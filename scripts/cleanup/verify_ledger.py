#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


REQUIRED_FIELDS = {
    "id", "path", "category", "owner", "canonical_replacement", "hash",
    "evidence", "references", "behavior_coverage", "risk", "rollback",
    "disposition", "approval"
}
DELETE_DISPOSITIONS = {"delete-approved"}
VALID_CATEGORIES = {
    "duplicate", "unreferenced", "generated", "fixture-in-production",
    "compatibility", "stale-report", "legacy-workflow"
}


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def verify(path: Path) -> list[str]:
    issues: list[str] = []
    data = load(path)
    seen_ids: set[str] = set()
    seen_paths: dict[str, str] = {}
    for row in data.get("candidates", []):
        missing = sorted(REQUIRED_FIELDS - row.keys())
        if missing:
            issues.append(f"{row.get('id', '<unknown>')}: missing fields {', '.join(missing)}")
        row_id = row.get("id", "")
        if row_id in seen_ids:
            issues.append(f"duplicate candidate id: {row_id}")
        seen_ids.add(row_id)
        candidate_path = row.get("path", "")
        if candidate_path in seen_paths and row.get("category") != "legacy-workflow":
            issues.append(f"{candidate_path}: duplicate ownership in {seen_paths[candidate_path]} and {row_id}")
        seen_paths[candidate_path] = row_id
        if row.get("category") not in VALID_CATEGORIES:
            issues.append(f"{row_id}: invalid category {row.get('category')!r}")
        if not row.get("evidence"):
            issues.append(f"{row_id}: missing evidence")
        if not row.get("behavior_coverage"):
            issues.append(f"{row_id}: missing behavior coverage")
        if row.get("disposition") in DELETE_DISPOSITIONS:
            refs = row.get("references", {})
            if refs.get("runtime") not in (0, "0"):
                issues.append(f"{row_id}: delete-approved row has runtime references")
            if refs.get("dynamic") not in ("none", "none detected"):
                issues.append(f"{row_id}: delete-approved row has dynamic/uncertain references")
            if not row.get("canonical_replacement"):
                issues.append(f"{row_id}: delete-approved row missing replacement")
            if "approved" not in str(row.get("approval", "")):
                issues.append(f"{row_id}: delete-approved row lacks approval")
            if not row.get("rollback"):
                issues.append(f"{row_id}: delete-approved row lacks rollback evidence")
    required_audit_candidates = {
        "web-duplicate-common-button",
        "android-duplicate-cart-screen",
        "android-duplicate-menu-screen",
        "frontend-generated-token-copy",
        "ios-monolithic-mock-router",
        "backend-coverage-output",
        "backend-final-coverage-output",
        "backend-test-output",
        "android-test-firebase-config",
        "legacy-ci-workflow",
        "legacy-pr-checks-workflow",
        "legacy-nightly-e2e-workflow",
        "payment-compatibility-aliases",
        "order-item-compatibility-aliases",
    }
    missing_required = sorted(required_audit_candidates - seen_ids)
    issues.extend(f"missing audit candidate row: {item}" for item in missing_required)
    return issues


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("ledger")
    args = parser.parse_args()
    issues = verify(Path(args.ledger))
    if issues:
        print("❌ cleanup ledger verification failed")
        for issue in issues:
            print(f"   - {issue}")
        return 1
    print("✅ cleanup ledger verification passed")
    print(f"   candidates={len(load(Path(args.ledger)).get('candidates', []))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
