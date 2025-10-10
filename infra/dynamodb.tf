########################################
# DynamoDB table for query cache       #
########################################
resource "aws_dynamodb_table" "flights_query_cache" {
  name         = "flights-query-cache"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "query_hash"

  attribute {
    name = "query_hash"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Name = "Flights Query Cache"
  }
}