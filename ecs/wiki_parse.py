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
    if "/wiki/" not in href:
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
    table = soup.find("table", {"class": "infobox-airline-codes"})
    rows = table.find_all("tr") if table else []
    cell = rows[1].find("td") if len(rows) > 1 else None
    code = clean_text(cell.text)[:2] if cell else ""
    return code if re.fullmatch(r"[A-Z0-9]{2}", code) else None


def _is_destinations_heading(tag: Tag) -> bool:
    heading_id = tag.get("id", "").lower()
    return tag.name in ("h2", "h3", "h4") and "airline" in heading_id and "destination" in heading_id


def find_destination_rows(soup: BeautifulSoup) -> list[Tag]:
    """The first wikitable in the section is the passenger table; cargo comes after it."""
    heading = soup.find(_is_destinations_heading)
    if heading is None:
        raise LookupError("No 'Airlines and destinations' section")

    for element in heading.find_all_next(["table", "h2"]):
        if element.name == "h2":
            break
        classes = set(element.get("class") or [])
        if "wikitable" in classes and not classes & _NOTICE_CLASSES:
            return [tr for tr in element.find_all("tr") if tr.find("td")]
    raise LookupError("No destinations table in the 'Airlines and destinations' section")


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


def parse_airport_list(soup: BeautifulSoup) -> list[ListedAirport]:
    table = soup.find("table", {"class": "wikitable"})
    if table is None:
        raise LookupError("No airports table")

    airports = []
    for tr in table.find_all("tr"):
        cells = tr.find_all("td")
        if len(cells) < 7 or not clean_text(cells[1].text):
            continue
        city, faa, iata, icao, airport, role, enplanements = cells[:7]
        link = airport.find("a", href=True)
        count = clean_text(enplanements.text).replace(",", "")
        airports.append(
            ListedAirport(
                city=clean_text(city.text),
                faa=clean_text(faa.text),
                iata=clean_text(iata.text),
                icao=clean_text(icao.text),
                airport_title=wiki_title(link["href"]) if link else None,
                role=clean_text(role.text),
                enplanements=int(count) if count.isdigit() else None,
            )
        )
    return airports
