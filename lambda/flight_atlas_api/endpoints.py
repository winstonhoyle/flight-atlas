"""Turns Athena result rows into each endpoint's response body."""

from . import geo

# The scraper reads regional brands as their own airline; the map shows the parent.
AIRLINE_NAME_OVERRIDES = {"Delta Connection": "Delta Air Lines"}


def airports_body(rows: list[dict], _query) -> dict:
    return geo.airports_collection(rows)


def airlines_body(rows: list[dict], _query) -> dict:
    return {row["airline_code"]: AIRLINE_NAME_OVERRIDES.get(row["name"], row["name"]) for row in rows}


def routes_body(rows: list[dict], query) -> dict:
    return geo.routes_collection(rows, airline=query.airline)
