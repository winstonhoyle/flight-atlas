import logging
import os
import time
from datetime import datetime
from urllib.parse import unquote

import boto3
import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.dataset as ds
import requests
import wikipedia
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

USER_AGENT = "FlightAtlasBot/1.0 (https://github.com/winstonhoyle)"

session = requests.Session()
session.headers.update({"User-Agent": USER_AGENT})

# Wikimedia rate-limits the wikipedia library's default User-Agent.
wikipedia.set_user_agent(USER_AGENT)

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


def fetch_soup(url: str):
    response = session.get(url)
    response.raise_for_status()
    return wiki_parse.soup_of(response.text)


def resolve_page(title: str):
    """Destination cells often link to redirects like "Toronto–Pearson"."""
    try:
        return wikipedia.page(title.replace("_", " "), auto_suggest=False, redirect=True)
    except (
        wikipedia.exceptions.PageError,
        wikipedia.exceptions.DisambiguationError,
    ) as e:
        logger.warning(f"Skipping link to {title!r}: {type(e).__name__}")
        return None


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

    destinations = []
    for tr in rows:
        row = wiki_parse.parse_destination_row(tr)
        if row is None:
            continue

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
            page = resolve_page(title)
            if page is None:
                continue
            dst_url = unquote(page.url)
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
    rows = []
    for airport in tqdm(listed, desc="Parsing Airports"):
        page = resolve_page(airport.airport_title) if airport.airport_title else None
        point = get_coordinate(unquote(page.url)) if page else None
        if page is None or point is None:
            failed.append(airport.airport_title or airport.iata)
            continue
        rows.append(
            {
                "FAA": airport.faa,
                "IATA": airport.iata,
                "ICAO": airport.icao,
                "url": unquote(page.url),
                "Role": airport.role,
                "Enplanements": airport.enplanements,
                "geometry": point,
                "title": page.title,
            }
        )
    # Busiest first, so the largest airlines' codes are looked up early.
    return pd.DataFrame(rows).sort_values("Enplanements", ascending=False).reset_index(drop=True)


def main() -> None:
    if IS_LOCAL_OUTPUT:
        os.makedirs(OUTPUT_BASE, exist_ok=True)

    failed: list[str] = []
    usa_airports_df = scrape_us_airports(failed)

    routes: list[list[str]] = []
    additional_destinations: dict = {}
    for i in tqdm(range(len(usa_airports_df)), desc="Parsing Airports"):
        src_iata = usa_airports_df.iloc[i]["IATA"]
        try:
            routes.extend(get_destinations(src_iata, usa_airports_df, additional_destinations))
        except Exception as e:
            failed.append(usa_airports_df.iloc[i]["url"])
            logger.error(f"Failure getting destinations, url: {usa_airports_df.iloc[i]['url']}, Exception: {e}")
        time.sleep(1)

    for item in failed:
        logger.error(f"Failed: {item}")

    write_outputs(usa_airports_df, routes, additional_destinations)


def write_outputs(usa_airports_df: pd.DataFrame, routes: list, additional_destinations: dict) -> None:
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

    routes_df["year"] = datetime.now().year
    routes_df["month"] = datetime.now().month

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

    airports_df["year"] = datetime.now().year
    airports_df["month"] = datetime.now().month

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

    airlines_df["year"] = datetime.now().year
    airlines_df["month"] = datetime.now().month

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
    main()
