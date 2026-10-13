# Infrastructure (Terraform)

Terraform configuration for all AWS and Cloudflare resources behind Flight Atlas.
State is stored in an S3 backend (`flightatlas-terraform-state`) with native S3 locking.

## Layout

| File | Resources |
| --- | --- |
| `main.tf` | Terraform settings, S3 backend, AWS + Cloudflare providers |
| `variables.tf` | Input variables and defaults |
| `network.tf` | VPC, public subnets, internet gateway, route table, security group |
| `compute.tf` | ECR repositories, ECS cluster/task/service, image-based Lambda, CloudWatch log group + monthly schedule |
| `data.tf` | S3 buckets, Glue database + tables (Athena), DynamoDB cache |
| `api.tf` | API Gateway (HTTP API, routes, custom domain), ACM certificate |
| `dns.tf` | Route 53 zone + records, Cloudflare DNS |
| `iam.tf` | IAM roles/policies for Athena, ECS, Lambda, EventBridge |

## Prerequisites

- Terraform `>= 1.5` (`>= 1.10` for the S3 state lockfile used here)
- AWS CLI, authenticated (see below), targeting `us-west-1`
- Docker running, to build and push the ECS and Lambda images to ECR with the
  [root `Makefile`](../Makefile) (`make containers`, `make deploy-containers`)
- A Cloudflare account with an API token (`DNS:Edit`, `Zone:Read`) and the `flightatlas.io` zone ID

## Authenticate

Terraform uses the default AWS credential chain. Configure the AWS CLI once with an
IAM access key, then verify:

```bash
aws configure                 # Access Key ID, Secret Access Key, region = us-west-1
aws sts get-caller-identity   # prints your account ID and ARN when authenticated
```

That is all Terraform needs. Prefer an IAM user over the root account for these keys,
and never commit or paste the secret key. (If your org uses IAM Identity Center instead
of access keys, run `aws configure sso`, then `aws sso login`, and set `AWS_PROFILE`.)

Cloudflare credentials are passed as Terraform variables, not the CLI (see below).

## One-time setup

1. **State bucket.** The S3 backend bucket must exist before `init`. If it doesn't:
   ```bash
   aws s3api create-bucket --bucket flightatlas-terraform-state \
     --region us-west-1 --create-bucket-configuration LocationConstraint=us-west-1
   aws s3api put-bucket-versioning --bucket flightatlas-terraform-state \
     --versioning-configuration Status=Enabled
   ```
2. **Variables.** Copy the example and fill in Cloudflare values:
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   ```
   `terraform.tfvars` is gitignored; never commit it.
   ```hcl
   cloudflare_zone_io_id = "<flightatlas.io zone id>"
   cloudflare_api_token  = "<cloudflare api token>"
   ```

## Deploy

Both the ECS scraper and the query Lambda run from images in the single `flight-atlas`
ECR repository, distinguished by tag prefix: `ecs-${var.image_tag}` and
`lambda-${var.image_tag}` (`image_tag` is `local` by default, a git SHA in CI). Because
the Lambda is image-based, its image must exist in ECR **before** `apply` creates the
function, so push first:

```bash
# from the repo root: build + push both images to flight-atlas
make containers deploy-containers

cd infra
terraform init
terraform plan     # review before applying
terraform apply
```

Routine changes are then just `make deploy-containers` + `make tf-apply`. Pin a specific
image with `-var image_tag=<git-sha>`.

The `flight-atlas` repository must exist for the first push (it is Terraform-managed; on a
brand-new account create it once with `aws ecr create-repository --repository-name flight-atlas`).

The first `plan` after the recent refactor shows `moved` operations (renames), not
destroy/recreate. The `moved` blocks in `network.tf`, `data.tf`, and `api.tf` can be
deleted after the first successful apply. They also block `terraform apply -target` until
that first full apply is done.

## Notes

- **ECS service** runs at `desired_count = 0`; the scraper is triggered on demand
  (the monthly EventBridge rule exists but is disabled on this account). See the ECS
  scraper section in the [project README](../README.md) for how to run it.
- **Container images.** Both images live in the `flight-atlas` repo: the ECS task runs
  `flight-atlas:ecs-${var.image_tag}` and the Lambda runs `flight-atlas:lambda-${var.image_tag}`.
  `image_tag` defaults to `local`; CI overrides it with the git SHA. Build and push with
  the root `Makefile` before applying.
- **DNS** is split: Route 53 hosts the `flightatlas.io` zone and API alias; Cloudflare
  serves `www` and `api` records for the Pages/API endpoints.

## Destroy

```bash
terraform destroy
```

Emptying versioned S3 buckets may require deleting object versions first.

## Rate limiting

The API Gateway `$default` stage applies a stage-wide throttle
(`api_throttle_rate_limit` / `api_throttle_burst_limit`, default 50 rps / burst 100).
Excess requests get `429` before reaching Lambda, which caps Lambda and Athena spend.
The limit is shared by all clients: one abusive client can use it up for everyone.
HTTP APIs can't attach AWS WAF, so per-IP limits need a proxy in front, e.g. set
`proxied = true` on the Cloudflare `api` record and add a Cloudflare rate-limiting rule.
