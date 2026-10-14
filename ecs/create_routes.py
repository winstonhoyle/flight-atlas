import logging
import os
import sys
import time
from dataclasses import dataclass
from datetime import datetime

import boto3
import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.dataset as ds
import pyarrow.fs as pafs
import requests
from shapely import wkt
from shapely.geometry import Point
from tqdm import tqdm

import wiki_parse

# Load .env for local runs (no-op on ECS / if python-dotenv is absent).
try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

logger = logging.getLogger("flight_atlas")
logger.setLevel(logging.DEBUG)

console_handler = logging.StreamHandler()
console_handler.setLevel(logging.DEBUG)

formatter = logging.Formatter(
    "%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
console_handler.setFormatter(formatter)
logger.addHandler(console_handler)

S3_ROUTES_BUCKET = os.environ.get("S3_ROUTES_BUCKET", "bucket-flight-atlas-routes")
S3_RESULTS_BUCKET = os.environ.get("S3_RESULTS_BUCKET", "bucket-flight-atlas-query-results")
S3_PREFIX = os.environ.get("S3_PREFIX", "flights")
REGION = os.environ.get("REGION", "us-west-1")
DATABASE = os.environ.get("ATHENA_DB", "flights_db")

# Point OUTPUT_BASE at a local folder to write Parquet locally; Athena is
# skipped by default for non-s3 output.
OUTPUT_BASE = os.environ.get("OUTPUT_BASE") or f"s3://{S3_ROUTES_BUCKET}"
IS_LOCAL_OUTPUT = not OUTPUT_BASE.startswith("s3://")
RUN_ATHENA = os.environ.get("RUN_ATHENA", "false" if IS_LOCAL_OUTPUT else "true").lower() in ("1", "true", "yes")

SCRAPE_LIMIT = int(os.environ.get("SCRAPE_LIMIT", "0"))
AIRPORTS = {code.strip().upper() for code in os.environ.get("AIRPORTS", "").split(",") if code.strip()}

USER_AGENT = "FlightAtlasBot/1.0 (https://github.com/winstonhoyle)"

session = requests.Session()
session.headers.update({"User-Agent": USER_AGENT})
WIKI_API = "https://en.wikipedia.org/w/api.php"
RETRY_STATUSES = {429, 500, 502, 503, 504}

# Airlines whose Wikipedia pages have no IATA code.
airline_codes_dict = {
    "American Eagle": "AA",
    "Delta Connection": "DL",
    "United Express": "UA",
    "Sun Country Airlines": "SY",
    "Yute Commuter Service": "7H",
    "Alaska Air Transit": "JN",
    "Iliamna Air Taxi": "V8",
    "Katmai Air": "KT",
    "Reeve Air Alaska": "RV",
    "Alaska Seaplanes": "J5",
    "Smokey Bay Air": "2E",
    "Ward Air": "WD",
    "Island Air Express": "I4",
    "Air Excursions": "X4",
    "Air Canada Express": "AC",
    "Island Air Service": "WP",
    "Kenai Aviation": "KW",
    "Star Marianas Air": "S2",
    "Pathfinder Aviation": "PA",
    "Havana Air": "HV",
    "Fly The Whale": "FW",
    "San Juan Airlines": "SJ",
}


def get(url: str, attempts: int = 6, **params) -> requests.Response:
    """Wikimedia answers 429 when the scraper goes too fast; wait as long as it asks."""
    for attempt in range(attempts):
        response = session.get(url, params=params or None, timeout=30)
        if response.status_code not in RETRY_STATUSES or attempt == attempts - 1:
            break
        wait = int(response.headers.get("Retry-After") or 2**attempt)
        logger.warning(f"HTTP {response.status_code} from Wikipedia, retrying in {wait}s: {url}")
        time.sleep(wait)
    response.raise_for_status()
    return response


def fetch_soup(url: str):
    return wiki_parse.soup_of(get(url).text)


@dataclass(frozen=True)
class Page:
    title: str
    url: str


_pages: dict[str, Page | None] = {}


def resolve_pages(titles: list[str]) -> dict[str, Page | None]:
    """
    Follows redirects (destination cells link to titles like "Toronto–Pearson") 50 titles per
    API request, caching across airports. Missing and disambiguation pages map to None.
    """
    todo = [t for t in dict.fromkeys(titles) if t not in _pages]
    for start in range(0, len(todo), 50):
        batch = todo[start : start + 50]
        query = get(
            WIKI_API,
            action="query",
            format="json",
            formatversion=2,
            redirects=1,
            prop="pageprops",
            ppprop="disambiguation",
            titles="|".join(t.replace("_", " ") for t in batch),
        ).json()["query"]
        normalized = {n["from"]: n["to"] for n in query.get("normalized", [])}
        redirects = {r["from"]: r["to"] for r in query.get("redirects", [])}
        pages = {p["title"]: p for p in query.get("pages", [])}
        for title in batch:
            name = title.replace("_", " ")
            name = normalized.get(name, name)
            page = pages.get(redirects.get(name, name))
            if not page or page.get("missing") or page.get("invalid") or "disambiguation" in page.get("pageprops", {}):
                logger.warning(f"Skipping link to {title!r}: missing or disambiguation page")
                _pages[title] = None
            else:
                _pages[title] = Page(page["title"], wiki_parse.wiki_url(page["title"].replace(" ", "_")))
    return {t: _pages[t] for t in titles}


def get_airport_information(url: str) -> tuple[str, Point] | None:
    soup = fetch_soup(url)
    iata = wiki_parse.parse_iata(soup)
    coordinates = wiki_parse.parse_coordinates(soup)
    if not iata or not coordinates:
        logger.error(f"Unable to read IATA code or coordinates, url: {url}")
        return None
    return iata, Point(*coordinates)


def get_airline_code(url: str, name: str) -> str | None:
    if name in airline_codes_dict:
        return airline_codes_dict[name]
    code = wiki_parse.parse_airline_code(fetch_soup(url))
    if code is None:
        logger.error(f"Cannot find airline code, url: {url}, name: {name}")
        return None
    airline_codes_dict[name] = code
    logger.info(f"Added new airline code, name: {name}, code: {code}")
    return code


def get_coordinate(url: str) -> Point | None:
    coordinates = wiki_parse.parse_coordinates(fetch_soup(url))
    if coordinates is None:
        logger.error(f"Cannot find coordinates, url: {url}")
        return None
    return Point(*coordinates)


def get_destinations(src_iata: str, airports_df: pd.DataFrame, additional_destinations: dict) -> list[list[str]]:
    matches = airports_df.loc[airports_df["IATA"] == src_iata, "url"]
    if matches.empty:
        return []
    url = matches.iloc[0]

    try:
        rows = wiki_parse.find_destination_rows(fetch_soup(url))
    except LookupError as e:
        logger.error(f"Cannot find destination table, url: {url}, {e}")
        return []

    parsed = [row for row in map(wiki_parse.parse_destination_row, rows) if row]
    pages = resolve_pages([title for row in parsed for title in row.destination_titles])

    destinations = []
    for row in parsed:
        if row.airline_name in airline_codes_dict:
            airline_code = airline_codes_dict[row.airline_name]
        elif row.airline_title:
            airline_code = get_airline_code(wiki_parse.wiki_url(row.airline_title), row.airline_name)
        else:
            logger.error(f"Airline has no link or known code, url: {url}, name: {row.airline_name}")
            continue
        if not airline_code:
            continue

        for title in row.destination_titles:
            page = pages[title]
            if page is None:
                continue
            dst_url = page.url
            known = airports_df.loc[airports_df["url"] == dst_url, "IATA"]

            if not known.empty:
                # Both ends are U.S. airports; the reverse route comes from the other page.
                destinations.append([airline_code, src_iata, known.iloc[0]])
                continue

            if dst_url not in additional_destinations:
                logger.debug(f"Adding new airport, {row.airline_name} flying to {dst_url}")
                info = get_airport_information(dst_url)
                if info is None:
                    continue
                additional_destinations[dst_url] = {
                    "IATA": info[0],
                    "geometry": info[1],
                    "url": dst_url,
                    "title": page.title,
                }

            # International and remote airports have no page of their own here, so add both ways.
            dst_iata = additional_destinations[dst_url]["IATA"]
            destinations.append([airline_code, src_iata, dst_iata])
            destinations.append([airline_code, dst_iata, src_iata])

    return destinations


def scrape_us_airports(failed: list[str]) -> pd.DataFrame:
    soup = fetch_soup("https://en.wikipedia.org/wiki/List_of_airports_in_the_United_States")
    listed = sorted(
        wiki_parse.parse_airport_list(soup),
        key=lambda a: a.enplanements or 0,
        reverse=True,
    )
    if SCRAPE_LIMIT:
        listed = listed[:SCRAPE_LIMIT]
    pages = resolve_pages([a.airport_title for a in listed if a.airport_title])
    rows = []
    for airport in tqdm(listed, desc="Parsing Airports"):
        page = pages.get(airport.airport_title) if airport.airport_title else None
        point = get_coordinate(page.url) if page else None
        if page is None or point is None:
            failed.append(airport.airport_title or airport.iata)
            continue
        rows.append(
            {
                "FAA": airport.faa,
                "IATA": airport.iata,
                "ICAO": airport.icao,
                "url": page.url,
                "Role": airport.role,
                "Enplanements": airport.enplanements,
                "geometry": point,
                "title": page.title,
            }
        )
    # Busiest first, so the largest airlines' codes are looked up early.
    return pd.DataFrame(rows).sort_values("Enplanements", ascending=False).reset_index(drop=True)


def snapshot_dir(dataset: str, snapshot: tuple[int, int]) -> str:
    year, month = snapshot
    return f"{OUTPUT_BASE}/{dataset}/year={year}/month={month}"


def _filesystem(uri: str) -> tuple[pafs.FileSystem, str]:
    return pafs.FileSystem.from_uri(uri if not IS_LOCAL_OUTPUT else os.path.abspath(uri))


def read_snapshot(dataset: str, snapshot: tuple[int, int]) -> pd.DataFrame:
    fs, path = _filesystem(snapshot_dir(dataset, snapshot))
    if fs.get_file_info(path).type == pafs.FileType.NotFound:
        return pd.DataFrame()
    return ds.dataset(path, filesystem=fs, format="parquet", partitioning="hive").to_table().to_pandas()


def clear_snapshot(snapshot: tuple[int, int]) -> None:
    for dataset in (S3_PREFIX, "airports", "airlines"):
        fs, path = _filesystem(snapshot_dir(dataset, snapshot))
        if fs.get_file_info(path).type != pafs.FileType.NotFound:
            fs.delete_dir(path)


def merge_into_snapshot(
    new_routes: list[list[str]],
    targets: set[str],
    us_iatas: set[str],
    existing_flights: pd.DataFrame,
    existing_airports: pd.DataFrame,
    additional_destinations: dict,
) -> list[list[str]]:
    """
    Replaces the targets' routes in an existing snapshot. A target's page also produced the
    return legs from foreign airports, so those go too; routes from other U.S. airports stay.
    """
    src, dst = existing_flights["src_airport"], existing_flights["dst_airport"]
    replaced = src.isin(targets) | (dst.isin(targets) & ~src.isin(us_iatas))
    kept = existing_flights.loc[~replaced, ["airline_code", "src_airport", "dst_airport"]]

    known = {info["IATA"] for info in additional_destinations.values()}
    still_served = set(kept["src_airport"]) | set(kept["dst_airport"])
    for row in existing_airports.itertuples():
        if row.IATA in still_served and row.IATA not in us_iatas and row.IATA not in known:
            additional_destinations[row.url] = {
                "IATA": row.IATA,
                "geometry": wkt.loads(row.geometry),
                "url": row.url,
                "title": row.title,
            }
    return kept.values.tolist() + new_routes


def check_airport(url: str) -> list[str]:
    """Problems with one airport's page, using the same parsers as a scrape."""
    soup = fetch_soup(url)
    problems = []
    if wiki_parse.parse_coordinates(soup) is None:
        problems.append("no coordinates")
    try:
        rows = [row for row in map(wiki_parse.parse_destination_row, wiki_parse.find_destination_rows(soup)) if row]
    except LookupError as e:
        return problems + [str(e)]
    if not rows:
        problems.append("destinations table has no rows")
    for row in rows:
        if not row.airline_title and row.airline_name not in airline_codes_dict:
            problems.append(f"airline without a link or known code: {row.airline_name}")
        if not row.destination_titles:
            problems.append(f"no destination links for {row.airline_name}")
    return problems


def check_airports() -> int:
    """Reads every listed airport's page without writing anything. Returns the number of airports with problems."""
    soup = fetch_soup("https://en.wikipedia.org/wiki/List_of_airports_in_the_United_States")
    listed = [a for a in wiki_parse.parse_airport_list(soup) if not AIRPORTS or a.iata in AIRPORTS]
    pages = resolve_pages([a.airport_title for a in listed if a.airport_title])
    report: dict[str, list[str]] = {}
    for airport in tqdm(listed, desc="Checking airports"):
        page = pages.get(airport.airport_title) if airport.airport_title else None
        if page is None:
            report[airport.iata] = ["no Wikipedia page"]
            continue
        try:
            problems = check_airport(page.url)
        except Exception as e:
            problems = [f"{type(e).__name__}: {e}"]
        if problems:
            report[airport.iata] = problems

    for iata, problems in sorted(report.items()):
        for problem in problems:
            print(f"{iata}  {problem}")
    print(f"{len(listed) - len(report)} of {len(listed)} airports parse cleanly.")
    if report:
        print(f"Recheck after a fix with: make scrape-check AIRPORTS={','.join(sorted(report))}")
    return len(report)


def main() -> None:
    if IS_LOCAL_OUTPUT:
        os.makedirs(OUTPUT_BASE, exist_ok=True)
    snapshot = (datetime.now().year, datetime.now().month)

    failed: list[str] = []
    usa_airports_df = scrape_us_airports(failed)
    us_iatas = set(usa_airports_df["IATA"])

    targets = usa_airports_df
    if AIRPORTS:
        unknown = AIRPORTS - us_iatas
        if unknown:
            raise SystemExit(f"Not in the U.S. airport list: {', '.join(sorted(unknown))}")
        targets = usa_airports_df[usa_airports_df["IATA"].isin(AIRPORTS)]

    routes: list[list[str]] = []
    additional_destinations: dict = {}
    for i in tqdm(range(len(targets)), desc="Parsing Airports"):
        src_iata = targets.iloc[i]["IATA"]
        try:
            routes.extend(get_destinations(src_iata, usa_airports_df, additional_destinations))
        except Exception as e:
            failed.append(targets.iloc[i]["url"])
            logger.error(f"Failure getting destinations, url: {targets.iloc[i]['url']}, Exception: {e}")
        time.sleep(1)

    for item in failed:
        logger.error(f"Failed: {item}")
    failed_iatas = sorted(set(usa_airports_df.loc[usa_airports_df["url"].isin(failed), "IATA"]))
    if failed_iatas:
        logger.error(f"Retry just these after the run: make scrape AIRPORTS={','.join(failed_iatas)}")

    if AIRPORTS:
        existing_flights = read_snapshot(S3_PREFIX, snapshot)
        if existing_flights.empty:
            raise SystemExit(f"No {snapshot[0]}-{snapshot[1]:02d} snapshot to update. Run a full scrape first.")
        routes = merge_into_snapshot(
            routes,
            AIRPORTS,
            us_iatas,
            existing_flights,
            read_snapshot("airports", snapshot),
            additional_destinations,
        )

    write_outputs(usa_airports_df, routes, additional_destinations, snapshot)


def write_outputs(
    usa_airports_df: pd.DataFrame, routes: list, additional_destinations: dict, snapshot: tuple[int, int]
) -> None:
    additional_airports_df = pd.DataFrame([airline_dict for _, airline_dict in additional_destinations.items()])

    routes_df = pd.DataFrame(routes, columns=["airline_code", "src_airport", "dst_airport"])

    routes_df = routes_df.merge(
        usa_airports_df.rename(columns={"IATA": "src_airport", "geometry": "geometry_src"})[
            ["src_airport", "geometry_src"]
        ],
        on="src_airport",
        how="left",
    )
    routes_df = routes_df.merge(
        usa_airports_df.rename(columns={"IATA": "dst_airport", "geometry": "geometry_dst"})[
            ["dst_airport", "geometry_dst"]
        ],
        on="dst_airport",
        how="left",
    )

    if len(additional_airports_df) > 0:
        routes_df = routes_df.merge(
            additional_airports_df.rename(columns={"IATA": "dst_airport", "geometry": "geometry_dst_new"}),
            on="dst_airport",
            how="left",
        )
        routes_df = routes_df.merge(
            additional_airports_df.rename(columns={"IATA": "src_airport", "geometry": "geometry_src_new"}),
            on="src_airport",
            how="left",
        )

        # U.S. airports' geometry comes from the first merge, foreign airports' from this one.
        routes_df["geometry_src"] = routes_df["geometry_src"].combine_first(routes_df["geometry_src_new"])
        routes_df["geometry_dst"] = routes_df["geometry_dst"].combine_first(routes_df["geometry_dst_new"])

    routes_df["src_geometry"] = routes_df["geometry_src"].apply(lambda g: g.wkt)
    routes_df["dst_geometry"] = routes_df["geometry_dst"].apply(lambda g: g.wkt)

    # An unordered pair, so A to B and B to A count as one route.
    routes_df["airport1"] = routes_df[["src_airport", "dst_airport"]].min(axis=1)
    routes_df["airport2"] = routes_df[["src_airport", "dst_airport"]].max(axis=1)

    unique_routes = routes_df.drop_duplicates(subset=["airline_code", "airport1", "airport2"])

    route_counts = unique_routes.groupby("airline_code").size().reset_index(name="route_count")

    airlines_df = pd.DataFrame(airline_codes_dict.items(), columns=["name", "airline_code"])

    airlines_df = airlines_df.merge(route_counts, on="airline_code")
    airlines_df = airlines_df.sort_values("route_count", ascending=False)

    routes_df = routes_df[["airline_code", "src_airport", "dst_airport", "src_geometry", "dst_geometry"]]

    routes_df["year"], routes_df["month"] = snapshot

    clear_snapshot(snapshot)
    routes_table = pa.Table.from_pandas(routes_df)

    routes_dir = f"{OUTPUT_BASE}/{S3_PREFIX}/"
    logger.info(f"Writing Routes to to {routes_dir}")

    ds.write_dataset(
        routes_table,
        base_dir=routes_dir,
        format="parquet",
        partitioning=["year", "month", "airline_code", "src_airport"],
        partitioning_flavor="hive",
        existing_data_behavior="overwrite_or_ignore",
        max_partitions=10_000,
    )

    airports_df = pd.concat([usa_airports_df, additional_airports_df], ignore_index=True)[
        ["FAA", "IATA", "url", "geometry", "title"]
    ]

    unique_pairs_count = routes_df.groupby("src_airport")["dst_airport"].nunique().reset_index()
    unique_pairs_count.rename(columns={"src_airport": "IATA", "dst_airport": "destinations"}, inplace=True)
    airports_df = airports_df.merge(unique_pairs_count, on="IATA", how="left")
    airports_df = airports_df.replace(np.nan, 0.0)
    airports_df["destinations"] = airports_df["destinations"].astype(int)
    airports_df[["FAA", "IATA", "url", "title"]] = airports_df[["FAA", "IATA", "url", "title"]].astype(str)

    airports_df["geometry"] = airports_df["geometry"].apply(lambda g: g.wkt)

    airports_df["year"], airports_df["month"] = snapshot

    airport_table = pa.Table.from_pandas(airports_df)

    airports_dir = f"{OUTPUT_BASE}/airports/"
    logger.info(f"Writing airports to {airports_dir}")

    ds.write_dataset(
        data=airport_table,
        base_dir=airports_dir,
        format="parquet",
        partitioning=["year", "month"],
        partitioning_flavor="hive",
        existing_data_behavior="overwrite_or_ignore",
        basename_template="part-{i}.parquet",
        filesystem=None,
    )

    airlines_df[["name", "airline_code"]] = airlines_df[["name", "airline_code"]].astype(str)
    airlines_df["route_count"] = airlines_df["route_count"].astype(int)

    airlines_df["year"], airlines_df["month"] = snapshot

    airlines_table = pa.Table.from_pandas(airlines_df)

    airlines_dir = f"{OUTPUT_BASE}/airlines/"
    logger.info(f"Writing Airlines to to {airlines_dir}")

    ds.write_dataset(
        data=airlines_table,
        base_dir=airlines_dir,
        format="parquet",
        partitioning=["year", "month"],
        partitioning_flavor="hive",
        existing_data_behavior="overwrite_or_ignore",
        basename_template="part-{i}.parquet",
        filesystem=None,
    )

    if not RUN_ATHENA:
        logger.info("RUN_ATHENA disabled; skipping Athena MSCK REPAIR step.")
    else:
        logger.info("Enabling tables for Athena")
        athena = boto3.client("athena", region_name=REGION)
        athena_output_dir = f"s3://{S3_RESULTS_BUCKET}/"

        for table in ["airports", "flights", "airlines"]:
            query = f"MSCK REPAIR TABLE {table};"

            response = athena.start_query_execution(
                QueryString=query,
                QueryExecutionContext={"Database": DATABASE},
                ResultConfiguration={"OutputLocation": athena_output_dir},
            )
            query_execution_id = response["QueryExecutionId"]
            logger.info(f"Athena query ({table}) started: {query_execution_id}")

            while True:
                status = athena.get_query_execution(QueryExecutionId=query_execution_id)
                state = status["QueryExecution"]["Status"]["State"]

                if state in ["SUCCEEDED", "FAILED", "CANCELLED"]:
                    break
                time.sleep(2)

            if state == "SUCCEEDED":
                logger.info("MSCK REPAIR TABLE completed successfully!")
            else:
                logger.error(f"Query failed or cancelled: {state}")


if __name__ == "__main__":
    if "--check" in sys.argv:
        sys.exit(1 if check_airports() else 0)
    main()
