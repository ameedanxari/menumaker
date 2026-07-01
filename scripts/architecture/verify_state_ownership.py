#!/usr/bin/env python3
"""Verify every backend model has one write owner in target-state.md."""

from pathlib import Path
import re
import sys


def load_ownership_rows(markdown: str):
    rows = {}
    in_section = False
    for line in markdown.splitlines():
        if line.startswith("## "):
            in_section = line.strip() == "## Canonical state ownership"
            continue
        if not in_section:
            continue
        if not line.startswith("|"):
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if len(cells) < 3:
            continue
        entity, owner, projections = cells[:3]
        if entity in {"---", "Entity/Table"}:
            continue
        rows.setdefault(entity, []).append((owner, projections))
    return rows


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: verify_state_ownership.py <target-state.md> <models-dir>", file=sys.stderr)
        return 2

    target_state = Path(sys.argv[1])
    models_dir = Path(sys.argv[2])
    if not target_state.is_file():
        print(f"❌ missing target-state document: {target_state}", file=sys.stderr)
        return 2
    if not models_dir.is_dir():
        print(f"❌ missing models directory: {models_dir}", file=sys.stderr)
        return 2

    models = sorted(path.stem for path in models_dir.glob("*.ts") if path.name != "index.ts")
    rows = load_ownership_rows(target_state.read_text(encoding="utf-8"))
    issues = []

    for model in models:
        entries = rows.get(model, [])
        if not entries:
            issues.append(f"{model}: missing write owner")
            continue
        if len(entries) > 1:
            issues.append(f"{model}: duplicate ownership rows ({len(entries)})")
            continue
        owner, _projections = entries[0]
        if not owner or owner.lower() in {"tbd", "unknown", "n/a"}:
            issues.append(f"{model}: write owner is not concrete")

    extra = sorted(set(rows) - set(models))
    for entity in extra:
        if re.match(r"^[A-Z][A-Za-z0-9]+$", entity):
            issues.append(f"{entity}: ownership row has no matching backend model")

    if issues:
        print("❌ state ownership verification failed")
        for issue in issues:
            print(f" - {issue}")
        return 1

    print(f"✅ state ownership complete: {len(models)} models have unique write owners")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
