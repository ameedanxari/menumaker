#!/usr/bin/env python3
"""Dry-run/apply documentation disposition decisions from the inventory."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def read_rows(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def destination_for(row: dict[str, str]) -> str:
    if row.get("disposition") != "archive":
        return ""
    original = Path(row["path"])
    safe_name = original.name if len(original.parts) == 1 else "__".join(original.parts)
    return f"docs/archive/2026/{safe_name}"


def hash_file(path: Path) -> str:
    if not path.exists():
        return ""
    return hashlib.sha256(path.read_bytes()).hexdigest()


def archive_body(source: Path, row: dict[str, str], root: Path) -> str:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    original = source.read_text(encoding="utf-8", errors="replace")
    replacement = row.get("replacement") or "docs/README.md"
    return (
        "---\n"
        f"archived_at: {now}\n"
        f"original_path: {row['path']}\n"
        f"original_sha256: {hash_file(source)}\n"
        f"superseded_by: {replacement}\n"
        f"retention_reason: {row.get('retention_reason', 'historical provenance')}\n"
        "---\n\n"
        f"> Superseded by [{replacement}]({Path('/').joinpath(replacement).as_posix() if False else '../../' + replacement if not replacement.startswith('docs/archive/') else replacement}).\n\n"
        + original
    )


def build_plan(rows: list[dict[str, str]], root: Path) -> list[dict[str, str]]:
    plan: list[dict[str, str]] = []
    for row in rows:
        src = row.get("path", "")
        if not src:
            continue
        if src.startswith("docs/archive/"):
            continue
        action = row.get("disposition", "")
        if action == "archive":
            plan.append({
                "action": "archive",
                "source": src,
                "destination": destination_for(row),
                "sha256": hash_file(root / src),
                "replacement": row.get("replacement", ""),
            })
        elif action == "delete":
            plan.append({
                "action": "delete",
                "source": src,
                "destination": "",
                "sha256": hash_file(root / src),
                "replacement": row.get("replacement", ""),
            })
    return plan


def apply_plan(plan: list[dict[str, str]], rows_by_path: dict[str, dict[str, str]], root: Path, confirm_delete: bool) -> None:
    for item in plan:
        source = root / item["source"]
        if not source.exists():
            continue
        if item["action"] == "archive":
            destination = root / item["destination"]
            destination.parent.mkdir(parents=True, exist_ok=True)
            body = archive_body(source, rows_by_path[item["source"]], root)
            if destination.exists() and destination.read_text(encoding="utf-8", errors="replace") == body:
                continue
            destination.write_text(body, encoding="utf-8")
            source.unlink()
        elif item["action"] == "delete":
            row = rows_by_path[item["source"]]
            if not confirm_delete:
                raise SystemExit(f"delete requires --confirm-delete: {item['source']}")
            if row.get("status") != "generated" or row.get("inbound_links"):
                raise SystemExit(f"unsafe delete refused: {item['source']}")
            source.unlink(missing_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--inventory", required=True)
    parser.add_argument("--root", default=str(ROOT))
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--confirm-delete", action="store_true")
    args = parser.parse_args()
    root = Path(args.root).resolve()
    inventory = (root / args.inventory).resolve() if not Path(args.inventory).is_absolute() else Path(args.inventory)
    rows = read_rows(inventory)
    rows_by_path = {row["path"]: row for row in rows}
    plan = build_plan(rows, root)
    print(json.dumps({"dry_run": not args.apply, "operations": plan}, indent=2))
    if args.apply:
        apply_plan(plan, rows_by_path, root, args.confirm_delete)
    return 0


if __name__ == "__main__":
    sys.exit(main())
