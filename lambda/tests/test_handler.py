import json

import pytest

from conftest import event
from flight_atlas_api import athena
from flight_atlas_api.handler import lambda_handler

ROUTES_SQL = "SELECT * FROM flights WHERE year = ? AND month = ? AND src_airport = ?"
ROUTE_ROW = {
    "dst_airport": "BOS",
    "dst_geometry": "POINT (-71.0 42.36)",
    "src_geometry": "POINT (-84.43 33.64)",
    "airline_code": "DL",
    "src_airport": "ATL",
}


def call(path: str, **params: str) -> tuple[int, object, dict]:
    response = lambda_handler(event(path, **params), None)
    return response["statusCode"], json.loads(response["body"]), response["headers"]


def test_first_call_starts_the_query_and_the_next_returns_rows(fake):
    fake.results[ROUTES_SQL] = [ROUTE_ROW]

    status, body, headers = call("/routes", airport="ATL")
    assert status == 202 and body["status"] == "started"
    assert headers["Cache-Control"] == "no-store"
    assert fake.executions["q1"]["params"] == ["2026", "2", "'ATL'"]

    status, body, headers = call("/routes", airport="ATL")
    assert status == 200
    assert headers["Cache-Control"].startswith("public")
    assert body["features"][0]["properties"] == {
        "airline_code": "DL",
        "src_airport": "ATL",
        "dst_airport": "BOS",
    }


def test_a_cached_result_location_skips_athena(fake, monkeypatch):
    fake.results[ROUTES_SQL] = [ROUTE_ROW]
    call("/routes", airport="ATL")
    call("/routes", airport="ATL")

    monkeypatch.setattr(athena, "status", lambda _id: pytest.fail("asked Athena again"))
    status, body, _ = call("/routes", airport="ATL")
    assert status == 200 and len(body["features"]) == 1


def test_a_running_query_answers_processing(fake):
    fake.next_state = "RUNNING"
    call("/airports")
    status, body, _ = call("/airports")
    assert status == 202 and body == {"status": "processing", "query_id": "q1"}


def test_a_failed_query_runs_again(fake):
    fake.next_state = "FAILED"
    call("/airports")
    status, body, _ = call("/airports")
    assert status == 202 and body["query_id"] == "q2"


def test_month_without_year_uses_that_months_newest_snapshot(fake):
    call("/airlines", month="10")
    assert fake.executions["q1"]["params"] == ["2025", "10"]


def test_airline_names_use_the_parent_brand(fake):
    fake.results["SELECT * FROM airlines WHERE year = ? AND month = ? ORDER BY route_count DESC"] = [
        {"name": "Delta Connection", "airline_code": "9E", "route_count": "40"},
        {"name": "JetBlue", "airline_code": "B6", "route_count": "30"},
    ]
    call("/airlines")
    _, body, _ = call("/airlines")
    assert body == {"9E": "Delta Air Lines", "B6": "JetBlue"}


def test_available_months_come_from_glue(fake):
    status, body, _ = call("/available_months")
    assert status == 200
    assert body[0] == {"month": "2", "year": "2026"}
    assert fake.executions == {}


@pytest.mark.parametrize(
    "path, params, status, message",
    [
        ("/routes", {}, 400, "Missing parameter"),
        ("/routes", {"airport": "atl"}, 400, "Invalid parameter: atl"),
        ("/airports", {"airport": "ATL"}, 400, "No parameters for this endpoint"),
        (
            "/airports",
            {"month": "13"},
            400,
            "Invalid month. Must be an integer between 1 and 12",
        ),
        ("/airports", {"year": "2024", "month": "5"}, 404, "No data for that month"),
        ("/nowhere", {}, 404, "Not found"),
    ],
)
def test_errors(fake, path, params, status, message):
    got_status, body, headers = call(path, **params)
    assert (got_status, body) == (status, {"error": message})
    assert headers["Cache-Control"] == "no-store"


def test_unexpected_failures_hide_the_details(fake, monkeypatch, caplog):
    monkeypatch.setattr(athena, "start", lambda *_: (_ for _ in ()).throw(RuntimeError("secret detail")))
    status, body, _ = call("/airports")
    assert (status, body) == (500, {"error": "Internal server error"})
    assert "secret detail" in caplog.text
