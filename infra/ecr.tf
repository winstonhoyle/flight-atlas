resource "aws_ecr_repository" "flight_atlas_repo" {
  name = "flight-atlas"
}

resource "null_resource" "build_push_image" {
  depends_on = [aws_ecr_repository.flight_atlas_repo]

  provisioner "local-exec" {
    command = <<EOT
      $(aws ecr get-login-password --region ${var.region} | docker login --username AWS --password-stdin ${aws_ecr_repository.flight_atlas_repo.repository_url})
      docker build -t flight-atlas:latest ../ecs
      docker tag flight-atlas:latest ${aws_ecr_repository.flight_atlas_repo.repository_url}:latest
      docker push ${aws_ecr_repository.flight_atlas_repo.repository_url}:latest
    EOT
  }
}

resource "aws_ecr_lifecycle_policy" "flight_atlas_policy" {
  repository = aws_ecr_repository.flight_atlas_repo.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep only the most recent image, delete the rest after 7 days"
        selection = {
          tagStatus   = "any"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 7 # Older than 7 days
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}