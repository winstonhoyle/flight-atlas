############################################################
# S3 buckets
############################################################
resource "aws_s3_bucket" "flights_bucket" {
  bucket = var.routes_bucket_name

  tags = {
    Name = "Flights Parquet Data"
  }
}

resource "aws_s3_bucket" "athena_query_results" {
  bucket = var.results_bucket_name

  tags = {
    Name = "Athena Query Results"
  }
}

locals {
  managed_buckets = {
    flights = aws_s3_bucket.flights_bucket.id
    results = aws_s3_bucket.athena_query_results.id
  }
}

resource "aws_s3_bucket_public_access_block" "this" {
  for_each = local.managed_buckets
  bucket   = each.value

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "this" {
  for_each = local.managed_buckets
  bucket   = each.value

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  for_each = local.managed_buckets
  bucket   = each.value

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Query results are disposable: expire current and noncurrent versions after 7 days.
resource "aws_s3_bucket_lifecycle_configuration" "athena_query_results_lifecycle" {
  bucket = aws_s3_bucket.athena_query_results.id

  rule {
    id     = "delete-old-query-results"
    status = "Enabled"

    filter {}

    expiration {
      days = 7
    }

    noncurrent_version_expiration {
      noncurrent_days = 7
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

resource "aws_s3_bucket_policy" "athena_query_results_policy" {
  bucket = aws_s3_bucket.athena_query_results.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Sid       = "AllowLambdaAthenaResults",
        Effect    = "Allow",
        Principal = { AWS = aws_iam_role.lambda_role.arn },
        Action    = ["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
        Resource = [
          aws_s3_bucket.athena_query_results.arn,
          "${aws_s3_bucket.athena_query_results.arn}/*"
        ]
      },
      {
        Sid       = "AllowAthenaServiceWrite",
        Effect    = "Allow",
        Principal = { Service = "athena.amazonaws.com" },
        Action    = ["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
        Resource = [
          aws_s3_bucket.athena_query_results.arn,
          "${aws_s3_bucket.athena_query_results.arn}/*"
        ]
      }
    ]
  })
}

############################################################
# Glue catalog database & tables (Athena)
############################################################
resource "aws_glue_catalog_database" "flights_db" {
  name = var.athena_database_name
}

locals {
  glue_tables = {
    flights = {
      name     = var.athena_routes_table_name
      location = "flights"
      columns = [
        { name = "dst_airport", type = "string" },
        { name = "dst_geometry", type = "string" },
        { name = "src_geometry", type = "string" },
      ]
      partition_keys = [
        { name = "year", type = "int" },
        { name = "month", type = "int" },
        { name = "airline_code", type = "string" },
        { name = "src_airport", type = "string" },
      ]
    }

    airports = {
      name     = var.athena_airports_table_name
      location = "airports"
      columns = [
        { name = "faa", type = "string" },
        { name = "iata", type = "string" },
        { name = "url", type = "string" },
        { name = "geometry", type = "string" },
        { name = "title", type = "string" },
        { name = "destinations", type = "int" },
      ]
      partition_keys = [
        { name = "year", type = "int" },
        { name = "month", type = "int" },
      ]
    }

    airlines = {
      name     = var.athena_airlines_table_name
      location = "airlines"
      columns = [
        { name = "name", type = "string" },
        { name = "airline_code", type = "string" },
        { name = "route_count", type = "int" },
      ]
      partition_keys = [
        { name = "year", type = "int" },
        { name = "month", type = "int" },
      ]
    }
  }
}

resource "aws_glue_catalog_table" "tables" {
  for_each = local.glue_tables

  name          = each.value.name
  database_name = aws_glue_catalog_database.flights_db.name
  table_type    = "EXTERNAL_TABLE"

  parameters = {
    "classification" = "parquet"
    "typeOfData"     = "file"
  }

  storage_descriptor {
    location      = "s3://${aws_s3_bucket.flights_bucket.bucket}/${each.value.location}/"
    input_format  = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat"
    output_format = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat"
    compressed    = false

    dynamic "columns" {
      for_each = each.value.columns
      content {
        name = columns.value.name
        type = columns.value.type
      }
    }

    ser_de_info {
      name                  = "parquet"
      serialization_library = "org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe"
    }
  }

  dynamic "partition_keys" {
    for_each = each.value.partition_keys
    content {
      name = partition_keys.value.name
      type = partition_keys.value.type
    }
  }
}

############################################################
# DynamoDB query cache
############################################################
resource "aws_dynamodb_table" "flights_query_cache" {
  name         = "flights-query-cache"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "query_hash"

  attribute {
    name = "query_hash"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Name = "Flights Query Cache"
  }
}

# Rename-only state moves for the for_each migration; remove after first apply.
moved {
  from = aws_s3_bucket_public_access_block.flights_bucket_block
  to   = aws_s3_bucket_public_access_block.this["flights"]
}

moved {
  from = aws_s3_bucket_public_access_block.athena_query_results_block
  to   = aws_s3_bucket_public_access_block.this["results"]
}

moved {
  from = aws_s3_bucket_versioning.flights_bucket_versioning
  to   = aws_s3_bucket_versioning.this["flights"]
}

moved {
  from = aws_s3_bucket_versioning.athena_query_results_versioning
  to   = aws_s3_bucket_versioning.this["results"]
}

moved {
  from = aws_s3_bucket_server_side_encryption_configuration.flights_bucket_sse
  to   = aws_s3_bucket_server_side_encryption_configuration.this["flights"]
}

moved {
  from = aws_s3_bucket_server_side_encryption_configuration.athena_query_results_sse
  to   = aws_s3_bucket_server_side_encryption_configuration.this["results"]
}

moved {
  from = aws_glue_catalog_table.flights_table
  to   = aws_glue_catalog_table.tables["flights"]
}

moved {
  from = aws_glue_catalog_table.airports_table
  to   = aws_glue_catalog_table.tables["airports"]
}

moved {
  from = aws_glue_catalog_table.airlines_table
  to   = aws_glue_catalog_table.tables["airlines"]
}
