# Get current AWS account ID (needed for Glue resource ARNs)
data "aws_caller_identity" "current" {}