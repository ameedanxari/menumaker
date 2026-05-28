provider "aws" {
  region = "us-east-1"
}

module "backend" {
  source = "./modules/backend"
}

module "database" {
  source = "./modules/database"
}
