#!/usr/bin/env python3
"""Verify Terraform observability coverage against the SLO catalog."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


REQUIRED_TOKENS = [
    "aws_cloudwatch_dashboard",
    "aws_cloudwatch_metric_alarm",
    "aws_xray_sampling_rule",
    "aws_sns_topic",
    "aws_synthetics_canary",
    "treat_missing_data",
    "Runbook",
    "duplicate/lost/invalid-transition",
    "PaymentSignatureFailures",
    "OutboxLagSeconds",
    "MigrationFailures",
    "BackupStatusFailures",
]


def fail(message: str) -> None:
    print(f"❌ {message}", file=sys.stderr)
    raise SystemExit(1)


def main(catalog_path: Path, terraform_path: Path) -> None:
    catalog = json.loads(catalog_path.read_text())
    terraform = terraform_path.read_text()
    for token in REQUIRED_TOKENS:
        if token not in terraform:
            fail(f"{terraform_path}: missing required observability token/resource {token!r}")

    alarm_count = len(re.findall(r'resource\s+"aws_cloudwatch_metric_alarm"', terraform))
    if alarm_count < 7:
        fail(f"{terraform_path}: expected at least 7 CloudWatch alarms, found {alarm_count}")

    canary_names = set(re.findall(r'"(public-menu|auth|order|payment-event)"', terraform))
    if canary_names != {"public-menu", "auth", "order", "payment-event"}:
        fail(f"{terraform_path}: synthetics must cover public-menu, auth, order, and payment-event")

    slo_blob = json.dumps(catalog).lower()
    for term in ["duplicate", "lost", "invalid_transition", "runbook", "customer_impact", "no_data"]:
        if term not in slo_blob:
            fail(f"{catalog_path}: missing SLO coverage term {term}")

    for service in catalog.get("services", []):
      if service.get("tier") == 0 and service["id"] not in ["order_creation", "order_status", "payment_webhook"]:
          fail(f"{catalog_path}: unexpected tier 0 service {service['id']}")

    print(f"✅ alert coverage valid: {alarm_count} alarms, {len(canary_names)} canaries")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        fail("usage: verify_alert_coverage.py <slo-catalog.yaml> <observability.tf>")
    main(Path(sys.argv[1]), Path(sys.argv[2]))
