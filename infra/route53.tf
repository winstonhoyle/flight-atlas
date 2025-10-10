# resource "aws_route53_record" "api" {
#   zone_id = aws_route53_zone.main.zone_id
#   name    = "api.${aws_apigatewayv2_domain_name.api_domain.domain_name}"
#   type    = "A"

#   alias {
#     name                   = aws_api_gateway_domain_name.api_domain.cloudfront_domain_name
#     zone_id                = aws_api_gateway_domain_name.api_domain.cloudfront_zone_id
#     evaluate_target_health = false
#   }
# }
