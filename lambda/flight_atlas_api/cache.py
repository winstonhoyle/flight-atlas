"""DynamoDB cache from a query's hash to its Athena execution and result location."""

import hashlib
import json
import time

from . import aws
from .config import Settings


def key(sql: str, params: list[str]) -> str:
    return hashlib.sha256(json.dumps([sql, params]).encode()).hexdigest()


def lookup(settings: Settings, query_hash: str) -> dict | None:
    return aws.table(settings.cache_table).get_item(Key={"query_hash": query_hash}).get("Item")


def remember_started(settings: Settings, query_hash: str, query_id: str) -> None:
    now = int(time.time())
    aws.table(settings.cache_table).put_item(
        Item={
            "query_hash": query_hash,
            "query_id": query_id,
            "status": "RUNNING",
            "timestamp": now,
            "ttl": now + settings.cache_ttl_seconds,
        }
    )


def remember_succeeded(settings: Settings, query_hash: str, s3_location: str) -> None:
    aws.table(settings.cache_table).update_item(
        Key={"query_hash": query_hash},
        UpdateExpression="SET s3_location = :l, #s = :s, last_updated = :t",
        ExpressionAttributeValues={
            ":l": s3_location,
            ":s": "SUCCEEDED",
            ":t": int(time.time()),
        },
        ExpressionAttributeNames={"#s": "status"},
    )
