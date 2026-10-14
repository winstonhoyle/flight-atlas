import pytest

from flight_atlas_api import snapshots
from flight_atlas_api.config import settings
from flight_atlas_api.params import Query

SNAPSHOTS = [(2026, 2), (2026, 1), (2025, 12), (2025, 10)]


def test_lists_snapshots_newest_first(fake):
    fake.partitions = [(2025, 10), (2026, 2), (2025, 10), (2026, 1)]
    assert snapshots.available(settings()) == [(2026, 2), (2026, 1), (2025, 10)]


@pytest.mark.parametrize(
    "query, expected",
    [
        (Query(), (2026, 2)),
        (Query(year=2025, month=12), (2025, 12)),
        (Query(year=2024, month=12), None),
        (Query(month=12), (2025, 12)),
        (Query(month=6), (2026, 2)),  # no June snapshot: the newest one
    ],
)
def test_resolves_the_requested_snapshot(query, expected):
    assert snapshots.resolve(query, SNAPSHOTS) == expected


def test_no_snapshots_resolves_to_nothing():
    assert snapshots.resolve(Query(), []) is None
