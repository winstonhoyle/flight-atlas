resource "aws_cloudwatch_log_group" "flights_scraper" {
  name              = "/ecs/flights-scraper"
  retention_in_days = 30
}
