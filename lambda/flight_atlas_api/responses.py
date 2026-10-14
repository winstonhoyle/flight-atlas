import json

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
}

# Snapshots don't change once written; 202s and errors must not be cached.
CACHE_OK = "public, max-age=3600, stale-while-revalidate=86400"
CACHE_NONE = "no-store"


def json_response(status_code: int, body) -> dict:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Cache-Control": CACHE_OK if status_code == 200 else CACHE_NONE,
            **CORS_HEADERS,
        },
        "body": json.dumps(body),
    }


def error(status_code: int, message: str) -> dict:
    return json_response(status_code, {"error": message})
