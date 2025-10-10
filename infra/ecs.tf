############################################################
# ECS Cluster
############################################################
resource "aws_ecs_cluster" "flights_cluster" {
  name = "flights-cluster"
}

############################################################
# ECS Task Definition
############################################################
resource "aws_ecs_task_definition" "flights_task" {
  family                   = "flights-scraper"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "2048"
  memory                   = "4096"
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_execution_role.arn

  container_definitions = jsonencode([{
    name      = "flights-scraper"
    image     = var.ecs_image
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

  depends_on = [null_resource.build_push_image]
}

############################################################
# ECS Fargate Service
############################################################
resource "aws_ecs_service" "flight_atlas_service" {
  name            = "flight-atlas-service"
  cluster         = aws_ecs_cluster.flights_cluster.id
  task_definition = aws_ecs_task_definition.flights_task.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.public_subnet_1.id, aws_subnet.public_subnet_2.id]
    security_groups  = [aws_security_group.ecs_sg.id]
    assign_public_ip = true
  }

  depends_on = [aws_internet_gateway.ecs_igw]
}
