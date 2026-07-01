terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state bootstrap:
  # 1. Create an encrypted S3 bucket and DynamoDB lock table in the target AWS account.
  # 2. Initialize with:
  #    terraform init \
  #      -backend-config="bucket=<state-bucket>" \
  #      -backend-config="key=menumaker/${var.environment}/terraform.tfstate" \
  #      -backend-config="region=${var.aws_region}" \
  #      -backend-config="dynamodb_table=<lock-table>" \
  #      -backend-config="encrypt=true"
}

provider "aws" {
  region = var.aws_region

  # Local/offline plans use fake credentials and skip AWS API validation.
  # CI/deploy tfvars set allow_offline_plan=false and authenticate via OIDC.
  access_key                  = var.allow_offline_plan ? "offline-plan" : null
  secret_key                  = var.allow_offline_plan ? "offline-plan" : null
  skip_credentials_validation = var.allow_offline_plan
  skip_metadata_api_check     = var.allow_offline_plan
  skip_requesting_account_id  = var.allow_offline_plan

  default_tags {
    tags = merge(var.tags, {
      Application = "menumaker"
      Environment = var.environment
      ManagedBy   = "terraform"
    })
  }
}

module "environment" {
  source = "./modules/environment"

  environment                = var.environment
  aws_region                 = var.aws_region
  aws_account_id             = var.aws_account_id
  vpc_cidr                   = var.vpc_cidr
  public_subnet_cidrs        = var.public_subnet_cidrs
  private_subnet_cidrs       = var.private_subnet_cidrs
  database_subnet_cidrs      = var.database_subnet_cidrs
  domain_name                = var.domain_name
  hosted_zone_id             = var.hosted_zone_id
  acm_certificate_arn        = var.acm_certificate_arn
  api_image_digest           = var.api_image_digest
  desired_count              = var.desired_count
  api_cpu                    = var.api_cpu
  api_memory                 = var.api_memory
  rds_instance_class         = var.rds_instance_class
  rds_allocated_storage_gb   = var.rds_allocated_storage_gb
  rds_backup_retention_days  = var.rds_backup_retention_days
  rds_deletion_protection    = var.rds_deletion_protection
  rds_multi_az               = var.rds_multi_az
  log_retention_days         = var.log_retention_days
  alarm_email                = var.alarm_email
  database_secret_arn        = var.database_secret_arn
  jwt_secret_arn             = var.jwt_secret_arn
  stripe_secret_arn          = var.stripe_secret_arn
  media_bucket_force_destroy = var.media_bucket_force_destroy
  tags                       = var.tags
}
