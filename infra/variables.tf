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
# Container images
# ------------------------------
variable "image_tag" {
  description = "Tag for the ECS and Lambda images (local for dev, git SHA on deploy)"
  type        = string
  default     = "local"
}

# ------------------------------
# API rate limiting
# ------------------------------
variable "api_throttle_rate_limit" {
  description = "Steady-state requests per second allowed across the whole API"
  type        = number
  default     = 50
}

variable "api_throttle_burst_limit" {
  description = "Maximum burst of concurrent requests allowed across the whole API"
  type        = number
  default     = 100
}

variable "api_rate_limit_per_ip" {
  description = "Requests one IP may make to the API in 10 seconds before Cloudflare blocks it for 10 seconds"
  type        = number
  default     = 100
}

# ------------------------------
# Alerts
# ------------------------------
variable "alert_email" {
  description = "Where API alarms and budget alerts go"
  type        = string
  default     = "hoylejwinston@gmail.com"
}

variable "monthly_budget_usd" {
  description = "Monthly AWS spend in USD; email at 80% actual and 100% forecast"
  type        = string
  default     = "10"
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
