variable "region" {
  type    = string
  default = "us-west-1"
}

# S3 Bucket names
variable "routes_bucket_name" {
  type    = string
  default = "bucket-flight-atlas-routes"
}

variable "results_bucket_name" {
  type    = string
  default = "bucket-flight-atlas-query-results"
}

variable "frontend_bucket_name" {
  type    = string
  default = "bucket-flight-atlas-frontend"
}

# Athena db
variable "athena_database_name" {
  type    = string
  default = "flights_db"
}

# Athena db table names
variable "athena_routes_table_name" {
  type    = string
  default = "flights"
}

variable "athena_airports_table_name" {
  type    = string
  default = "airports"
}

variable "athena_airlines_table_name" {
  type    = string
  default = "airlines"
}

# Dummy image so `terraform plan` works this is build with github actions and pushes
# actual updated image for the ecs monthly job
variable "ecs_image" {
  description = "ECS container image URI"
  type        = string
  default     = "public.ecr.aws/amazonlinux/amazonlinux:latest"
}

# Lambda zip path, need to build before running
variable "lambda_zip_path" {
  description = "Path to the Lambda ZIP file"
  type        = string
  default     = "../lambda/lambda_package.zip"
}

# Cloudfare vars
variable "cloudflare_api_token" {
  description = "Cloudflare API token with DNS:Edit & Zone:Read"
  type        = string
  sensitive   = true
}

variable "cloudflare_zone_io_id" {
  description = "Cloudflare Zone ID for flightatlas.io"
  type        = string
}

