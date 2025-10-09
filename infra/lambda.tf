############################################################
# Lambda Function
############################################################
resource "null_resource" "build_push_lambda_zip" {
  depends_on = [aws_iam_role.lambda_role]

  provisioner "local-exec" {
    command = <<EOT
      # Install dependencies to build/
      pip install -r ../lambda/requirements.txt -t ../lambda/build/
      cp ../lambda/lambda_function.py ../lambda/build/
      cd ../lambda/build
      zip -r ../lambda_package.zip .
    EOT
  }
}

############################################################
# Lambda ZIP
############################################################
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../lambda"
  output_path = "${path.module}/lambda_package.zip"
}

############################################################
# Lambda Function
############################################################
resource "aws_lambda_function" "flights_query_lambda" {
  function_name = "flights-query-lambda"
  role          = aws_iam_role.lambda_role.arn
  handler       = "lambda_function.lambda_handler"
  runtime       = "python3.12"

  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  environment {
    variables = {
      S3_RESULTS_BUCKET = aws_s3_bucket.athena_query_results.bucket
      DATABASE          = aws_glue_catalog_database.flights_db.name
      ATHENA_TABLE      = aws_glue_catalog_table.flights_table.name
      REGION            = var.region
    }
  }
}

############################################################
# Lambda Permission for API Gateway
############################################################
resource "aws_lambda_permission" "allow_apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.flights_query_lambda.function_name
  principal     = "apigateway.amazonaws.com"

  # Use /*/* to allow any stage, any route
  source_arn = "${aws_apigatewayv2_api.flights_api.execution_arn}/*/*"
}
