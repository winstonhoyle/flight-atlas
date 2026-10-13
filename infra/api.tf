############################################################
# HTTP API
############################################################
resource "aws_apigatewayv2_api" "flights_api" {
  name          = "flight-atlas"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "OPTIONS"]
    allow_headers = ["*"]
    max_age       = 3600
  }
}

resource "aws_apigatewayv2_integration" "flights_integration" {
  api_id                 = aws_apigatewayv2_api.flights_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.flights_query_lambda.invoke_arn
  payload_format_version = "2.0"
}

locals {
  api_routes = ["GET /routes", "GET /airlines", "GET /airports", "GET /available_months"]
}

resource "aws_apigatewayv2_route" "routes" {
  for_each = toset(local.api_routes)

  api_id    = aws_apigatewayv2_api.flights_api.id
  route_key = each.value
  target    = "integrations/${aws_apigatewayv2_integration.flights_integration.id}"
}

# auto_deploy handles deployments; no explicit aws_apigatewayv2_deployment needed.
resource "aws_apigatewayv2_stage" "flights_stage" {
  api_id      = aws_apigatewayv2_api.flights_api.id
  name        = "$default"
  auto_deploy = true

  # Shared by all clients, not per-IP. See infra/README.md.
  default_route_settings {
    throttling_rate_limit  = var.api_throttle_rate_limit
    throttling_burst_limit = var.api_throttle_burst_limit
  }
}

resource "aws_apigatewayv2_domain_name" "api_domain" {
  domain_name = "api.flightatlas.io"

  domain_name_configuration {
    certificate_arn = aws_acm_certificate.api_cert.arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }

  depends_on = [aws_acm_certificate_validation.api_cert_validation]
}

resource "aws_apigatewayv2_api_mapping" "api_mapping" {
  api_id      = aws_apigatewayv2_api.flights_api.id
  domain_name = aws_apigatewayv2_domain_name.api_domain.id
  stage       = aws_apigatewayv2_stage.flights_stage.id
}

############################################################
# ACM certificate
############################################################
resource "aws_acm_certificate" "api_cert" {
  domain_name       = "api.flightatlas.io"
  validation_method = "DNS"
}

resource "aws_acm_certificate_validation" "api_cert_validation" {
  certificate_arn         = aws_acm_certificate.api_cert.arn
  validation_record_fqdns = [for record in aws_route53_record.api_cert_validation : record.fqdn]
}

# Route keys migrated from individually-named resources to for_each.
moved {
  from = aws_apigatewayv2_route.routes
  to   = aws_apigatewayv2_route.routes["GET /routes"]
}

moved {
  from = aws_apigatewayv2_route.airlines
  to   = aws_apigatewayv2_route.routes["GET /airlines"]
}

moved {
  from = aws_apigatewayv2_route.airports
  to   = aws_apigatewayv2_route.routes["GET /airports"]
}

moved {
  from = aws_apigatewayv2_route.available_months
  to   = aws_apigatewayv2_route.routes["GET /available_months"]
}
