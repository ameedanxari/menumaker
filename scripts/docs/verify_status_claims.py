#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
STATUS_WORDS = re.compile(r"\b(production[- ]ready|complete|completed|green|pass|ready)\b", re.I)
EVIDENCE_RE = re.compile(r"\|\s*[^|]+\|\s*`?([^|`]+)`?\s*\|\s*`([^`]+)`\s*\|\s*(\d{4}-\d{2}-\d{2}T|\d{4}-\d{2}-\d{2})", re.I)


def verify_status(path: Path, root: Path = ROOT) -> list[str]:
    text = path.read_text(encoding="utf-8")
    issues: list[str] = []
    if "Status: current" not in text or "Owner:" not in text or "Review cadence:" not in text:
        issues.append("status page missing governance frontmatter fields")
    if "Production-ready criteria" not in text:
        issues.append("status page must define production-ready criteria")
    if "UNVERIFIED" not in text:
        issues.append("status page must explicitly mark missing evidence as UNVERIFIED")
    evidence_lines = [line for line in text.splitlines() if line.strip().startswith("|") and "Evidence" not in line and "Scope" not in line]
    evidence_count = 0
    for line in evidence_lines:
        if not STATUS_WORDS.search(line):
            continue
        match = EVIDENCE_RE.search(line)
        if not match:
            issues.append(f"claim lacks source path, command, and timestamp: {line[:140]}")
            continue
        source = match.group(1).strip()
        source_path = (root / source).resolve()
        try:
            source_path.relative_to(root.resolve())
        except ValueError:
            issues.append(f"evidence source escapes repository: {source}")
            continue
        if not source_path.exists():
            issues.append(f"evidence source does not exist: {source}")
        evidence_count += 1
    if evidence_count < 4:
        issues.append("status page has too few scoped evidence claims")
    unsupported = [
        line for line in text.splitlines()
        if "production-ready" in line.lower()
        and "criteria" not in line.lower()
        and "not production-ready" not in line.lower()
        and "| Release posture |" not in line
    ]
    if unsupported:
        issues.append("production-ready phrase appears outside criteria/release posture guardrails")
    return issues


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("status")
    parser.add_argument("--root", default=str(ROOT))
    args = parser.parse_args()
    root = Path(args.root).resolve()
    path = (root / args.status).resolve() if not Path(args.status).is_absolute() else Path(args.status)
    issues = verify_status(path, root)
    if issues:
        print("❌ status claims verification failed")
        for issue in issues:
            print(f"   - {issue}")
        return 1
    print("✅ status claims verification passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
