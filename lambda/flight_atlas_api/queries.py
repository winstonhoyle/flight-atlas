from .config import Settings
from .snapshots import Snapshot

SqlQuery = tuple[str, list[str]]


def _quoted(value: str) -> str:
    # Athena substitutes parameters as literals, so strings carry their own quotes.
    return "'" + value.replace("'", "''") + "'"


def routes(settings: Settings, snapshot: Snapshot, airport: str | None, airline: str | None) -> SqlQuery:
    year, month = snapshot
    sql = f"SELECT * FROM {settings.flights_table} WHERE year = ? AND month = ?"
    params = [str(year), str(month)]
    # With both set, the airport's routes are fetched and filtered by airline afterwards.
    if airport:
        sql += " AND src_airport = ?"
        params.append(_quoted(airport))
    elif airline:
        sql += " AND airline_code = ?"
        params.append(_quoted(airline))
    return sql, params


def airlines(settings: Settings, snapshot: Snapshot, airline: str | None) -> SqlQuery:
    year, month = snapshot
    sql = f"SELECT * FROM {settings.airlines_table} WHERE year = ? AND month = ?"
    params = [str(year), str(month)]
    if airline:
        return sql + " AND airline_code = ?", [*params, _quoted(airline)]
    return sql + " ORDER BY route_count DESC", params


def airports(settings: Settings, snapshot: Snapshot) -> SqlQuery:
    year, month = snapshot
    return (
        f"SELECT * FROM {settings.airports_table} WHERE year = ? AND month = ? ORDER BY destinations DESC",
        [str(year), str(month)],
    )
