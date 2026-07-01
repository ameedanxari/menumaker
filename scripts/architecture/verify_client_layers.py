#!/usr/bin/env python3
"""Verify generated transport does not leak directly into UI layers."""

from pathlib import Path
import sys


PROHIBITED_UI_IMPORTS = [
    "shared/src/generated",
    "@menumaker/shared/src/generated",
    "com.menumaker.generated.api",
    "Generated/API",
    "MenuMakerGeneratedAPI",
]

ENDPOINT_MARKERS = ['"/api/', "'/api/"]


def iter_source(root: Path):
    if not root.exists():
        return
    for path in root.rglob("*"):
        if path.suffix in {".ts", ".tsx", ".kt", ".swift"} and path.is_file():
            yield path


def is_ui_file(path: Path) -> bool:
    parts = {part.lower() for part in path.parts}
    return bool(parts & {"components", "pages", "screens", "views"})


def is_repository_file(path: Path) -> bool:
    name = path.name.lower()
    return "repository" in name or "repositories" in {part.lower() for part in path.parts}


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: verify_client_layers.py <root> [<root> ...]", file=sys.stderr)
        return 2

    issues = []
    for raw_root in sys.argv[1:]:
        root = Path(raw_root)
        for path in iter_source(root) or []:
            text = path.read_text(encoding="utf-8", errors="ignore")
            normalized = str(path).replace("\\", "/")
            if is_ui_file(path):
                for marker in PROHIBITED_UI_IMPORTS:
                    if marker in text:
                        issues.append(f"{normalized}: UI imports generated transport marker {marker}")
                if any(marker in text for marker in ENDPOINT_MARKERS):
                    issues.append(f"{normalized}: UI declares literal API endpoint")
            if is_repository_file(path) and any(part.lower() in {"screens", "views", "components"} for part in path.parts):
                issues.append(f"{normalized}: repository lives under UI layer")

    if issues:
        print("❌ client layer verification failed")
        for issue in issues:
            print(f" - {issue}")
        return 1

    print("✅ client layers verified: zero unapproved layer reversals")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
