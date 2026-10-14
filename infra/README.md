# Infrastructure

Terraform for the AWS resources behind Flight Atlas and its Cloudflare DNS records. State is
in the `flightatlas-terraform-state` S3 bucket with S3 native locking.

## Layout

| File | Resources |
| --- | --- |
| `main.tf` | Terraform settings, S3 backend, AWS and Cloudflare providers |
| `variables.tf` | Input variables and defaults |
| `network.tf` | VPC, public subnets, internet gateway, route table, security group for the scraper task |
| `compute.tf` | ECR repository and lifecycle policy, ECS cluster, task, and service, monthly schedule, the Lambda |
| `data.tf` | S3 buckets, Glue database and tables, DynamoDB query cache |
| `api.tf` | API Gateway HTTP API, routes, throttling, custom domain, ACM certificate |
| `dns.tf` | Route 53 zone and records, Cloudflare `www` and `api` records |
| `edge.tf` | Cloudflare SSL mode, `www` redirect, API rate limit and cache rules |
| `alerts.tf` | SNS email topic, API 5xx and Lambda error alarms, monthly budget |
| `iam.tf` | Roles and policies for Athena, ECS, the Lambda, and EventBridge |

Cloudflare Pages itself is not in Terraform; CI deploys the app to it.

## Prerequisites

- Terraform 1.10 or later (the S3 lockfile needs it; CI uses 1.13.3)
- The AWS CLI, signed in to the account, region `us-west-1`
- Docker, to build and push the images with the [root `Makefile`](../Makefile)
- A Cloudflare API token for the `flightatlas.io` zone with Zone Read and these Edit permissions: DNS, Zone Settings, Zone WAF, Cache Rules, and Single Redirect. CI uses the same token from the `CLOUDFLARE_API_TOKEN` secret

## Credentials

Terraform uses the default AWS credential chain:

```bash
aws configure                 # Access Key ID, Secret Access Key, region = us-west-1
aws sts get-caller-identity   # prints your account ID and ARN when authenticated
```

Use an IAM user or IAM Identity Center (`aws configure sso`, `aws sso login`, `AWS_PROFILE`)
instead of the root account. Cloudflare credentials go in Terraform variables.

## One-time setup

1. Create the state bucket if it doesn't exist:
   ```bash
   aws s3api create-bucket --bucket flightatlas-terraform-state \
     --region us-west-1 --create-bucket-configuration LocationConstraint=us-west-1
   aws s3api put-bucket-versioning --bucket flightatlas-terraform-state \
     --versioning-configuration Status=Enabled
   ```
2. Copy the variables file and fill in the Cloudflare values. `terraform.tfvars` is gitignored.
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   ```
   ```hcl
   cloudflare_zone_io_id = "<flightatlas.io zone id>"
   cloudflare_api_token  = "<cloudflare api token>"
   ```
3. On a new account, create the ECR repository once so the first push has somewhere to go.
   Terraform manages it after that:
   ```bash
   aws ecr create-repository --repository-name flight-atlas
   ```

## Deploy

Both images live in the `flight-atlas` ECR repository, tagged `ecs-<tag>` and `lambda-<tag>`.
`image_tag` defaults to `local`; CI sets it to the commit SHA. The Lambda's image has to be in
ECR before `apply` creates or updates the function, so push first:

```bash
# from the repo root: build + push both images to flight-atlas
make containers deploy-containers

cd infra
terraform init
terraform plan     # review before applying
terraform apply
```

After the first deploy, `make deploy-containers` and `make tf-apply` are enough. Pin an image
with `-var image_tag=<git-sha>`.

The ECR lifecycle policy keeps the five newest `lambda-*` and `ecs-*` images.

## The scraper task

The ECS service runs at `desired_count = 0`, and the EventBridge rule starts the task on the
first of each month. AWS blocks ECS task launches for this account (`RunTask` returns
`BlockedException`), so those runs fail and the scraper runs locally instead; see
[ecs/README.md](../ecs/README.md).

## DNS

Cloudflare is authoritative for `flightatlas.io`. It holds the apex (Pages), `www`, `api`, and
the ACM validation record for `api`. `www` and `api` go through Cloudflare's proxy: `www`
redirects to the apex, and `api` reaches the API Gateway custom domain over HTTPS with SSL
mode Full (strict). The Route 53 zone in `dns.tf` has the same `api` and validation records
but answers no queries.

## Rate limiting and caching

Two limits apply to the API:

- Cloudflare blocks an IP for 10 seconds after `api_rate_limit_per_ip` requests (default 100) in 10 seconds.
- The API Gateway `$default` stage throttles all traffic together to `api_throttle_rate_limit` requests per second with bursts up to `api_throttle_burst_limit` (defaults 50 and 100), and answers `429` above that.

The default `execute-api` URL is disabled, so every request comes through `api.flightatlas.io`
and Cloudflare. Cloudflare caches responses for as long as their `Cache-Control` allows: an hour
for `200`, and never for `202` or errors.

## Alerts

Alarms and budget alerts go to `alert_email` (in `variables.tf`). After the first apply, AWS
emails a confirmation link for the SNS subscription; alarms arrive only once it's clicked.

- `flight-atlas-api-5xx`: 3 or more `5xx` responses in 5 minutes.
- `flight-atlas-lambda-errors`: the Lambda crashed, timed out, or couldn't start (a deleted image shows up here).
- `flight-atlas-monthly`: actual spend passes 80% of `monthly_budget_usd` (default 10), or the forecast passes 100%.

Each alarm also emails when it returns to OK.

## Recovering a Lambda whose image was deleted

If the Lambda's image is deleted from ECR, the function goes `Inactive` and `apply` fails with
"cannot be updated as the provided Image ID cannot be found". Terraform changes the
configuration before the image, and AWS rejects configuration changes while the image is
missing. Point the function at a pushed image, then apply. The function's code and settings are
described in [lambda/README.md](../lambda/README.md).

```bash
aws lambda update-function-code --function-name flights-query-lambda \
  --image-uri <account>.dkr.ecr.us-west-1.amazonaws.com/flight-atlas:lambda-<tag>
aws lambda wait function-updated-v2 --function-name flights-query-lambda
make tf-apply IMAGE_TAG=<tag>
```

## Destroy

```bash
terraform destroy
```

Versioned S3 buckets need their object versions deleted first.
