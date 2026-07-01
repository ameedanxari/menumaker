#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def parse_registry(path: Path) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    current: dict[str, str] | None = None
    for line in path.read_text(encoding="utf-8").splitlines():
        if match := re.match(r"\s*-\s+name:\s+(.+)", line):
            current = {"name": match.group(1).strip()}
            rows.append(current)
            continue
        if current and (match := re.match(r"\s+(owner|status|launch_scope|feature_flag|route_prefixes|tests|client_or_operator_consumers):\s*(.*)", line)):
            current[match.group(1)] = match.group(2).strip()
    return rows


def anchor(name: str) -> str:
    return name.lower().replace("_", "-")


def verify(index_path: Path, registry_path: Path, root: Path = ROOT) -> list[str]:
    issues: list[str] = []
    text = index_path.read_text(encoding="utf-8")
    caps = parse_registry(registry_path)
    for cap in caps:
        name = cap["name"]
        if f"## {name}" not in text:
            issues.append(f"{name}: missing capability section")
        if text.count(f"## {name}") != 1:
            issues.append(f"{name}: must have exactly one current product page/section")
        for field in ["owner", "status", "feature_flag"]:
            value = cap.get(field, "").strip("[]")
            if value and value not in text:
                issues.append(f"{name}: missing {field} value {value}")
    required_links = [
        "capability-registry.yaml",
        "../../openapi/menumaker.v1.yaml",
        "../architecture/target-state.md",
        "../operations/runbooks/index.md",
    ]
    for link in required_links:
        if link not in text:
            issues.append(f"missing required capability-index link: {link}")
    for match in re.findall(r"\[[^\]]+\]\(([^)]+)\)", text):
        if re.match(r"^[a-z]+://", match):
            continue
        clean = match.split("#", 1)[0]
        if not clean:
            continue
        resolved = (index_path.parent / clean).resolve()
        try:
            resolved.relative_to(root.resolve())
        except ValueError:
            issues.append(f"link escapes repository: {match}")
            continue
        if not resolved.exists():
            issues.append(f"broken link: {match}")
    return issues


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("index")
    parser.add_argument("registry")
    parser.add_argument("--root", default=str(ROOT))
    args = parser.parse_args()
    root = Path(args.root).resolve()
    index = (root / args.index).resolve() if not Path(args.index).is_absolute() else Path(args.index)
    registry = (root / args.registry).resolve() if not Path(args.registry).is_absolute() else Path(args.registry)
    issues = verify(index, registry, root)
    if issues:
        print("❌ capability docs verification failed")
        for issue in issues:
            print(f"   - {issue}")
        return 1
    print("✅ capability docs verification passed")
    print(f"   capabilities={len(parse_registry(registry))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
