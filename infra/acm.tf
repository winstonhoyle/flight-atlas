resource "aws_acm_certificate" "api_cert" {
  domain_name       = "api.flightatlas.io"
  validation_method = "DNS"
  region            = var.region
}

resource "aws_acm_certificate_validation" "api_cert_validation" {
  certificate_arn         = aws_acm_certificate.api_cert.arn
  validation_record_fqdns = [for record in aws_route53_record.api_cert_validation : record.fqdn]
}
