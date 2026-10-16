import json

import pytest

from conftest import event
from flight_atlas_api.handler import lambda_handler

ROUTES = [["DL", "ATL", "BOS"]]


def call(path: str, **params: str) -> tuple[int, object, dict]:
    response = lambda_handler(event(path, **params), None)
    return response["statusCode"], json.loads(response["body"]), response["headers"]


def test_serves_the_newest_snapshots_file(fake):
    fake.objects["2026/02/routes.json"] = json.dumps(ROUTES).encode()
    status, body, headers = call("/routes")
    assert (status, body) == (200, ROUTES)
    assert headers["Cache-Control"].startswith("public, max-age=3600")


def test_serves_the_months_problems(fake):
    problems = [{"kind": "destinations_table", "airport": "YYT", "airline": None, "url": None, "message": "No table"}]
    fake.objects["2026/02/problems.json"] = json.dumps(problems).encode()
    assert call("/problems")[:2] == (200, problems)


def test_routes_filter_by_origin_and_airline(fake):
    rows = [["DL", "ATL", "BOS"], ["AA", "ATL", "DFW"], ["AA", "GSO", "CLT"]]
    fake.objects["2026/02/routes.json"] = json.dumps(rows).encode()
    assert call("/routes", airport="atl")[1] == rows[:2]
    assert call("/routes", airline_code="AA")[1] == rows[1:]
    assert call("/routes", airport="ATL", airline_code="AA")[1] == [rows[1]]


def test_a_past_month_is_cached_forever(fake):
    fake.objects["2025/12/airlines.json"] = b'{"DL": "Delta Air Lines"}'
    status, body, headers = call("/airlines", year="2025", month="12")
    assert (status, body) == (200, {"DL": "Delta Air Lines"})
    assert "immutable" in headers["Cache-Control"]


def test_naming_the_newest_month_keeps_the_short_cache(fake):
    fake.objects["2026/02/airports.json"] = b'{"type": "FeatureCollection", "features": []}'
    _, _, headers = call("/airports", year="2026", month="2")
    assert "immutable" not in headers["Cache-Control"]


def test_month_without_year_uses_that_months_newest_snapshot(fake):
    fake.objects["2025/10/routes.json"] = b"[]"
    assert call("/routes", month="10")[0] == 200


def test_available_months_come_from_the_snapshot_list(fake):
    status, body, _ = call("/available_months")
    assert status == 200
    assert body[0] == {"month": "2", "year": "2026"}


@pytest.mark.parametrize(
    "path, params, status, message",
    [
        ("/airports", {"month": "13"}, 400, "Invalid month. Must be an integer between 1 and 12"),
        ("/airports", {"year": "2024", "month": "5"}, 404, "No data for that month"),
        ("/airports", {"year": "2026", "month": "1"}, 404, "No data for that month"),
        ("/routes", {"airport": "ATLX"}, 400, "Invalid parameter: ATLX"),
        ("/nowhere", {}, 404, "Not found"),
    ],
)
def test_errors(fake, path, params, status, message):
    got_status, body, headers = call(path, **params)
    assert (got_status, body) == (status, {"error": message})
    assert headers["Cache-Control"] == "no-store"


def test_unexpected_failures_hide_the_details(fake, monkeypatch, caplog):
    monkeypatch.setattr(fake, "get_object", lambda **_: (_ for _ in ()).throw(RuntimeError("secret detail")))
    status, body, _ = call("/airports")
    assert (status, body) == (500, {"error": "Internal server error"})
    assert "secret detail" in caplog.text
