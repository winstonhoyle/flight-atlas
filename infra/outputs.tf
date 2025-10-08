output "s3_bucket_name" {
  value = aws_s3_bucket.flights_bucket.bucket
}

output "athena_database_name" {
  value = aws_glue_catalog_database.flights_db.name
}

output "athena_table_name" {
  value = aws_glue_catalog_table.flights_table.name
}
