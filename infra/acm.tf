resource "aws_acm_certificate" "api_cert" {
  domain_name       = "api.flightatlas.io"
  validation_method = "DNS"
  region            = var.region
}
