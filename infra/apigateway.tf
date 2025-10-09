resource "aws_apigatewayv2_api" "flights_api" {
  name          = "flight-atlas"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "flights_integration" {
  api_id                 = aws_apigatewayv2_api.flights_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.flights_query_lambda.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "routes" {
  api_id    = aws_apigatewayv2_api.flights_api.id
  route_key = "GET /routes"
  target    = "integrations/${aws_apigatewayv2_integration.flights_integration.id}"
}

resource "aws_apigatewayv2_deployment" "flights_deployment" {
  api_id = aws_apigatewayv2_api.flights_api.id

  depends_on = [
    aws_apigatewayv2_route.routes,
    aws_apigatewayv2_integration.flights_integration
  ]
}

resource "aws_apigatewayv2_stage" "flights_stage" {
  api_id = aws_apigatewayv2_api.flights_api.id
  name   = "dev"
  # deployment_id = aws_apigatewayv2_deployment.flights_deployment.id for dev
  auto_deploy = true
}


