import logging
import os
import re
import time
from datetime import datetime
from typing import List, Tuple
from urllib.parse import unquote

import boto3
import pandas as pd
import pyarrow as pa
import pyarrow.dataset as ds
import requests
import wikipedia
from bs4 import BeautifulSoup
from lat_lon_parser import parse
from shapely.geometry import Point
from tqdm import tqdm

# Logger setup
logger = logging.getLogger("flight_atlas")
logger.setLevel(logging.DEBUG)

# Add console handler
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.DEBUG)

formatter = logging.Formatter(
    "%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
console_handler.setFormatter(formatter)
logger.addHandler(console_handler)

# Env Vars
S3_ROUTES_BUCKET = os.environ.get("S3_ROUTES_BUCKET", "bucket-flight-atlas-routes")
S3_RESULTS_BUCKET = os.environ.get(
    "S3_RESULTS_BUCKET", "bucket-flight-atlas-query-results"
)
S3_PREFIX = os.environ.get("S3_PREFIX", "flights")
REGION = os.environ.get("REGION", "us-west-1")
DATABASE = os.environ.get("ATHENA_DB", "flights_db")

# Create session
session = requests.Session()
session.headers.update(
    {"User-Agent": "FlightAtlasBot/1.0 (https://github.com/winstonhoyle)"}
)

# Airport code dict because many airlines do not have an IATA code on wikipedia
airline_codes_dict = {
    "American Eagle": "AA",
    "Delta Connection": "DL",
    "United Express": "UA",
    "Yute Commuter Service": "4Y",
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
}

additional_destinations = {}


def get_airport_information(url: str) -> Tuple[str, Point]:
    r = session.get(url)
    soup = BeautifulSoup(r.text, "html.parser")

    try:
        # Get Point first
        lat = round(parse(soup.find("span", {"class": "latitude"}).text), 5)
        lon = round(parse(soup.find("span", {"class": "longitude"}).text), 5)
        point = Point(lon, lat)

        # Get IATA Code
        iata_href = soup.find("a", {"href": "/wiki/IATA_airport_code"})
        iata_code = re.sub(r"\[\d+\]", "", iata_href.find_next("span").text)
        return iata_code, point
    except Exception as e:
        logger.error(
            f"Unable to Retrieve airport's point or IATA code, url: {url}, Exception: {str(e)}"
        )
        return None


def get_airline_code(url: str, name: str) -> str:
    if name in airline_codes_dict:
        return airline_codes_dict[name]
    else:
        r = session.get(url)
        soup = BeautifulSoup(r.text, "html.parser")
        try:
            airline_code_table = soup.find_all(
                "table", {"class": "infobox-airline-codes"}
            )[0]
            codes = airline_code_table.find_all("tr")[1]
            airline_code = re.sub(r"\[\d+\]", "", codes.find("td").text.strip())[:2]
            airline_codes_dict[name] = airline_code
            logger.info(f"Added New Airline Code, name: {name}, code: {airline_code}")
            return airline_code
        except Exception as e:
            logger.error(
                f"Cannot Find Airline Code, url: {url}, name: {name}, Exception: {str(e)}"
            )


def get_coordinate(url: str) -> Point:
    try:
        airport_r = session.get(url)
        soup = BeautifulSoup(airport_r.text, "html.parser")
        lat = round(parse(soup.find("span", {"class": "latitude"}).text), 5)
        lon = round(parse(soup.find("span", {"class": "longitude"}).text), 5)
        return Point(lon, lat)
    except Exception as e:
        logger.error(f"Cannot Find Coordinate, url: {url}, Exception: {str(e)}")
        return None


def find_destination_table(url: str) -> List:
    r = session.get(url)
    soup = BeautifulSoup(r.text, "html.parser")
    header = soup.find(
        lambda tag: (
            tag.name
            and tag.name.startswith("h")
            and "airline" in tag.get("id", "").lower()
            and "destination" in tag.get("id", "").lower()
        )
    )
    table = header.find_next("table")
    classes = table.get("class", [])
    if any(
        c in classes for c in ["ambox", "metadata", "plainlinks", "box-Multiple_issues"]
    ):
        table = next(
            table
            for table in table.find_all_next("table")
            if "wikitable" in table.attrs["class"]
        )

    if not table:
        raise LookupError("Unable to find Destination table", url)

    trs = table.find("tbody").find_all("tr")
    return trs


def get_destinations(src_iata: str, airports_df: pd.DataFrame) -> List:
    """
    Returns all destinations from source airport in List type
    """

    # Query airport and get destination table
    matches = airports_df.loc[airports_df["IATA"] == src_iata, "url"]
    if matches.empty:
        return []
    else:
        url = matches.iloc[0]

    try:
        trs = find_destination_table(url=url)
    except Exception as e:
        logger.error(f"Cannot Find Destination Table, url: {url}, Exception: {str(e)}")
        return []

    destinations = []

    # Loop through records
    for tr in trs[1:]:

        # Loop through columns
        for i, td in enumerate(tr.find_all("td")):

            # Get airline for desinations, saving all airlines incase I want to expand later
            if i == 0:
                a = td.find("a")

                # If Airline does not have an `href`
                airline_name = re.sub(r"\[\d+\]", "", td.text.strip())
                if not a and airline_name not in airline_codes_dict:
                    logger.error(
                        f"Airline URL Doesn't Exist, url: {url}, name: {airline_name}"
                    )
                    break

                # If Airline already exists in dict
                if airline_name in airline_codes_dict:
                    airline_code = airline_codes_dict[airline_name]

                # If airline doesn't exist get code and `get_airline_code` as it to `airline_codes_dict`
                else:
                    airline_href = a.attrs["href"]
                    airline_url = f"https://en.wikipedia.org{unquote(airline_href)}"
                    airline_name = re.sub(r"\[\d+\]", "", td.text.strip())
                    airline_code = get_airline_code(url=airline_url, name=airline_name)

            # Get Destinations
            elif i == 1:

                airport_as = [
                    a
                    for a in td.find_all("a", href=True)
                    if a["href"].startswith("/wiki/")
                    and not a["href"].startswith("/wiki/Wikipedia:")
                    and "#cite_note" not in a["href"]
                    and "NOTRS" not in a["href"]
                ]

                # Get all airports
                for a in airport_as:
                    href = a.attrs["href"]

                    # If wiki citation note, skip
                    if len(href.split("#")) > 1:
                        if not href.split("#")[1].startswith("cite_note"):
                            logger.debug(f"Href note: {a}, href: {href}")
                        continue

                    # Get iata code, US airports and intl they fly too
                    unquote_href = unquote(href)
                    url = f"https://en.wikipedia.org{unquote_href}"
                    if (
                        url == "https://en.wikipedia.org/wiki/Wikipedia:Citation_needed"
                        or url
                        == "https://en.wikipedia.org/wiki/Wikipedia:Verifiability"
                    ):
                        continue

                    # Ensure airport url is original, lots of redirects on wikipedia
                    page = wikipedia.page(
                        unquote_href.replace("/wiki/", "").replace("_", " "),
                        auto_suggest=False,
                        redirect=True,
                    )
                    url = unquote(page.url)
                    matches = airports_df.loc[airports_df["url"] == url, "IATA"]
                    dst_iata = matches.iloc[0] if not matches.empty else None

                    # If code is found
                    if dst_iata:
                        destinations.append([airline_code, src_iata, dst_iata])

                    # If international URL already found
                    elif url in additional_destinations:
                        dst_iata = additional_destinations[url]["IATA"]
                        destinations.append([airline_code, src_iata, dst_iata])

                    # No code found international or remote (Alaska)
                    else:
                        logger.debug(
                            f"Adding New Airport, {airline_name} flying to {url}"
                        )
                        # If information is found
                        airport_info = get_airport_information(url)
                        if not airport_info:
                            continue
                        else:
                            dst_iata = airport_info[0]
                            intl_point = airport_info[1]

                        # Append to dictionary
                        additional_destinations[url] = {
                            "IATA": dst_iata,
                            "geometry": intl_point,
                            "url": url,
                            "title": page.title,
                        }
                        # Add from src to dst
                        destinations.append([airline_code, src_iata, dst_iata])
                        # Add new src to dst record
                        destinations.append([airline_code, dst_iata, src_iata])
            else:
                continue
    return destinations


# Get all the airports in the USA
response = session.get(
    "https://en.wikipedia.org/wiki/List_of_airports_in_the_United_States",
)
response.raise_for_status()

# Get headers for airports
soup = BeautifulSoup(response.text, "html.parser")
trs = soup.find("table", {"class": "wikitable sortable"}).find_all("tr")
headers = [th.text.strip() for th in trs[0].find_all("th")]

# Loop through airports and save data
data = []
points = []
titles = []
for tr in tqdm(trs[1:], desc="Parsing Airports"):
    if not tr.find_all("td")[1].text:
        continue
    row = []
    for i, td in enumerate(tr.find_all("td")):
        if td.find("a") and i == 4:
            href = unquote(td.find("a").attrs["href"])
            page = wikipedia.page(
                href.replace("/wiki/", "").replace("_", " "),
                auto_suggest=False,
                redirect=True,
            )
            url = unquote(page.url)
            row.append(url)
            points.append(get_coordinate(url))
            titles.append(page.title)
        elif i == 6:
            row.append(int(td.text.strip().replace(",", "")))
        else:
            row.append(td.text.strip())
    data.append(row)

# Create airports geopandas frame
usa_airports_df = pd.DataFrame(data=data, columns=headers)
usa_airports_df.rename(columns={"Airport": "url"}, inplace=True)
usa_airports_df["geometry"] = points
usa_airports_df["title"] = titles
usa_airports_df = usa_airports_df[
    ["FAA", "IATA", "ICAO", "url", "Role", "Enplanements", "geometry", "title"]
]

# Sort by most travelled airports so the largest airlines get queried first
usa_airports_df = usa_airports_df.sort_values(
    "Enplanements", ascending=False
).reset_index(drop=True)

# Loop through airports again but querying the destinations at the airport
# Queried twice because we know the US airports now, before we were building a list
routes = []
failed_urls = []
for i in tqdm(range(len(usa_airports_df)), desc="Parsing Airports"):
    try:
        src_iata = usa_airports_df.iloc[i]["IATA"]
        destinations = get_destinations(src_iata=src_iata, airports_df=usa_airports_df)
        routes.extend(destinations)
    except Exception as e:
        logger.error(
            f"Failure getting destinations, url: {usa_airports_df.iloc[i]['url']}, Exception: {str(e)}"
        )
    time.sleep(1)

for failed_url in failed_urls:
    logger.error(f"Failed URL: {failed_url}")

# Create addtional airports df
additional_airports_df = pd.DataFrame(
    [airline_dict for _, airline_dict in additional_destinations.items()]
)

# Create a routes df with airport-pairs and geometries
routes_df = pd.DataFrame(routes, columns=["airline_code", "src_airport", "dst_airport"])

# Join Geometries
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
    # Join geometries for the additional routes
    routes_df = routes_df.merge(
        additional_airports_df.rename(
            columns={"IATA": "dst_airport", "geometry": "geometry_dst_new"}
        ),
        on="dst_airport",
        how="left",
    )
    routes_df = routes_df.merge(
        additional_airports_df.rename(
            columns={"IATA": "src_airport", "geometry": "geometry_src_new"}
        ),
        on="src_airport",
        how="left",
    )

    # Combine geomtries to remove `None` geometries
    routes_df["geometry_src"] = routes_df["geometry_src"].combine_first(
        routes_df["geometry_src_new"]
    )
    routes_df["geometry_dst"] = routes_df["geometry_dst"].combine_first(
        routes_df["geometry_dst_new"]
    )

# Cast geometries and drop geometry columns
routes_df["src_geometry"] = routes_df["geometry_src"].apply(lambda g: g.wkt)
routes_df["dst_geometry"] = routes_df["geometry_dst"].apply(lambda g: g.wkt)

# Clean
routes_df = routes_df[
    ["airline_code", "src_airport", "dst_airport", "src_geometry", "dst_geometry"]
]

# Format date for partition
routes_df["year"] = datetime.now().year
routes_df["month"] = datetime.now().month

# Upload routes to S3
routes_table = pa.Table.from_pandas(routes_df)

# Write partitioned dataset
routes_dir = f"s3://{S3_ROUTES_BUCKET}/{S3_PREFIX}/"
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

# Prepare airports DataFrame for upload
airports_df = pd.concat([usa_airports_df, additional_airports_df], ignore_index=True)[
    ["FAA", "IATA", "url", "geometry", "title"]
]

# Convert geometry to WKT
airports_df["geometry"] = airports_df["geometry"].apply(lambda g: g.wkt)

# Add snapshot date and partition columns
airports_df["year"] = datetime.now().year
airports_df["month"] = datetime.now().month

# Convert to Arrow table
airport_table = pa.Table.from_pandas(airports_df)

# Write partitioned dataset
airports_dir = f"s3://{S3_ROUTES_BUCKET}/airports/"
logger.info(f"Writing airports to {airports_dir}")

# Write dataset partitioned by year/month
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

# Upload airlines to S3
airlines_df = pd.DataFrame(airline_codes_dict.items(), columns=["name", "airline_code"])
airlines_df[["name", "airline_code"]] = airlines_df[["name", "airline_code"]].astype(
    str
)

# Add snapshot date and partition columns
airlines_df["year"] = datetime.now().year
airlines_df["month"] = datetime.now().month

# Convert to Arrow table
airlines_table = pa.Table.from_pandas(airlines_df)

# Write partitioned dataset
airlines_dir = f"s3://{S3_ROUTES_BUCKET}/airlines/"
logger.info(f"Writing Airlines to to {airlines_dir}")

# Write dataset partitioned by year/month
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

logger.info(f"Enable Tables for Athena")
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
