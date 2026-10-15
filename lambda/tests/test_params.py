import pytest

from flight_atlas_api.params import BadRequest, Query, parse_query


def test_reads_dates():
    assert parse_query({"year": "2026", "month": "2"}) == Query(year=2026, month=2)


@pytest.mark.parametrize(
    "params, message",
    [
        ({"month": "13"}, "Invalid month"),
        ({"month": "may"}, "Invalid month"),
        ({"year": "26", "month": "2"}, "Invalid year"),
        ({"year": "2026"}, "year needs month"),
    ],
)
def test_rejects_bad_input(params, message):
    with pytest.raises(BadRequest, match=message):
        parse_query(params)
