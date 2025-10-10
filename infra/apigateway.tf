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

resource "aws_apigatewayv2_route" "airlines" {
  api_id    = aws_apigatewayv2_api.flights_api.id
  route_key = "GET /airlines"
  target    = "integrations/${aws_apigatewayv2_integration.flights_integration.id}"
}

resource "aws_apigatewayv2_deployment" "flights_deployment" {
  api_id = aws_apigatewayv2_api.flights_api.id

  depends_on = [
    aws_apigatewayv2_route.routes,
    aws_apigatewayv2_route.airlines,
    aws_apigatewayv2_integration.flights_integration
  ]
}

resource "aws_apigatewayv2_stage" "flights_stage" {
  api_id      = aws_apigatewayv2_api.flights_api.id
  name        = "$default"
  auto_deploy = true
}

# resource "aws_apigatewayv2_domain_name" "api_domain" {
#   domain_name = var.domain_name
#   domain_name_configuration {
#     certificate_arn = aws_acm_certificate.api_cert.arn
#     endpoint_type   = "REGIONAL"
#     security_policy = "TLS_1_2"
#   }
# }

# resource "aws_apigatewayv2_api_mapping" "api_mapping" {
#   api_id      = aws_apigatewayv2_api.my_api.id
#   domain_name = aws_apigatewayv2_domain_name.api_domain.id
#   stage       = aws_apigatewayv2_stage.my_stage.id
# }

