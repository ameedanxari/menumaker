#!/usr/bin/env python3
"""Validate incident, rollback, backup, and restore runbooks."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


REQUIRED_RUNBOOKS = [
    "API outage and auth failure",
    "Database failover, restore, and bad migration",
    "Payment webhook backlog",
    "Duplicate order or payment suspicion",
    "Credential compromise",
    "Media and public menu outage",
    "Outbox DLQ replay and stale order status",
    "Mobile bad release and sync failure",
    "Terraform drift",
]
REQUIRED_TERMS = [
    "Detection",
    "Customer impact",
    "Containment",
    "Evidence capture",
    "Approval",
    "Recovery",
    "Verification",
    "Communication",
    "Postmortem",
]
DRILL_TERMS = ["timestamps", "commands", "checksums", "row counts", "RPO", "RTO", "follow-ups"]
TOOL_TERMS = ["explicit environment", "dry-run summary", "approval identity", "idempotency key", "immutable evidence output"]


def fail(message: str) -> None:
    print(f"❌ {message}", file=sys.stderr)
    raise SystemExit(1)


def main(runbook_dir: Path, slo_path: Path) -> None:
    index = runbook_dir / "index.md"
    if not index.exists():
        fail(f"{index}: missing runbook index")
    text = index.read_text()
    lower = text.lower()
    catalog = json.loads(slo_path.read_text())

    for runbook in REQUIRED_RUNBOOKS:
        if f"## {runbook}" not in text:
            fail(f"{index}: missing runbook section {runbook!r}")

    for heading in re.findall(r"^## (.+)$", text, flags=re.MULTILINE):
        if heading == "Quarterly drill evidence template":
            continue
        section = section_text(text, heading)
        for term in REQUIRED_TERMS:
            if f"**{term}:**" not in section:
                fail(f"{index}: section {heading!r} missing {term}")

    for term in DRILL_TERMS + TOOL_TERMS:
        if term.lower() not in lower:
            fail(f"{index}: missing drill/tool requirement {term!r}")

    service_blob = json.dumps(catalog).lower()
    for runbook in REQUIRED_RUNBOOKS:
        anchor = slug(runbook)
        if anchor not in lower and anchor not in service_blob:
            fail(f"{index}: runbook {runbook!r} lacks an anchor reference")

    print(f"✅ runbooks valid: {len(REQUIRED_RUNBOOKS)} sections")


def section_text(text: str, heading: str) -> str:
    pattern = rf"^## {re.escape(heading)}$(.*?)(?=^## |\Z)"
    match = re.search(pattern, text, flags=re.MULTILINE | re.DOTALL)
    return match.group(1) if match else ""


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        fail("usage: validate_runbooks.py <docs/operations/runbooks> <docs/operations/slo-catalog.yaml>")
    main(Path(sys.argv[1]), Path(sys.argv[2]))
