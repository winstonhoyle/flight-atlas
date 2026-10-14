"""The scraper's own logic, with Wikipedia replaced by saved pages and fake page lookups."""

from pathlib import Path

import pandas as pd
import pyarrow.dataset as ds
import pytest
from shapely.geometry import Point

import create_routes
import wiki_parse

FIXTURES = Path(__file__).parent / "fixtures"
WIKI = "https://en.wikipedia.org/wiki/"


def infobox(iata: str, lat: str, lon: str) -> str:
    return (
        f'<a href="/wiki/IATA_airport_code">IATA</a> <span>{iata}</span>'
        f'<span class="latitude">{lat}</span><span class="longitude">{lon}</span>'
    )


class FakePage:
    def __init__(self, title: str):
        self.title = title.replace("_", " ")
        self.url = WIKI + title


@pytest.fixture
def wikipedia(monkeypatch):
    """Serves fixture pages by URL; unknown pages have no infobox. Titles resolve to themselves."""
    pages = {
        WIKI + "Bethel_Airport": (FIXTURES / "bethel.html").read_text(encoding="utf-8"),
        WIKI
        + "Alaska_Airlines": '<table class="infobox-airline-codes"><tr><th>IATA</th></tr><tr><td>AS</td></tr></table>',
        WIKI
        + "Grant_Aviation": '<table class="infobox-airline-codes"><tr><th>IATA</th></tr><tr><td>GV</td></tr></table>',
        WIKI + "Ryan_Air_Services": "<p>No codes box</p>",
        WIKI + "Alakanuk_Airport": infobox("AUK", "62°40′48″N", "164°39′36″W"),
        # Grant, Ryan Air (no airline code), and Yute all fly here.
        WIKI + "Atmautluak_Airport": infobox("4A2", "60°52′00″N", "162°16′00″W"),
    }
    fetched = []

    def fetch_soup(url):
        fetched.append(url)
        return wiki_parse.soup_of(pages.get(url, "<p>Stub</p>"))

    def resolve_page(title):
        # Stands in for a link that lands on a disambiguation page.
        return None if title == "Chefornak_Airport" else FakePage(title)

    monkeypatch.setattr(create_routes, "fetch_soup", fetch_soup)
    monkeypatch.setattr(create_routes, "resolve_page", resolve_page)
    monkeypatch.setattr(create_routes, "airline_codes_dict", dict(create_routes.airline_codes_dict))
    return fetched


@pytest.fixture
def us_airports():
    return pd.DataFrame(
        [
            {
                "IATA": "BET",
                "url": WIKI + "Bethel_Airport",
                "geometry": Point(-161.83722, 60.77861),
            },
            {
                "IATA": "ANC",
                "url": WIKI + "Ted_Stevens_Anchorage_International_Airport",
                "geometry": Point(-149.99833, 61.17417),
            },
        ]
    )


def test_routes_from_a_real_page(wikipedia, us_airports):
    extra: dict = {}
    routes = create_routes.get_destinations("BET", us_airports, extra)

    # A U.S. destination gets one direction; the other comes from that airport's own page.
    assert ["AS", "BET", "ANC"] in routes
    assert ["AS", "ANC", "BET"] not in routes

    # A village with a readable infobox is added, both ways.
    assert ["GV", "BET", "AUK"] in routes and ["GV", "AUK", "BET"] in routes
    assert extra[WIKI + "Alakanuk_Airport"]["IATA"] == "AUK"

    # Villages whose pages have no infobox are dropped, not written with empty codes.
    assert all(len(code) == 3 for _, src, dst in routes for code in (src, dst))


def test_airlines_without_a_code_are_skipped(wikipedia, us_airports):
    routes = create_routes.get_destinations("BET", us_airports, {})
    to_atmautluak = {airline for airline, src, dst in routes if dst == "4A2"}
    assert to_atmautluak == {"GV", "7H"}  # Ryan Air has no code on its page
    assert all(airline for airline, _, _ in routes)


def test_a_bad_link_drops_only_that_destination(wikipedia, us_airports):
    routes = create_routes.get_destinations("BET", us_airports, {})
    assert ["GV", "BET", "AUK"] in routes
    assert WIKI + "Chefornak_Airport" not in wikipedia


def test_an_airport_missing_from_the_list_has_no_routes(wikipedia, us_airports):
    assert create_routes.get_destinations("ZZZ", us_airports, {}) == []


def test_a_page_without_a_destinations_table_has_no_routes(wikipedia, us_airports):
    airports = pd.concat(
        [
            us_airports,
            pd.DataFrame([{"IATA": "XXX", "url": WIKI + "Stub_Airport", "geometry": Point(0, 0)}]),
        ]
    )
    assert create_routes.get_destinations("XXX", airports, {}) == []


def test_write_outputs_round_trips_through_parquet(tmp_path, monkeypatch, us_airports):
    monkeypatch.setattr(create_routes, "OUTPUT_BASE", str(tmp_path))
    monkeypatch.setattr(create_routes, "RUN_ATHENA", False)
    us_airports = us_airports.assign(FAA=["BET", "ANC"], title=["Bethel Airport", "Anchorage"])
    extra = {
        WIKI + "Nome_Airport": {
            "IATA": "OME",
            "geometry": Point(-165.44, 64.51),
            "url": WIKI + "Nome_Airport",
            "title": "Nome Airport",
        }
    }
    routes = [
        ["AS", "BET", "ANC"],
        ["AS", "ANC", "BET"],
        ["AS", "ANC", "OME"],
        ["AS", "OME", "ANC"],
    ]
    create_routes.airline_codes_dict = {"Alaska Airlines": "AS"}

    create_routes.write_outputs(us_airports, routes, extra)

    flights = ds.dataset(tmp_path / "flights", partitioning="hive").to_table().to_pandas()
    assert len(flights) == 4
    assert set(flights["dst_geometry"]) >= {"POINT (-165.44 64.51)"}

    airports = ds.dataset(tmp_path / "airports", partitioning="hive").to_table().to_pandas()
    assert dict(zip(airports["IATA"], airports["destinations"], strict=True)) == {
        "BET": 1,
        "ANC": 2,
        "OME": 1,
    }

    airlines = ds.dataset(tmp_path / "airlines", partitioning="hive").to_table().to_pandas()
    assert airlines.loc[0, "route_count"] == 2
