terraform {
  required_version = ">= 1.5.0"

  backend "s3" {
    bucket       = "flightatlas-terraform-state"
    key          = "infra/terraform.tfstate"
    region       = "us-west-1"
    use_lockfile = true
    encrypt      = true
  }
}
