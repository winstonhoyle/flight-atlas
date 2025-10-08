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

variable "athena_table_name" {
  type    = string
  default = "flights"
}
