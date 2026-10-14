import pytest

from flight_atlas_api.params import BadRequest, Query, parse_query


def test_reads_codes_and_dates():
    query = parse_query({"airport": "ATL", "airline_code": "DL", "year": "2026", "month": "2"})
    assert query == Query(airport="ATL", airline="DL", year=2026, month=2)


def test_keeps_the_part_before_a_stray_question_mark():
    assert parse_query({"airport": "ATL?month=2"}).airport == "ATL"


@pytest.mark.parametrize(
    "params, message",
    [
        ({"airport": "atl"}, "Invalid parameter: atl"),
        ({"airport": "ATL'--"}, "Invalid parameter"),
        ({"airline_code": "DELTA"}, "Invalid parameter: DELTA"),
        ({"month": "13"}, "Invalid month"),
        ({"month": "may"}, "Invalid month"),
        ({"year": "26", "month": "2"}, "Invalid year"),
        ({"year": "2026"}, "year needs month"),
    ],
)
def test_rejects_bad_input(params, message):
    with pytest.raises(BadRequest, match=message):
        parse_query(params)
