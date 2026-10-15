import io
import json

import pytest

from flight_atlas_api import aws, config, snapshots


class FakeS3:
    class exceptions:
        class NoSuchKey(Exception):
            pass

    def __init__(self):
        self.objects: dict[str, bytes] = {}
        self.set_snapshots([(2026, 2), (2026, 1), (2025, 12), (2025, 10)])

    def set_snapshots(self, found: list[tuple[int, int]]) -> None:
        body = [{"month": str(month), "year": str(year)} for year, month in found]
        self.objects["snapshots.json"] = json.dumps(body).encode()

    def get_object(self, Bucket, Key):
        if Key not in self.objects:
            raise self.exceptions.NoSuchKey(Key)
        return {"Body": io.BytesIO(self.objects[Key])}


@pytest.fixture
def fake(monkeypatch) -> FakeS3:
    fake = FakeS3()
    monkeypatch.setattr(aws, "s3", lambda: fake)
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
