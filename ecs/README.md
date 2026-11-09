# Flight Atlas scraper

The scraper builds the monthly data snapshot from English Wikipedia. It reads the airport lists for the
[U.S.](https://en.wikipedia.org/wiki/List_of_airports_in_the_United_States),
[Mexico](https://en.wikipedia.org/wiki/List_of_airports_in_Mexico),
[Canada](https://en.wikipedia.org/wiki/List_of_airports_in_Canada) (split over sub-pages) and the
Central American, Caribbean and South American countries and territories in
[`COUNTRY_LISTS`](create_routes.py) (only rows with an IATA code and their own article), then each airport's "Airlines and destinations" table, and writes four JSON files to
`YYYY/MM/` in S3:

| File | Contents |
| --- | --- |
| `airports.json` | GeoJSON points: listed airports plus the overseas and remote airports they fly to, with destination counts |
| `airlines.json` | Airline code to name |
| `routes.json` | `[src_airport, dst_airport, [airline_codes]]`, one row per direction; a code ends in `:s`, `:c` or `:sc` for seasonal, charter or seasonal charter service |
| `problems.json` | Wikipedia pages it couldn't fully read, by the airport and airline they affect; shown at [flightatlas.io/errors](https://flightatlas.io/errors) |

It then rewrites `snapshots.json` at the bucket root with every month that has data. A full
run takes 30 to 45 minutes.

## Monthly refresh

AWS blocks ECS task launches for this account (`RunTask` returns `BlockedException`, see
[infra/README.md](../infra/README.md#the-scraper-task)), so the scraper runs locally once a month. From the repo root, with AWS credentials configured:

```bash
cp ecs/.env.sample ecs/.env       # once
make scrape-check                 # a few minutes: reads every airport page, writes nothing
make scrape                       # 30 to 45 minutes: writes this month's snapshot to S3
make scrape AIRPORTS=DFW,ORD      # re-scrapes only these airports into this month's snapshot
make scrape COUNTRIES=CA,MX       # re-scrapes only these countries' airports the same way
```

`scrape-check` runs the same parsers as a scrape on every airport's page and lists the ones
with no coordinates, no destinations table, or airlines it can't identify, then prints the
`AIRPORTS=` value to recheck them. A full scrape ends with the same kind of line for any
airport that failed, so a retry never repeats the whole run.

With `AIRPORTS` or `COUNTRIES`, the scraper replaces those airports' routes in this month's
snapshot, along with the return legs to unlisted airports that came from their pages, and
recomputes the airport and airline totals. Other airports keep their coordinates from the
snapshot instead of being refetched. `COUNTRIES=CA,MX` on top of a U.S.-only month adds
Canada and Mexico without re-scraping the U.S.

It needs a full snapshot for the month to exist. Every write
clears the month's snapshot first, so routes an airline dropped don't linger.

The site shows the new snapshot within an hour: the Lambda rereads `snapshots.json` every ten
minutes, and Cloudflare caches the newest month for an hour (see
[lambda/README.md](../lambda/README.md#request-flow)).

To try a run against live Wikipedia without touching AWS:

```bash
make scrape-dry-run LIMIT=2       # the two busiest airports, JSON to ecs/output/
```

Destination links are resolved through the MediaWiki API, 50 titles per request and cached
for the run. When Wikipedia answers `429`, the scraper waits as long as it asks and retries.

For S3 output, the files are written to a local temp folder first and uploaded once every
file exists. Every run appends its log to `ecs/scrape.log` (gitignored), including the traceback
if it crashes.

## Limits to watch

- **Wikimedia rate limit:** 200 requests a minute for a client with an identifying User-Agent (ours is `FlightAtlasBot/1.0 (https://github.com/winstonhoyle)`), 10 without. The scraper is serial and makes about 18 a minute, so more airports lengthen a run without raising the rate. If `429` lines become frequent, make the fallback wait in `get()` at least 5 seconds.
- **File size:** a month is four JSON files, each growing with the number of airports and routes. In early November, with the U.S., Canada and Mexico only, `routes.json` was 390 KB (74 KB gzipped), `airports.json` 297 KB and `problems.json` 190 KB. `problems.json` grows fastest, and the map downloads all of it on every visit.
- **Lambda response cap:** AWS limits a synchronous Lambda response to 6 MB, and the handler returns whole files. Check what it does before any file passes about 3 MB. Splitting by region is not done and needs care for routes that cross regions; revisit when a file passes about 2 MB.

Every scrape also overwrites `ecs/scrape-report.json` (gitignored) with:

| Key | Contents |
| --- | --- |
| `status` | `ok`, or `failed: <exception>` |
| `failed`, `retry` | Airports that failed, and the `make scrape AIRPORTS=...` line to retry them |
| `one_sided_routes` | `{airline, listed_by, missing_from}` for routes between two listed airports that only one page lists. They stay in the snapshot; fix them on Wikipedia or ignore them |
| `problems` | Every warning and error the run logged, as `{level, message}` |

A run stops before writing if any route's airline has no name, so a partial run can't upload an
`airlines.json` with gaps.

## Settings

From `ecs/.env` (copy [`.env.sample`](.env.sample)) or the environment:

| Variable | Purpose |
| --- | --- |
| `OUTPUT_BASE` | Where to write. Unset writes to `s3://$S3_ROUTES_BUCKET`; a folder path writes locally |
| `SCRAPE_LIMIT` | Scrape only the N busiest airports. `0` scrapes all |
| `AIRPORTS` | Comma-separated IATA codes to re-scrape or check; empty means all |
| `COUNTRIES` | Comma-separated country codes to re-scrape or check, like `AIRPORTS`: `US`, `CA`, `MX` and the codes in `COUNTRY_LISTS` (`create_routes.py`) |
| `S3_ROUTES_BUCKET`, `REGION` | AWS targets |

## Layout

| File | Job |
| --- | --- |
| `create_routes.py` | The run: fetches pages, resolves redirects and airline codes, writes the JSON |
| `wiki_parse.py` | Every function that reads Wikipedia HTML. No network calls |
| `tests/` | pytest for both, with saved pages in `tests/fixtures/` |

## Wikipedia quirks the parser handles

Each of these has a test, against a saved page or a small snippet:

- Citation markers in every form: `[12]`, `[a]`, `[note 1]`, `[citation needed]`.
- A "More citations needed" box above the destinations table (Bethel).
- Tables without a class, and a third "Refs" column (Anchorage).
- Passenger and cargo tables in one section; only the passenger table is read.
- Destination links that are redirects (`Toronto–Pearson`), which `resolve_pages` follows.
- Links to a section of an airport page (`…Airport#Terminal_1`).
- Airlines with no link, or no IATA code on their page: their rows are skipped. `scrape-report.json` lists each with a free `9xx` code in `unregistered_airlines`; add the ones you approve to `airlines.json`.
- A link that lands on a disambiguation or missing page: only that destination is dropped.
- Bold labels in a destinations cell: `Seasonal:`, `Charter:` and `Seasonal charter:` mark the destinations after them (up to the next line break or list item). Any other bold label ending in a colon is logged as `unknown label` and its destinations are read as year-round.
- Rate limiting (`429`) from Wikipedia: the request waits and retries instead of failing the airport.
- Airports without coordinates: skipped, so they can't break the final write.
- Pages with no "Airlines and destinations" section, or a section that only says "No scheduled flights" (small airstrips): no routes and no problem.
- A section that describes service in prose with no table (Hilo, Molokai, Lake Charles: "connected to Honolulu by Hawaiian"): a problem on `/errors`. The prose isn't read.
- List pages whose headings are `IATA code` and `ICAO code` (Uruguay) as well as `IATA` and `ICAO`.
- Small countries whose list page redirects to a shared Caribbean list (Anguilla, Barbados, Montserrat, Trinidad and Tobago, the Dutch islands): the page can't say whose airport it is, so `icao_country()` tags each airport from its ICAO prefix (`ICAO_COUNTRIES` in `create_routes.py`). Add a prefix there when a new shared page brings a country that has none.

## After a scrape

Read `scrape-report.json` and the log for these, in order:

1. `unregistered_airlines`: airlines skipped for having no code. Spellings of one airline ("Saeta Peru", "Saeta Perú") get the same suggested `9xx` code. Add each to `airlines.json` (one `display` name per code; a test checks it), then `make scrape AIRPORTS=...` for the airports that listed them. Ignore "Charter service by private arrangement".
2. Two airlines under one code. Wikipedia reuses retired IATA codes (TAG Airlines and LADE are both `5U`), and the scraper keeps one name per code, so their routes merge. Search the log for `Added new airline code` lines that repeat a code under different names, and give the newer airline a `9xx` code in `airlines.json`. A redirect isn't a clash: "Arrendamientos Aéreos" is the Flytrip page, so both names are `FE`.
3. `unknown label` lines: bold labels such as `Cropdusting:` and `Scheduled:` in a destinations cell. They are read as year-round routes. Add a marker to `ROUTE_MARKERS` or register the operator.
4. Problem lines with `Skipped …: its page has no readable IATA code or coordinates`. These are destination links that point to a list page, city, island or seaplane base, and are expected.

## When Wikipedia changes

Wikipedia serves Parsoid HTML (sections in `<section>`, headings wrapped in
`div.mw-heading`). `make scrape-check` lists the pages that stop parsing. Save one as a new
fixture, trimmed to the parts the scraper reads, with a comment naming the page, the date, and
the CC BY-SA license like the existing ones. Write a test that fails against it, then fix
`wiki_parse.py`.

```bash
make py-check   # ruff + pytest for the scraper and the Lambda
```
