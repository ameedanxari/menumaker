variable "environment" {
  type        = string
  description = "Deployment environment."
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of dev, staging, or prod."
  }
}

variable "aws_region" {
  type        = string
  description = "AWS region for this environment."
}

variable "aws_account_id" {
  type        = string
  description = "Expected AWS account id for this environment."
  validation {
    condition     = can(regex("^\\d{12}$", var.aws_account_id))
    error_message = "aws_account_id must be a 12 digit AWS account id."
  }
}

variable "allow_offline_plan" {
  type        = bool
  description = "Allow local validation/plans without real AWS credentials. Must be false in CI/deploy."
  default     = false
}

variable "vpc_cidr" {
  type        = string
  description = "Private VPC CIDR."
  validation {
    condition     = can(cidrhost(var.vpc_cidr, 1)) && !startswith(var.vpc_cidr, "0.0.0.0/")
    error_message = "vpc_cidr must be a valid non-public-all CIDR."
  }
}

variable "public_subnet_cidrs" {
  type        = list(string)
  description = "Public subnet CIDRs for ALB and NAT."
  validation {
    condition     = length(var.public_subnet_cidrs) >= 2 && alltrue([for cidr in var.public_subnet_cidrs : can(cidrhost(cidr, 1))])
    error_message = "At least two valid public_subnet_cidrs are required."
  }
}

variable "private_subnet_cidrs" {
  type        = list(string)
  description = "Private subnet CIDRs for ECS tasks."
  validation {
    condition     = length(var.private_subnet_cidrs) >= 2 && alltrue([for cidr in var.private_subnet_cidrs : can(cidrhost(cidr, 1))])
    error_message = "At least two valid private_subnet_cidrs are required."
  }
}

variable "database_subnet_cidrs" {
  type        = list(string)
  description = "Private database subnet CIDRs."
  validation {
    condition = length(var.database_subnet_cidrs) >= 2 && alltrue([
      for cidr in var.database_subnet_cidrs :
      can(cidrhost(cidr, 1)) && !startswith(cidr, "0.0.0.0/")
    ])
    error_message = "At least two private database_subnet_cidrs are required and 0.0.0.0/0 is prohibited."
  }
}

variable "domain_name" {
  type        = string
  description = "Environment DNS name."
}

variable "hosted_zone_id" {
  type        = string
  description = "Route 53 hosted zone id. Empty disables DNS records for local validation."
  default     = ""
}

variable "acm_certificate_arn" {
  type        = string
  description = "ACM certificate ARN for HTTPS listeners."
}

variable "api_image_digest" {
  type        = string
  description = "Pinned ECR image URI with digest, never a mutable tag."
  validation {
    condition     = can(regex("@sha256:[0-9a-f]{64}$", var.api_image_digest))
    error_message = "api_image_digest must be pinned by digest, e.g. repository@sha256:<64 hex chars>."
  }
}

variable "desired_count" {
  type        = number
  description = "ECS service desired task count."
  validation {
    condition     = var.desired_count >= 1
    error_message = "desired_count must be at least 1."
  }
}

variable "api_cpu" {
  type        = number
  description = "Fargate task CPU units."
  default     = 512
}

variable "api_memory" {
  type        = number
  description = "Fargate task memory MiB."
  default     = 1024
}

variable "rds_instance_class" {
  type        = string
  description = "RDS PostgreSQL instance class."
}

variable "rds_allocated_storage_gb" {
  type        = number
  description = "RDS allocated storage in GiB."
  validation {
    condition     = var.rds_allocated_storage_gb >= 20
    error_message = "rds_allocated_storage_gb must be at least 20."
  }
}

variable "rds_backup_retention_days" {
  type        = number
  description = "Automated backup retention days."
  validation {
    condition     = var.environment != "prod" || var.rds_backup_retention_days >= 7
    error_message = "prod requires rds_backup_retention_days >= 7."
  }
}

variable "rds_deletion_protection" {
  type        = bool
  description = "Enable RDS deletion protection."
  validation {
    condition     = var.environment != "prod" || var.rds_deletion_protection
    error_message = "prod requires rds_deletion_protection=true."
  }
}

variable "rds_multi_az" {
  type        = bool
  description = "Enable RDS Multi-AZ."
  validation {
    condition     = var.environment != "prod" || var.rds_multi_az
    error_message = "prod requires rds_multi_az=true."
  }
}

variable "log_retention_days" {
  type        = number
  description = "CloudWatch log retention."
  validation {
    condition     = contains([7, 14, 30, 60, 90, 180, 365], var.log_retention_days)
    error_message = "log_retention_days must be an approved CloudWatch retention value."
  }
}

variable "alarm_email" {
  type        = string
  description = "Operational alarm email."
  default     = ""
}

variable "database_secret_arn" {
  type        = string
  description = "Secrets Manager ARN for database credentials. Secret values are never Terraform variables."
  validation {
    condition     = can(regex("^arn:aws:secretsmanager:", var.database_secret_arn))
    error_message = "database_secret_arn must be a Secrets Manager ARN, not a secret value."
  }
}

variable "jwt_secret_arn" {
  type        = string
  description = "Secrets Manager ARN for JWT/session secret."
  validation {
    condition     = can(regex("^arn:aws:secretsmanager:", var.jwt_secret_arn))
    error_message = "jwt_secret_arn must be a Secrets Manager ARN, not a secret value."
  }
}

variable "stripe_secret_arn" {
  type        = string
  description = "Secrets Manager ARN for Stripe secret material."
  validation {
    condition     = can(regex("^arn:aws:secretsmanager:", var.stripe_secret_arn))
    error_message = "stripe_secret_arn must be a Secrets Manager ARN, not a secret value."
  }
}

variable "media_bucket_force_destroy" {
  type        = bool
  description = "Allow media bucket force destroy. Must be false in prod."
  default     = false
  validation {
    condition     = var.environment != "prod" || !var.media_bucket_force_destroy
    error_message = "prod cannot force-destroy media buckets."
  }
}

variable "tags" {
  type        = map(string)
  description = "Common resource tags."
  default     = {}
}
