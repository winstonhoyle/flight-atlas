# Flight Atlas

Flight Atlas maps the direct flight routes between U.S. airports, built from Wikipedia's
airline and destination tables. Live at [flightatlas.io](https://flightatlas.io).

![Flight Atlas logo](app/public/logo.svg)

## Architecture

| Part | Service | Folder |
| --- | --- | --- |
| Scraper | Python, run locally each month | [`ecs/`](ecs/README.md) |
| Storage and queries | S3 (Parquet), Glue, Athena | |
| API | API Gateway, Lambda, DynamoDB query cache | [`lambda/`](lambda/README.md) |
| Frontend | React, TypeScript, and Leaflet on Cloudflare Pages | [`app/`](app/README.md) |
| Infrastructure | Terraform: AWS resources and Cloudflare DNS records | [`infra/`](infra/README.md) |

How data moves:

1. `make scrape` reads Wikipedia and writes a year/month snapshot of routes, airports, and airlines to S3 as Parquet, then repairs the Athena partitions.
2. The app calls `api.flightatlas.io`, where API Gateway invokes the Lambda.
3. The Lambda picks the snapshot, then either reads a finished Athena query's result from S3 (found through the DynamoDB cache) or starts the query and returns `202` until it finishes.

The scraper is packaged for ECS with a monthly EventBridge schedule, but AWS blocks ECS task
launches for this account, so it runs locally.

GitHub Actions runs on every push to `main`: it lints, tests, and builds the app and deploys it
to Cloudflare Pages; runs ruff and pytest for the Lambda and the scraper; builds both
container images, pushes them to ECR tagged with the commit SHA, and applies Terraform.

## API

All endpoints are `GET` and return JSON. The data comes in monthly snapshots, listed by
`/available_months`. `/airports`, `/airlines`, and `/routes` take optional `year` and `month`
parameters to pick one:

- Neither: the newest snapshot.
- `year` and `month`: that snapshot, or `404` if it doesn't exist.
- `month` alone: that month's newest year, or the newest snapshot if that month has none.

Status codes:

- `200`: result in the body
- `202`: the query is still running in Athena (`{"status": "processing", "query_id": "..."}`). Retry the same request after a short delay
- `400`: missing or invalid parameter
- `404`: unknown path, or no snapshot for the requested `year` and `month`
- `429`: rate limit exceeded. Back off and retry

The API allows 50 requests per second with bursts of 100, shared across all clients. The data
changes once a month, so cache responses.

**Endpoint:** `https://api.flightatlas.io/airports`  

**Method:** GET  

**Response:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [-84.42806, 33.63667]
      },
      "properties": {
        "FAA": "ATL",
        "IATA": "ATL",
        "Name": "Hartsfield–Jackson Atlanta International Airport",
        "url": "https://en.wikipedia.org/wiki/Hartsfield–Jackson_Atlanta_International_Airport",
        "destinations": 247
      }
    },
    ...
  ]
}
```

**Endpoint:** `https://api.flightatlas.io/airlines`  

**Method:** GET  

**Response:**
```json
{
  "AA": "American Airlines",
  "DL": "Delta Air Lines",
  "UA": "United Airlines",
    ...
}
```

**Endpoint:** `https://api.flightatlas.io/available_months`  

**Method:** GET  

**Response:**
```json
[
  { "month": "10", "year": "2026" },
  ...
]
```

**Endpoint:** `https://api.flightatlas.io/routes`  

**Method:** GET  

**Parameters:**
- `airport`: IATA code of the origin airport
- `airline_code`: IATA code of the airline
- `year`, `month`: the snapshot (optional, see above)

At least one of `airport` and `airline_code` is required. With both, the response has that
airline's routes from that airport.

**Response:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-79.93722, 36.09778],
          [-82.6875, 27.91]
        ]
      },
      "properties": {
        "airline_code": "G4",
        "src_airport": "GSO",
        "dst_airport": "PIE"
      }
    },
    ...
  ]
}
```

## Getting started

Prerequisites: Node.js 22 or later, Python 3.14, Docker, Terraform 1.10 or later, and the AWS
CLI with credentials for the account.

Run the app against the live API:

```bash
git clone https://github.com/winstonhoyle/flight-atlas.git
cd flight-atlas
make app-start      # http://localhost:3000, against the live API
```

Check everything locally:

```bash
make app-check      # ESLint, Prettier, TypeScript, and the app's tests
make py-check       # ruff and pytest for the Lambda and the scraper
```

`requirements.txt` at the root pins pytest and ruff; `lambda/` and `ecs/` each have their own
runtime requirements.

## Deploying

Pushing to `main` deploys everything. To deploy the backend from a laptop, set up Terraform
as described in [infra/README.md](infra/README.md), then:

```bash
make containers          # build both images, tagged :local
make deploy-containers   # push them to ECR
```

```bash
make tf-init
make tf-plan
make tf-apply
```

The Lambda's image has to be in ECR before `tf-apply`. CI reads these GitHub secrets:

```bash
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ZONE_IO_ID
```

## Contributing

Fork the repository, make your change on a branch, and open a pull request. `make app-check`
and `make py-check` match what CI runs.

## License

[Apache License 2.0](LICENSE).
