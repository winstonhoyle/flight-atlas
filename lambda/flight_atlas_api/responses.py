import json

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
}

# The scraper rewrites the newest snapshot; older ones never change.
CACHE_OK = "public, max-age=3600, stale-while-revalidate=86400"
CACHE_FOREVER = "public, max-age=31536000, immutable"
CACHE_NONE = "no-store"


def raw_response(status_code: int, body: str, cache_control: str) -> dict:
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json", "Cache-Control": cache_control, **CORS_HEADERS},
        "body": body,
    }


def json_response(status_code: int, body) -> dict:
    return raw_response(status_code, json.dumps(body), CACHE_OK if status_code == 200 else CACHE_NONE)


def error(status_code: int, message: str) -> dict:
    return json_response(status_code, {"error": message})
