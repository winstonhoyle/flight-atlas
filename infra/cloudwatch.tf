resource "aws_cloudwatch_event_rule" "monthly_schedule" {
  name                = "flights_monthly_schedule"
  description         = "Trigger flights scraper ECS task on the 1st of every month"
  schedule_expression = "cron(0 0 1 * ? *)" # UTC midnight on the 1st
}

resource "aws_cloudwatch_event_target" "monthly_ecs_target" {
  rule      = aws_cloudwatch_event_rule.monthly_schedule.name
  target_id = "flights-ecs"

  arn      = aws_ecs_cluster.flights_cluster.arn
  role_arn = aws_iam_role.ecs_events_role.arn

  ecs_target {
    task_definition_arn = aws_ecs_task_definition.flights_task.arn
    launch_type         = "FARGATE"
    network_configuration {
      subnets          = [aws_subnet.public_subnet_1.id, aws_subnet.public_subnet_2.id]
      security_groups  = [aws_security_group.ecs_sg.id]
      assign_public_ip = true
    }
  }
}
