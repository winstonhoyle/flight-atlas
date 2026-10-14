"""
Parsers against real Wikipedia pages (tests/fixtures, fetched 2026-10-13) and against small
snippets for each kind of mess those pages contain.
"""

from pathlib import Path

import pytest

from wiki_parse import (
    clean_text,
    find_destination_rows,
    parse_airline_code,
    parse_airport_list,
    parse_coordinates,
    parse_destination_row,
    parse_iata,
    soup_of,
    wiki_title,
)

FIXTURES = Path(__file__).parent / "fixtures"


def fixture(name: str):
    return soup_of((FIXTURES / name).read_text(encoding="utf-8"))


def html(body: str):
    return soup_of(f"<html><body>{body}</body></html>")


def destinations_page(*tables: str, heading_id: str = "Airlines_and_destinations") -> str:
    return f'<div class="mw-heading mw-heading2"><h2 id="{heading_id}">Airlines and destinations</h2></div>' + "".join(
        tables
    )


def wikitable(*rows: str) -> str:
    return (
        '<table class="wikitable sortable"><tbody><tr><th>Airlines</th><th>Destinations</th></tr>'
        + "".join(rows)
        + "</tbody></table>"
    )


# Real pages


class TestAtlanta:
    soup = fixture("atl.html")

    def test_infobox(self):
        assert parse_iata(self.soup) == "ATL"
        assert parse_coordinates(self.soup) == (-84.42806, 33.63667)

    def test_reads_the_passenger_table_not_cargo(self):
        rows = [parse_destination_row(tr) for tr in find_destination_rows(self.soup)]
        assert [r.airline_name for r in rows][:3] == [
            "Aeroméxico Connect",
            "Air Canada",
            "Air Canada Express",
        ]
        assert len(rows) == 12

    def test_destination_cells_drop_citations_and_keep_seasonal_routes(self):
        rows = {r.airline_name: r for r in map(parse_destination_row, find_destination_rows(self.soup))}
        assert rows["Aeroméxico Connect"].destination_titles == [
            "Bajío_International_Airport",
            "Monterrey_International_Airport",
            "Querétaro_Intercontinental_Airport",
        ]
        # Links can be redirects; the scraper resolves them to the airport article later.
        assert rows["Air Canada"].destination_titles == [
            "Toronto–Pearson",
            "Montréal–Trudeau",
        ]
        assert len(rows["Delta Air Lines"].destination_titles) == 198
        every_title = [t for r in rows.values() for t in r.destination_titles]
        assert not [t for t in every_title if "cite_note" in t or t.startswith("Wikipedia:")]


def test_bethel_skips_the_citations_needed_box():
    soup = fixture("bethel.html")
    rows = [parse_destination_row(tr) for tr in find_destination_rows(soup)]
    assert parse_iata(soup) == "BET"
    assert [r.airline_name for r in rows][0] == "Alaska Airlines"
    assert sum(len(r.destination_titles) for r in rows) == 65


def test_anchorage_ignores_the_refs_column():
    soup = fixture("anchorage.html")
    rows = [parse_destination_row(tr) for tr in find_destination_rows(soup)]
    assert len(rows) == 17
    assert rows[0].destination_titles == ["Vancouver_International_Airport"]


def test_delta_airline_code():
    assert parse_airline_code(fixture("delta.html")) == "DL"


def test_airport_list_skips_state_rows_and_reads_counts():
    airports = parse_airport_list(fixture("airport_list.html"))
    assert len(airports) == 9
    bhm = airports[0]
    assert (bhm.city, bhm.faa, bhm.iata, bhm.icao, bhm.role) == (
        "Birmingham",
        "BHM",
        "BHM",
        "KBHM",
        "P-S",
    )
    assert bhm.airport_title == "Birmingham–Shuttlesworth_International_Airport"
    assert bhm.enplanements == 1596510


# Snippets


@pytest.mark.parametrize(
    "raw, cleaned",
    [
        ("American Airlines[12]", "American Airlines"),
        ("Alaska Airlines [ 82 ]", "Alaska Airlines"),
        ("Ravn Alaska[a][note 1]", "Ravn Alaska"),
        ("Fox Air[citation needed]", "Fox Air"),
        ("  Delta\n Connection  ", "Delta Connection"),
    ],
)
def test_clean_text_strips_footnotes(raw, cleaned):
    assert clean_text(raw) == cleaned


@pytest.mark.parametrize(
    "href, title",
    [
        ("/wiki/Logan_International_Airport", "Logan_International_Airport"),
        (
            "https://en.wikipedia.org/wiki/Montr%C3%A9al%E2%80%93Trudeau_International_Airport",
            "Montréal–Trudeau_International_Airport",
        ),
        (
            "/wiki/Toronto_Pearson_International_Airport#Terminal_1",
            "Toronto_Pearson_International_Airport",
        ),
        ("#cite_note-83", None),
        ("/wiki/Some_Airport#cite_note-5", None),
        ("/wiki/Wikipedia:Citation_needed", None),
        ("/wiki/Help:IPA", None),
        ("/wiki/File:Map.png", None),
        ("https://www.example.com/schedule", None),
    ],
)
def test_wiki_title(href, title):
    assert wiki_title(href) == title


def test_skips_notice_boxes_and_tables_without_a_class():
    soup = html(
        destinations_page(
            '<table class="box-More_citations_needed plainlinks metadata ambox"><tr><td>Box</td></tr></table>',
            "<table><tr><td>layout</td><td>table</td></tr></table>",
            wikitable(
                '<tr><td><a href="/wiki/Ravn_Alaska">Ravn Alaska</a></td>'
                '<td><a href="/wiki/Nome_Airport">Nome</a></td></tr>'
            ),
        )
    )
    rows = find_destination_rows(soup)
    assert parse_destination_row(rows[0]).destination_titles == ["Nome_Airport"]


def test_does_not_wander_into_the_next_section():
    soup = html(
        destinations_page("<p>Service is seasonal.</p>")
        + '<div class="mw-heading mw-heading2"><h2 id="Statistics">Statistics</h2></div>'
        + wikitable("<tr><td>2024</td><td>1,000</td></tr>")
    )
    with pytest.raises(LookupError, match="No destinations table"):
        find_destination_rows(soup)


def test_missing_section():
    with pytest.raises(LookupError, match="No 'Airlines and destinations' section"):
        find_destination_rows(html("<h2 id='History'>History</h2>"))


def test_accepts_heading_variants():
    soup = html(
        destinations_page(
            wikitable("<tr><td>Ravn Alaska</td><td><a href='/wiki/Nome_Airport'>Nome</a></td></tr>"),
            heading_id="Passenger_airlines_and_destinations",
        )
    )
    assert len(find_destination_rows(soup)) == 1


def test_row_with_an_unlinked_airline_and_duplicate_links():
    row = html(
        "<table><tr><td>Fox Air[1]</td><td>"
        "<a href='/wiki/Nome_Airport'>Nome</a>, Seasonal: <a href='/wiki/Nome_Airport'>Nome</a>"
        "<sup><a href='#cite_note-1'>[1]</a></sup> "
        "<a href='/wiki/Wikipedia:Citation_needed'>citation needed</a></td></tr></table>"
    ).find("tr")
    parsed = parse_destination_row(row)
    assert parsed.airline_name == "Fox Air"
    assert parsed.airline_title is None
    assert parsed.destination_titles == ["Nome_Airport"]


def test_row_without_two_cells():
    assert parse_destination_row(html("<table><tr><td colspan='2'>Cargo</td></tr></table>").find("tr")) is None


@pytest.mark.parametrize(
    "lat, lon, expected",
    [
        ("33°38′12″N", "84°25′41″W", (-84.42806, 33.63667)),
        ("60.77861°N", "161.83722°W", (-161.83722, 60.77861)),
        ("not a coordinate", "84°25′41″W", None),
    ],
)
def test_coordinates(lat, lon, expected):
    soup = html(f'<span class="latitude">{lat}</span><span class="longitude">{lon}</span>')
    assert parse_coordinates(soup) == expected


def test_page_without_coordinates():
    assert parse_coordinates(html("<p>No infobox</p>")) is None


@pytest.mark.parametrize(
    "cell, code",
    [("ATL[1]", "ATL"), ("none", None), ("", None)],
)
def test_iata(cell, code):
    soup = html(f'<a href="/wiki/IATA_airport_code">IATA</a>: <span>{cell}</span>')
    assert parse_iata(soup) == code


def test_iata_missing():
    assert parse_iata(html("<p>No codes</p>")) is None


@pytest.mark.parametrize("cell, code", [("DL[1]", "DL"), ("—", None), ("3M", "3M")])
def test_airline_code(cell, code):
    soup = html(
        '<table class="infobox-airline-codes"><tr><th>IATA</th><th>ICAO</th></tr>'
        f"<tr><td>{cell}</td><td>DAL</td></tr></table>"
    )
    assert parse_airline_code(soup) == code


def test_airline_without_codes_box():
    assert parse_airline_code(html("<p>Charter operator</p>")) is None
