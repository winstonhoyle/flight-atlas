resource "aws_dynamodb_table" "query_cache" {
  name         = "flights-query-cache"
  billing_mode = "PAY_PER_REQUEST" # no fixed cost
  hash_key     = "query_hash"

  attribute {
    name = "query_hash"
    type = "S"
  }
}