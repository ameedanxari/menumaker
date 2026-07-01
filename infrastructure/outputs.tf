output "environment" {
  description = "Environment name."
  value       = module.environment.environment
}

output "api_url" {
  description = "Public HTTPS API URL."
  value       = module.environment.api_url
}

output "web_distribution_domain_name" {
  description = "CloudFront web distribution domain."
  value       = module.environment.web_distribution_domain_name
}

output "media_bucket_name" {
  description = "S3 media bucket name."
  value       = module.environment.media_bucket_name
}

output "ecr_repository_url" {
  description = "ECR repository URL for immutable image publishing."
  value       = module.environment.ecr_repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name."
  value       = module.environment.ecs_cluster_name
}

output "ecs_service_name" {
  description = "ECS service name."
  value       = module.environment.ecs_service_name
}

output "rds_endpoint" {
  description = "RDS endpoint for deployment verification. Contains no password."
  value       = module.environment.rds_endpoint
}
