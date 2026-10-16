# Flight Atlas scraper

The scraper builds the monthly data snapshot from English Wikipedia. It reads the airport lists for the
[U.S.](https://en.wikipedia.org/wiki/List_of_airports_in_the_United_States),
[Mexico](https://en.wikipedia.org/wiki/List_of_airports_in_Mexico) and
[Canada](https://en.wikipedia.org/wiki/List_of_airports_in_Canada) (split over sub-pages; only
rows with an IATA code and their own article), then each airport's "Airlines and destinations" table, and writes three JSON files to
`YYYY/MM/` in S3:

| File | Contents |
| --- | --- |
| `airports.json` | GeoJSON points: listed airports plus the overseas and remote airports they fly to, with destination counts |
| `airlines.json` | Airline code to name |
| `routes.json` | Every route as `[airline_code, src_airport, dst_airport]` |

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
| `COUNTRIES` | Comma-separated country codes (`US`, `CA`, `MX`) to re-scrape or check, like `AIRPORTS` |
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
- Airlines with no link, or no IATA code on their page: their rows are skipped.
- A link that lands on a disambiguation or missing page: only that destination is dropped.
- Rate limiting (`429`) from Wikipedia: the request waits and retries instead of failing the airport.
- Airports without coordinates: skipped, so they can't break the final write.

## When Wikipedia changes

Wikipedia serves Parsoid HTML (sections in `<section>`, headings wrapped in
`div.mw-heading`). `make scrape-check` lists the pages that stop parsing. Save one as a new
fixture, trimmed to the parts the scraper reads, with a comment naming the page, the date, and
the CC BY-SA license like the existing ones. Write a test that fails against it, then fix
`wiki_parse.py`.

```bash
make py-check   # ruff + pytest for the scraper and the Lambda
```
