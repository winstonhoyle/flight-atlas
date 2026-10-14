from flight_atlas_api import queries
from flight_atlas_api.config import settings


def test_routes_by_airport_keep_input_out_of_the_sql():
    sql, params = queries.routes(settings(), (2026, 2), "ATL", None)
    assert sql == "SELECT * FROM flights WHERE year = ? AND month = ? AND src_airport = ?"
    assert params == ["2026", "2", "'ATL'"]


def test_routes_by_airline():
    sql, params = queries.routes(settings(), (2026, 2), None, "DL")
    assert sql.endswith("AND airline_code = ?")
    assert params[-1] == "'DL'"


def test_airport_wins_when_both_are_given():
    sql, _ = queries.routes(settings(), (2026, 2), "ATL", "DL")
    assert "src_airport" in sql and "airline_code" not in sql


def test_airlines_are_ordered_by_route_count():
    sql, params = queries.airlines(settings(), (2025, 10), None)
    assert sql.endswith("ORDER BY route_count DESC") and params == ["2025", "10"]


def test_quotes_are_escaped():
    assert queries._quoted("O'Hare") == "'O''Hare'"
