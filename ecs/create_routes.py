import json
import logging
import os
import posixpath
import re
import shutil
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass
from datetime import datetime
from functools import cache
from urllib.parse import urlparse

import boto3
import pandas as pd
import requests
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

# Keeps the last runs' output for debugging a crash; *.log is gitignored.
file_handler = logging.FileHandler(os.path.join(os.path.dirname(os.path.abspath(__file__)), "scrape.log"))
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)

REPORT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "scrape-report.json")


class _Problems(logging.Handler):
    """Collects this run's warnings and errors for scrape-report.json."""

    def __init__(self):
        super().__init__(logging.WARNING)
        self.records: list[dict] = []

    def emit(self, record: logging.LogRecord) -> None:
        self.records.append({"level": record.levelname, "message": record.getMessage()})


problems = _Problems()
logger.addHandler(problems)
report: dict = {}

# This run's unreadable pages, by airport and airline, for the month's problems.json.
found_problems: list[dict] = []


def note_problem(
    kind: str, message: str, *, airport: str | None = None, airline: str | None = None, url: str | None = None
) -> None:
    logger.error(f"{message}, url: {url}" if url else message)
    found_problems.append({"kind": kind, "airport": airport, "airline": airline, "url": url, "message": message})


S3_ROUTES_BUCKET = os.environ.get("S3_ROUTES_BUCKET", "bucket-flight-atlas-routes")
REGION = os.environ.get("REGION", "us-west-1")

# Point OUTPUT_BASE at a local folder to write the JSON there instead of S3.
OUTPUT_BASE = os.environ.get("OUTPUT_BASE") or f"s3://{S3_ROUTES_BUCKET}"
IS_LOCAL_OUTPUT = not OUTPUT_BASE.startswith("s3://")

SCRAPE_LIMIT = int(os.environ.get("SCRAPE_LIMIT", "0"))
AIRPORTS = {code.strip().upper() for code in os.environ.get("AIRPORTS", "").split(",") if code.strip()}
COUNTRIES = {code.strip().upper() for code in os.environ.get("COUNTRIES", "").split(",") if code.strip()}

USER_AGENT = "FlightAtlasBot/1.0 (https://github.com/winstonhoyle)"

session = requests.Session()
session.headers.update({"User-Agent": USER_AGENT})
WIKI_API = "https://en.wikipedia.org/w/api.php"
RETRY_STATUSES = {429, 500, 502, 503, 504}

# Brands filed under their parent, spelling variants, and airlines with no code on Wikipedia.
# An airline with no code at all gets a made-up one with a digit and 3 characters (9RV), which no real code can be.
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "airlines.json"), encoding="utf-8") as f:
    AIRLINES: dict[str, dict] = json.load(f)
airline_codes_dict = {name: entry["code"] for name, entry in AIRLINES.items()}


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
    revid: int | None = None


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
            prop="pageprops|info",
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
                url = wiki_parse.wiki_url(page["title"].replace(" ", "_"))
                _pages[title] = Page(page["title"], url, page.get("lastrevid"))
    return {t: _pages[t] for t in titles}


def get_airport_information(url: str) -> tuple[str, Point] | None:
    soup = fetch_soup(url)
    iata = wiki_parse.parse_iata(soup)
    coordinates = wiki_parse.parse_coordinates(soup)
    if not iata or not coordinates:
        return None
    return iata, Point(*coordinates)


def get_airline_code(url: str, name: str) -> str | None:
    if name in airline_codes_dict:
        return airline_codes_dict[name]
    code = wiki_parse.parse_airline_code(fetch_soup(url))
    if code is None:
        return None
    airline_codes_dict[name] = code
    logger.info(f"Added new airline code, name: {name}, code: {code}")
    return code


# Bump after any wiki_parse change, so saved pages are parsed again.
PARSER_VERSION = 1
PAGE_CACHE = "cache/pages.json"

# Airport page URL to what was parsed from it, at which revision. Saved with each snapshot.
page_cache: dict[str, dict] = {}


def load_page_cache(full: bool) -> dict[str, dict]:
    """The saved pages, or none with --full (a template edit can change a table without a new revision)."""
    if full:
        return {}
    try:
        saved = _read_json(PAGE_CACHE)
    except Exception as e:
        logger.warning(f"Unreadable {PAGE_CACHE}, so every page is downloaded: {e}")
        return {}
    return saved if isinstance(saved, dict) else {}


def read_airport_page(url: str, revid: int | None) -> dict:
    """
    Coordinates and destination rows (or why there are none) from one download, or from
    page_cache when the page and parser haven't changed since.
    """
    saved = page_cache.get(url)
    if revid is not None and saved and saved.get("revid") == revid and saved.get("parser") == PARSER_VERSION:
        return saved
    soup = fetch_soup(url)
    time.sleep(1)
    parsed = {"revid": revid, "parser": PARSER_VERSION, "coordinates": wiki_parse.parse_coordinates(soup)}
    try:
        rows = map(wiki_parse.parse_destination_row, wiki_parse.find_destination_rows(soup))
        parsed |= {"rows": [asdict(row) for row in rows if row], "error": None}
    except LookupError as e:
        parsed |= {"rows": None, "error": str(e)}
    page_cache[url] = parsed
    return parsed


def get_destinations(src_iata: str, airports_df: pd.DataFrame, additional_destinations: dict) -> list[list[str]]:
    matches = airports_df[airports_df["IATA"] == src_iata]
    if matches.empty:
        return []
    url = matches["url"].iloc[0]
    revid = matches["revid"].iloc[0] if "revid" in matches else None

    page = read_airport_page(url, None if pd.isna(revid) else int(revid))
    if page["rows"] is None:
        note_problem(
            "destinations_table", f"{page['error']}, so none of its routes were read", airport=src_iata, url=url
        )
        return []

    parsed = [wiki_parse.DestinationRow(**row) for row in page["rows"]]
    pages = resolve_pages([title for row in parsed for title in row.destination_titles])

    destinations = []
    for row in parsed:
        if row.airline_name in airline_codes_dict:
            airline_code = airline_codes_dict[row.airline_name]
        elif row.airline_title:
            airline_url = wiki_parse.wiki_url(row.airline_title)
            airline_code = get_airline_code(airline_url, row.airline_name)
            if not airline_code:
                note_problem(
                    "airline_code",
                    "The airline's page has no IATA or ICAO code, so its routes here were skipped",
                    airport=src_iata,
                    airline=row.airline_name,
                    url=airline_url,
                )
                continue
        else:
            note_problem(
                "airline_link",
                "The airline isn't linked to its page and has no known code, so its routes here were skipped",
                airport=src_iata,
                airline=row.airline_name,
                url=url,
            )
            continue

        for title in row.destination_titles:
            page = pages[title]
            if page is None:
                continue
            dst_url = page.url
            known = airports_df.loc[airports_df["url"] == dst_url, "IATA"]

            if not known.empty:
                # Both ends are listed airports; the reverse route comes from the other page.
                destinations.append([airline_code, src_iata, known.iloc[0]])
                continue

            if dst_url not in additional_destinations:
                logger.debug(f"Adding new airport, {row.airline_name} flying to {dst_url}")
                info = get_airport_information(dst_url)
                if info is None:
                    note_problem(
                        "destination_page",
                        f"Skipped {page.title}: its page has no readable IATA code or coordinates",
                        airport=src_iata,
                        url=dst_url,
                    )
                    continue
                additional_destinations[dst_url] = {
                    "IATA": info[0],
                    "geometry": info[1],
                    "url": dst_url,
                    "title": page.title,
                }

            # Unlisted airports (overseas, remote villages) aren't scraped themselves, so add both ways.
            dst_iata = additional_destinations[dst_url]["IATA"]
            destinations.append([airline_code, src_iata, dst_iata])
            destinations.append([airline_code, dst_iata, src_iata])

    return destinations


def list_airports() -> list[tuple[str, wiki_parse.ListedAirport]]:
    """(country, airport) from every country's list pages, deduplicated by IATA, busiest first."""
    canada_index = fetch_soup(wiki_parse.wiki_url("List_of_airports_in_Canada"))
    airport_lists = {
        "US": ["List_of_airports_in_the_United_States"],
        "MX": ["List_of_airports_in_Mexico"],
        "CA": wiki_parse.parse_list_links(canada_index, "List_of_airports_in_Canada_("),
    }
    unknown = COUNTRIES - airport_lists.keys()
    if unknown:
        raise SystemExit(f"Unknown COUNTRIES: {', '.join(sorted(unknown))}. Use {', '.join(airport_lists)}")

    listed: dict[str, tuple[str, wiki_parse.ListedAirport]] = {}
    for country, titles in airport_lists.items():
        for title in titles:
            for airport in wiki_parse.parse_airport_list(fetch_soup(wiki_parse.wiki_url(title))):
                kept = listed.get(airport.iata)
                # Lists can share a code between an airport and a base or water aerodrome (YWG, YBL).
                if kept is None or ("Airport" in airport.airport_title and "Airport" not in kept[1].airport_title):
                    listed[airport.iata] = (country, airport)
    # Busiest first, so the largest airlines' codes are looked up early.
    return sorted(listed.values(), key=lambda item: (item[1].enplanements is None, -(item[1].enplanements or 0)))


def is_target(country: str, iata: str) -> bool:
    return iata in AIRPORTS or country in COUNTRIES


def scrape_listed_airports(failed: list[str], known_points: dict[str, Point]) -> pd.DataFrame:
    """Every listed airport with its coordinates. Non-targets reuse `known_points` (IATA to Point) when present."""
    listed = list_airports()
    if SCRAPE_LIMIT:
        listed = listed[:SCRAPE_LIMIT]
    pages = resolve_pages([a.airport_title for _, a in listed])
    rows = []
    for country, airport in tqdm(listed, desc="Parsing Airports"):
        page = pages.get(airport.airport_title)
        point = None if is_target(country, airport.iata) else known_points.get(airport.iata)
        if page is None:
            note_problem(
                "airport_page",
                "The airport list links to a missing or disambiguation page",
                airport=airport.iata,
                url=wiki_parse.wiki_url(airport.airport_title),
            )
        elif point is None:
            coordinates = read_airport_page(page.url, page.revid)["coordinates"]
            point = Point(*coordinates) if coordinates else None
            if point is None:
                note_problem("coordinates", "The page has no readable coordinates", airport=airport.iata, url=page.url)
        if page is None or point is None:
            failed.append(airport.airport_title)
            continue
        rows.append(
            {
                "FAA": airport.faa,
                "IATA": airport.iata,
                "City": airport.city,
                "ICAO": airport.icao,
                "Country": country,
                "url": page.url,
                "Role": airport.role,
                "Enplanements": airport.enplanements,
                "geometry": point,
                "title": page.title,
                "revid": page.revid,
            }
        )
    return pd.DataFrame(rows)


def airline_names() -> dict[str, str]:
    """Code to name: the registry's display name, else the first name seen with that code."""
    names = {entry["code"]: name for name, entry in AIRLINES.items() if entry.get("display")}
    for name, code in airline_codes_dict.items():
        names.setdefault(code, name)
    return names


SNAPSHOT_FILES = ("airports.json", "airlines.json", "routes.json", "problems.json")
SNAPSHOT_KEY = re.compile(r"(\d{4})/(\d{2})/routes\.json")


def snapshot_prefix(snapshot: tuple[int, int]) -> str:
    year, month = snapshot
    return f"{year}/{month:02d}/"


@cache
def _s3():
    return boto3.client("s3", region_name=REGION)


def _bucket_and_key(uri: str) -> tuple[str, str]:
    parsed = urlparse(uri)
    return parsed.netloc, parsed.path.lstrip("/")


def _s3_key(key: str) -> tuple[str, str]:
    bucket, prefix = _bucket_and_key(OUTPUT_BASE)
    return bucket, posixpath.join(prefix, key)


def _dump(path: str, body) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(body, f, separators=(",", ":"))


def _read_json(key: str):
    if IS_LOCAL_OUTPUT:
        path = os.path.join(OUTPUT_BASE, key)
        if not os.path.exists(path):
            return None
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    bucket, key = _s3_key(key)
    try:
        return json.loads(_s3().get_object(Bucket=bucket, Key=key)["Body"].read())
    except _s3().exceptions.NoSuchKey:
        return None


def _keys() -> list[str]:
    if IS_LOCAL_OUTPUT:
        return [
            os.path.relpath(os.path.join(root, name), OUTPUT_BASE).replace(os.sep, "/")
            for root, _, names in os.walk(OUTPUT_BASE)
            for name in names
        ]
    bucket, prefix = _bucket_and_key(OUTPUT_BASE)
    prefix = prefix and prefix.rstrip("/") + "/"
    pages = _s3().get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix=prefix)
    return [obj["Key"][len(prefix) :] for page in pages for obj in page.get("Contents", [])]


def read_snapshot(snapshot: tuple[int, int]) -> tuple[pd.DataFrame, pd.DataFrame]:
    prefix = snapshot_prefix(snapshot)
    routes = _read_json(prefix + "routes.json") or []
    airports = (_read_json(prefix + "airports.json") or {}).get("features", [])
    flights_df = pd.DataFrame(routes, columns=["airline_code", "src_airport", "dst_airport"])
    airports_df = pd.DataFrame(
        [
            {
                "FAA": f["properties"].get("FAA"),
                "IATA": f["properties"]["IATA"],
                "City": f["properties"].get("City"),
                "url": f["properties"]["url"],
                "title": f["properties"]["Name"],
                "geometry": Point(f["geometry"]["coordinates"]),
            }
            for f in airports
        ],
        columns=["FAA", "IATA", "City", "url", "title", "geometry"],
    )
    return flights_df, airports_df


def latest_snapshot() -> tuple[int, int] | None:
    return max(((int(m[1]), int(m[2])) for key in _keys() if (m := SNAPSHOT_KEY.fullmatch(key))), default=None)


def clear_snapshot(snapshot: tuple[int, int]) -> None:
    prefix = snapshot_prefix(snapshot)
    if IS_LOCAL_OUTPUT:
        shutil.rmtree(os.path.join(OUTPUT_BASE, prefix), ignore_errors=True)
        return
    bucket, key_prefix = _s3_key(prefix)
    for page in _s3().get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix=key_prefix):
        keys = [{"Key": obj["Key"]} for obj in page.get("Contents", [])]
        if keys:
            _s3().delete_objects(Bucket=bucket, Delete={"Objects": keys})


def write_snapshot_list() -> list[tuple[int, int]]:
    found = sorted({(int(m[1]), int(m[2])) for key in _keys() if (m := SNAPSHOT_KEY.fullmatch(key))}, reverse=True)
    body = [{"month": str(month), "year": str(year)} for year, month in found]
    if IS_LOCAL_OUTPUT:
        _dump(os.path.join(OUTPUT_BASE, "snapshots.json"), body)
    else:
        bucket, key = _s3_key("snapshots.json")
        _s3().put_object(Bucket=bucket, Key=key, Body=json.dumps(body), ContentType="application/json")
    return found


def airports_body(airports_df: pd.DataFrame) -> dict:
    features = [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(row.geometry.x, 6), round(row.geometry.y, 6)]},
            "properties": {
                "FAA": row.FAA if isinstance(row.FAA, str) and row.FAA else None,
                "IATA": row.IATA,
                "Name": row.title,
                "City": row.City if isinstance(row.City, str) and row.City else None,
                "url": row.url,
                "destinations": int(row.destinations),
            },
        }
        for row in airports_df.itertuples()
    ]
    return {"type": "FeatureCollection", "features": features}


def upload_dir(local_dir: str) -> None:
    bucket, prefix = _bucket_and_key(OUTPUT_BASE)
    files = [os.path.join(root, name) for root, _, names in os.walk(local_dir) for name in names]

    def upload(path: str) -> None:
        key = posixpath.join(prefix, os.path.relpath(path, local_dir).replace(os.sep, "/"))
        _s3().upload_file(path, bucket, key)

    with ThreadPoolExecutor(max_workers=16) as pool:
        list(pool.map(upload, files))
    logger.info(f"Uploaded {len(files)} files to s3://{bucket}/{prefix}")


def load_airline_codes(snapshot: tuple[int, int]) -> None:
    """Adds the snapshot's airline names, so airlines on carried-over routes stay in airlines.json."""
    for code, name in (_read_json(snapshot_prefix(snapshot) + "airlines.json") or {}).items():
        airline_codes_dict.setdefault(name, code)


def one_sided_routes(routes: list[list[str]], scraped_iatas: set[str]) -> list[dict]:
    """Legs between two scraped airports whose reverse leg the other airport's page doesn't list."""
    legs = {tuple(r) for r in routes}
    # Airports with no outgoing legs had no readable table; check_airport reports those already.
    has_table = {src for _, src, _ in legs}
    return [
        {"airline": airline, "listed_by": src, "missing_from": dst}
        for airline, src, dst in sorted(legs)
        if src in scraped_iatas and dst in scraped_iatas and dst in has_table and (airline, dst, src) not in legs
    ]


def merge_into_snapshot(
    new_routes: list[list[str]],
    targets: set[str],
    scraped_iatas: set[str],
    existing_flights: pd.DataFrame,
    existing_airports: pd.DataFrame,
    additional_destinations: dict,
) -> list[list[str]]:
    """
    Replaces the targets' routes in an existing snapshot. A target's page also produced the
    return legs from unlisted airports, so those go too; routes from other listed airports stay.
    """
    src, dst = existing_flights["src_airport"], existing_flights["dst_airport"]
    replaced = src.isin(targets) | (dst.isin(targets) & ~src.isin(scraped_iatas))
    kept = existing_flights.loc[~replaced, ["airline_code", "src_airport", "dst_airport"]]

    known = {info["IATA"] for info in additional_destinations.values()}
    still_served = set(kept["src_airport"]) | set(kept["dst_airport"])
    for row in existing_airports.itertuples():
        if row.IATA in still_served and row.IATA not in scraped_iatas and row.IATA not in known:
            additional_destinations[row.url] = {
                "IATA": row.IATA,
                "geometry": row.geometry,
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
    listed = [a for country, a in list_airports() if not (AIRPORTS or COUNTRIES) or is_target(country, a.iata)]
    pages = resolve_pages([a.airport_title for a in listed])
    report: dict[str, list[str]] = {}
    for airport in tqdm(listed, desc="Checking airports"):
        page = pages.get(airport.airport_title)
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
    partial = bool(AIRPORTS or COUNTRIES)
    page_cache.update(load_page_cache("--full" in sys.argv))
    logger.info(f"{len(page_cache)} saved airport pages")

    known_points: dict[str, Point] = {}
    if partial:
        existing_flights, existing_airports = read_snapshot(snapshot)
        if existing_flights.empty:
            raise SystemExit(f"No {snapshot[0]}-{snapshot[1]:02d} snapshot to update. Run a full scrape first.")
        known_points = dict(zip(existing_airports["IATA"], existing_airports["geometry"], strict=True))
        load_airline_codes(snapshot)

    failed: list[str] = []
    listed_airports_df = scrape_listed_airports(failed, known_points)
    scraped_iatas = set(listed_airports_df["IATA"])

    targets = listed_airports_df
    if partial:
        unknown = AIRPORTS - scraped_iatas
        if unknown:
            raise SystemExit(f"Not in the airport lists: {', '.join(sorted(unknown))}")
        targets = listed_airports_df[
            listed_airports_df["IATA"].isin(AIRPORTS) | listed_airports_df["Country"].isin(COUNTRIES)
        ]

    routes: list[list[str]] = []
    additional_destinations: dict = {}
    for i in tqdm(range(len(targets)), desc="Parsing Airports"):
        src_iata = targets.iloc[i]["IATA"]
        try:
            routes.extend(get_destinations(src_iata, listed_airports_df, additional_destinations))
        except Exception as e:
            failed.append(targets.iloc[i]["url"])
            logger.error(f"Failure getting destinations, url: {targets.iloc[i]['url']}, Exception: {e}")

    for item in failed:
        logger.error(f"Failed: {item}")
    failed_iatas = sorted(set(listed_airports_df.loc[listed_airports_df["url"].isin(failed), "IATA"]))
    retry = f"make scrape AIRPORTS={','.join(failed_iatas)}" if failed_iatas else None
    if retry:
        logger.error(f"Retry just these after the run: {retry}")

    if partial:
        routes = merge_into_snapshot(
            routes,
            set(targets["IATA"]),
            scraped_iatas,
            existing_flights,
            existing_airports,
            additional_destinations,
        )

    one_sided = one_sided_routes(routes, scraped_iatas)
    logger.info(f"{len(one_sided)} routes are listed by only one of their airports; see {REPORT_PATH}")
    names = airline_names()
    month_problems = found_problems + [
        {
            "kind": "one_sided_route",
            "airport": r["missing_from"],
            "airline": names.get(r["airline"], r["airline"]),
            "url": None,
            "message": f"{r['listed_by']}'s page lists this airline's route here, but this airport's page doesn't",
        }
        for r in one_sided
    ]
    if partial:
        month_problems += kept_problems(snapshot, set(targets["IATA"]))
    report.update(
        snapshot=f"{snapshot[0]}-{snapshot[1]:02d}",
        airports=sorted(AIRPORTS),
        countries=sorted(COUNTRIES),
        targets=len(targets),
        routes=len(routes),
        failed=failed_iatas,
        retry=retry,
        one_sided_routes=one_sided,
    )
    write_outputs(listed_airports_df, routes, additional_destinations, snapshot, month_problems, page_cache)


def kept_problems(snapshot: tuple[int, int], targets: set[str]) -> list[dict]:
    """The snapshot's problems a partial run didn't recheck. One-sided routes are always recomputed."""
    return [
        {k: v for k, v in p.items() if k not in ("airport_name", "coordinates")}
        for p in _read_json(snapshot_prefix(snapshot) + "problems.json") or []
        if p["airport"] not in targets and p["kind"] != "one_sided_route"
    ]


def normalize(
    routes_df: pd.DataFrame, airports_df: pd.DataFrame, names: dict[str, str] | None = None
) -> tuple[pd.DataFrame, pd.DataFrame, pd.Series]:
    """
    Routes under the registry's codes without duplicates, the airports that have routes out with
    their destination counts, and each airline's route count, busiest first. `names` is a past
    month's airlines.json, whose brands had codes of their own (Air Canada Rouge as RV).
    """
    remap = {code: airline_codes_dict.get(name, code) for code, name in (names or {}).items()}
    routes_df = routes_df.assign(airline_code=routes_df["airline_code"].replace(remap)).drop_duplicates()

    # An unordered pair, so A to B and B to A count as one route.
    pairs = pd.DataFrame(
        {
            "airline_code": routes_df["airline_code"],
            "airport1": routes_df[["src_airport", "dst_airport"]].min(axis=1),
            "airport2": routes_df[["src_airport", "dst_airport"]].max(axis=1),
        }
    ).drop_duplicates()
    route_counts = pairs.groupby("airline_code").size().sort_values(ascending=False, kind="stable")

    destinations = routes_df.groupby("src_airport")["dst_airport"].nunique()
    airports_df = airports_df[airports_df["IATA"].isin(destinations.index)]
    airports_df = airports_df.assign(destinations=airports_df["IATA"].map(destinations).astype(int))
    airports_df = airports_df.sort_values("destinations", ascending=False, kind="stable")
    return routes_df, airports_df, route_counts


def one_per_code(airports_df: pd.DataFrame) -> pd.DataFrame:
    """Same rule as list_airports: of two features sharing a code, the airport wins (YWG, not CFB Winnipeg)."""
    airports_df = airports_df.sort_values("title", key=lambda t: ~t.str.contains("Airport"), kind="stable")
    return airports_df.drop_duplicates("IATA").set_index("IATA")


def normalize_month(snapshot: tuple[int, int]) -> None:
    """Rewrites a past month under the registry's codes, with airport names from the latest month."""
    prefix = snapshot_prefix(snapshot)
    names = _read_json(prefix + "airlines.json") or {}
    load_airline_codes(snapshot)
    routes_df, airports_df = read_snapshot(snapshot)
    if routes_df.empty:
        raise SystemExit(f"No {snapshot[0]}-{snapshot[1]:02d} snapshot in {OUTPUT_BASE}")
    routes_df = normalize(routes_df, airports_df, names)[0]

    airports_df = one_per_code(airports_df)
    latest = one_per_code(read_snapshot(latest_snapshot())[1])
    # Airports that failed to scrape that month (YYT) take the latest month's place, so their routes stay.
    missing = (set(routes_df["src_airport"]) | set(routes_df["dst_airport"])) - set(airports_df.index)
    airports_df = pd.concat([airports_df, latest[latest.index.isin(missing)]])
    airports_df.update(latest[["title", "City"]])
    unplaced = ~(routes_df["src_airport"].isin(airports_df.index) & routes_df["dst_airport"].isin(airports_df.index))
    if unplaced.any():
        logger.warning(
            f"Dropping {unplaced.sum()} routes to airports no month places: {routes_df[unplaced].values.tolist()}"
        )
        routes_df = routes_df[~unplaced]

    problems = [
        {k: v for k, v in p.items() if k not in ("airport_name", "coordinates")}
        for p in _read_json(prefix + "problems.json") or []
    ]
    write_outputs(airports_df.reset_index(), routes_df.values.tolist(), {}, snapshot, problems)


def write_outputs(
    listed_airports_df: pd.DataFrame,
    routes: list,
    additional_destinations: dict,
    snapshot: tuple[int, int],
    problems: list[dict] | None = None,
    pages: dict | None = None,
) -> None:
    additional_airports_df = pd.DataFrame(
        [info for info in additional_destinations.values()], columns=["IATA", "url", "geometry", "title"]
    )

    routes_df = pd.DataFrame(routes, columns=["airline_code", "src_airport", "dst_airport"])
    routes_df = routes_df[(routes_df["src_airport"].str.len() == 3) & (routes_df["dst_airport"].str.len() == 3)]

    airports_df = pd.concat([listed_airports_df, additional_airports_df], ignore_index=True)[
        ["FAA", "IATA", "City", "url", "geometry", "title"]
    ]
    airports_df = airports_df[airports_df["IATA"].str.len() == 3]
    unplaced = (set(routes_df["src_airport"]) | set(routes_df["dst_airport"])) - set(airports_df["IATA"])
    if unplaced:
        raise ValueError(f"Routes reference airports with no coordinates: {', '.join(sorted(unplaced))}")

    # Before the filter below, so airports left off the map still place their problems.
    places = {
        row.IATA: {"airport_name": row.title, "coordinates": [round(row.geometry.x, 6), round(row.geometry.y, 6)]}
        for row in airports_df.itertuples()
    }
    unplaced_problem = {"airport_name": None, "coordinates": None}
    unique = {json.dumps(p, sort_keys=True): p for p in problems or []}
    problems_body = sorted(
        ({**p, **places.get(p["airport"], unplaced_problem)} for p in unique.values()),
        key=lambda p: (p["airport"] or "", p["kind"], p["airline"] or "", p["url"] or ""),
    )

    routes_df, airports_df, route_counts = normalize(routes_df, airports_df)
    names = airline_names()
    unnamed = set(route_counts.index) - names.keys()
    if unnamed:
        raise ValueError(f"Routes reference airlines with no name: {', '.join(sorted(unnamed))}")

    bodies = {
        "airports.json": airports_body(airports_df),
        "airlines.json": {code: names[code] for code in route_counts.index},
        "routes.json": routes_df.values.tolist(),
        "problems.json": problems_body,
    }

    # S3 output is staged locally and uploaded once every file is written.
    stage = OUTPUT_BASE if IS_LOCAL_OUTPUT else tempfile.mkdtemp(prefix="flight-atlas-")
    if IS_LOCAL_OUTPUT:
        clear_snapshot(snapshot)
    for name in SNAPSHOT_FILES:
        path = os.path.join(stage, snapshot_prefix(snapshot), name)
        logger.info(f"Writing {path}")
        _dump(path, bodies[name])
    if pages is not None:
        _dump(os.path.join(stage, PAGE_CACHE), pages)

    if not IS_LOCAL_OUTPUT:
        clear_snapshot(snapshot)
        upload_dir(stage)
        shutil.rmtree(stage)

    logger.info(f"Snapshots: {write_snapshot_list()}")


if __name__ == "__main__":
    if "--check" in sys.argv:
        sys.exit(1 if check_airports() else 0)
    if "--normalize" in sys.argv:
        year, month = sys.argv[sys.argv.index("--normalize") + 1 :][:2]
        normalize_month((int(year), int(month)))
        sys.exit()
    try:
        main()
        report["status"] = "ok"
    except BaseException as e:
        logger.exception("Scrape failed")
        report["status"] = f"failed: {type(e).__name__}: {e}"
        raise
    finally:
        _dump(
            REPORT_PATH,
            report | {"finished": datetime.now().isoformat(timespec="seconds"), "problems": problems.records},
        )
        logger.info(f"Report: {REPORT_PATH}")
