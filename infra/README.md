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
| `iam.tf` | Roles and policies for Athena, ECS, the Lambda, and EventBridge |

Cloudflare Pages itself is not in Terraform; CI deploys the app to it.

## Prerequisites

- Terraform 1.10 or later (the S3 lockfile needs it; CI uses 1.13.3)
- The AWS CLI, signed in to the account, region `us-west-1`
- Docker, to build and push the images with the [root `Makefile`](../Makefile)
- A Cloudflare API token with `DNS:Edit` and `Zone:Read`, and the `flightatlas.io` zone ID

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

Route 53 hosts the `flightatlas.io` zone, the ACM validation records, and the `api` alias to
API Gateway. Cloudflare holds `www`, a CNAME to `flight-atlas.pages.dev`, and `api`, a CNAME to
the API Gateway domain.

## Rate limiting

The `$default` stage throttles the whole API to `api_throttle_rate_limit` requests per second
with bursts up to `api_throttle_burst_limit` (defaults 50 and 100). Requests over the limit get
`429` before they reach the Lambda. The limit is shared by every client, so one client can use
it up. HTTP APIs can't use AWS WAF; per-client limits need a proxy in front, such as
`proxied = true` on the Cloudflare `api` record plus a Cloudflare rate-limiting rule.

## Recovering a Lambda whose image was deleted

If the Lambda's image is deleted from ECR, the function goes `Inactive` and `apply` fails with
"cannot be updated as the provided Image ID cannot be found". Terraform changes the
configuration before the image, and AWS rejects configuration changes while the image is
missing. Point the function at a pushed image, then apply:

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
