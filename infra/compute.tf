############################################################
# ECR repositories
############################################################
resource "aws_ecr_repository" "flight_atlas_repo" {
  name = "flight-atlas"
}

resource "aws_ecr_lifecycle_policy" "flight_atlas_policy" {
  repository = aws_ecr_repository.flight_atlas_repo.name

  # Count-based, not age-based: deleting the Lambda's image takes the API down.
  policy = jsonencode({
    rules = [
      for i, kind in ["lambda", "ecs"] : {
        rulePriority = i + 1
        description  = "Keep the 5 most recent ${kind} images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["${kind}-"]
          countType     = "imageCountMoreThan"
          countNumber   = 5
        }
        action = { type = "expire" }
      }
    ]
  })
}

############################################################
# ECS cluster, task definition & service
############################################################
resource "aws_ecs_cluster" "flights_cluster" {
  name = "flights-cluster"
}

resource "aws_ecs_task_definition" "flights_task" {
  family                   = "flights-scraper"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "2048"
  memory                   = "4096"
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([{
    name      = "flights-scraper"
    image     = "${aws_ecr_repository.flight_atlas_repo.repository_url}:ecs-${var.image_tag}"
    essential = true
    environment = [
      { name = "S3_ROUTES_BUCKET", value = aws_s3_bucket.flights_bucket.bucket },
      { name = "S3_RESULTS_BUCKET", value = aws_s3_bucket.athena_query_results.bucket },
      { name = "REGION", value = var.region },
      { name = "ATHENA_DB", value = aws_glue_catalog_database.flights_db.name },
      { name = "S3_PREFIX", value = "flights" }
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/flights-scraper"
        "awslogs-region"        = var.region
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])
}

# desired_count = 0: the scraper runs via the monthly scheduled task below, not
# as a persistent service. Set to 1 only to run it continuously.
resource "aws_ecs_service" "flight_atlas_service" {
  name            = "flight-atlas-service"
  cluster         = aws_ecs_cluster.flights_cluster.id
  task_definition = aws_ecs_task_definition.flights_task.arn
  desired_count   = 0
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = local.public_subnet_ids
    security_groups  = [aws_security_group.ecs_sg.id]
    assign_public_ip = true
  }

  depends_on = [aws_internet_gateway.ecs_igw]
}

resource "aws_cloudwatch_log_group" "flights_scraper" {
  name              = "/ecs/flights-scraper"
  retention_in_days = 30
}

############################################################
# Monthly scheduled scraper run
############################################################
resource "aws_cloudwatch_event_rule" "monthly_schedule" {
  name                = "flights_monthly_schedule"
  description         = "Trigger flights scraper ECS task on the 1st of every month"
  schedule_expression = "cron(0 0 1 * ? *)"
}

resource "aws_cloudwatch_event_target" "monthly_ecs_target" {
  rule      = aws_cloudwatch_event_rule.monthly_schedule.name
  target_id = "flights-monthly-ecs"

  arn      = aws_ecs_cluster.flights_cluster.arn
  role_arn = aws_iam_role.ecs_events_role.arn

  ecs_target {
    task_definition_arn = aws_ecs_task_definition.flights_task.arn
    launch_type         = "FARGATE"
    network_configuration {
      subnets          = local.public_subnet_ids
      security_groups  = [aws_security_group.ecs_sg.id]
      assign_public_ip = true
    }
  }
}

############################################################
# Query Lambda
############################################################
resource "aws_lambda_function" "flights_query_lambda" {
  function_name = "flights-query-lambda"
  role          = aws_iam_role.lambda_role.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.flight_atlas_repo.repository_url}:lambda-${var.image_tag}"
  memory_size   = 256
  timeout       = 10

  environment {
    variables = {
      ATHENA_DATABASE   = aws_glue_catalog_database.flights_db.name
      FLIGHTS_TABLE     = aws_glue_catalog_table.tables["flights"].name
      AIRPORTS_TABLE    = aws_glue_catalog_table.tables["airports"].name
      AIRLINES_TABLE    = aws_glue_catalog_table.tables["airlines"].name
      S3_RESULTS_BUCKET = aws_s3_bucket.athena_query_results.bucket
      CACHE_TABLE       = aws_dynamodb_table.flights_query_cache.name
    }
  }
}

resource "aws_lambda_permission" "allow_apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.flights_query_lambda.function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_apigatewayv2_api.flights_api.execution_arn}/*/*"
}
