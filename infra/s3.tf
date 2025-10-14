########################################
# S3 bucket for Parquet flights data  #
########################################
resource "aws_s3_bucket" "flights_bucket" {
  bucket = var.routes_bucket_name

  tags = {
    Name = "Flights Parquet Data"
  }
}

# Block public access using separate resource
resource "aws_s3_bucket_public_access_block" "flights_bucket_block" {
  bucket = aws_s3_bucket.flights_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enable versioning
resource "aws_s3_bucket_versioning" "flights_bucket_versioning" {
  bucket = aws_s3_bucket.flights_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Enable server-side encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "flights_bucket_sse" {
  bucket = aws_s3_bucket.flights_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

########################################
# S3 bucket for Athena query results  #
########################################
resource "aws_s3_bucket" "athena_query_results" {
  bucket = var.results_bucket_name

  tags = {
    Name = "Athena Query Results"
  }
}

# Block public access for Athena query results
resource "aws_s3_bucket_public_access_block" "athena_query_results_block" {
  bucket = aws_s3_bucket.athena_query_results.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enable versioning for query results (optional)
resource "aws_s3_bucket_versioning" "athena_query_results_versioning" {
  bucket = aws_s3_bucket.athena_query_results.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Enable server-side encryption for query results
resource "aws_s3_bucket_server_side_encryption_configuration" "athena_query_results_sse" {
  bucket = aws_s3_bucket.athena_query_results.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Lifecycle rule: automatically delete objects older than 7 days
resource "aws_s3_bucket_lifecycle_configuration" "athena_query_results_lifecycle" {
  bucket = aws_s3_bucket.athena_query_results.id

  rule {
    id     = "delete-old-query-results"
    status = "Enabled"

    filter {}

    expiration {
      days = 7
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

###########################
# S3 Bucket Policy for Athena Query Results
###########################
resource "aws_s3_bucket_policy" "athena_query_results_policy" {
  bucket = aws_s3_bucket.athena_query_results.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      # Allow Lambda to read/write results
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
      # Allow Athena service to write query results
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
