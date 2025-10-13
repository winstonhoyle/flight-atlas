# Cloudflare DNS zone
resource "cloudflare_record" "pages_custom_domain" {
  zone_id = var.cloudflare_zone_io_id
  name    = "www"
  content = "flight-atlas.pages.dev"
  type    = "CNAME"
  proxied = false
}

# Cloudflare DNS for API Gateway custom domain
resource "cloudflare_record" "api_custom_domain" {
  zone_id    = var.cloudflare_zone_io_id
  name       = "api"
  type       = "CNAME"
  content    = aws_apigatewayv2_domain_name.api_domain.domain_name_configuration[0].target_domain_name
  proxied    = false
  depends_on = [aws_apigatewayv2_domain_name.api_domain]
}