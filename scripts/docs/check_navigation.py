#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
REQUIRED_TARGETS = [
    "product/status.md",
    "product/capability-index.md",
    "product/capability-registry.yaml",
    "architecture/target-state.md",
    "architecture/adr/0003-api-contract-authority.md",
    "../openapi/menumaker.v1.yaml",
    "../scripts/dev-setup.sh",
    "../.github/workflows/smart-ci.yml",
    "operations/runbooks/index.md",
    "security/threat-model.md",
    "security/data-inventory.yaml",
    "release/mobile-data-practices.yaml",
    "design-system/state-matrix.yaml",
    "archive/2026/",
]


def markdown_links(text: str) -> list[str]:
    return [target for target in re.findall(r"\[[^\]]+\]\(([^)]+)\)", text) if not re.match(r"^[a-z]+://", target)]


def check_navigation(readme: Path, root: Path = ROOT) -> list[str]:
    issues: list[str] = []
    text = readme.read_text(encoding="utf-8")
    for target in REQUIRED_TARGETS:
        if target not in text:
            issues.append(f"missing required navigation link: {target}")
    for target in markdown_links(text):
        clean = target.split("#", 1)[0]
        if not clean:
            continue
        resolved = (readme.parent / clean).resolve()
        try:
            resolved.relative_to(root.resolve())
        except ValueError:
            issues.append(f"link escapes repository: {target}")
            continue
        if clean.endswith("/"):
            if not resolved.is_dir():
                issues.append(f"broken directory link: {target}")
        elif not resolved.exists():
            issues.append(f"broken link: {target}")
    return issues


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("readme")
    parser.add_argument("--root", default=str(ROOT))
    args = parser.parse_args()
    root = Path(args.root).resolve()
    readme = (root / args.readme).resolve() if not Path(args.readme).is_absolute() else Path(args.readme)
    issues = check_navigation(readme, root)
    if issues:
        print("❌ docs navigation check failed")
        for issue in issues:
            print(f"   - {issue}")
        return 1
    print("✅ docs navigation check passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
