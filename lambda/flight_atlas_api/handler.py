import json
import logging

from . import aws, snapshots
from .config import Settings, settings
from .params import BadRequest, Query, parse_query
from .responses import CACHE_FOREVER, CACHE_OK, error, json_response, raw_response

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def _available_months(_query: Query, config: Settings) -> dict:
    body = [{"month": str(month), "year": str(year)} for year, month in snapshots.available(config)]
    return json_response(200, body)


def _matches(route: list[str], query: Query) -> bool:
    airline, src, _dst = route
    return (query.airport in (None, src)) and (query.airline in (None, airline))


def _snapshot_file(name: str):
    def endpoint(query: Query, config: Settings) -> dict:
        available = snapshots.available(config)
        snapshot = snapshots.resolve(query, available)
        if snapshot is None:
            return error(404, "No data for that month")
        year, month = snapshot
        s3 = aws.s3()
        try:
            body = s3.get_object(Bucket=config.bucket, Key=f"{year}/{month:02d}/{name}")["Body"].read()
        except s3.exceptions.NoSuchKey:
            return error(404, "No data for that month")
        pinned = query.year is not None and snapshot != available[0]
        if name == "routes.json" and (query.airport or query.airline):
            body = json.dumps([r for r in json.loads(body) if _matches(r, query)]).encode()
        return raw_response(200, body.decode(), CACHE_FOREVER if pinned else CACHE_OK)

    return endpoint


ENDPOINTS = {
    "/routes": _snapshot_file("routes.json"),
    "/airports": _snapshot_file("airports.json"),
    "/airlines": _snapshot_file("airlines.json"),
    "/available_months": _available_months,
}


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
