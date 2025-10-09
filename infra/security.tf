resource "aws_security_group" "ecs_sg" {
  name        = "ecs-sg"
  description = "Allow HTTP/HTTPS outbound for ECS"
  vpc_id      = aws_vpc.ecs_vpc.id

  ingress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"] # Adjust if you want to restrict
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "ecs-sg"
  }
}
