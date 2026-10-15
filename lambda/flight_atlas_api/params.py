from dataclasses import dataclass


class BadRequest(ValueError):
    pass


@dataclass(frozen=True)
class Query:
    year: int | None = None
    month: int | None = None


def _int(value: str | None, low: int, high: int, message: str) -> int | None:
    if value is None:
        return None
    try:
        number = int(value)
    except ValueError:
        raise BadRequest(message) from None
    if not low <= number <= high:
        raise BadRequest(message)
    return number


def parse_query(params: dict[str, str]) -> Query:
    query = Query(
        month=_int(
            params.get("month"),
            1,
            12,
            "Invalid month. Must be an integer between 1 and 12",
        ),
        year=_int(params.get("year"), 2000, 2100, "Invalid year. Must be a four-digit year"),
    )
    if query.year is not None and query.month is None:
        raise BadRequest("year needs month")
    return query
