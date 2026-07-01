#!/usr/bin/env python3
"""Validate MenuMaker SLO catalog completeness.

The catalog is JSON-compatible YAML so this gate has no external Python
dependency. It intentionally checks the operational fields that make alerts
actionable: owner, query, thresholds, runbook, severity, and no-data behavior.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path


REQUIRED_SERVICE_FIELDS = ["id", "owner", "tier", "customer_impact", "runbook", "slos"]
REQUIRED_SLO_FIELDS = [
    "name",
    "sli",
    "query",
    "target",
    "window",
    "page_threshold",
    "ticket_threshold",
    "severity",
    "no_data",
]
TIER0_IDS = {"order_creation", "order_status", "payment_webhook"}
CORRECTNESS_TERMS = ("duplicate", "lost", "invalid_transition")


def fail(message: str) -> None:
    print(f"❌ {message}", file=sys.stderr)
    raise SystemExit(1)


def load_catalog(path: Path) -> dict:
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError as exc:
        fail(f"{path}: not valid JSON-compatible YAML: {exc}")


def validate(path: Path) -> None:
    catalog = load_catalog(path)
    services = catalog.get("services")
    if not isinstance(services, list) or not services:
        fail(f"{path}: services must be a non-empty list")

    service_ids = set()
    for service in services:
        missing = [field for field in REQUIRED_SERVICE_FIELDS if field not in service or service.get(field) in (None, "", [])]
        if missing:
            fail(f"{path}: service {service.get('id', '<unknown>')} missing {', '.join(missing)}")
        service_id = service["id"]
        service_ids.add(service_id)
        if not str(service["runbook"]).startswith("docs/operations/runbooks/index.md#"):
            fail(f"{path}: service {service_id} runbook must link to a versioned runbook anchor")
        if "customer" not in service["customer_impact"].lower() and "user" not in service["customer_impact"].lower():
            fail(f"{path}: service {service_id} customer_impact must describe user/customer impact")
        if service["tier"] == 0 and "sev1" not in json.dumps(service).lower():
            fail(f"{path}: tier 0 service {service_id} must have a sev1 page threshold")

        slos = service["slos"]
        if not isinstance(slos, list) or not slos:
            fail(f"{path}: service {service_id} must define at least one SLO")
        for slo in slos:
            missing = [field for field in REQUIRED_SLO_FIELDS if slo.get(field) in (None, "")]
            if missing:
                fail(f"{path}: SLO {service_id}/{slo.get('name', '<unknown>')} missing {', '.join(missing)}")
            if "sum(" not in slo["query"] and "histogram_quantile" not in slo["query"]:
                fail(f"{path}: SLO {service_id}/{slo['name']} query does not look executable")
            if not (0 < float(slo["target"]) <= 100):
                fail(f"{path}: SLO {service_id}/{slo['name']} target must be 0 < target <= 100")
            if not str(slo["page_threshold"]).strip() or not str(slo["ticket_threshold"]).strip():
                fail(f"{path}: SLO {service_id}/{slo['name']} must define page and ticket thresholds")
            if "no_data" not in slo or not str(slo["no_data"]).strip():
                fail(f"{path}: SLO {service_id}/{slo['name']} must define no-data behavior")

    missing_tier0 = TIER0_IDS - service_ids
    if missing_tier0:
        fail(f"{path}: missing tier 0 services: {', '.join(sorted(missing_tier0))}")

    tier0_blob = json.dumps([service for service in services if service["id"] in TIER0_IDS]).lower()
    for term in CORRECTNESS_TERMS:
        if term not in tier0_blob:
            fail(f"{path}: tier 0 order/payment SLIs must include {term} correctness")

    print(f"✅ SLO catalog valid: {len(services)} services")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        fail("usage: validate_slos.py <docs/operations/slo-catalog.yaml>")
    validate(Path(sys.argv[1]))
