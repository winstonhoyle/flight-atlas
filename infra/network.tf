############################################################
# VPC & Internet Gateway
############################################################
resource "aws_vpc" "ecs_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "ecs-vpc"
  }
}

resource "aws_internet_gateway" "ecs_igw" {
  vpc_id = aws_vpc.ecs_vpc.id

  tags = {
    Name = "ecs-igw"
  }
}

############################################################
# Public subnets
############################################################
locals {
  public_subnets = {
    "1" = { az = "us-west-1a", cidr = "10.0.1.0/24" }
    "2" = { az = "us-west-1c", cidr = "10.0.2.0/24" }
  }

  public_subnet_ids = [for s in aws_subnet.public : s.id]
}

resource "aws_subnet" "public" {
  for_each = local.public_subnets

  vpc_id                  = aws_vpc.ecs_vpc.id
  cidr_block              = each.value.cidr
  availability_zone       = each.value.az
  map_public_ip_on_launch = true

  tags = { Name = "ecs-public-${each.key}" }
}

resource "aws_route_table" "public_rt" {
  vpc_id = aws_vpc.ecs_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.ecs_igw.id
  }

  tags = {
    Name = "ecs-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  for_each = aws_subnet.public

  subnet_id      = each.value.id
  route_table_id = aws_route_table.public_rt.id
}

############################################################
# Security group (outbound only)
############################################################
resource "aws_security_group" "ecs_sg" {
  name        = "ecs-sg"
  description = "Outbound only for ECS scraper"
  vpc_id      = aws_vpc.ecs_vpc.id

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

# Rename-only state moves for the for_each migration; remove after first apply.
moved {
  from = aws_subnet.public_subnet_1
  to   = aws_subnet.public["1"]
}

moved {
  from = aws_subnet.public_subnet_2
  to   = aws_subnet.public["2"]
}

moved {
  from = aws_route_table_association.subnet1_assoc
  to   = aws_route_table_association.public["1"]
}

moved {
  from = aws_route_table_association.subnet2_assoc
  to   = aws_route_table_association.public["2"]
}
