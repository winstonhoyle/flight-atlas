# 🗺️ Flight Atlas

**Flight Atlas** is a cloud-native application that maps **direct flight routes between all U.S. airports**.  
It combines scheduled data ingestion, serverless querying, and a static web frontend for fast and scalable access to flight route information.

## Try it out: [https://flightatlas.io](https://flightatlas.io)

![alt text](app/public/logo.png)
---


## 🚀 Architecture Overview

Flight Atlas leverages AWS and Cloudflare services to provide a complete workflow from data ingestion to end-user queries.  
All infrastructure is **fully managed using Terraform**, enabling reproducible deployments, and **CI/CD is automated with GitHub Actions**.


### Data Pipeline (ECS + ECR + S3 + Athena)

- **ECS Task (Monthly Job):**  
  A monthly job scrapes the list of all U.S. airports and their destinations from Wikipedia. It's built to run as an ECS task, but AWS blocks ECS for this account, so it runs locally with `make scrape` (see [Running the scraper](#running-the-ecs-scraper)).
  - Runs inside a **Docker container** stored in **Amazon ECR**.
  - Writes structured route data to an **S3 bucket**.
  - **CloudWatch Events / EventBridge** triggers the ECS task on a monthly schedule.

- **S3 & Athena Integration:**  
  - S3 stores the scraped route data.  
  - **Amazon Athena** allows SQL-style queries directly against the S3 dataset without provisioning a separate database.

---

### Query Layer (Lambda + DynamoDB + API Gateway)

- **AWS Lambda Function:**  
  Handles on-demand flight queries from the frontend.  
  - Picks the data snapshot (year and month) from the Glue partitions.
  - Checks **DynamoDB** for a cached Athena query; if there is none, starts one and returns `202` until it finishes.
  - Code lives in `lambda/flight_atlas_api/`, one module per job (see [Lambda](#lambda)).

- **API Gateway Endpoint:**  
  Exposes the Lambda function over HTTPS, serving as the backend API for the frontend.

---

### Web Application (Cloudflare + Route 53)

- The frontend is a static **React + TypeScript app** built with Vite.  
- Deployed to **Cloudflare Pages** for high availability and global CDN caching.  
- **Route 53** manages DNS for the primary domain, which points to Cloudflare.  
- Cloudflare handles final DNS resolution and SSL termination.

---

### Infrastructure as Code (Terraform)

Terraform is used to manage **all AWS and Cloudflare resources**, including:

- **ECS infrastructure:** Cluster, tasks, Docker image deployment  
- **Networking:** VPC, subnets, and security groups  
- **IAM roles & policies** for ECS, Lambda, and other services  
- **ACM Certificate** for secure HTTPS traffic  
- **Lambda functions** and **API Gateway endpoints**  
- **S3 buckets** for storage of route data  
- **DynamoDB** for query caching  
- **CloudWatch / EventBridge** to schedule the monthly ECS scraper task  
- **Cloudflare Pages deployment** and DNS configuration

This ensures **fully version-controlled, reproducible infrastructure** with minimal manual setup.

---

### CI/CD Automation (GitHub Actions)

- **GitHub Actions workflows** automate:
  - ECS scraper and query Lambda container image builds, pushed to ECR (tagged with the git SHA)  
  - Terraform plan and apply for infrastructure changes  
  - Frontend build and deployment to Cloudflare Pages  

This provides **fully automated, end-to-end CI/CD** whenever changes are pushed to the repository.

---

### Services Summary

| Component        | Service            | Purpose                                              |
|-----------------|------------------|-----------------------------------------------------|
| 🐳 Data Scraper   | ECS + ECR         | Runs monthly containerized scraper                  |
| ☁️ Storage        | S3                | Stores raw and processed route data                |
| 🔍 Query Engine   | Athena            | Enables SQL access to S3 data                      |
| ⚡ API Compute    | Lambda            | Handles flight data queries                        |
| 🧠 Cache          | DynamoDB          | Stores cached query results                         |
| 🌐 API Gateway    | API Gateway       | Public interface for Lambda                         |
| 🧭 DNS & Routing | Route 53 + Cloudflare | Domain routing and SSL                           |
| 💻 Frontend       | Cloudflare Pages  | Static React app hosting                            |

---

### 🗓️ Workflow Summary

1. **Monthly scrape** (`make scrape`, run locally) reads Wikipedia → writes data to **S3**.  
2. **Athena** indexes the data → ready for queries.  
3. **Frontend (Cloudflare)** sends request → **API Gateway → Lambda**.  
4. **Lambda** checks **DynamoDB** cache:  
   - If cached → return result.  
   - If not → query **Athena**, store result in DynamoDB, return result.  
5. **Terraform** ensures all infrastructure is deployed correctly, including Route53 hosted zones, subnets, API Gateway domains, IAM roles, ACM certificate, and scheduled ECS tasks.  
6. **GitHub Actions** automatically handles builds and deployments for ECS, Lambda, and the frontend.


---

This setup ensures **scalable, serverless infrastructure** with automated data updates, fast queries, and a responsive frontend.

## 📡 API

All endpoints are read-only `GET` requests that return JSON. The data comes in monthly
snapshots; `/available_months` lists them. `/airports`, `/airlines`, and `/routes` pick one with
optional `year` and `month` parameters:

- Neither: the newest snapshot.
- `year` and `month`: that snapshot, or `404` if it doesn't exist.
- `month` alone: that month's newest year, or the newest snapshot if that month has none.

**Status codes:**
- `200`: result in the body
- `202`: the query is still running in Athena (`{"status": "processing", "query_id": "..."}`). Retry the same request after a short delay
- `400`: missing or invalid parameter
- `404`: unknown path, or no snapshot for the requested `year` and `month`
- `429`: rate limit exceeded. Back off and retry

**Rate limits:** the API is throttled to 50 requests/second sustained (burst 100), shared
across all clients. Please cache responses: the data only changes once a month.

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

**Parameters (at least one required):**
- `airport`: IATA code of the origin airport (optional if airline_code is provided)
- `airline_code`: IATA code of the airline (optional if airport is provided)
- `year`, `month`: the snapshot (optional, see above)

Note: At least one of airport or airline_code must be provided; both can also be used together for filtering.

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

## 📂 Project Structure

- `app/`: React frontend ([app/README.md](app/README.md))
- `infra/`: Terraform for AWS and Cloudflare ([infra/README.md](infra/README.md))
- `lambda/`: the query API ([lambda/README.md](lambda/README.md))
- `ecs/`: the monthly Wikipedia scraper ([ecs/README.md](ecs/README.md))
- `requirements.txt`: pytest and ruff, for `make py-check`

---

## 🛠️ Getting Started

### Prerequisites
- Node.js >= 22
- npm
- Python 3.14 (for the ECS scraper and Lambda function)
- Terraform >= 1.13
- Docker (for building and running the ECS scraper container locally, if needed)
- AWS CLI configured with appropriate credentials
- Access to Cloudflare account with API token and Pages project

---

### Required Environment Variables
For deployment (Terraform, ECS, Lambda, Cloudflare Pages, GitHub Actions), you must provide:
```bash
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ZONE_IO_ID
```

---

### Running Locally (Frontend Only)
```bash
git clone https://github.com/winstonhoyle/flight-atlas.git
cd flight-atlas
make app-start      # http://localhost:3000, against the live API
```

See [app/README.md](app/README.md) for the other `make app-*` targets.

`npm run build` first runs `scripts/generate-sitemap.js`, which writes `public/sitemap.xml`
with one URL per airport and airline from the live API (home page only if the API is
unreachable). Run it on its own with `npm run sitemap`.

---

### Deploying the Backend (ECS, Lambda, Terraform)

1. Set up environment variables listed above
2. Prepare Terraform variables based on [infra/terraform.tfvars.example](infra/terraform.tfvars.example)
3. Build and push the ECS + Lambda container images to ECR:
```bash
make containers          # build both images, tagged :local
make deploy-containers   # push them to ECR
```
4. Initialize and apply Terraform:
```bash
make tf-init
make tf-plan
make tf-apply
```

First-time setup has an ordering step (the image-based Lambda needs its image in ECR
before apply). See [infra/README.md](infra/README.md).

---

### Running the ECS Scraper

The data refreshes once a month with `make scrape`, run locally (30 to 45 minutes). Setup,
settings, tests, and the Wikipedia quirks it handles are in [ecs/README.md](ecs/README.md).

---

## Lambda

How the API answers requests, its modules, settings, and local runs are in
[lambda/README.md](lambda/README.md).

---

## 🤝 Contributing

1. Fork the repository
2. Create a new branch (`git checkout -b feature/xyz`)
3. Make your changes and commit (`git commit -m "Add feature"`)
4. Push to branch (`git push origin feature/xyz`)
5. Open a Pull Request

## 📄 License

This project is licensed under the **Apache License 2.0**.  
See the [LICENSE](LICENSE) file for details.
