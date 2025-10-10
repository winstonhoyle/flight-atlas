# resource "aws_acm_certificate" "api_cert" {
#   domain_name       = aws_route53_record.api.name
#   validation_method = "DNS"

#   lifecycle {
#     create_before_destroy = true
#   }
# }
