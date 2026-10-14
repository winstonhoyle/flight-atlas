from flight_atlas_api import geo


def test_parses_wkt_points():
    assert geo.parse_wkt_point("POINT (-84.42806 33.63667)") == (-84.42806, 33.63667)


def test_airports_skip_bad_rows_and_blank_faa_codes():
    rows = [
        {
            "iata": "ATL",
            "faa": "ATL",
            "title": "Atlanta",
            "url": "u",
            "geometry": "POINT (1 2)",
            "destinations": "9",
        },
        {
            "iata": "XX",
            "faa": "",
            "title": "Bad",
            "url": "u",
            "geometry": "POINT (1 2)",
            "destinations": "1",
        },
        {
            "iata": "BOS",
            "faa": "0.0",
            "title": "Boston",
            "url": "u",
            "geometry": "nonsense",
            "destinations": "1",
        },
        {
            "iata": "JFK",
            "faa": "0.0",
            "title": "JFK",
            "url": "u",
            "geometry": "POINT (3 4)",
            "destinations": "2",
        },
    ]
    features = geo.airports_collection(rows)["features"]
    assert [f["properties"]["IATA"] for f in features] == ["ATL", "JFK"]
    assert features[1]["properties"]["FAA"] is None
    assert features[0]["geometry"]["coordinates"] == [1.0, 2.0]


def test_routes_filter_by_airline():
    rows = [
        {
            "airline_code": "DL",
            "src_airport": "ATL",
            "dst_airport": "BOS",
            "src_geometry": "POINT (1 2)",
            "dst_geometry": "POINT (3 4)",
        },
        {
            "airline_code": "B6",
            "src_airport": "ATL",
            "dst_airport": "BOS",
            "src_geometry": "POINT (1 2)",
            "dst_geometry": "POINT (3 4)",
        },
    ]
    features = geo.routes_collection(rows, airline="DL")["features"]
    assert len(features) == 1
    assert features[0]["geometry"]["coordinates"] == [[1.0, 2.0], [3.0, 4.0]]
