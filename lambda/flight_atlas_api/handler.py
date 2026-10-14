import logging

from . import athena, cache, endpoints, queries, snapshots
from .config import Settings, settings
from .params import BadRequest, Query, parse_query
from .responses import error, json_response

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def _available_months(_query: Query, config: Settings) -> dict:
    # Strings, matching what the API returned when this came from Athena.
    body = [{"month": str(month), "year": str(year)} for year, month in snapshots.available(config)]
    return json_response(200, body)


def _from_athena(build_sql, render):
    def endpoint(query: Query, config: Settings) -> dict:
        snapshot = snapshots.resolve(query, snapshots.available(config))
        if snapshot is None:
            return error(404, "No data for that month")
        sql, params = build_sql(query, config, snapshot)
        return _run_cached(sql, params, lambda rows: render(rows, query), config)

    return endpoint


_routes_query = _from_athena(lambda q, c, s: queries.routes(c, s, q.airport, q.airline), endpoints.routes_body)
_airports_query = _from_athena(lambda q, c, s: queries.airports(c, s), endpoints.airports_body)
_airlines = _from_athena(lambda q, c, s: queries.airlines(c, s, q.airline), endpoints.airlines_body)


def _routes(query: Query, config: Settings) -> dict:
    if not query.airport and not query.airline:
        return error(400, "Missing parameter")
    return _routes_query(query, config)


def _airports(query: Query, config: Settings) -> dict:
    if query.airport or query.airline:
        return error(400, "No parameters for this endpoint")
    return _airports_query(query, config)


ENDPOINTS = {
    "/routes": _routes,
    "/airports": _airports,
    "/airlines": _airlines,
    "/available_months": _available_months,
}


def _run_cached(sql: str, params: list[str], render, config: Settings) -> dict:
    """
    Answers from a finished Athena query when one is cached. Otherwise starts the query and
    returns 202; the client polls the same URL until the result is ready.
    """
    query_hash = cache.key(sql, params)
    cached = cache.lookup(config, query_hash)

    if cached and cached.get("s3_location"):
        return json_response(200, render(athena.read_rows(cached["s3_location"])))

    if cached and "query_id" in cached:
        state, location = athena.status(cached["query_id"])
        if state == "SUCCEEDED":
            cache.remember_succeeded(config, query_hash, location)
            return json_response(200, render(athena.read_rows(location)))
        if state in athena.RUNNING_STATES:
            return json_response(202, {"status": "processing", "query_id": cached["query_id"]})
        # FAILED or CANCELLED: run it again below.

    query_id = athena.start(sql, params, config)
    cache.remember_started(config, query_hash, query_id)
    return json_response(202, {"status": "started", "query_id": query_id})


def lambda_handler(event: dict, _context) -> dict:
    endpoint = ENDPOINTS.get(event.get("rawPath", ""))
    if endpoint is None:
        return error(404, "Not found")
    try:
        query = parse_query(event.get("queryStringParameters") or {})
        return endpoint(query, settings())
    except BadRequest as e:
        return error(400, str(e))
    except Exception:
        logger.exception("Request failed")
        return error(500, "Internal server error")
