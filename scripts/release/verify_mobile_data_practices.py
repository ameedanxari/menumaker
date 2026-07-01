#!/usr/bin/env python3
"""Verify mobile permissions match the release data-practices manifest."""

from __future__ import annotations

import json
import plistlib
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


ANDROID_NS = "{http://schemas.android.com/apk/res/android}"


def main(argv: list[str]) -> int:
    if len(argv) != 4:
        print("usage: verify_mobile_data_practices.py <practices.yaml> <Info.plist> <AndroidManifest.xml>", file=sys.stderr)
        return 2

    practices_path = Path(argv[1])
    ios_plist_path = Path(argv[2])
    android_manifest_path = Path(argv[3])
    errors: list[str] = []
    practices = json.loads(practices_path.read_text())

    manifest = ET.parse(android_manifest_path).getroot()
    android_permissions = {
        node.attrib.get(f"{ANDROID_NS}name")
        for node in manifest.findall("uses-permission")
    }
    declared_android = set(practices.get("android", {}).get("permissions", {}).keys())
    for permission in sorted(android_permissions - declared_android):
        errors.append(f"{android_manifest_path}: permission {permission} missing from {practices_path}")
    for permission in sorted(declared_android - android_permissions):
        errors.append(f"{practices_path}: declares Android permission {permission} not present in manifest")

    app = manifest.find("application")
    cleartext = app.attrib.get(f"{ANDROID_NS}usesCleartextTraffic") if app is not None else None
    if cleartext == "true":
        errors.append(f"{android_manifest_path}: android:usesCleartextTraffic must not be true for release privacy/security evidence")

    with ios_plist_path.open("rb") as handle:
        plist = plistlib.load(handle)
    ios_usage_keys = {key for key in plist if key.startswith("NS") and key.endswith("UsageDescription")}
    declared_ios = set(practices.get("ios", {}).get("usage_descriptions", {}).keys())
    for key in sorted(ios_usage_keys - declared_ios):
        errors.append(f"{ios_plist_path}: usage key {key} missing from {practices_path}")
    for key in sorted(declared_ios - ios_usage_keys):
        errors.append(f"{practices_path}: declares iOS usage key {key} not present in Info.plist")

    broad_ios = {"NSLocationAlwaysUsageDescription", "NSLocationAlwaysAndWhenInUseUsageDescription", "NSBluetoothAlwaysUsageDescription", "NSMicrophoneUsageDescription", "NSContactsUsageDescription", "NSCalendarsUsageDescription"}
    for key in sorted(ios_usage_keys & broad_ios):
        errors.append(f"{ios_plist_path}: broad/unused permission key {key} must be removed or justified by active code and manifest")

    modes = set(plist.get("UIBackgroundModes", []))
    declared_modes = set(practices.get("ios", {}).get("background_modes", []))
    for mode in sorted(modes - declared_modes):
        errors.append(f"{ios_plist_path}: background mode {mode} missing from practices manifest")

    def check_entries(obj: object, path: str) -> None:
        if isinstance(obj, dict):
            for key, value in obj.items():
                if key in {"purpose", "retention", "denial_behavior", "data_category"} and value in {"", "unknown", "tbd", None}:
                    errors.append(f"{practices_path}:{path}.{key} is unknown")
                check_entries(value, f"{path}.{key}")
        elif isinstance(obj, list):
            for index, item in enumerate(obj):
                check_entries(item, f"{path}[{index}]")

    check_entries(practices, "$")

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print(f"mobile data practices OK: {len(android_permissions)} Android permissions and {len(ios_usage_keys)} iOS usage descriptions declared")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
