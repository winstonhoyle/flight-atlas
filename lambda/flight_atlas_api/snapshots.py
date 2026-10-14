import time

from . import aws
from .config import Settings
from .params import Query

Snapshot = tuple[int, int]  # (year, month)

_TTL_SECONDS = 600
_cached: tuple[float, list[Snapshot]] | None = None


def available(settings: Settings) -> list[Snapshot]:
    """Newest first."""
    global _cached
    if _cached and time.monotonic() - _cached[0] < _TTL_SECONDS:
        return _cached[1]

    found: set[Snapshot] = set()
    pages = (
        aws.glue()
        .get_paginator("get_partitions")
        .paginate(DatabaseName=settings.database, TableName=settings.airlines_table)
    )
    for page in pages:
        for partition in page["Partitions"]:
            year, month = partition["Values"][:2]
            found.add((int(year), int(month)))

    snapshots = sorted(found, reverse=True)
    _cached = (time.monotonic(), snapshots)
    return snapshots


def clear_cache() -> None:
    global _cached
    _cached = None


def resolve(query: Query, snapshots: list[Snapshot]) -> Snapshot | None:
    """
    year + month: exactly that snapshot, or None. Month alone: that month's newest year,
    else the newest snapshot, so a client that asks for the current month still gets data.
    Neither: the newest snapshot.
    """
    if not snapshots:
        return None
    if query.year is not None:
        wanted = (query.year, query.month)
        return wanted if wanted in snapshots else None
    if query.month is not None:
        return next((s for s in snapshots if s[1] == query.month), snapshots[0])
    return snapshots[0]
