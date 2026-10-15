############################################################
# S3 buckets
############################################################
resource "aws_s3_bucket" "flights_bucket" {
  bucket = var.routes_bucket_name

  tags = {
    Name = "Flight Atlas Data"
  }
}

locals {
  managed_buckets = {
    flights = aws_s3_bucket.flights_bucket.id
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
