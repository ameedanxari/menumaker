#!/usr/bin/env python3
"""Verify MenuMaker privacy data inventory coverage.

The inventory file is JSON-compatible YAML so this script can stay stdlib-only.
It reports every TypeORM column discovered in backend model sources and blocks
release if any column is uncovered, ambiguously covered, or assigned unknown
purpose/retention/processor/deletion behavior.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


UNKNOWN_VALUES = {"", "unknown", "tbd", "todo", "indefinite", None}
DECORATOR_RE = re.compile(r"@(Column|PrimaryGeneratedColumn|CreateDateColumn|UpdateDateColumn|DeleteDateColumn)\b")
CLASS_RE = re.compile(r"export\s+class\s+([A-Za-z0-9_]+)")
FIELD_RE = re.compile(r"^\s+([A-Za-z_][A-Za-z0-9_]*)[!?]?\s*[:=]")


def load_inventory(path: Path) -> dict:
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError as exc:
        raise SystemExit(f"{path}: expected JSON-compatible YAML: {exc}") from exc


def discover_typeorm_columns(models_dir: Path) -> list[tuple[str, str, Path]]:
    columns: list[tuple[str, str, Path]] = []
    for model in sorted(models_dir.glob("*.ts")):
        text = model.read_text()
        class_match = CLASS_RE.search(text)
        if not class_match:
            continue
        current_class = class_match.group(1)
        lines = text.splitlines()
        for index, line in enumerate(lines):
            if not DECORATOR_RE.search(line):
                continue
            for follow in lines[index + 1 : index + 8]:
                field_match = FIELD_RE.match(follow)
                if field_match:
                    columns.append((current_class, field_match.group(1), model))
                    break
    return columns


def rule_matches(rule: dict, entity: str, field: str) -> bool:
    entity_rule = rule.get("entity")
    field_rule = rule.get("field")
    return entity_rule in {"*", entity} and field_rule in {"*", field}


def require_known(mapping: dict, label: str, required: list[str], errors: list[str]) -> None:
    for key in required:
        value = mapping.get(key)
        if isinstance(value, list):
            if not value or any(item in UNKNOWN_VALUES for item in value):
                errors.append(f"{label}: {key} must not be empty/unknown")
        elif value in UNKNOWN_VALUES:
            errors.append(f"{label}: {key} must not be unknown")


def main(argv: list[str]) -> int:
    if len(argv) != 6:
        print("usage: verify_data_inventory.py <inventory> <backend_models> <frontend_src> <android_src> <ios_src>", file=sys.stderr)
        return 2
    inventory_path, models_dir, frontend_src, android_src, ios_src = map(Path, argv[1:])
    inventory = load_inventory(inventory_path)
    errors: list[str] = []

    rules = inventory.get("typeorm_column_rules", [])
    if not rules:
        errors.append(f"{inventory_path}: typeorm_column_rules is required")
    for idx, rule in enumerate(rules):
        require_known(
            rule,
            f"{inventory_path}: typeorm_column_rules[{idx}]",
            ["classification", "subject", "purpose", "legal_basis", "retention", "export", "deletion", "processors"],
            errors,
        )

    columns = discover_typeorm_columns(models_dir)
    for entity, field, model in columns:
        matches = [rule for rule in rules if rule_matches(rule, entity, field)]
        if len(matches) != 1:
            errors.append(f"{model}:{entity}.{field}: expected exactly one inventory rule, found {len(matches)}")

    for section in ("client_persistence", "logs_and_traces", "uploads_and_blobs", "third_party_processors"):
        entries = inventory.get(section, [])
        if not entries:
            errors.append(f"{inventory_path}: {section} must have at least one entry")
        for idx, entry in enumerate(entries):
            require_known(entry, f"{inventory_path}: {section}[{idx}]", ["purpose", "retention", "deletion"], errors)

    local_sources = [frontend_src, android_src, ios_src]
    if not any(src.exists() for src in local_sources):
        errors.append("client source roots are missing; cannot verify persistence inventory")

    persisted_keys = {entry.get("key") for entry in inventory.get("client_persistence", [])}
    required_keys = {
        "auth-storage.user",
        "auth-storage.isAuthenticated",
        "secure_preferences.menumaker_tokens",
        "keychain-access-groups",
    }
    missing_keys = sorted(required_keys - persisted_keys)
    if missing_keys:
        errors.append(f"{inventory_path}: missing client persistence keys: {', '.join(missing_keys)}")

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    print(f"data inventory OK: {len(columns)} TypeORM columns covered exactly once across {models_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
