#!/usr/bin/env python3
"""Validate MenuMaker capability registry coverage.

The verifier intentionally avoids third-party YAML dependencies so it can run
inside CI bootstrap jobs before backend packages are installed.
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REGISTRY = ROOT / "docs/product/capability-registry.yaml"
MAIN = ROOT / "backend/src/main.ts"
BACKEND_SRC = ROOT / "backend/src"


@dataclass
class Capability:
    name: str
    status: str = ""
    owner: str = ""
    launch_scope: bool = False
    route_prefixes: list[str] = field(default_factory=list)
    tests: list[str] = field(default_factory=list)
    consumers: list[str] = field(default_factory=list)
    stub_markers: list[str] = field(default_factory=list)


def parse_inline_list(raw: str) -> list[str]:
    raw = raw.strip()
    if not raw.startswith("[") or not raw.endswith("]"):
        return []
    body = raw[1:-1].strip()
    if not body:
        return []
    return [item.strip().strip("\"'") for item in body.split(",") if item.strip()]


def parse_registry(path: Path) -> list[Capability]:
    caps: list[Capability] = []
    current: Capability | None = None
    current_list: str | None = None
    for line in path.read_text(encoding="utf-8").splitlines():
        if match := re.match(r"\s*-\s+name:\s+(.+)\s*$", line):
            current = Capability(name=match.group(1).strip().strip("\"'"))
            caps.append(current)
            current_list = None
            continue
        if current is None:
            continue
        if match := re.match(r"\s+(status|owner|launch_scope|route_prefixes|tests|client_or_operator_consumers|known_stub_markers):\s*(.*)$", line):
            key, value = match.group(1), match.group(2).strip()
            if key == "status":
                current.status = value
            elif key == "owner":
                current.owner = value
            elif key == "launch_scope":
                current.launch_scope = value.lower() == "true"
            elif key == "route_prefixes":
                current.route_prefixes = parse_inline_list(value)
                current_list = "route_prefixes" if not current.route_prefixes else None
            elif key == "tests":
                current.tests = parse_inline_list(value)
                current_list = "tests" if not current.tests else None
            elif key == "client_or_operator_consumers":
                current.consumers = parse_inline_list(value)
                current_list = "client_or_operator_consumers" if not current.consumers else None
            elif key == "known_stub_markers":
                current.stub_markers = parse_inline_list(value)
                current_list = "known_stub_markers" if not current.stub_markers else None
            continue
        if current_list and (match := re.match(r"\s+-\s+(.+?)\s*$", line)):
            item = match.group(1).strip().strip("\"'")
            if current_list == "route_prefixes":
                current.route_prefixes.append(item)
            elif current_list == "tests":
                current.tests.append(item)
            elif current_list == "client_or_operator_consumers":
                current.consumers.append(item)
            elif current_list == "known_stub_markers":
                current.stub_markers.append(item)
            continue
        if line and not line.startswith(" "):
            current_list = None
    return caps


def route_prefixes_from_main() -> list[str]:
    text = MAIN.read_text(encoding="utf-8")
    return re.findall(r"prefix:\s*['\"]([^'\"]+)['\"]", text)


def source_markers() -> list[tuple[Path, int, str]]:
    pattern = re.compile(
        r"\b(TODO|FIXME|not implemented|Token refresh not implemented|stubbed|stub implementation|placeholder data|For now, return placeholder|99\.97)\b",
        re.IGNORECASE,
    )
    markers: list[tuple[Path, int, str]] = []
    for path in BACKEND_SRC.rglob("*.ts"):
        if "/dist/" in str(path):
            continue
        for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            if pattern.search(line):
                rel = path.relative_to(ROOT)
                markers.append((rel, number, line.strip()))
    return markers


def main() -> int:
    issues: list[str] = []
    caps = parse_registry(REGISTRY)
    if not caps:
        issues.append("capability registry is empty or unparsable")
    by_route = {
        route.rstrip("/"): cap
        for cap in caps
        for route in cap.route_prefixes
    }

    for route in route_prefixes_from_main():
        normalized = route.rstrip("/")
        if normalized == "/api/v1":
            has_nested_capability = any(
                prefix.startswith("/api/v1/") for cap in caps for prefix in cap.route_prefixes
            )
            if has_nested_capability:
                continue
        if normalized not in by_route:
            issues.append(f"unclassified route registration in backend/src/main.ts: {route}")

    for cap in caps:
        if not cap.owner:
            issues.append(f"{cap.name}: missing owner")
        if cap.status not in {"implemented", "disabled", "deprecated"}:
            issues.append(f"{cap.name}: invalid status {cap.status!r}")
        if cap.status == "implemented":
            if not cap.tests:
                issues.append(f"{cap.name}: implemented capability has no backend test evidence")
            if not cap.consumers:
                issues.append(f"{cap.name}: implemented capability has no client/operator consumer")

    stub_index = "\n".join(
        marker for cap in caps for marker in cap.stub_markers
    )
    for rel, number, text in source_markers():
        # Entity/legal template comments are declarative metadata, not runtime behavior.
        if str(rel).endswith("LegalTemplate.ts") or str(rel).endswith("AuthService.ts"):
            continue
        if str(rel) not in stub_index:
            issues.append(f"unclassified runtime stub marker: {rel}:{number}: {text}")

    if issues:
        print("❌ capability registry verification failed")
        for issue in issues:
            print(f"   - {issue}")
        return 1
    print("✅ capability registry verification passed")
    print(f"   capabilities={len(caps)} routes={len(route_prefixes_from_main())} stub_markers={len(source_markers())}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
