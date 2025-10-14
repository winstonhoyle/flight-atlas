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
  A scheduled ECS task runs once per month to scrape the list of all U.S. airports and their destinations from Wikipedia.
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
  - Checks **DynamoDB** for cached results.  
  - If not cached, queries **Athena** and stores results in DynamoDB for future requests.

- **API Gateway Endpoint:**  
  Exposes the Lambda function over HTTPS, serving as the backend API for the frontend.

---

### Web Application (Cloudflare + Route 53)

- The frontend is a static **React app** built using Node.js and npm.  
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
  - Docker image build and push to ECR  
  - Lambda ZIP packaging and deployment  
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

1. **Monthly ECS Task** scrapes Wikipedia → writes data to **S3**.  
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

**Endpoint:** `https://api.flightatlas.io/routes`  

**Method:** GET  

**Parameters (at least one required):**
- `airport` – IATA code of the origin airport (optional if airline_code is provided)
- `airline_code` IATA code of the airline (optional if airport is provided)

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

- `app/` – React frontend
- `infra/` – Terraform code for AWS & Cloudflare
- `lambda/` – Lambda function code and packaging scripts
- `ecs/` – Dockerfile and ECS scraper container

---

## 🛠️ Getting Started

### Prerequisites
- Node.js >= 20
- npm
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
```
git clone https://github.com/winstonhoyle/flight-atlas.git
cd flight-atlas/app
npm install
npm run start
```

---

### Deploying the Backend (ECS, Lambda, Terraform)

1. Set up environment variables listed above
2. Prepare Terraform variables based on [infra/terraform.tfvars.example](infra/terraform.tfvars.example)
3. Package Lambda code:
```bash
sh lambda/build.sh
```
4. Initialize Terraform and apply:
```bash
cd infra
terraform init
terraform plan
terraform apply
```

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
