variable "region" {
  type    = string
  default = "us-west-1"
}

variable "routes_bucket_name" {
  type    = string
  default = "bucket-flight-atlas-routes"
}

variable "results_bucket_name" {
  type    = string
  default = "bucket-flight-atlas-query-results"
}

variable "athena_database_name" {
  type    = string
  default = "flights_db"
}

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

# variable "domain_name" {
#   type    = string
#   default = "flightatlas.us"
# }

