#!/usr/bin/env python3
"""Lightweight deprecation-ledger validation without external YAML deps."""

from pathlib import Path
import sys


REQUIRED = {"alias", "owner", "replacement", "telemetry", "removal_release", "rollback", "status", "evidence"}


def parse_alias_blocks(text: str):
    blocks = []
    current = None
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("- alias:"):
            if current:
                blocks.append(current)
            current = {"alias": stripped.split(":", 1)[1].strip().strip('"')}
            continue
        if current is not None and ":" in stripped and not stripped.startswith("- "):
            key, value = stripped.split(":", 1)
            current[key.strip()] = value.strip().strip('"')
    if current:
        blocks.append(current)
    return blocks


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: verify_deprecations.py <deprecation-ledger.yaml>", file=sys.stderr)
        return 2
    ledger = Path(sys.argv[1])
    if not ledger.is_file():
        print(f"❌ missing deprecation ledger: {ledger}", file=sys.stderr)
        return 2

    blocks = parse_alias_blocks(ledger.read_text(encoding="utf-8"))
    issues = []
    aliases = set()
    for index, block in enumerate(blocks, start=1):
        missing = sorted(key for key in REQUIRED if not block.get(key))
        if missing:
            issues.append(f"alias row {index}: missing {', '.join(missing)}")
        alias = block.get("alias")
        if alias in aliases:
            issues.append(f"duplicate alias row: {alias}")
        aliases.add(alias)
        if block.get("status") == "expired":
            issues.append(f"{alias}: expired alias still present")
        if block.get("replacement", "").lower() in {"tbd", "none", "n/a"}:
            issues.append(f"{alias}: replacement is not concrete")

    if not blocks:
        issues.append("ledger contains no aliases")

    if issues:
        print("❌ deprecation ledger verification failed")
        for issue in issues:
            print(f" - {issue}")
        return 1

    print(f"✅ deprecation ledger verified: {len(blocks)} aliases, no orphan or expired entries")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
