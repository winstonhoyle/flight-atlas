############################################################
# Cloudflare proxy rules for flightatlas.io
############################################################
locals {
  domain   = "flightatlas.io"
  api_host = aws_apigatewayv2_domain_name.api_domain.domain_name
}

# Cloudflare to API Gateway over HTTPS with a verified certificate.
resource "cloudflare_zone_settings_override" "flightatlas_io" {
  zone_id = var.cloudflare_zone_io_id

  settings {
    ssl = "strict"
  }
}

resource "cloudflare_ruleset" "www_redirect" {
  zone_id = var.cloudflare_zone_io_id
  name    = "Redirect www to the apex"
  kind    = "zone"
  phase   = "http_request_dynamic_redirect"

  rules {
    description = "www to apex"
    expression  = "(http.host eq \"www.${local.domain}\")"
    action      = "redirect"
    enabled     = true

    action_parameters {
      from_value {
        status_code           = 301
        preserve_query_string = true
        target_url {
          expression = "concat(\"https://${local.domain}\", http.request.uri.path)"
        }
      }
    }
  }
}

resource "cloudflare_ruleset" "api_rate_limit" {
  zone_id = var.cloudflare_zone_io_id
  name    = "API rate limit"
  kind    = "zone"
  phase   = "http_ratelimit"

  rules {
    description = "Per-IP limit on the API"
    expression  = "(http.host eq \"${local.api_host}\")"
    action      = "block"
    enabled     = true

    ratelimit {
      characteristics     = ["cf.colo.id", "ip.src"]
      period              = 10
      requests_per_period = var.api_rate_limit_per_ip
      mitigation_timeout  = 10
    }
  }
}

resource "cloudflare_ruleset" "api_cache" {
  zone_id = var.cloudflare_zone_io_id
  name    = "Cache API responses"
  kind    = "zone"
  phase   = "http_request_cache_settings"

  rules {
    description = "Cache what the API marks cacheable"
    expression  = "(http.host eq \"${local.api_host}\")"
    action      = "set_cache_settings"
    enabled     = true

    action_parameters {
      cache = true
      edge_ttl {
        mode = "respect_origin"
      }
      browser_ttl {
        mode = "respect_origin"
      }
    }
  }
}
