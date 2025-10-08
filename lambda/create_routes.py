import os
import re
from datetime import datetime
from typing import List
from urllib.parse import unquote

import pandas as pd
import pyarrow as pa
import pyarrow.dataset as ds
import requests
from bs4 import BeautifulSoup
from lat_lon_parser import parse
from shapely.geometry import Point
from tqdm import tqdm

S3_BUCKET = os.environ.get("S3_BUCKET", "bucket-flight-atlas-routes")
S3_PREFIX = os.environ.get("S3_PREFIX", "flights") 
HEADERS = {"User-Agent": "FlightAtlas (hoylejwinston@gmail.com)"}

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


def get_airline_code(url: str, name: str) -> str:
    if name in airline_codes_dict:
        return airline_codes_dict[name]
    else:
        r = requests.get(url, headers=HEADERS)
        soup = BeautifulSoup(r.text, "html.parser")
        try:
            airline_code_table = soup.find_all(
                "table", {"class": "infobox-airline-codes"}
            )[0]
            codes = airline_code_table.find_all("tr")[1]
            airline_code = re.sub(r"\[\d+\]", "", codes.find("td").text.strip())[:2]
            airline_codes_dict[name] = airline_code
            print("Added New Airline Code", name, airline_code)
            return airline_code
        except Exception as e:
            print("Cannot Find Airline Code", url, name, str(e))


def get_coordinate(url: str) -> Point:
    try:
        airport_r = requests.get(url, headers=HEADERS)
        soup = BeautifulSoup(airport_r.text, "html.parser")
        lat = parse(soup.find("span", {"class": "latitude"}).text)
        lon = parse(soup.find("span", {"class": "longitude"}).text)
        return Point(lon, lat)
    except Exception as e:
        print("Cannot Find Coordinate", url, str(e))
        return None


def find_destination_table(url: str) -> List:
    r = requests.get(url, headers=HEADERS)
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


def find_destination_table(url: str) -> List:
    r = requests.get(url, headers=HEADERS)
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


def get_destinations(iata: str, airports_df: pd.DataFrame) -> List:
    """
    Returns all destinations from source airport in List format: List[str, str]
    """

    # Query airport and get destination table
    matches = airports_df.loc[airports_df["IATA"] == iata, "url"]
    if matches.empty:
        return []
    else:
        url = matches.iloc[0]

    try:
        trs = find_destination_table(url=url)
    except Exception as e:
        print("Cannot Find Destination Table", str(e), url)
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
                    print("Airline URL Doesn't Exist", url, f"Soup Tag: {tr}")
                    break

                if airline_name in airline_codes_dict:
                    airline_code = airline_codes_dict[airline_name]
                else:
                    airline_href = a.attrs["href"]
                    airline_url = f"https://en.wikipedia.org{unquote(airline_href)}"
                    airline_name = re.sub(r"\[\d+\]", "", td.text.strip())
                    airline_code = get_airline_code(url=airline_url, name=airline_name)

            # Get Destinations
            elif i == 1:

                # Get all airports
                for a in td.find_all("a"):
                    href = a.attrs["href"]

                    # If wiki citation note, skip
                    if len(href.split("#")) > 1:
                        if not href.split("#")[1].startswith("cite_note"):
                            print("Href note", a, href)
                        continue

                    # Get iata code, only US airports
                    url = f"https://en.wikipedia.org{unquote(href)}"
                    matches = airports_df.loc[airports_df["url"] == url, "IATA"]
                    iata_code = matches.iloc[0] if not matches.empty else None
                    if iata_code:
                        destinations.append([airline_code, iata, iata_code])
            else:
                continue
    return destinations

# Get all the airports in the USA
response = requests.get(
    "https://en.wikipedia.org/wiki/List_of_airports_in_the_United_States",
    headers=HEADERS,
)
response.raise_for_status()

# Get headers for airports
soup = BeautifulSoup(response.text, "html.parser")
trs = soup.find("table", {"class": "wikitable sortable"}).find_all("tr")
headers = [th.text.strip() for th in trs[0].find_all("th")]

# Loop through airports and save data
data = []
points = []
for tr in tqdm(trs[1:], desc="Parsing Airports"):
    if not tr.find_all("td")[1].text:
        continue
    row = []
    for i, td in enumerate(tr.find_all("td")):
        if td.find("a") and i == 4:
            href = unquote(td.find("a").attrs["href"])
            url = f"https://en.wikipedia.org{href}"
            row.append(url)
            points.append(get_coordinate(url))
        elif i == 6:
            row.append(int(td.text.strip().replace(",", "")))
        else:
            row.append(td.text.strip())
    data.append(row)

# Create airports geopandas frame
usa_airports_df = pd.DataFrame(data=data, columns=headers)
usa_airports_df.rename(columns={"Airport": "url"}, inplace=True)
usa_airports_df["geometry"] = points

# Loop through airports again but querying the destinations at the airport
# Queried twice because we know the US airports now, before we were building a list
routes = []
for i in tqdm(range(len(usa_airports_df)), desc="Parsing Airports"):
    try:
        iata = usa_airports_df.iloc[i]["IATA"]
        destinations = get_destinations(iata, airports_df=usa_airports_df)
        routes.extend(destinations)
    except Exception as e:
        print(str(e), usa_airports_df.iloc[i]["url"])

# Create a routes df with airport-pairs and geometries
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

# Cast geometries and drop geometry columns
routes_df["src_geometry"] = routes_df["geometry_src"].apply(lambda g: g.wkt)
routes_df["dst_geometry"] = routes_df["geometry_dst"].apply(lambda g: g.wkt)
routes_df = routes_df.drop(columns=["geometry_dst", "geometry_src"])

# Format date for partition
routes_df["year"] = datetime.now().year
routes_df["month"] = datetime.now().month

# Upload to S3
table = pa.Table.from_pandas(routes_df)

s3_base_dir = f"s3://{S3_BUCKET}/{S3_PREFIX}/"
print(f'Uploading data to {s3_base_dir}')

ds.write_dataset(
    table,
    base_dir=s3_base_dir,
    format="parquet",
    partitioning=["airline_code", "src_airport", "year", "month"],
    partitioning_flavor="hive",
    existing_data_behavior="overwrite_or_ignore",
    max_partitions=2000,
)
