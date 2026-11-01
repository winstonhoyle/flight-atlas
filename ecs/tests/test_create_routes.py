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
            t: None if t == "Chefornak_Airport" else create_routes.Page(t.replace("_", " "), WIKI + t, 1)
            for t in titles
        }

    monkeypatch.setattr(create_routes, "fetch_soup", fetch_soup)
    monkeypatch.setattr(create_routes, "page_cache", {})
    monkeypatch.setattr(create_routes.time, "sleep", lambda _: None)
    monkeypatch.setattr(create_routes, "resolve_pages", resolve_pages)
    monkeypatch.setattr(create_routes, "airline_codes_dict", dict(create_routes.airline_codes_dict))
    monkeypatch.setattr(create_routes, "found_problems", [])
    return fetched


@pytest.fixture
def listed_airports():
    return pd.DataFrame(
        [
            {
                "IATA": "BET",
                "City": "Bethel",
                "url": WIKI + "Bethel_Airport",
                "geometry": Point(-161.83722, 60.77861),
            },
            {
                "IATA": "ANC",
                "City": "Anchorage",
                "url": WIKI + "Ted_Stevens_Anchorage_International_Airport",
                "geometry": Point(-149.99833, 61.17417),
            },
        ]
    )


def test_a_shared_code_lists_the_airport_not_the_base(monkeypatch):
    def listed(title):
        return wiki_parse.ListedAirport("Winnipeg", "", "YWG", "", title, "", None)

    pages = {
        "CA_1": [listed("CFB_Winnipeg")],
        "CA_2": [listed("Winnipeg_International_Airport"), listed("CFB_Winnipeg")],
    }
    monkeypatch.setattr(create_routes, "fetch_soup", lambda url: url.rsplit("/", 1)[-1])
    monkeypatch.setattr(wiki_parse, "parse_list_links", lambda soup, prefix: ["CA_1", "CA_2"])
    monkeypatch.setattr(wiki_parse, "parse_airport_list", lambda title: pages.get(title, []))

    assert [a.airport_title for _, a in create_routes.list_airports()] == ["Winnipeg_International_Airport"]


def test_every_registry_code_has_one_display_name():
    displays: dict[str, list[str]] = {}
    for name, entry in create_routes.AIRLINES.items():
        displays.setdefault(entry["code"], [])
        if entry.get("display"):
            displays[entry["code"]].append(name)
    assert {code: names for code, names in displays.items() if len(names) != 1} == {}


def test_a_shared_code_takes_the_registrys_display_name(monkeypatch):
    codes = dict(create_routes.airline_codes_dict) | {"Grant Aviation": "GV"}
    monkeypatch.setattr(create_routes, "airline_codes_dict", codes)
    names = create_routes.airline_names()
    assert {code: names[code] for code in ("AA", "AV", "AS", "LA", "9K", "GV")} == {
        "AA": "American Airlines",
        "AV": "Avianca",
        "AS": "Alaska Airlines",
        "LA": "LATAM Airlines",
        "9K": "Cape Air",
        "GV": "Grant Aviation",
    }


def test_normalize_files_brands_under_the_parent_and_drops_the_duplicates():
    routes = pd.DataFrame(
        [["RV", "YYZ", "MCO"], ["AC", "YYZ", "MCO"], ["AC", "MCO", "YYZ"], ["AS", "YYZ", "MCO"]],
        columns=["airline_code", "src_airport", "dst_airport"],
    )
    airports = pd.DataFrame({"IATA": ["YYZ", "MCO", "ANC"]})

    routes, airports, counts = create_routes.normalize(routes, airports, {"RV": "Air Canada Rouge", "AC": "Air Canada"})

    assert routes.values.tolist() == [["AC", "YYZ", "MCO"], ["AC", "MCO", "YYZ"], ["AS", "YYZ", "MCO"]]
    assert counts.to_dict() == {"AC": 1, "AS": 1}
    assert dict(zip(airports["IATA"], airports["destinations"], strict=True)) == {"YYZ": 1, "MCO": 1}


def test_routes_from_a_real_page(wikipedia, listed_airports):
    extra: dict = {}
    routes = create_routes.get_destinations("BET", listed_airports, extra)

    # A U.S. destination gets one direction; the other comes from that airport's own page.
    assert ["AS", "BET", "ANC"] in routes
    assert ["AS", "ANC", "BET"] not in routes

    # A village with a readable infobox is added, both ways.
    assert ["GV", "BET", "AUK"] in routes and ["GV", "AUK", "BET"] in routes
    assert extra[WIKI + "Alakanuk_Airport"]["IATA"] == "AUK"

    # Villages whose pages have no infobox are dropped, not written with empty codes.
    assert all(len(code) == 3 for _, src, dst in routes for code in (src, dst))


def test_airlines_without_a_code_are_skipped(wikipedia, listed_airports):
    routes = create_routes.get_destinations("BET", listed_airports, {})
    to_atmautluak = {airline for airline, src, dst in routes if dst == "4A2"}
    assert to_atmautluak == {"GV", "7H"}  # Ryan Air has no code on its page
    assert all(airline for airline, _, _ in routes)
    assert {
        "kind": "airline_code",
        "airport": "BET",
        "airline": "Ryan Air",
        "url": WIKI + "Ryan_Air_Services",
        "message": "The airline's page has no IATA or ICAO code, so its routes here were skipped",
    } in create_routes.found_problems


def test_a_bad_link_drops_only_that_destination(wikipedia, listed_airports):
    routes = create_routes.get_destinations("BET", listed_airports, {})
    assert ["GV", "BET", "AUK"] in routes
    assert WIKI + "Chefornak_Airport" not in wikipedia


def test_an_airport_missing_from_the_list_has_no_routes(wikipedia, listed_airports):
    assert create_routes.get_destinations("ZZZ", listed_airports, {}) == []


def test_a_page_without_a_destinations_table_has_no_routes(wikipedia, listed_airports):
    airports = pd.concat(
        [
            listed_airports,
            pd.DataFrame([{"IATA": "XXX", "url": WIKI + "Stub_Airport", "geometry": Point(0, 0)}]),
        ]
    )
    assert create_routes.get_destinations("XXX", airports, {}) == []
    assert [(p["kind"], p["airport"]) for p in create_routes.found_problems] == [("destinations_table", "XXX")]


SNAPSHOT = (2026, 10)


@pytest.fixture
def local_output(tmp_path, monkeypatch):
    monkeypatch.setattr(create_routes, "OUTPUT_BASE", str(tmp_path))
    monkeypatch.setattr(create_routes, "IS_LOCAL_OUTPUT", True)
    monkeypatch.setattr(
        create_routes,
        "airline_codes_dict",
        {"Alaska Airlines": "AS", "Grant Aviation": "GV", "Hawaiian Airlines": "AS"},
    )
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


def write_full_snapshot(listed_airports):
    listed_airports = listed_airports.assign(FAA=["BET", "ANC"], title=["Bethel Airport", "Anchorage"])
    extra = foreign("OME", -165.44, 64.51) | foreign("AUK", -164.66, 62.68) | foreign("KWT", -161.44, 60.79)
    create_routes.write_outputs(listed_airports, FULL_ROUTES, extra, SNAPSHOT)
    return listed_airports


def read_json(root, key):
    return json.loads((root / key).read_text(encoding="utf-8"))


def test_write_outputs_writes_the_months_json(local_output, listed_airports):
    write_full_snapshot(listed_airports)

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
    assert ome["properties"]["City"] is None
    bet = next(f for f in airports if f["properties"]["IATA"] == "BET")
    assert bet["properties"]["City"] == "Bethel"

    assert read_json(local_output, "2026/10/airlines.json") == {"AS": "Alaska Airlines", "GV": "Grant Aviation"}
    assert read_json(local_output, "snapshots.json") == [{"month": "10", "year": "2026"}]


def test_routes_to_an_airport_without_coordinates_are_refused(local_output, listed_airports):
    with pytest.raises(ValueError, match="OME"):
        create_routes.write_outputs(
            listed_airports.assign(FAA=["BET", "ANC"], title=["Bethel Airport", "Anchorage"]),
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


def test_merging_mexico_keeps_us_routes_and_replaces_mexicos_own():
    existing = pd.DataFrame(
        [
            ["AA", "DFW", "ORD"],
            ["AA", "ORD", "DFW"],
            ["AM", "DFW", "MEX"],
            ["AM", "MEX", "DFW"],
            ["AM", "MEX", "CUN"],
            ["AM", "CUN", "MEX"],
            ["AM", "MEX", "MAD"],
            ["AM", "MAD", "MEX"],
        ],
        columns=["airline_code", "src_airport", "dst_airport"],
    )
    airports = pd.DataFrame(
        [{"IATA": "MAD", "url": WIKI + "Madrid_Airport", "geometry": Point(-3.57, 40.47), "title": "Madrid"}]
    )
    new = [["Y4", "MEX", "DFW"], ["Y4", "MEX", "CUN"], ["Y4", "CUN", "MEX"]]

    routes = create_routes.merge_into_snapshot(
        new, {"MEX", "CUN"}, {"DFW", "ORD", "MEX", "CUN"}, existing, airports, extra := {}
    )

    assert sorted(routes) == sorted([["AA", "DFW", "ORD"], ["AA", "ORD", "DFW"], ["AM", "DFW", "MEX"], *new])
    assert extra == {}


def test_rescraping_one_airport_updates_the_snapshot_in_place(local_output, listed_airports):
    listed_airports = write_full_snapshot(listed_airports)

    flights, airports = create_routes.read_snapshot(SNAPSHOT)
    routes = create_routes.merge_into_snapshot(
        [["AS", "BET", "ANC"]], {"BET"}, {"BET", "ANC"}, flights, airports, extra := {}
    )
    create_routes.write_outputs(listed_airports, routes, extra, SNAPSHOT)

    flights, airports = create_routes.read_snapshot(SNAPSHOT)
    pairs = set(zip(flights["airline_code"], flights["src_airport"], flights["dst_airport"], strict=True))
    assert pairs == {("AS", "BET", "ANC"), ("AS", "ANC", "BET"), ("AS", "ANC", "OME"), ("AS", "OME", "ANC")}
    assert "AUK" not in set(airports["IATA"])


def test_a_partial_run_keeps_names_of_airlines_it_didnt_see(local_output, listed_airports, monkeypatch):
    listed_airports = write_full_snapshot(listed_airports)
    monkeypatch.setattr(create_routes, "airline_codes_dict", {"Alaska Airlines": "AS"})

    create_routes.load_airline_codes(SNAPSHOT)
    flights, airports = create_routes.read_snapshot(SNAPSHOT)
    routes = create_routes.merge_into_snapshot(
        [["AS", "BET", "ANC"]], {"BET"}, {"BET", "ANC"}, flights, airports, extra := {}
    )
    routes.append(["GV", "ANC", "OME"])
    create_routes.write_outputs(listed_airports, routes, extra, SNAPSHOT)

    assert read_json(local_output, "2026/10/airlines.json") == {"AS": "Alaska Airlines", "GV": "Grant Aviation"}


def test_routes_on_an_unnamed_airline_are_refused(local_output, listed_airports, monkeypatch):
    monkeypatch.setattr(create_routes, "airline_codes_dict", {"Alaska Airlines": "AS"})
    with pytest.raises(ValueError, match="GV"):
        create_routes.write_outputs(
            listed_airports.assign(FAA=["BET", "ANC"], title=["Bethel Airport", "Anchorage"]),
            [["AS", "BET", "ANC"], ["GV", "ANC", "BET"]],
            {},
            SNAPSHOT,
        )


def test_one_sided_routes():
    routes = [
        ["AA", "ATL", "GSO"],
        ["AA", "GSO", "CLT"],
        ["AA", "CLT", "GSO"],
        ["AA", "ATL", "YYT"],  # YYT's page has no readable table, so it lists nothing
        ["AC", "YYZ", "LHR"],  # LHR isn't scraped
    ]
    assert create_routes.one_sided_routes(routes, {"ATL", "GSO", "CLT", "YYT", "YYZ"}) == [
        {"airline": "AA", "listed_by": "ATL", "missing_from": "GSO"}
    ]


def test_clearing_a_snapshot_leaves_other_months(local_output, listed_airports):
    write_full_snapshot(listed_airports)
    create_routes.write_outputs(
        listed_airports.assign(FAA=["BET", "ANC"], title=["Bethel Airport", "Anchorage"]),
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


def test_s3_write_replaces_the_month_through_boto3(s3_output, listed_airports):
    s3_output.objects = {"2026/10/stale.json": b"", "2026/09/routes.json": b"[]"}

    write_full_snapshot(listed_airports)

    assert set(s3_output.objects) == {
        "2026/09/routes.json",
        "2026/10/airports.json",
        "2026/10/airlines.json",
        "2026/10/routes.json",
        "2026/10/problems.json",
        "snapshots.json",
    }
    assert json.loads(s3_output.objects["snapshots.json"]) == [
        {"month": "10", "year": "2026"},
        {"month": "9", "year": "2026"},
    ]
    flights, airports = create_routes.read_snapshot(SNAPSHOT)
    assert len(flights) == 6 and len(airports) == 4


def test_problems_are_written_once_each_with_the_airports_coordinates(local_output, listed_airports):
    listed_airports = listed_airports.assign(FAA=["BET", "ANC"], title=["Bethel Airport", "Anchorage"])
    unread = {"kind": "destinations_table", "airport": "ANC", "airline": None, "url": None, "message": "No table"}
    lost = {"kind": "destination_page", "airport": "BET", "airline": None, "url": WIKI + "Eek", "message": "Skipped"}

    # ANC lists nothing, so it's off the map, but its problem still has a place.
    create_routes.write_outputs(
        listed_airports,
        [["AS", "BET", "OME"]],
        foreign("OME", -165.44, 64.51),
        SNAPSHOT,
        [unread, lost, lost],
    )

    assert "ANC" not in {f["properties"]["IATA"] for f in read_json(local_output, "2026/10/airports.json")["features"]}
    assert read_json(local_output, "2026/10/problems.json") == [
        {**unread, "airport_name": "Anchorage", "coordinates": [-149.99833, 61.17417]},
        {**lost, "airport_name": "Bethel Airport", "coordinates": [-161.83722, 60.77861]},
    ]


def test_a_partial_run_keeps_problems_it_didnt_recheck(local_output, listed_airports):
    listed_airports = listed_airports.assign(FAA=["BET", "ANC"], title=["Bethel Airport", "Anchorage"])
    old = [
        {"kind": "destinations_table", "airport": "ANC", "airline": None, "url": None, "message": "No table"},
        {"kind": "airline_code", "airport": "BET", "airline": "Ryan Air", "url": None, "message": "No code"},
        {"kind": "one_sided_route", "airport": "ANC", "airline": "Alaska Airlines", "url": None, "message": "One"},
    ]
    create_routes.write_outputs(
        listed_airports, FULL_ROUTES, foreign("OME", -165.44, 64.51) | foreign("AUK", -164.66, 62.68), SNAPSHOT, old
    )

    assert create_routes.kept_problems(SNAPSHOT, {"BET"}) == [old[0]]


def feature(iata: str, name: str, lon: float = 0.0, lat: float = 0.0, city: str | None = None) -> dict:
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [lon, lat]},
        "properties": {"FAA": None, "IATA": iata, "Name": name, "City": city, "url": WIKI + name, "destinations": 1},
    }


def write_month(root, month: str, features: list, routes: list, airlines: dict, problems=()) -> None:
    folder = root / "2026" / month
    folder.mkdir(parents=True)
    bodies = {
        "airports.json": {"type": "FeatureCollection", "features": features},
        "routes.json": routes,
        "airlines.json": airlines,
        "problems.json": list(problems),
    }
    for name, body in bodies.items():
        (folder / name).write_text(json.dumps(body), encoding="utf-8")


def test_normalizing_a_past_month(local_output, monkeypatch):
    monkeypatch.setattr(
        create_routes, "airline_codes_dict", {name: e["code"] for name, e in create_routes.AIRLINES.items()}
    )
    lost = {"kind": "coordinates", "airport": "YYT", "airline": None, "url": None, "message": "No coordinates"}
    write_month(
        local_output,
        "10",
        [
            feature("YYZ", "Toronto Pearson"),
            feature("CUN", "Cancún Airport"),
            feature("YWG", "CFB Winnipeg", 1, 1),
            feature("YWG", "Winnipeg Airport", 2, 2),
        ],
        [
            ["RV", "YYZ", "CUN"],
            ["AC", "YYZ", "CUN"],
            ["AC", "YYZ", "CUN"],
            ["RV", "CUN", "YYZ"],
            ["WS", "YWG", "CUN"],
            ["WS", "CUN", "YWG"],
            ["AC", "YYZ", "YYT"],
        ],
        {"RV": "Air Canada Rouge", "AC": "Air Canada", "WS": "WestJet"},
        [{**lost, "airport_name": None, "coordinates": None}],
    )
    write_month(
        local_output,
        "11",
        [
            feature("YYZ", "Toronto Pearson International Airport", city="Toronto"),
            feature("YYT", "St. John's International Airport", 5, 5, city="St. John's"),
            feature("YWG", "CFB Winnipeg", 1, 1),
            feature("YWG", "Winnipeg Airport", 2, 2),
        ],
        [["AC", "YYZ", "YYT"]],
        {"AC": "Air Canada"},
    )

    create_routes.normalize_month(SNAPSHOT)

    assert read_json(local_output, "2026/10/routes.json") == [
        ["AC", "YYZ", "CUN"],
        ["AC", "CUN", "YYZ"],
        ["WS", "YWG", "CUN"],
        ["WS", "CUN", "YWG"],
        ["AC", "YYZ", "YYT"],
    ]
    assert read_json(local_output, "2026/10/airlines.json") == {"AC": "Air Canada", "WS": "WestJet"}
    airports = {f["properties"]["IATA"]: f for f in read_json(local_output, "2026/10/airports.json")["features"]}
    assert airports["YYZ"]["properties"]["Name"] == "Toronto Pearson International Airport"
    assert airports["YYZ"]["properties"]["City"] == "Toronto"
    assert airports["YWG"]["properties"]["Name"] == "Winnipeg Airport"
    assert airports["YWG"]["geometry"]["coordinates"] == [2, 2]
    assert airports["CUN"]["properties"]["destinations"] == 2
    # St. John's has no routes out that month, so it isn't drawn, but its problem gets the latest month's place.
    assert "YYT" not in airports
    assert read_json(local_output, "2026/10/problems.json") == [
        {**lost, "airport_name": "St. John's International Airport", "coordinates": [5, 5]}
    ]


BETHEL = WIKI + "Bethel_Airport"


def saved_bethel(revid: int = 1, parser: int = create_routes.PARSER_VERSION) -> dict:
    return {
        "revid": revid,
        "parser": parser,
        "coordinates": [-161.83722, 60.77861],
        "rows": [
            {
                "airline_name": "Hawaiian Airlines",
                "airline_title": "Hawaiian_Airlines",
                "destination_titles": ["Ted_Stevens_Anchorage_International_Airport"],
            }
        ],
        "error": None,
    }


def test_a_scrape_downloads_each_airport_page_once(wikipedia, monkeypatch):
    bethel = wiki_parse.ListedAirport("Bethel", "BET", "BET", "PABE", "Bethel_Airport", "", None)
    monkeypatch.setattr(create_routes, "list_airports", lambda: [("US", bethel)])

    airports = create_routes.scrape_listed_airports([], {})
    routes = create_routes.get_destinations("BET", airports, {})

    assert ["GV", "BET", "AUK"] in routes
    assert wikipedia.count(BETHEL) == 1


def test_an_unchanged_page_uses_the_saved_rows_with_todays_registry(wikipedia, listed_airports):
    create_routes.page_cache[BETHEL] = saved_bethel()

    routes = create_routes.get_destinations("BET", listed_airports.assign(revid=1), {})

    assert BETHEL not in wikipedia
    # The saved row names Hawaiian; the registry files it under Alaska.
    assert routes == [["AS", "BET", "ANC"]]


@pytest.mark.parametrize(
    "saved", [saved_bethel(revid=1), saved_bethel(revid=2, parser=create_routes.PARSER_VERSION - 1)]
)
def test_a_new_revision_or_parser_downloads_the_page(wikipedia, listed_airports, saved):
    create_routes.page_cache[BETHEL] = saved

    routes = create_routes.get_destinations("BET", listed_airports.assign(revid=2), {})

    assert wikipedia[0] == BETHEL
    assert ["GV", "BET", "AUK"] in routes
    assert create_routes.page_cache[BETHEL]["revid"] == 2


def test_the_page_cache_is_saved_with_the_snapshot(local_output, listed_airports):
    listed_airports = listed_airports.assign(FAA=["BET", "ANC"], title=["Bethel Airport", "Anchorage"])
    create_routes.write_outputs(listed_airports, [["AS", "BET", "ANC"]], {}, SNAPSHOT, [], {BETHEL: saved_bethel()})

    assert create_routes.load_page_cache(full=False) == {BETHEL: saved_bethel()}
    assert create_routes.load_page_cache(full=True) == {}


def test_an_unreadable_page_cache_downloads_everything(local_output):
    (local_output / "cache").mkdir()
    (local_output / "cache" / "pages.json").write_text("{not json", encoding="utf-8")
    assert create_routes.load_page_cache(full=False) == {}
