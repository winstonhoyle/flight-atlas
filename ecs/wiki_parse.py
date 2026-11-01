import re
from dataclasses import dataclass, field
from urllib.parse import unquote

from bs4 import BeautifulSoup, Tag
from lat_lon_parser import parse as parse_degrees

# Footnote markers: [12], [a], [note 1], [citation needed], with or without inner spaces.
FOOTNOTE = re.compile(r"\[[^\[\]]*\]")

_SKIPPED_NAMESPACES = (
    "Wikipedia:",
    "Help:",
    "File:",
    "Template:",
    "Special:",
    "Category:",
)

_NOTICE_CLASSES = {"ambox", "metadata", "plainlinks", "box-Multiple_issues"}


def clean_text(text: str) -> str:
    return " ".join(FOOTNOTE.sub("", text).split())


def soup_of(html: str) -> BeautifulSoup:
    return BeautifulSoup(html, "html.parser")


def wiki_title(href: str) -> str | None:
    """The article title an href points to, or None for non-article links."""
    href = unquote(href)
    if "/wiki/" not in href or "redlink=1" in href:
        return None
    title, _, fragment = href.split("/wiki/", 1)[1].partition("#")
    if fragment.startswith("cite_note") or title.startswith(_SKIPPED_NAMESPACES):
        return None
    return title or None


def wiki_url(title: str) -> str:
    return f"https://en.wikipedia.org/wiki/{title}"


def parse_coordinates(soup: BeautifulSoup) -> tuple[float, float] | None:
    """(longitude, latitude) from the first coordinates on the page, rounded to 5 places."""
    lat = soup.find("span", {"class": "latitude"})
    lon = soup.find("span", {"class": "longitude"})
    if not lat or not lon:
        return None
    try:
        return round(parse_degrees(lon.text), 5), round(parse_degrees(lat.text), 5)
    except ValueError:
        return None


def parse_iata(soup: BeautifulSoup) -> str | None:
    link = soup.find("a", href=lambda h: h and "/wiki/IATA_airport_code" in h)
    code_span = link.find_next("span") if link else None
    code = clean_text(code_span.text) if code_span else ""
    return code if re.fullmatch(r"[A-Z0-9]{3}", code) else None


def parse_airline_code(soup: BeautifulSoup) -> str | None:
    """The IATA code, or the ICAO code for an airline without one (Mokulele: IATA None, ICAO MHO)."""
    table = soup.find("table", {"class": "infobox-airline-codes"})
    rows = table.find_all("tr") if table else []
    if len(rows) < 2:
        return None
    headers = [clean_text(th.get_text()) for th in rows[0].find_all("th")]
    codes = dict(zip(headers, (clean_text(td.get_text()) for td in rows[1].find_all("td")), strict=False))
    iata, icao = codes.get("IATA", "")[:2], codes.get("ICAO", "")
    if re.fullmatch(r"[A-Z0-9]{2}", iata):
        return iata
    return icao if re.fullmatch(r"[A-Z]{3}", icao) else None


def _is_destinations_heading(tag: Tag) -> bool:
    heading_id = tag.get("id", "").lower()
    return tag.name in ("h2", "h3", "h4") and "airline" in heading_id and "destination" in heading_id


def _is_airlines_table(table: Tag) -> bool:
    classes = set(table.get("class") or [])
    header = table.find("th")
    return (
        "wikitable" in classes
        and not classes & _NOTICE_CLASSES
        and header is not None
        and "airline" in header.get_text().lower()
    )


def find_destination_rows(soup: BeautifulSoup) -> list[Tag]:
    """
    The first airlines table under any "Airlines and destinations" heading; the passenger table
    comes before cargo. Ranking tables ("Top destinations") have no Airlines column and are skipped.
    """
    headings = soup.find_all(_is_destinations_heading)
    if not headings:
        raise LookupError("No 'Airlines and destinations' section")

    for heading in headings:
        for element in heading.find_all_next(["table", "h2"]):
            if element.name == "h2":
                break
            if _is_airlines_table(element):
                return [tr for tr in element.find_all("tr") if tr.find("td")]
    raise LookupError("No airlines table in the 'Airlines and destinations' section")


@dataclass
class DestinationRow:
    airline_name: str
    airline_title: str | None
    destination_titles: list[str] = field(default_factory=list)


def parse_destination_row(tr: Tag) -> DestinationRow | None:
    cells = tr.find_all("td", recursive=False) or tr.find_all("td")
    if len(cells) < 2:
        return None

    airline_cell, destinations_cell = cells[0], cells[1]
    if not clean_text(airline_cell.get_text()):
        return None
    airline_link = airline_cell.find("a", href=True)
    titles: list[str] = []
    for link in destinations_cell.find_all("a", href=True):
        title = wiki_title(link["href"])
        if title and title not in titles:
            titles.append(title)

    return DestinationRow(
        airline_name=clean_text(airline_cell.get_text()),
        airline_title=wiki_title(airline_link["href"]) if airline_link else None,
        destination_titles=titles,
    )


@dataclass
class ListedAirport:
    city: str
    faa: str
    iata: str
    icao: str
    airport_title: str | None
    role: str
    enplanements: int | None


# The U.S., Mexico and Canada lists name and order their columns differently.
_LIST_COLUMNS = {
    "city": ("City", "City served", "Community"),
    "faa": ("FAA",),
    "iata": ("IATA",),
    "icao": ("ICAO",),
    "airport": ("Airport", "Airport name"),
    "role": ("Role",),
    "enplanements": ("Enplanements",),
}
_LIST_END_SECTIONS = {"Military only airports", "Defunct airports"}


def parse_airport_list(soup: BeautifulSoup) -> list[ListedAirport]:
    """Rows with an IATA code and an airport link, from every wikitable with an IATA column."""
    tables = []
    for table in soup.find_all("table", {"class": "wikitable"}):
        rows = table.find_all("tr")
        names = [clean_text(th.get_text(" ")) for th in rows[0].find_all("th")] if rows else []
        if "IATA" in names:
            columns = {
                key: next((names.index(a) for a in aliases if a in names), None)
                for key, aliases in _LIST_COLUMNS.items()
            }
            tables.append((columns, rows[1:]))
    if not tables:
        raise LookupError("No airports table")

    airports = []
    for columns, rows in tables:
        for tr in rows:
            cells = tr.find_all("td")
            if not cells:
                if clean_text(tr.get_text()) in _LIST_END_SECTIONS:
                    break
                continue
            by_key = {key: cells[i] for key, i in columns.items() if i is not None and i < len(cells)}
            text = {key: clean_text(cell.get_text()) for key, cell in by_key.items()}
            link = by_key["airport"].find("a", href=True) if "airport" in by_key else None
            title = wiki_title(link["href"]) if link else None
            # Canada links some small fields to a list page, whose coordinates aren't the airport's.
            if not title or title.startswith("List_of_") or not re.fullmatch(r"[A-Z]{3}", text.get("iata", "")):
                continue
            count = text.get("enplanements", "").replace(",", "")
            airports.append(
                ListedAirport(
                    city=text.get("city", ""),
                    faa=text.get("faa", ""),
                    iata=text["iata"],
                    icao=text.get("icao", ""),
                    airport_title=title,
                    role=text.get("role", ""),
                    enplanements=int(count) if count.isdigit() else None,
                )
            )
    return airports


def parse_list_links(soup: BeautifulSoup, prefix: str) -> list[str]:
    """Distinct article titles starting with prefix, in page order."""
    titles = (wiki_title(a["href"]) for a in soup.find_all("a", href=True))
    return list(dict.fromkeys(t for t in titles if t and t.startswith(prefix)))
