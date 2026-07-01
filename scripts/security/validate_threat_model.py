#!/usr/bin/env python3
"""Validate the security/privacy threat model has required high-risk coverage."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


REQUIRED_PHRASES = [
    "cross-tenant",
    "idor",
    "refresh token",
    "webhook forgery",
    "fake payment success",
    "malicious upload",
    "log",
    "backup",
    "dependency",
    "action compromise",
    "break-glass",
]


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print("usage: validate_threat_model.py <threat-model.md> <data-inventory.yaml>", file=sys.stderr)
        return 2
    model_path = Path(argv[1])
    inventory_path = Path(argv[2])
    text = model_path.read_text().lower()
    errors: list[str] = []

    try:
        inventory = json.loads(inventory_path.read_text())
    except json.JSONDecodeError as exc:
        errors.append(f"{inventory_path}: inventory must be JSON-compatible YAML: {exc}")
        inventory = {}

    if not inventory.get("third_party_processors"):
        errors.append(f"{inventory_path}: third_party_processors required for threat model validation")

    for phrase in REQUIRED_PHRASES:
        if phrase not in text:
            errors.append(f"{model_path}: missing required threat phrase: {phrase}")

    for section in ("scope and assets", "trust boundaries", "threats and controls", "release control matrix"):
        if f"## {section}" not in text:
            errors.append(f"{model_path}: missing section ## {section.title()}")

    critical_high_rows = [
        line for line in model_path.read_text().splitlines()
        if re.search(r"\|\s*(critical|high)\s*\|", line, re.IGNORECASE)
    ]
    if len(critical_high_rows) < 8:
        errors.append(f"{model_path}: expected at least 8 high/critical threat rows, found {len(critical_high_rows)}")
    for line in critical_high_rows:
        if "`" not in line or "Owner" in line:
            continue
        if " |  | " in line or "TBD" in line or "unknown" in line.lower():
            errors.append(f"{model_path}: high/critical row lacks concrete controls/evidence: {line}")

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print(f"threat model OK: {len(critical_high_rows)} high/critical threats with controls and verification")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
