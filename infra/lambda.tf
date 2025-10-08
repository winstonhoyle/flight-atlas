# Upload Lambda zip to S3
resource "aws_s3_object" "flights_lambda_zip" {
  bucket = aws_s3_bucket.flights_bucket.id
  key    = "lambda_package.zip"
  source = "lambda_package.zip"   # local path to your zip
  etag   = filemd5("lambda_package.zip")
}

# Create Lambda from the S3 object
resource "aws_lambda_function" "flights_scraper" {
  function_name = "flights_scraper"
  role          = aws_iam_role.lambda_execution_role.arn
  handler       = "lambda_function.lambda_handler"
  runtime       = "python3.12"
  timeout       = 900
  memory_size   = 1024

  s3_bucket = aws_s3_object.flights_lambda_zip.bucket
  s3_key    = aws_s3_object.flights_lambda_zip.key

  environment {
    variables = {
      S3_BUCKET = aws_s3_bucket.flights_bucket.bucket
      S3_PREFIX = "flights"
    }
  }

  depends_on = [aws_iam_role_policy.lambda_policy]
}
