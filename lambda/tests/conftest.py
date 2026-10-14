import csv
import io
import itertools

import pytest

from flight_atlas_api import aws, config, snapshots


class FakeAws:
    """In-memory Athena, S3, Glue, and DynamoDB, enough for the handler's calls."""

    def __init__(self):
        self.partitions: list[tuple[int, int]] = [
            (2026, 2),
            (2026, 1),
            (2025, 12),
            (2025, 10),
        ]
        self.results: dict[str, list[dict]] = {}  # SQL text -> rows the query returns
        self.executions: dict[str, dict] = {}
        self.objects: dict[str, str] = {}
        self.items: dict[str, dict] = {}
        self.next_state = "SUCCEEDED"
        self._ids = itertools.count(1)

    # Athena
    def start_query_execution(self, QueryString, QueryExecutionContext, ResultConfiguration, **kw):
        query_id = f"q{next(self._ids)}"
        location = f"{ResultConfiguration['OutputLocation']}{query_id}.csv"
        self.executions[query_id] = {
            "sql": QueryString,
            "params": kw.get("ExecutionParameters", []),
            "state": self.next_state,
            "location": location,
        }
        self.objects[location] = to_csv(self.results.get(QueryString, []))
        return {"QueryExecutionId": query_id}

    def get_query_execution(self, QueryExecutionId):
        execution = self.executions[QueryExecutionId]
        return {
            "QueryExecution": {
                "Status": {"State": execution["state"]},
                "ResultConfiguration": {"OutputLocation": execution["location"]},
            }
        }

    # S3
    def get_object(self, Bucket, Key):
        return {"Body": io.BytesIO(self.objects[f"s3://{Bucket}/{Key}"].encode())}

    # Glue
    def get_paginator(self, _name):
        partitions = [{"Values": [str(y), str(m), "AA", "ATL"]} for y, m in self.partitions]
        return type(
            "Paginator",
            (),
            {"paginate": lambda _self, **_kw: [{"Partitions": partitions}]},
        )()

    # DynamoDB table
    def get_item(self, Key):
        item = self.items.get(Key["query_hash"])
        return {"Item": dict(item)} if item else {}

    def put_item(self, Item):
        self.items[Item["query_hash"]] = dict(Item)

    def update_item(self, Key, ExpressionAttributeValues, **_kw):
        self.items[Key["query_hash"]].update(
            s3_location=ExpressionAttributeValues[":l"],
            status=ExpressionAttributeValues[":s"],
        )


def to_csv(rows: list[dict]) -> str:
    if not rows:
        return ""
    out = io.StringIO()
    writer = csv.DictWriter(out, fieldnames=list(rows[0]), quoting=csv.QUOTE_ALL)
    writer.writeheader()
    writer.writerows(rows)
    return out.getvalue()


@pytest.fixture
def fake(monkeypatch) -> FakeAws:
    fake = FakeAws()
    for name in ("athena", "s3", "glue"):
        monkeypatch.setattr(aws, name, lambda: fake)
    monkeypatch.setattr(aws, "table", lambda _name: fake)
    snapshots.clear_cache()
    config.settings.cache_clear()
    yield fake
    snapshots.clear_cache()


def event(path: str, **params: str) -> dict:
    return {
        "version": "2.0",
        "rawPath": path,
        "queryStringParameters": params or None,
        "requestContext": {"http": {"method": "GET", "path": path}},
    }
