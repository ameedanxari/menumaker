#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]

DEFAULT_TARGETS = [
    "README.md",
    "android/README.md",
    "ios/README.md",
    "prompts/outputs/current/store-submission.md",
    "prompts/outputs/current/release-plan.md",
    "docs/product/status.md",
    "docs/product/capability-index.md",
]

CLAIM_PATTERNS = [
    ("OCR", ["ocr menu import", "vision framework for ocr", "auto-extract dishes"]),
    ("subscriptions", ["subscription tiers", "subscription management", "storekit 2", "free, pro, business plans"]),
    ("enhanced referrals", ["earn rewards", "leaderboards, affiliate", "affiliate program", "referral rewards", "prize campaigns"]),
    ("tax reporting", ["tax compliance", "gst invoice", "tax reports"]),
    ("POS", ["pos integration", "pos and delivery integrations", "square, dine, zoho order sync"]),
    ("delivery partner", ["delivery partners", "swiggy", "zomato", "dunzo", "delivery platforms"]),
    ("production readiness", ["production-ready", "production ready", "ready for deployment", "fully functional and ready"]),
]

ALLOW_CONTEXT = [
    "⛔",
    "disabled",
    "launch-gated",
    "launch gated",
    "not available",
    "not advertised",
    "out of launch scope",
    "historical",
    "superseded",
    "until",
    "criteria",
    "missing",
    "not production-ready",
    "do not use",
    "go-live still needs",
    "requires",
    "governed by",
    "see ",
]


def claim_allowed(lines: list[str], index: int) -> bool:
    start = max(0, index - 4)
    end = min(len(lines), index + 3)
    context = "\n".join(lines[start:end]).lower()
    return any(marker in context for marker in ALLOW_CONTEXT)


def verify_file(root: Path, relative_path: str) -> list[str]:
    path = root / relative_path
    if not path.exists():
        return []

    issues: list[str] = []
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    for index, line in enumerate(lines):
        lowered = line.lower()
        for capability, patterns in CLAIM_PATTERNS:
            if any(pattern in lowered for pattern in patterns) and not claim_allowed(lines, index):
                issues.append(
                    f"{relative_path}:{index + 1}: {capability} claim lacks disabled/gated/historical context: {line.strip()}"
                )
    return issues


def default_targets(root: Path) -> list[str]:
    targets = set(DEFAULT_TARGETS)
    inventory = root / "docs/governance/document-inventory.csv"
    if inventory.exists():
        with inventory.open(newline="", encoding="utf-8") as handle:
            for row in csv.DictReader(handle):
                relative_path = row.get("path", "")
                if not relative_path:
                    continue
                if row.get("disposition") != "current":
                    continue
                if Path(relative_path).suffix.lower() not in {".md", ".txt"}:
                    continue
                if (root / relative_path).exists():
                    targets.add(relative_path)
    return sorted(targets)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Reject launch-facing docs that advertise disabled capabilities without disabled/gated context."
    )
    parser.add_argument("--root", default=str(ROOT))
    parser.add_argument("paths", nargs="*")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    issues: list[str] = []
    targets = args.paths or default_targets(root)
    for relative_path in targets:
        issues.extend(verify_file(root, relative_path))

    if issues:
        print("❌ disabled capability claim verification failed")
        for issue in issues:
            print(f"   - {issue}")
        return 1

    print("✅ disabled capability claim verification passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
