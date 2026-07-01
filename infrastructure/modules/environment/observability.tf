locals {
  alarm_actions        = var.alarm_email == "" ? [] : [aws_sns_topic.alerts[0].arn]
  observability_prefix = "${local.name_prefix}-observability"
  runbook_base_url     = "https://github.com/ameedanxari/menumaker/blob/main/docs/operations/runbooks/index.md"
  canary_names         = toset(["public-menu", "auth", "order", "payment-event"])
}

resource "aws_sns_topic" "alerts" {
  count             = var.alarm_email == "" ? 0 : 1
  name              = "${local.name_prefix}-alerts"
  kms_master_key_id = aws_kms_key.environment.arn
  tags              = merge(local.common_tags, { Runbook = local.runbook_base_url })
}

resource "aws_sns_topic_subscription" "alert_email" {
  count     = var.alarm_email == "" ? 0 : 1
  topic_arn = aws_sns_topic.alerts[0].arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

resource "aws_xray_sampling_rule" "api" {
  rule_name      = "${local.name_prefix}-api"
  priority       = 1000
  version        = 1
  reservoir_size = var.environment == "prod" ? 5 : 1
  fixed_rate     = var.environment == "prod" ? 0.10 : 0.25
  url_path       = "*"
  host           = "*"
  http_method    = "*"
  service_name   = "menumaker-api"
  service_type   = "*"
  resource_arn   = "*"
  tags           = local.common_tags
}

resource "aws_cloudwatch_dashboard" "operations" {
  dashboard_name = "${local.name_prefix}-operations"
  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "text"
        x      = 0
        y      = 0
        width  = 24
        height = 2
        properties = {
          markdown = "# MenuMaker ${var.environment} operations\nRunbook: ${local.runbook_base_url}\nSLO catalog: docs/operations/slo-catalog.yaml"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 2
        width  = 12
        height = 6
        properties = {
          title   = "API 5xx and latency"
          region  = var.aws_region
          metrics = [["AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", "TargetGroup", aws_lb_target_group.api.arn_suffix, "LoadBalancer", aws_lb.api.arn_suffix]]
          stat    = "Sum"
          period  = 60
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 2
        width  = 12
        height = 6
        properties = {
          title   = "Tier 0 correctness"
          region  = var.aws_region
          metrics = [["MenuMaker", "OrderCorrectnessErrors", "Environment", var.environment], [".", "PaymentCorrectnessErrors", ".", "."]]
          stat    = "Sum"
          period  = 60
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 8
        width  = 12
        height = 6
        properties = {
          title   = "RDS storage and CPU"
          region  = var.aws_region
          metrics = [["AWS/RDS", "FreeStorageSpace", "DBInstanceIdentifier", aws_db_instance.postgres.identifier], [".", "CPUUtilization", ".", "."]]
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 8
        width  = 12
        height = 6
        properties = {
          title   = "Outbox/DLQ lag and migration failures"
          region  = var.aws_region
          metrics = [["MenuMaker", "OutboxLagSeconds", "Environment", var.environment], [".", "MigrationFailures", ".", "."]]
          period  = 60
        }
      }
    ]
  })
}

resource "aws_cloudwatch_metric_alarm" "api_latency_p95" {
  alarm_name          = "${local.name_prefix}-api-latency-p95"
  alarm_description   = "SEV2: API p95 latency violates SLO. Customer impact: ordering/auth/menu flows are slow. Runbook: ${local.runbook_base_url}#api-outage-and-auth-failure"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 5
  datapoints_to_alarm = 4
  threshold           = 1.5
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
  metric_query {
    id          = "p95"
    expression  = "SELECT PERCENTILE(TargetResponseTime, 95) FROM SCHEMA(\"AWS/ApplicationELB\", LoadBalancer, TargetGroup) WHERE LoadBalancer='${aws_lb.api.arn_suffix}' AND TargetGroup='${aws_lb_target_group.api.arn_suffix}'"
    label       = "ALB target response p95"
    return_data = true
  }
  tags = merge(local.common_tags, { Severity = "sev2", Runbook = "${local.runbook_base_url}#api-outage-and-auth-failure" })
}

resource "aws_cloudwatch_metric_alarm" "tier0_correctness" {
  alarm_name          = "${local.name_prefix}-tier0-correctness"
  alarm_description   = "SEV1: duplicate/lost/invalid-transition order or payment correctness failure. Runbook: ${local.runbook_base_url}#duplicate-order-or-payment-suspicion"
  namespace           = "MenuMaker"
  metric_name         = "Tier0CorrectnessErrors"
  statistic           = "Sum"
  period              = 60
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  dimensions          = { Environment = var.environment }
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
  tags                = merge(local.common_tags, { Severity = "sev1", Runbook = "${local.runbook_base_url}#duplicate-order-or-payment-suspicion" })
}

resource "aws_cloudwatch_metric_alarm" "rds_free_storage" {
  alarm_name          = "${local.name_prefix}-rds-free-storage"
  alarm_description   = "SEV2: RDS free storage is low. Runbook: ${local.runbook_base_url}#database-failover-restore-and-bad-migration"
  namespace           = "AWS/RDS"
  metric_name         = "FreeStorageSpace"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 5368709120
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "breaching"
  dimensions          = { DBInstanceIdentifier = aws_db_instance.postgres.identifier }
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
  tags                = merge(local.common_tags, { Severity = "sev2", Runbook = "${local.runbook_base_url}#database-failover-restore-and-bad-migration" })
}

resource "aws_cloudwatch_metric_alarm" "migration_failure" {
  alarm_name          = "${local.name_prefix}-migration-failure"
  alarm_description   = "SEV1: migration job failed; do not auto-revert destructive migrations. Runbook: ${local.runbook_base_url}#database-failover-restore-and-bad-migration"
  namespace           = "MenuMaker"
  metric_name         = "MigrationFailures"
  statistic           = "Sum"
  period              = 60
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  dimensions          = { Environment = var.environment }
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
  tags                = merge(local.common_tags, { Severity = "sev1", Runbook = "${local.runbook_base_url}#database-failover-restore-and-bad-migration" })
}

resource "aws_cloudwatch_metric_alarm" "outbox_dlq_lag" {
  alarm_name          = "${local.name_prefix}-outbox-dlq-lag"
  alarm_description   = "SEV2: notification outbox or DLQ replay lag exceeds SLO. Runbook: ${local.runbook_base_url}#outbox-dlq-replay-and-stale-order-status"
  namespace           = "MenuMaker"
  metric_name         = "OutboxLagSeconds"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 5
  datapoints_to_alarm = 3
  threshold           = 600
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "breaching"
  dimensions          = { Environment = var.environment }
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
  tags                = merge(local.common_tags, { Severity = "sev2", Runbook = "${local.runbook_base_url}#outbox-dlq-replay-and-stale-order-status" })
}

resource "aws_cloudwatch_metric_alarm" "payment_signature_failures" {
  alarm_name          = "${local.name_prefix}-payment-signature-failures"
  alarm_description   = "SEV1: signed payment-event canary or webhook signature failures exceed SLO. Runbook: ${local.runbook_base_url}#payment-webhook-backlog"
  namespace           = "MenuMaker"
  metric_name         = "PaymentSignatureFailures"
  statistic           = "Sum"
  period              = 60
  evaluation_periods  = 3
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  dimensions          = { Environment = var.environment }
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
  tags                = merge(local.common_tags, { Severity = "sev1", Runbook = "${local.runbook_base_url}#payment-webhook-backlog" })
}

resource "aws_cloudwatch_metric_alarm" "backup_status" {
  alarm_name          = "${local.name_prefix}-backup-status"
  alarm_description   = "SEV2: backup freshness/status failed. Runbook: ${local.runbook_base_url}#database-failover-restore-and-bad-migration"
  namespace           = "MenuMaker"
  metric_name         = "BackupStatusFailures"
  statistic           = "Sum"
  period              = 3600
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "breaching"
  dimensions          = { Environment = var.environment }
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
  tags                = merge(local.common_tags, { Severity = "sev2", Runbook = "${local.runbook_base_url}#database-failover-restore-and-bad-migration" })
}

resource "aws_iam_role" "synthetics" {
  name = "${local.name_prefix}-synthetics"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "synthetics.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = local.common_tags
}

resource "aws_iam_role_policy" "synthetics" {
  name = "${local.name_prefix}-synthetics"
  role = aws_iam_role.synthetics.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["cloudwatch:PutMetricData", "logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:GetBucketLocation"]
        Resource = [aws_s3_bucket.web.arn, "${aws_s3_bucket.web.arn}/*"]
      }
    ]
  })
}

resource "aws_synthetics_canary" "customer_journey" {
  for_each             = local.canary_names
  name                 = "${local.name_prefix}-${each.key}"
  artifact_s3_location = "s3://${aws_s3_bucket.web.bucket}/synthetics/${each.key}"
  execution_role_arn   = aws_iam_role.synthetics.arn
  handler              = "index.handler"
  runtime_version      = "syn-nodejs-puppeteer-9.1"
  zip_file             = "${path.module}/canary.zip"
  start_canary         = false

  schedule {
    expression = "rate(5 minutes)"
  }

  run_config {
    timeout_in_seconds = 60
    environment_variables = {
      ENVIRONMENT = var.environment
      CHECK_NAME  = each.key
      API_URL     = "https://api.${var.domain_name}"
    }
  }

  tags = merge(local.common_tags, {
    Severity = contains(["order", "payment-event"], each.key) ? "sev1" : "sev2"
    Runbook  = local.runbook_base_url
  })

  depends_on = [aws_iam_role_policy.synthetics]
}
