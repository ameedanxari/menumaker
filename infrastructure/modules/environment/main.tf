variable "environment" { type = string }
variable "aws_region" { type = string }
variable "aws_account_id" { type = string }
variable "vpc_cidr" { type = string }
variable "public_subnet_cidrs" { type = list(string) }
variable "private_subnet_cidrs" { type = list(string) }
variable "database_subnet_cidrs" { type = list(string) }
variable "domain_name" { type = string }
variable "hosted_zone_id" { type = string }
variable "acm_certificate_arn" { type = string }
variable "api_image_digest" { type = string }
variable "desired_count" { type = number }
variable "api_cpu" { type = number }
variable "api_memory" { type = number }
variable "rds_instance_class" { type = string }
variable "rds_allocated_storage_gb" { type = number }
variable "rds_backup_retention_days" { type = number }
variable "rds_deletion_protection" { type = bool }
variable "rds_multi_az" { type = bool }
variable "log_retention_days" { type = number }
variable "alarm_email" { type = string }
variable "database_secret_arn" { type = string }
variable "jwt_secret_arn" { type = string }
variable "stripe_secret_arn" { type = string }
variable "media_bucket_force_destroy" { type = bool }
variable "tags" { type = map(string) }

locals {
  name_prefix        = "menumaker-${var.environment}"
  common_tags        = merge(var.tags, { Environment = var.environment, Service = "menumaker" })
  has_dns            = var.hosted_zone_id != ""
  database_name      = "menumaker"
  container_port     = 3001
  web_bucket_name    = "menumaker-${var.environment}-web-${var.aws_account_id}"
  media_bucket       = "menumaker-${var.environment}-media-${var.aws_account_id}"
  availability_zones = ["${var.aws_region}a", "${var.aws_region}b", "${var.aws_region}c"]
}

resource "aws_kms_key" "environment" {
  description             = "${local.name_prefix} environment encryption key"
  deletion_window_in_days = var.environment == "prod" ? 30 : 7
  enable_key_rotation     = true
  tags                    = local.common_tags
}

resource "aws_kms_alias" "environment" {
  name          = "alias/${local.name_prefix}"
  target_key_id = aws_kms_key.environment.key_id
}

resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags                 = merge(local.common_tags, { Name = local.name_prefix })
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = merge(local.common_tags, { Name = "${local.name_prefix}-igw" })
}

resource "aws_subnet" "public" {
  count                   = length(var.public_subnet_cidrs)
  vpc_id                  = aws_vpc.this.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = local.availability_zones[count.index]
  map_public_ip_on_launch = true
  tags                    = merge(local.common_tags, { Name = "${local.name_prefix}-public-${count.index + 1}", Tier = "public" })
}

resource "aws_subnet" "private" {
  count                   = length(var.private_subnet_cidrs)
  vpc_id                  = aws_vpc.this.id
  cidr_block              = var.private_subnet_cidrs[count.index]
  availability_zone       = local.availability_zones[count.index]
  map_public_ip_on_launch = false
  tags                    = merge(local.common_tags, { Name = "${local.name_prefix}-private-${count.index + 1}", Tier = "private" })
}

resource "aws_subnet" "database" {
  count                   = length(var.database_subnet_cidrs)
  vpc_id                  = aws_vpc.this.id
  cidr_block              = var.database_subnet_cidrs[count.index]
  availability_zone       = local.availability_zones[count.index]
  map_public_ip_on_launch = false
  tags                    = merge(local.common_tags, { Name = "${local.name_prefix}-database-${count.index + 1}", Tier = "database" })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id
  tags   = merge(local.common_tags, { Name = "${local.name_prefix}-public" })
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.this.id
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_eip" "nat" {
  count  = var.environment == "prod" ? length(aws_subnet.public) : 1
  domain = "vpc"
  tags   = merge(local.common_tags, { Name = "${local.name_prefix}-nat-${count.index + 1}" })
}

resource "aws_nat_gateway" "this" {
  count         = length(aws_eip.nat)
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id
  tags          = merge(local.common_tags, { Name = "${local.name_prefix}-nat-${count.index + 1}" })
  depends_on    = [aws_internet_gateway.this]
}

resource "aws_route_table" "private" {
  count  = length(aws_subnet.private)
  vpc_id = aws_vpc.this.id
  tags   = merge(local.common_tags, { Name = "${local.name_prefix}-private-${count.index + 1}" })
}

resource "aws_route" "private_nat" {
  count                  = length(aws_route_table.private)
  route_table_id         = aws_route_table.private[count.index].id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.this[var.environment == "prod" ? count.index : 0].id
}

resource "aws_route_table_association" "private" {
  count          = length(aws_subnet.private)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

resource "aws_route_table" "database" {
  vpc_id = aws_vpc.this.id
  tags   = merge(local.common_tags, { Name = "${local.name_prefix}-database" })
}

resource "aws_route_table_association" "database" {
  count          = length(aws_subnet.database)
  subnet_id      = aws_subnet.database[count.index].id
  route_table_id = aws_route_table.database.id
}

resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-alb"
  description = "Public TLS ingress to MenuMaker API"
  vpc_id      = aws_vpc.this.id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = local.container_port
    to_port     = local.container_port
    protocol    = "tcp"
    cidr_blocks = var.private_subnet_cidrs
  }

  tags = local.common_tags
}

resource "aws_security_group" "api" {
  name        = "${local.name_prefix}-api"
  description = "Private ECS task ingress only from ALB"
  vpc_id      = aws_vpc.this.id

  ingress {
    from_port       = local.container_port
    to_port         = local.container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.common_tags
}

resource "aws_security_group" "database" {
  name        = "${local.name_prefix}-database"
  description = "Private PostgreSQL access only from API tasks"
  vpc_id      = aws_vpc.this.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.api.id]
  }

  tags = local.common_tags
}

resource "aws_lb" "api" {
  name               = "${local.name_prefix}-api"
  load_balancer_type = "application"
  internal           = false
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id
  tags               = local.common_tags
}

resource "aws_lb_target_group" "api" {
  name        = "${local.name_prefix}-api"
  port        = local.container_port
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.this.id

  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }

  tags = local.common_tags
}

resource "aws_lb_listener" "http_redirect" {
  load_balancer_arn = aws_lb.api.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.api.arn
  port              = 443
  protocol          = "HTTPS"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

resource "aws_ecr_repository" "api" {
  name                 = "${local.name_prefix}-api"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.environment.arn
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/ecs/${local.name_prefix}/api"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.environment.arn
  tags              = local.common_tags
}

resource "aws_iam_role" "task_execution" {
  name = "${local.name_prefix}-task-execution"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "task_execution" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "task_execution_secrets" {
  name = "${local.name_prefix}-secrets"
  role = aws_iam_role.task_execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue", "kms:Decrypt"]
      Resource = [var.database_secret_arn, var.jwt_secret_arn, var.stripe_secret_arn, aws_kms_key.environment.arn]
    }]
  })
}

resource "aws_iam_role" "task" {
  name = "${local.name_prefix}-task"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = local.common_tags
}

resource "aws_ecs_cluster" "this" {
  name = local.name_prefix

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = local.common_tags
}

resource "aws_ecs_task_definition" "api" {
  family                   = "${local.name_prefix}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.api_cpu
  memory                   = var.api_memory
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([{
    name         = "api"
    image        = var.api_image_digest
    essential    = true
    portMappings = [{ containerPort = local.container_port, protocol = "tcp" }]
    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "PORT", value = tostring(local.container_port) }
    ]
    secrets = [
      { name = "DATABASE_URL", valueFrom = var.database_secret_arn },
      { name = "JWT_SECRET", valueFrom = var.jwt_secret_arn },
      { name = "STRIPE_SECRET_KEY", valueFrom = var.stripe_secret_arn }
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.api.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "api"
      }
    }
  }])

  tags = local.common_tags
}

resource "aws_ecs_service" "api" {
  name            = "${local.name_prefix}-api"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.api.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = local.container_port
  }

  depends_on = [aws_lb_listener.https]
  tags       = local.common_tags
}

resource "aws_db_subnet_group" "this" {
  name       = "${local.name_prefix}-db"
  subnet_ids = aws_subnet.database[*].id
  tags       = local.common_tags
}

resource "aws_db_instance" "postgres" {
  identifier                  = "${local.name_prefix}-postgres"
  engine                      = "postgres"
  engine_version              = "16"
  instance_class              = var.rds_instance_class
  allocated_storage           = var.rds_allocated_storage_gb
  db_name                     = local.database_name
  username                    = "menumaker_admin"
  manage_master_user_password = true
  kms_key_id                  = aws_kms_key.environment.arn
  storage_encrypted           = true
  multi_az                    = var.rds_multi_az
  publicly_accessible         = false
  deletion_protection         = var.rds_deletion_protection
  backup_retention_period     = var.rds_backup_retention_days
  db_subnet_group_name        = aws_db_subnet_group.this.name
  vpc_security_group_ids      = [aws_security_group.database.id]
  skip_final_snapshot         = var.environment != "prod"
  final_snapshot_identifier   = var.environment == "prod" ? "${local.name_prefix}-final" : null
  tags                        = local.common_tags
}

resource "aws_s3_bucket" "web" {
  bucket = local.web_bucket_name
  tags   = local.common_tags
}

resource "aws_s3_bucket" "media" {
  bucket        = local.media_bucket
  force_destroy = var.media_bucket_force_destroy
  tags          = local.common_tags
}

resource "aws_s3_bucket_public_access_block" "web" {
  bucket                  = aws_s3_bucket.web.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "media" {
  bucket                  = aws_s3_bucket.media.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "web" {
  bucket = aws_s3_bucket.web.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_versioning" "media" {
  bucket = aws_s3_bucket.media.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "web" {
  bucket = aws_s3_bucket.web.id
  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.environment.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "media" {
  bucket = aws_s3_bucket.media.id
  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.environment.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

resource "aws_cloudfront_origin_access_control" "web" {
  name                              = "${local.name_prefix}-web"
  description                       = "MenuMaker web origin access"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "web" {
  enabled             = true
  comment             = "${local.name_prefix} web"
  default_root_object = "index.html"

  origin {
    domain_name              = aws_s3_bucket.web.bucket_regional_domain_name
    origin_id                = "web"
    origin_access_control_id = aws_cloudfront_origin_access_control.web.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "web"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = local.common_tags
}

resource "aws_route53_record" "api" {
  count   = local.has_dns ? 1 : 0
  zone_id = var.hosted_zone_id
  name    = "api.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_lb.api.dns_name
    zone_id                = aws_lb.api.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "web" {
  count   = local.has_dns ? 1 : 0
  zone_id = var.hosted_zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.web.domain_name
    zone_id                = aws_cloudfront_distribution.web.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_cloudwatch_metric_alarm" "api_5xx" {
  alarm_name          = "${local.name_prefix}-api-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"
  dimensions = {
    LoadBalancer = aws_lb.api.arn_suffix
  }
  tags = local.common_tags
}

output "environment" { value = var.environment }
output "api_url" { value = "https://api.${var.domain_name}" }
output "web_distribution_domain_name" { value = aws_cloudfront_distribution.web.domain_name }
output "media_bucket_name" { value = aws_s3_bucket.media.bucket }
output "ecr_repository_url" { value = aws_ecr_repository.api.repository_url }
output "ecs_cluster_name" { value = aws_ecs_cluster.this.name }
output "ecs_service_name" { value = aws_ecs_service.api.name }
output "rds_endpoint" { value = aws_db_instance.postgres.endpoint }
