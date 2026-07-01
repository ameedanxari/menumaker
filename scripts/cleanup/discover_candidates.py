#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def classify_fixture(root: Path) -> list[dict[str, str]]:
    candidates: list[dict[str, str]] = []
    web = root / "sample-web/src"
    if web.exists():
        imports = "\n".join(path.read_text(encoding="utf-8", errors="replace") for path in web.glob("*.ts"))
        for path in sorted(web.glob("*.ts")):
            if path.name == "index.ts":
                continue
            stem = path.stem
            rel = path.relative_to(root).as_posix()
            if re.search(rf"['\"]\.\/{re.escape(stem)}['\"]", imports):
                candidates.append({"path": rel, "category": "referenced", "classification": "keep"})
            else:
                candidates.append({"path": rel, "category": "unreferenced", "classification": "delete-candidate"})

    nav = root / "sample-android/res/navigation/nav_graph.xml"
    android_src = root / "sample-android/src/main/kotlin"
    if nav.exists() and android_src.exists():
        nav_text = nav.read_text(encoding="utf-8", errors="replace")
        for path in sorted(android_src.rglob("*.kt")):
            rel = path.relative_to(root).as_posix()
            package_match = re.search(r"package\s+([\w.]+)", path.read_text(encoding="utf-8", errors="replace"))
            symbol_match = re.search(r"(?:class|fun|object)\s+(\w+)", path.read_text(encoding="utf-8", errors="replace"))
            qualified = f"{package_match.group(1)}.{symbol_match.group(1)}" if package_match and symbol_match else path.stem
            if qualified in nav_text:
                candidates.append({"path": rel, "category": "android-resource-reference", "classification": "keep"})
            else:
                candidates.append({"path": rel, "category": "dynamic-reference-uncertain", "classification": "manual-review"})

    ios = root / "sample-ios/project.pbxproj"
    if ios.exists():
        text = ios.read_text(encoding="utf-8", errors="replace")
        for match in sorted(set(re.findall(r"path = ([^;]+\.swift);", text))):
            candidates.append({"path": f"sample-ios/{match}", "category": "xcode-target-reference", "classification": "keep"})
    return candidates


def read_expected(path: Path) -> list[dict[str, str]]:
    return json.loads(path.read_text(encoding="utf-8"))


def check(fixtures: Path) -> list[str]:
    actual = classify_fixture(fixtures)
    expected = read_expected(fixtures / "expected-candidates.yaml")
    normalize = lambda rows: sorted(rows, key=lambda item: (item["path"], item["category"], item["classification"]))
    if normalize(actual) != normalize(expected):
        return [
            "candidate classification mismatch",
            f"expected={json.dumps(normalize(expected), indent=2)}",
            f"actual={json.dumps(normalize(actual), indent=2)}",
        ]
    return []


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixtures")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--root", default=str(ROOT))
    args = parser.parse_args()
    if args.fixtures:
        fixtures = Path(args.fixtures).resolve()
        if args.check:
            issues = check(fixtures)
            if issues:
                print("❌ cleanup discovery fixture check failed")
                for issue in issues:
                    print(f"   - {issue}")
                return 1
            print("✅ cleanup discovery fixture check passed")
            return 0
        print(json.dumps(classify_fixture(fixtures), indent=2))
        return 0
    print(json.dumps({"candidates": []}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
