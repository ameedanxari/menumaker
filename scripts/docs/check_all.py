#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ROOT_ALLOWLIST = {"README.md", "CONTRIBUTING.md", "AGENTS.md", "MY_PROJECT.md"}


def run(command: list[str], cwd: Path) -> tuple[int, str]:
    proc = subprocess.run(command, cwd=cwd, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    return proc.returncode, proc.stdout


def read_inventory(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def markdown_links(path: Path) -> list[str]:
    return [
        target for target in re.findall(r"\[[^\]]+\]\(([^)]+)\)", path.read_text(encoding="utf-8", errors="replace"))
        if not re.match(r"^[a-z]+://", target)
    ]


def current_doc_paths(root: Path, rows: list[dict[str, str]]) -> set[Path]:
    current = {
        root / row["path"]
        for row in rows
        if row.get("status") in {"authoritative", "supporting"} and row.get("path", "").startswith("docs/")
    }
    current.update({root / "docs/README.md", root / "docs/product/status.md", root / "docs/product/capability-index.md"})
    return current


def check_archive_metadata(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8", errors="replace")
    required = ["archived_at:", "original_path:", "original_sha256:", "superseded_by:", "retention_reason:"]
    if not text.startswith("---"):
        return [f"{path}: archive missing provenance frontmatter"]
    return [f"{path}: archive missing {field}" for field in required if field not in text[:800]]


def check_root_allowlist(root: Path, rows: list[dict[str, str]]) -> list[str]:
    by_path = {row["path"]: row for row in rows}
    issues: list[str] = []
    for path in root.iterdir():
        if not path.is_file() or path.suffix.lower() not in {".md", ".txt"}:
            continue
        rel = path.name
        row = by_path.get(rel)
        if rel in ROOT_ALLOWLIST:
            continue
        if not row:
            issues.append(f"root document not listed in inventory: {rel}")
            continue
        if row.get("disposition") not in {"archive", "delete"}:
            issues.append(f"root document lacks archive/delete disposition: {rel}")
        if not row.get("replacement"):
            issues.append(f"root document lacks replacement: {rel}")
    return issues


def check_links(root: Path, paths: set[Path]) -> list[str]:
    issues: list[str] = []
    for path in sorted(paths):
        if not path.exists() or path.suffix.lower() != ".md":
            continue
        for target in markdown_links(path):
            clean = target.split("#", 1)[0]
            if not clean:
                continue
            resolved = (path.parent / clean).resolve()
            try:
                resolved.relative_to(root.resolve())
            except ValueError:
                issues.append(f"{path.relative_to(root)}: link escapes repo: {target}")
                continue
            if clean.endswith("/"):
                if not resolved.is_dir():
                    issues.append(f"{path.relative_to(root)}: broken directory link: {target}")
            elif not resolved.exists():
                issues.append(f"{path.relative_to(root)}: broken link: {target}")
    return issues


def check_unsupported_readiness(root: Path, paths: set[Path]) -> list[str]:
    issues: list[str] = []
    for path in sorted(paths):
        if not path.exists() or path.suffix.lower() != ".md":
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        for number, line in enumerate(text.splitlines(), 1):
            lowered = line.lower()
            if "production-ready" in lowered and "criteria" not in lowered and "not production-ready" not in lowered and "release posture" not in lowered:
                issues.append(f"{path.relative_to(root)}:{number}: unsupported production-ready phrase")
    return issues


def check_all(root: Path) -> list[str]:
    issues: list[str] = []
    inventory = root / "docs/governance/document-inventory.csv"
    if inventory.exists() and (root / "scripts/docs/build_inventory.py").exists():
        code, output = run([sys.executable, "scripts/docs/build_inventory.py", "--check", "docs/governance/document-inventory.csv"], root)
        if code != 0:
            issues.append(output.strip())
    rows = read_inventory(inventory)
    current = current_doc_paths(root, rows)
    issues.extend(check_root_allowlist(root, rows))
    issues.extend(check_links(root, current))
    issues.extend(check_unsupported_readiness(root, current))
    for archive in (root / "docs/archive").rglob("*.md") if (root / "docs/archive").exists() else []:
        if archive.name == "README.md":
            continue
        issues.extend(check_archive_metadata(archive))
    if (root / "docs/README.md").exists() and (root / "scripts/docs/check_navigation.py").exists():
        code, output = run([sys.executable, "scripts/docs/check_navigation.py", "docs/README.md", "--root", str(root)], root)
        if code != 0:
            issues.append(output.strip())
    if (root / "docs/product/status.md").exists() and (root / "scripts/docs/verify_status_claims.py").exists():
        code, output = run([sys.executable, "scripts/docs/verify_status_claims.py", "docs/product/status.md", "--root", str(root)], root)
        if code != 0:
            issues.append(output.strip())
    if (root / "docs/product/capability-index.md").exists() and (root / "scripts/docs/verify_capability_docs.py").exists() and (root / "docs/product/capability-registry.yaml").exists():
        code, output = run([sys.executable, "scripts/docs/verify_capability_docs.py", "docs/product/capability-index.md", "docs/product/capability-registry.yaml", "--root", str(root)], root)
        if code != 0:
            issues.append(output.strip())
    if (root / "scripts/docs/verify_disabled_capability_claims.py").exists():
        code, output = run([sys.executable, "scripts/docs/verify_disabled_capability_claims.py", "--root", str(root)], root)
        if code != 0:
            issues.append(output.strip())
    return issues


def check_fixtures(fixtures: Path) -> list[str]:
    issues: list[str] = []
    cases = {
        "good": True,
        "bad-root-clutter": False,
        "bad-unsupported-readiness": False,
        "bad-archive-metadata": False,
    }
    for name, should_pass in cases.items():
        root = fixtures / name
        result = check_all(root)
        if should_pass and result:
            issues.append(f"fixture {name} should pass but failed: {' | '.join(result)}")
        if not should_pass and not result:
            issues.append(f"fixture {name} should fail but passed")
    return issues


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=str(ROOT))
    parser.add_argument("--fixtures")
    args = parser.parse_args()
    if args.fixtures:
        issues = check_fixtures(Path(args.fixtures).resolve())
    else:
        issues = check_all(Path(args.root).resolve())
    if issues:
        print("❌ documentation lifecycle check failed")
        for issue in issues:
            for line in str(issue).splitlines():
                print(f"   - {line}")
        return 1
    print("✅ documentation lifecycle check passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
