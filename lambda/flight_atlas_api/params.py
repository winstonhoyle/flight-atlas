import re
from dataclasses import dataclass

AIRPORT = re.compile(r"^[A-Z]{3}$")
AIRLINE = re.compile(r"^[A-Z0-9]{2,3}$")


class BadRequest(ValueError):
    pass


@dataclass(frozen=True)
class Query:
    airport: str | None = None
    airline: str | None = None
    year: int | None = None
    month: int | None = None


def _code(value: str | None, pattern: re.Pattern) -> str | None:
    if not value:
        return None
    # Some clients have sent a second "?" inside the query string; keep what precedes it.
    value = value.strip().split("?")[0]
    if not pattern.match(value):
        raise BadRequest(f"Invalid parameter: {value}")
    return value


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
        airport=_code(params.get("airport"), AIRPORT),
        airline=_code(params.get("airline_code"), AIRLINE),
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
