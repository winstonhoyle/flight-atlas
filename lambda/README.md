# Flight Atlas API

The API is one Lambda behind API Gateway at `https://api.flightatlas.io`. It answers
`/airports`, `/airlines`, `/routes`, and `/available_months` from the JSON files the
[scraper](../ecs/README.md) writes to S3. The endpoints and parameters are in the
[API reference](../README.md#api).

## Request flow

1. `/available_months` returns the month list in `snapshots.json`.
2. The other endpoints pick a snapshot: `year` and `month` give that one (or `404`), `month`
   alone gives that month's newest year, and neither gives the newest snapshot.
3. The Lambda returns that month's `airports.json`, `airlines.json` or `routes.json` from S3.

The newest snapshot is served with `Cache-Control: public, max-age=3600`, since the scraper
rewrites it. A past snapshot requested by `year` and `month` never changes and gets
`max-age=31536000, immutable`. Errors carry `no-store`.

## Layout

| Module | Job |
| --- | --- |
| `flight_atlas_api/handler.py` | Entry point: dispatches by path, maps errors to responses |
| `flight_atlas_api/params.py` | Validates `airport`, `airline_code`, `year`, `month` |
| `flight_atlas_api/snapshots.py` | Reads `snapshots.json` (cached 10 minutes) and picks one |
| `flight_atlas_api/responses.py` | JSON responses, CORS and `Cache-Control` headers |
| `flight_atlas_api/config.py`, `aws.py` | Bucket name from env, S3 client created on first use |
| `tests/` | pytest, with an in-memory stand-in for S3 |
| `events/` | Sample API Gateway events for local runs |

## Settings

Terraform sets these on the function (`infra/compute.tf`). The defaults match the deployed
names, so a local run needs none of them.

| Variable | Default |
| --- | --- |
| `S3_ROUTES_BUCKET` | `bucket-flight-atlas-routes` |

## Run and test

From the repo root:

```bash
make py-check        # ruff + pytest for the Lambda and the scraper; no AWS needed
make lambda-run      # builds the image and runs it under the Lambda emulator on port 9000
make lambda-invoke EVENT=lambda/events/routes_2025_10.json   # from another shell
```

`lambda-run` uses your AWS CLI credentials and reads the live bucket. The emulator speaks the Lambda invoke protocol, not HTTP routes, so the app
can't point at it; use `lambda-invoke` with an event file.

## Deploy

The function runs from the `flight-atlas:lambda-<tag>` image in ECR. Push the image before
`terraform apply`; see [infra/README.md](../infra/README.md), including what to do if the
function's image is ever deleted.
