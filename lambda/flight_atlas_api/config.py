import os
from dataclasses import dataclass
from functools import cache


@dataclass(frozen=True)
class Settings:
    bucket: str


@cache
def settings() -> Settings:
    return Settings(bucket=os.environ.get("S3_ROUTES_BUCKET", "bucket-flight-atlas-routes"))
