# ------------------------------
# General AWS Configuration
# ------------------------------
variable "region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-west-1"
}

# ------------------------------
# S3 Buckets
# ------------------------------
variable "routes_bucket_name" {
  description = "S3 bucket for flight routes data"
  type        = string
  default     = "bucket-flight-atlas-routes"
}

variable "results_bucket_name" {
  description = "S3 bucket for Athena query results"
  type        = string
  default     = "bucket-flight-atlas-query-results"
}

# ------------------------------
# Athena Configuration
# ------------------------------
variable "athena_database_name" {
  description = "Athena database name"
  type        = string
  default     = "flights_db"
}

variable "athena_routes_table_name" {
  description = "Athena routes table name"
  type        = string
  default     = "flights"
}

variable "athena_airports_table_name" {
  description = "Athena airports table name"
  type        = string
  default     = "airports"
}

variable "athena_airlines_table_name" {
  description = "Athena airlines table name"
  type        = string
  default     = "airlines"
}

# ------------------------------
# ECS and Lambda
# ------------------------------
# Dummy image so `terraform plan` works this is build with github actions and pushes
# actual updated image for the ecs monthly job
variable "ecs_image" {
  description = "ECS container image URI"
  type        = string
  default     = "public.ecr.aws/amazonlinux/amazonlinux:latest"
}

variable "lambda_zip_path" {
  description = "Path to the Lambda ZIP file"
  type        = string
  default     = "../lambda/lambda_package.zip"
}

# ------------------------------
# Cloudflare Configuration
# ------------------------------
variable "cloudflare_api_token" {
  description = "Cloudflare API token with DNS:Edit & Zone:Read"
  type        = string
  sensitive   = true
}

variable "cloudflare_zone_io_id" {
  description = "Cloudflare Zone ID for flightatlas.io"
  type        = string
}
