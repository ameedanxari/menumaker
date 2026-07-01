#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def workflow_name(path: Path) -> str:
    text = path.read_text(encoding="utf-8", errors="replace")
    match = re.search(r"^name:\s*(.+)$", text, re.MULTILINE)
    return match.group(1).strip() if match else path.stem


def verify(ownership_path: Path, workflows_dir: Path) -> list[str]:
    data = load(ownership_path)
    issues: list[str] = []
    seen_checks: dict[str, str] = {}
    owned_paths = {row["path"] for row in data.get("workflows", [])}
    for row in data.get("workflows", []):
        path = Path(row["path"])
        full = workflows_dir.parent.parent / path if not path.is_absolute() else path
        if not full.exists():
            issues.append(f"{row['path']}: workflow file missing")
            continue
        if row.get("status") not in {"active", "legacy", "retired"}:
            issues.append(f"{row['path']}: invalid status {row.get('status')!r}")
        if not row.get("owner"):
            issues.append(f"{row['path']}: missing owner")
        if row.get("status") == "active" and not row.get("required_checks"):
            issues.append(f"{row['path']}: active workflow missing required_checks")
        if row.get("status") == "legacy" and not row.get("replacement"):
            issues.append(f"{row['path']}: legacy workflow missing replacement")
        for check in row.get("required_checks", []):
            if check in seen_checks:
                issues.append(f"required check {check!r} owned by both {seen_checks[check]} and {row['path']}")
            seen_checks[check] = row["path"]
    for workflow in sorted(workflows_dir.glob("*.yml")) + sorted(workflows_dir.glob("*.yaml")):
        rel = f".github/workflows/{workflow.name}"
        if rel not in owned_paths:
            issues.append(f"{rel}: workflow not represented in ownership ledger")
    graph = data.get("graph_rendering", {})
    for key in ["loading", "empty", "error", "legend", "tooltip"]:
        if key not in graph:
            issues.append(f"graph_rendering missing {key}")
    return issues


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("ownership")
    parser.add_argument("workflows_dir")
    args = parser.parse_args()
    issues = verify(Path(args.ownership), Path(args.workflows_dir))
    if issues:
        print("❌ workflow ownership verification failed")
        for issue in issues:
            print(f"   - {issue}")
        return 1
    print("✅ workflow ownership verification passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
