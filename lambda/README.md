# Flight Atlas API

The API is one Lambda behind API Gateway at `https://api.flightatlas.io`. It answers
`/airports`, `/airlines`, `/routes`, and `/available_months` from Athena queries over the
Parquet data the [scraper](../ecs/README.md) writes to S3. The endpoints and parameters are in the
[API reference](../README.md#api).

## Request flow

1. `/available_months` lists the snapshots straight from the Glue partitions of the airlines
   table. No Athena query runs.
2. The other endpoints pick a snapshot: `year` and `month` give that one (or `404`), `month`
   alone gives that month's newest year, and neither gives the newest snapshot.
3. The Lambda looks up the query's hash in the DynamoDB cache. For a finished query it reads
   the result CSV from S3 and returns `200`.
4. Otherwise the Lambda starts the Athena query and returns `202`. The client asks again with
   the same URL until the result is ready, usually a few seconds.

Successful responses carry `Cache-Control: public, max-age=3600`; `202` and errors carry
`no-store`.

## Layout

| Module | Job |
| --- | --- |
| `flight_atlas_api/handler.py` | Entry point: dispatches by path, maps errors to responses |
| `flight_atlas_api/params.py` | Validates `airport`, `airline_code`, `year`, `month` |
| `flight_atlas_api/snapshots.py` | Lists snapshots from Glue (cached 10 minutes) and picks one |
| `flight_atlas_api/queries.py` | SQL per endpoint; user input goes in Athena `ExecutionParameters` |
| `flight_atlas_api/athena.py`, `cache.py` | Runs queries and remembers them in DynamoDB |
| `flight_atlas_api/geo.py`, `endpoints.py` | Turns result rows into GeoJSON and JSON bodies |
| `flight_atlas_api/config.py`, `aws.py` | Settings from env vars, AWS clients created on first use |
| `tests/` | pytest, with an in-memory stand-in for Athena, S3, Glue, and DynamoDB |
| `events/` | Sample API Gateway events for local runs |

## Settings

Terraform sets these on the function (`infra/compute.tf`). The defaults match the deployed
names, so a local run needs none of them.

| Variable | Default |
| --- | --- |
| `ATHENA_DATABASE` | `flights_db` |
| `FLIGHTS_TABLE`, `AIRPORTS_TABLE`, `AIRLINES_TABLE` | `flights`, `airports`, `airlines` |
| `S3_RESULTS_BUCKET` | `bucket-flight-atlas-query-results` |
| `CACHE_TABLE` | `flights-query-cache` |

## Run and test

From the repo root:

```bash
make py-check        # ruff + pytest for the Lambda and the scraper; no AWS needed
make lambda-run      # builds the image and runs it under the Lambda emulator on port 9000
make lambda-invoke EVENT=lambda/events/routes_atl.json   # from another shell
```

`lambda-run` uses your AWS CLI credentials and the live data, so its queries and cache
entries are real. The emulator speaks the Lambda invoke protocol, not HTTP routes, so the app
can't point at it; use `lambda-invoke` with an event file.

## Deploy

The function runs from the `flight-atlas:lambda-<tag>` image in ECR. Push the image before
`terraform apply`; see [infra/README.md](../infra/README.md), including what to do if the
function's image is ever deleted.
