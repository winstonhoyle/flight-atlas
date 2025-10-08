resource "aws_cloudwatch_event_rule" "monthly_schedule" {
  name                = "flights_monthly_schedule"
  description         = "Trigger flights scraper Lambda on the 1st of every month"
  schedule_expression = "cron(0 0 1 * ? *)" # UTC midnight on the 1st
}

resource "aws_cloudwatch_event_target" "monthly_lambda_target" {
  rule      = aws_cloudwatch_event_rule.monthly_schedule.name
  target_id = "FlightsLambda"
  arn       = aws_lambda_function.flights_scraper.arn
}
