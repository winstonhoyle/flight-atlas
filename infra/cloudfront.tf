###################################
# CloudFront Distribution
###################################
# resource "aws_cloudfront_origin_access_identity" "frontend_oai" {
#   comment = "OAI for frontend bucket"
# }

# resource "aws_cloudfront_distribution" "frontend_cdn" {
#   origin {
#     domain_name = aws_s3_bucket.frontend_bucket.bucket_regional_domain_name
#     origin_id   = "S3-Frontend"

#     s3_origin_config {
#       origin_access_identity = aws_cloudfront_origin_access_identity.frontend_oai.cloudfront_access_identity_path
#     }
#   }

#   enabled             = true
#   is_ipv6_enabled     = true
#   default_root_object = "index.html"

#   default_cache_behavior {
#     allowed_methods  = ["GET", "HEAD"]
#     cached_methods   = ["GET", "HEAD"]
#     target_origin_id = "S3-Frontend"

#     forwarded_values {
#       query_string = false
#       cookies {
#         forward = "none"
#       }
#     }

#     viewer_protocol_policy = "redirect-to-https"
#     min_ttl                = 0
#     default_ttl            = 3600
#     max_ttl                = 86400
#   }

#   restrictions {
#     geo_restriction {
#       restriction_type = "none"
#     }
#   }

#   viewer_certificate {
#     cloudfront_default_certificate = true
#   }
# }