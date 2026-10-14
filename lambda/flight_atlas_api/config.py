import os
import re
from dataclasses import dataclass
from functools import cache

_IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


@dataclass(frozen=True)
class Settings:
    database: str
    flights_table: str
    airports_table: str
    airlines_table: str
    results_bucket: str
    cache_table: str
    cache_ttl_seconds: int = 7 * 24 * 60 * 60


def _identifier(name: str, value: str) -> str:
    # Table names go into SQL text, where Athena parameters can't reach.
    if not _IDENTIFIER.match(value):
        raise ValueError(f"{name} must be a plain SQL identifier, got {value!r}")
    return value


@cache
def settings() -> Settings:
    env = os.environ
    return Settings(
        database=_identifier("ATHENA_DATABASE", env.get("ATHENA_DATABASE", "flights_db")),
        flights_table=_identifier("FLIGHTS_TABLE", env.get("FLIGHTS_TABLE", "flights")),
        airports_table=_identifier("AIRPORTS_TABLE", env.get("AIRPORTS_TABLE", "airports")),
        airlines_table=_identifier("AIRLINES_TABLE", env.get("AIRLINES_TABLE", "airlines")),
        results_bucket=env.get("S3_RESULTS_BUCKET", "bucket-flight-atlas-query-results"),
        cache_table=env.get("CACHE_TABLE", "flights-query-cache"),
    )
