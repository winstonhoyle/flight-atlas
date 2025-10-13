# Hosted zone for flightatlas.io
resource "aws_route53_zone" "flightatlas_io" {
  name = "flightatlas.io"
}

# ACM validation DNS records
resource "aws_route53_record" "api_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.api_cert.domain_validation_options :
    dvo.domain_name => dvo
  }

  zone_id = aws_route53_zone.flightatlas_io.zone_id
  name    = each.value.resource_record_name
  type    = each.value.resource_record_type
  records = [each.value.resource_record_value]
  ttl     = 60
}

# Alias record for API Gateway custom domain
resource "aws_route53_record" "api_io" {
  zone_id = aws_route53_zone.flightatlas_io.zone_id
  name    = "api"
  type    = "A"

  alias {
    name                   = aws_apigatewayv2_domain_name.api_domain.domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.api_domain.domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }

  depends_on = [
    aws_route53_record.api_cert_validation
  ]
}