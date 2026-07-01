#!/usr/bin/env python3
"""Build and verify the MenuMaker documentation inventory.

The inventory is intentionally CSV so it is diffable, reviewable, and usable
before project dependencies are installed.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import re
import subprocess
import sys
from dataclasses import dataclass, asdict
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
TODAY = date(2026, 6, 20).isoformat()
STATUS_VALUES = {"authoritative", "supporting", "superseded", "historical", "generated"}
ROOT_ALLOWLIST = {"README.md", "CONTRIBUTING.md", "AGENTS.md", "MY_PROJECT.md"}
DOC_EXTENSIONS = {".md", ".txt"}
INVENTORY_FIELDS = [
    "path",
    "title",
    "type",
    "subject",
    "authority",
    "owner",
    "created_or_last_evidence",
    "status",
    "replacement",
    "inbound_links",
    "retention_reason",
    "disposition",
    "conflict_flags",
    "sha256",
]


@dataclass
class InventoryRow:
    path: str
    title: str
    type: str
    subject: str
    authority: str
    owner: str
    created_or_last_evidence: str
    status: str
    replacement: str
    inbound_links: str
    retention_reason: str
    disposition: str
    conflict_flags: str
    sha256: str


def tracked_files(root: Path) -> list[Path]:
    try:
      tracked = subprocess.check_output(["git", "ls-files"], cwd=root, text=True)
      untracked = subprocess.check_output(["git", "ls-files", "--others", "--exclude-standard"], cwd=root, text=True)
      raw = [Path(line) for line in (tracked + "\n" + untracked).splitlines() if line.strip()]
    except Exception:
      raw = [p.relative_to(root) for p in root.rglob("*") if p.is_file()]

    docs: list[Path] = []
    for path in raw:
        if not (root / path).is_file():
            continue
        if path.suffix.lower() not in DOC_EXTENSIONS:
            continue
        parts = path.parts
        if not parts:
            continue
        if parts[0].startswith("."):
            continue
        if parts[0] in {"node_modules", "dist", "build", "coverage"}:
            continue
        if len(parts) == 1 or parts[0] in {"docs", "specs", "android", "ios", "backend"}:
            docs.append(path)
    return sorted(set(docs), key=str)


def file_text(root: Path, path: Path) -> str:
    try:
        return (root / path).read_text(encoding="utf-8", errors="replace")
    except FileNotFoundError:
        return ""


def title_for(root: Path, path: Path) -> str:
    text = file_text(root, path)
    for line in text.splitlines():
        match = re.match(r"#\s+(.+)", line.strip())
        if match:
            return match.group(1).strip()
    return path.stem.replace("-", " ").replace("_", " ").title()


def sha256_for(root: Path, path: Path) -> str:
    full = root / path
    if not full.exists():
        return ""
    return hashlib.sha256(full.read_bytes()).hexdigest()


def doc_type(path: Path) -> str:
    name = path.name.lower()
    text = str(path).lower()
    if "/adr/" in text or name.startswith("000"):
        return "decision"
    if "runbook" in text:
        return "runbook"
    if "coverage" in name or "output" in name or "report" in name or "summary" in name:
        return "report"
    if "status" in name or "complete" in name or "ready" in name:
        return "status"
    if "guide" in name or "quick" in name or "setup" in name or "troubleshooting" in name:
        return "guide"
    if "spec" in name or path.parts[:1] == ("specs",):
        return "specification"
    if "plan" in name or "roadmap" in name:
        return "plan"
    return "reference"


def subject_for(path: Path) -> str:
    text = str(path).lower()
    subjects = [
        ("payment", "payments"),
        ("stripe", "payments"),
        ("android", "android"),
        ("ios", "ios"),
        ("security", "security"),
        ("gdpr", "privacy"),
        ("privacy", "privacy"),
        ("design", "design-system"),
        ("token", "design-system"),
        ("api", "api"),
        ("backend", "backend"),
        ("deployment", "delivery"),
        ("terraform", "delivery"),
        ("observability", "operations"),
        ("slo", "operations"),
        ("runbook", "operations"),
        ("coupon", "growth"),
        ("referral", "growth"),
        ("review", "marketplace"),
        ("marketplace", "marketplace"),
        ("i18n", "localization"),
        ("delivery", "logistics"),
        ("tax", "finance"),
        ("ocr", "seller-experience"),
        ("pos", "integrations"),
    ]
    for needle, subject in subjects:
        if needle in text:
            return subject
    if path.parts[:1] == ("specs",):
        return "product-spec"
    if path.parts[:1] == ("docs",):
        return "project-docs"
    return "project"


def replacement_for(path: Path) -> str:
    text = str(path).lower()
    if path.parts[:1] == ("docs",):
        return ""
    if "api" in text:
        return "openapi/menumaker.v1.yaml"
    if "security" in text or "gdpr" in text:
        return "docs/security/threat-model.md"
    if "deployment" in text or "ci" in text or "pipeline" in text:
        return "docs/architecture/adr/0002-aws-production-runtime.md"
    if "android" in text:
        return "docs/product/status.md"
    if "ios" in text or "mobile" in text:
        return "docs/product/status.md"
    if "design" in text or "component" in text or "brand" in text:
        return "docs/design-system/state-matrix.yaml"
    if any(key in text for key in ["coupon", "referral", "review", "marketplace", "pos", "delivery", "ocr", "tax", "i18n", "whatsapp", "payout", "reorder"]):
        return "docs/product/capability-index.md"
    if "ready" in text or "complete" in text or "status" in text or "next" in text:
        return "docs/product/status.md"
    return "docs/README.md"


def classify(path: Path) -> tuple[str, str, str, str]:
    path_text = str(path)
    name = path.name
    dtype = doc_type(path)
    if path_text in {
        "android/README.md",
        "docs/README.md",
        "docs/archive/2026/README.md",
        "docs/product/status.md",
        "docs/product/capability-index.md",
        "docs/product/capability-registry.yaml",
        "docs/architecture/target-state.md",
        "docs/architecture/client-layering.md",
        "docs/architecture/adr/0001-database-schema-ownership.md",
        "docs/architecture/adr/0002-aws-production-runtime.md",
        "docs/architecture/adr/0003-api-contract-authority.md",
        "docs/architecture/adr/0004-ios-business-customer-targets.md",
        "docs/operations/runbooks/index.md",
        "docs/security/threat-model.md",
        "docs/release/mobile-data-practices.yaml",
        "docs/design-system/state-matrix.yaml",
        "ios/README.md",
    }:
        return "authoritative", "current", "docs", "current governed documentation"
    if path_text.startswith("docs/archive/"):
        return "historical", "archive", "docs", "retain historical archive with provenance"
    if path.parts[:1] == ("docs",):
        return "supporting", "current", "docs", "supporting evidence or generated review artifact"
    if path.parts[:1] == ("specs",):
        return "supporting", "keep", "product", "source specification retained for traceability"
    if len(path.parts) == 1 and name in ROOT_ALLOWLIST:
        return "authoritative", "current", "maintainers", "approved root-level contributor instruction"
    if dtype == "report" or name.endswith(".txt"):
        return "generated", "archive", "qa", "generated or historical report retained until cleanup apply"
    return "superseded", "archive", "maintainers", "superseded root/platform guide; replacement identified"


def inbound_index(root: Path, docs: list[Path]) -> dict[str, list[str]]:
    index: dict[str, list[str]] = {str(path): [] for path in docs}
    texts = {path: file_text(root, path) for path in docs}
    for target in docs:
        target_name = target.name
        target_str = str(target)
        for source, text in texts.items():
            if source == target:
                continue
            if target_str in text or target_name in text:
                index[target_str].append(str(source))
    return index


def conflict_flags(text: str) -> str:
    readiness = bool(re.search(r"\b(production[- ]ready|complete|completed|ready to ship|implementation ready)\b", text, re.I))
    incomplete = bool(re.search(r"\b(missing|broken|todo|not implemented|fails?|incomplete|blocked)\b", text, re.I))
    if readiness and incomplete:
        return "conflicting-readiness"
    if readiness:
        return "readiness-claim"
    return ""


def build_rows(root: Path) -> list[InventoryRow]:
    docs = tracked_files(root)
    inbound = inbound_index(root, docs)
    rows: list[InventoryRow] = []
    for path in docs:
        status, disposition, owner, reason = classify(path)
        replacement = replacement_for(path) if status in {"superseded", "generated"} else ""
        text = file_text(root, path)
        rows.append(
            InventoryRow(
                path=str(path),
                title=title_for(root, path),
                type=doc_type(path),
                subject=subject_for(path),
                authority="current" if status == "authoritative" else ("reference" if status == "supporting" else "none"),
                owner=owner,
                created_or_last_evidence=TODAY,
                status=status,
                replacement=replacement,
                inbound_links=";".join(inbound[str(path)]),
                retention_reason=reason,
                disposition=disposition,
                conflict_flags=conflict_flags(text),
                sha256=sha256_for(root, path),
            )
        )
    return rows


def read_inventory(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        return list(reader)


def write_inventory(path: Path, rows: list[InventoryRow]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=INVENTORY_FIELDS)
        writer.writeheader()
        for row in rows:
            writer.writerow(asdict(row))


def validate_inventory(root: Path, inventory_path: Path) -> list[str]:
    expected = {str(path) for path in tracked_files(root)}
    rows = read_inventory(inventory_path)
    issues: list[str] = []
    seen: set[str] = set()
    for row in rows:
        path = row.get("path", "")
        if path in seen:
            issues.append(f"duplicate inventory row: {path}")
        seen.add(path)
        if row.get("status") not in STATUS_VALUES:
            issues.append(f"{path}: invalid status {row.get('status')!r}")
        if not row.get("owner"):
            issues.append(f"{path}: missing owner")
        if not row.get("retention_reason"):
            issues.append(f"{path}: missing retention_reason")
        if row.get("disposition") == "delete":
            if row.get("inbound_links") or row.get("status") != "generated":
                issues.append(f"{path}: delete disposition is unsafe with inbound links or non-generated status")
        if Path(path).parts and len(Path(path).parts) == 1 and path not in ROOT_ALLOWLIST:
            if row.get("status") == "authoritative" or row.get("disposition") == "current":
                issues.append(f"{path}: root clutter cannot remain authoritative/current")
            if not row.get("replacement"):
                issues.append(f"{path}: root clutter needs replacement before archive")
        if row.get("status") == "superseded" and not row.get("replacement"):
            issues.append(f"{path}: superseded row missing replacement")
    missing = sorted(expected - seen)
    extra = sorted(seen - expected)
    issues.extend(f"missing inventory row: {path}" for path in missing)
    issues.extend(f"inventory row for untracked/missing file: {path}" for path in extra)
    return issues


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=str(ROOT))
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--check", metavar="CSV")
    parser.add_argument("output", nargs="?")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    if args.check:
        inventory_path = (root / args.check).resolve() if not Path(args.check).is_absolute() else Path(args.check)
        issues = validate_inventory(root, inventory_path)
        if issues:
            print("❌ document inventory verification failed")
            for issue in issues:
                print(f"   - {issue}")
            return 1
        print("✅ document inventory verification passed")
        print(f"   rows={len(read_inventory(inventory_path))}")
        return 0

    output = Path(args.output or "docs/governance/document-inventory.csv")
    output = (root / output).resolve() if not output.is_absolute() else output
    rows = build_rows(root)
    if args.write:
        write_inventory(output, rows)
        print(f"wrote {output.relative_to(root)} ({len(rows)} rows)")
    else:
        writer = csv.DictWriter(sys.stdout, fieldnames=INVENTORY_FIELDS)
        writer.writeheader()
        for row in rows:
            writer.writerow(asdict(row))
    return 0


if __name__ == "__main__":
    sys.exit(main())
