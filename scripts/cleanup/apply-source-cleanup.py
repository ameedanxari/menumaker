#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def sha256(path: Path) -> str:
    if not path.exists():
        return "missing"
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_ledger(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def plan(ledger: dict, root: Path) -> list[dict[str, str]]:
    operations: list[dict[str, str]] = []
    for row in ledger.get("candidates", []):
        disposition = row.get("disposition")
        if disposition not in {"delete-approved", "already-removed", "replace-with-template"}:
            continue
        source = root / row["path"]
        current_hash = sha256(source)
        expected = row.get("hash")
        if disposition == "already-removed":
            operations.append({"id": row["id"], "action": "already_removed", "path": row["path"], "current_hash": current_hash})
        elif disposition == "replace-with-template":
            operations.append({"id": row["id"], "action": "verify_template", "path": row["path"], "current_hash": current_hash})
        elif current_hash == "missing":
            operations.append({"id": row["id"], "action": "already_removed", "path": row["path"], "current_hash": current_hash})
        elif current_hash == expected:
            operations.append({"id": row["id"], "action": "delete", "path": row["path"], "current_hash": current_hash})
        else:
            operations.append({"id": row["id"], "action": "refuse_hash_mismatch", "path": row["path"], "current_hash": current_hash, "expected_hash": expected})
    return operations


def verify_operations(operations: list[dict[str, str]]) -> list[str]:
    return [
        f"{item['id']}: hash mismatch for {item['path']}"
        for item in operations
        if item["action"] == "refuse_hash_mismatch"
    ]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ledger", required=True)
    parser.add_argument("--root", default=str(ROOT))
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--verify", action="store_true")
    args = parser.parse_args()
    root = Path(args.root).resolve()
    ledger = load_ledger((root / args.ledger).resolve() if not Path(args.ledger).is_absolute() else Path(args.ledger))
    operations = plan(ledger, root)
    print(json.dumps({"dry_run": args.dry_run or not args.verify, "operations": operations}, indent=2))
    issues = verify_operations(operations)
    if issues:
        print("❌ source cleanup dry-run verification failed")
        for issue in issues:
            print(f"   - {issue}")
        return 1
    if not args.dry_run:
        print("refusing to apply without an explicit reviewed cleanup batch; dry-run only in this task")
        return 1
    print("✅ source cleanup dry-run verification passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
