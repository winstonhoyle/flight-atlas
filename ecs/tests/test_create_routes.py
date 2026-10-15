import io
import json
from pathlib import Path

import pandas as pd
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

    def resolve_pages(titles):
        # Chefornak stands in for a link that lands on a disambiguation page.
        return {
            t: None if t == "Chefornak_Airport" else create_routes.Page(t.replace("_", " "), WIKI + t) for t in titles
        }

    monkeypatch.setattr(create_routes, "fetch_soup", fetch_soup)
    monkeypatch.setattr(create_routes, "resolve_pages", resolve_pages)
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


SNAPSHOT = (2026, 10)


@pytest.fixture
def local_output(tmp_path, monkeypatch):
    monkeypatch.setattr(create_routes, "OUTPUT_BASE", str(tmp_path))
    monkeypatch.setattr(create_routes, "IS_LOCAL_OUTPUT", True)
    monkeypatch.setattr(create_routes, "airline_codes_dict", {"Alaska Airlines": "AS", "Grant Aviation": "GV"})
    return tmp_path


def foreign(iata: str, lon: float, lat: float) -> dict:
    url = f"{WIKI}{iata}_Airport"
    return {url: {"IATA": iata, "geometry": Point(lon, lat), "url": url, "title": f"{iata} Airport"}}


FULL_ROUTES = [
    ["AS", "BET", "ANC"],
    ["AS", "ANC", "BET"],
    ["AS", "ANC", "OME"],
    ["AS", "OME", "ANC"],
    ["GV", "BET", "AUK"],
    ["GV", "AUK", "BET"],
]


def write_full_snapshot(us_airports):
    us_airports = us_airports.assign(FAA=["BET", "ANC"], title=["Bethel Airport", "Anchorage"])
    extra = foreign("OME", -165.44, 64.51) | foreign("AUK", -164.66, 62.68)
    create_routes.write_outputs(us_airports, FULL_ROUTES, extra, SNAPSHOT)
    return us_airports


def read_json(root, key):
    return json.loads((root / key).read_text(encoding="utf-8"))


def test_write_outputs_writes_the_months_json(local_output, us_airports):
    write_full_snapshot(us_airports)

    assert sorted(map(tuple, read_json(local_output, "2026/10/routes.json"))) == sorted(map(tuple, FULL_ROUTES))

    airports = read_json(local_output, "2026/10/airports.json")["features"]
    assert {f["properties"]["IATA"]: f["properties"]["destinations"] for f in airports} == {
        "BET": 2,
        "ANC": 2,
        "OME": 1,
        "AUK": 1,
    }
    ome = next(f for f in airports if f["properties"]["IATA"] == "OME")
    assert ome["geometry"]["coordinates"] == [-165.44, 64.51]
    assert ome["properties"]["FAA"] is None

    assert read_json(local_output, "2026/10/airlines.json") == {"AS": "Alaska Airlines", "GV": "Grant Aviation"}
    assert read_json(local_output, "snapshots.json") == [{"month": "10", "year": "2026"}]


def test_routes_to_an_airport_without_coordinates_are_refused(local_output, us_airports):
    with pytest.raises(ValueError, match="OME"):
        create_routes.write_outputs(
            us_airports.assign(FAA=["BET", "ANC"], title=["Bethel Airport", "Anchorage"]),
            [["AS", "ANC", "OME"]],
            {},
            SNAPSHOT,
        )


def test_merge_replaces_only_the_target_and_its_foreign_return_legs():
    existing = pd.DataFrame(FULL_ROUTES, columns=["airline_code", "src_airport", "dst_airport"])
    airports = pd.DataFrame(
        [
            {"IATA": "OME", "url": WIKI + "Nome_Airport", "geometry": Point(-165.44, 64.51), "title": "Nome"},
            {"IATA": "AUK", "url": WIKI + "Alakanuk_Airport", "geometry": Point(-164.66, 62.68), "title": "Alakanuk"},
        ]
    )
    extra: dict = {}

    routes = create_routes.merge_into_snapshot(
        [["AS", "BET", "ANC"]], {"BET"}, {"BET", "ANC"}, existing, airports, extra
    )

    assert sorted(routes) == sorted(
        [["AS", "ANC", "BET"], ["AS", "ANC", "OME"], ["AS", "OME", "ANC"], ["AS", "BET", "ANC"]]
    )
    # Alakanuk is no longer served, so it isn't carried over.
    assert [info["IATA"] for info in extra.values()] == ["OME"]


def test_rescraping_one_airport_updates_the_snapshot_in_place(local_output, us_airports):
    us_airports = write_full_snapshot(us_airports)

    flights, airports = create_routes.read_snapshot(SNAPSHOT)
    routes = create_routes.merge_into_snapshot(
        [["AS", "BET", "ANC"]], {"BET"}, {"BET", "ANC"}, flights, airports, extra := {}
    )
    create_routes.write_outputs(us_airports, routes, extra, SNAPSHOT)

    flights, airports = create_routes.read_snapshot(SNAPSHOT)
    pairs = set(zip(flights["airline_code"], flights["src_airport"], flights["dst_airport"], strict=True))
    assert pairs == {("AS", "BET", "ANC"), ("AS", "ANC", "BET"), ("AS", "ANC", "OME"), ("AS", "OME", "ANC")}
    assert "AUK" not in set(airports["IATA"])


def test_clearing_a_snapshot_leaves_other_months(local_output, us_airports):
    write_full_snapshot(us_airports)
    create_routes.write_outputs(
        us_airports.assign(FAA=["BET", "ANC"], title=["Bethel Airport", "Anchorage"]),
        [["AS", "BET", "ANC"]],
        {},
        (2026, 9),
    )
    assert read_json(local_output, "snapshots.json") == [
        {"month": "10", "year": "2026"},
        {"month": "9", "year": "2026"},
    ]

    create_routes.clear_snapshot(SNAPSHOT)

    assert create_routes.read_snapshot(SNAPSHOT)[0].empty
    assert len(create_routes.read_snapshot((2026, 9))[0]) == 1


class FakeResponse:
    def __init__(self, status: int, body: dict | None = None, headers: dict | None = None):
        self.status_code, self._body, self.headers = status, body or {}, headers or {}

    def json(self):
        return self._body

    def raise_for_status(self):
        if self.status_code >= 400:
            raise create_routes.requests.HTTPError(str(self.status_code))


def test_resolve_pages_follows_redirects_and_skips_bad_pages(monkeypatch):
    calls = []

    def get(url, **params):
        calls.append(params["titles"])
        return FakeResponse(
            200,
            {
                "query": {
                    "normalized": [{"from": "toronto–Pearson", "to": "Toronto–Pearson"}],
                    "redirects": [{"from": "Toronto–Pearson", "to": "Toronto Pearson International Airport"}],
                    "pages": [
                        {"title": "Toronto Pearson International Airport"},
                        {"title": "Springfield Airport", "pageprops": {"disambiguation": ""}},
                        {"title": "Nowhere Airport", "missing": True},
                    ],
                }
            },
        )

    monkeypatch.setattr(create_routes, "get", get)
    monkeypatch.setattr(create_routes, "_pages", {})
    titles = ["toronto–Pearson", "Springfield_Airport", "Nowhere_Airport"]

    pages = create_routes.resolve_pages(titles)

    assert pages["toronto–Pearson"] == create_routes.Page(
        "Toronto Pearson International Airport", WIKI + "Toronto_Pearson_International_Airport"
    )
    assert pages["Springfield_Airport"] is None and pages["Nowhere_Airport"] is None
    create_routes.resolve_pages(titles)
    assert len(calls) == 1  # the second lookup comes from the cache


def test_get_waits_out_a_rate_limit(monkeypatch):
    responses = iter([FakeResponse(429, headers={"Retry-After": "3"}), FakeResponse(200, {"ok": True})])
    waits = []
    monkeypatch.setattr(create_routes.session, "get", lambda *a, **k: next(responses))
    monkeypatch.setattr(create_routes.time, "sleep", waits.append)

    assert create_routes.get("https://en.wikipedia.org/w/api.php").json() == {"ok": True}
    assert waits == [3]


def test_check_airport_reports_page_problems(wikipedia):
    assert create_routes.check_airport(WIKI + "Bethel_Airport") == []
    assert create_routes.check_airport(WIKI + "Stub_Airport") == [
        "no coordinates",
        "No 'Airlines and destinations' section",
    ]


class FakeS3:
    class exceptions:
        class NoSuchKey(Exception):
            pass

    def __init__(self, keys=()):
        self.objects = dict.fromkeys(keys, b"")

    def get_paginator(self, _name):
        objects = self.objects

        class Paginator:
            def paginate(self, Bucket, Prefix):
                return [{"Contents": [{"Key": k} for k in list(objects) if k.startswith(Prefix)]}]

        return Paginator()

    def delete_objects(self, Bucket, Delete):
        for obj in Delete["Objects"]:
            del self.objects[obj["Key"]]

    def upload_file(self, path, bucket, key):
        self.objects[key] = open(path, "rb").read()

    def put_object(self, Bucket, Key, Body, **_kw):
        self.objects[Key] = Body.encode()

    def get_object(self, Bucket, Key):
        if Key not in self.objects:
            raise self.exceptions.NoSuchKey(Key)
        return {"Body": io.BytesIO(self.objects[Key])}


@pytest.fixture
def s3_output(monkeypatch):
    fake = FakeS3()
    monkeypatch.setattr(create_routes, "OUTPUT_BASE", "s3://bucket-flight-atlas-routes")
    monkeypatch.setattr(create_routes, "IS_LOCAL_OUTPUT", False)
    monkeypatch.setattr(create_routes, "_s3", lambda: fake)
    monkeypatch.setattr(create_routes, "airline_codes_dict", {"Alaska Airlines": "AS", "Grant Aviation": "GV"})
    return fake


def test_clearing_january_leaves_october(s3_output):
    s3_output.objects = dict.fromkeys(["2026/01/routes.json", "2026/10/routes.json"])
    create_routes.clear_snapshot((2026, 1))
    assert list(s3_output.objects) == ["2026/10/routes.json"]


def test_s3_write_replaces_the_month_through_boto3(s3_output, us_airports):
    s3_output.objects = {"2026/10/stale.json": b"", "2026/09/routes.json": b"[]"}

    write_full_snapshot(us_airports)

    assert set(s3_output.objects) == {
        "2026/09/routes.json",
        "2026/10/airports.json",
        "2026/10/airlines.json",
        "2026/10/routes.json",
        "snapshots.json",
    }
    assert json.loads(s3_output.objects["snapshots.json"]) == [
        {"month": "10", "year": "2026"},
        {"month": "9", "year": "2026"},
    ]
    flights, airports = create_routes.read_snapshot(SNAPSHOT)
    assert len(flights) == 6 and len(airports) == 4
