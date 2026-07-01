#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SELF_TEST="${1:-}"

python3 "$ROOT/scripts/quality/verify_capability_registry.py"

owned_files=(
  "$ROOT/backend/src/services/POSSyncService.ts"
  "$ROOT/backend/src/services/AnalyticsService.ts"
  "$ROOT/backend/src/services/EnhancedReferralService.ts"
  "$ROOT/backend/src/services/ModerationService.ts"
  "$ROOT/backend/src/models/NotificationOutbox.ts"
  "$ROOT/backend/src/config/capabilities.ts"
)

if grep -En "Token refresh not implemented|stub implementation|stubbed|placeholder data|For now, return placeholder|99\\.97" "${owned_files[@]}"; then
  echo "❌ runtime stub gate: prohibited launch-scope placeholder found in Task 11-owned source" >&2
  exit 1
fi

python3 - "$ROOT" "$SELF_TEST" <<'PY'
import json
import re
import sys
from pathlib import Path

root = Path(sys.argv[1])
self_test = len(sys.argv) > 2 and sys.argv[2] == "--self-test"
client_roots = [
    root / "frontend/src",
    root / "android/app/src/main",
    root / "ios/MenuMaker",
    root / "shared/src/generated",
    root / "ios/MenuMaker/Generated",
    root / "android/app/build/generated/openapi",
]
suffixes = {".ts", ".tsx", ".kt", ".swift"}
disabled_route_literal = re.compile(
    r"""['"`](?P<path>(?:/api/v1)?/(?:pos|delivery|ocr|tax|subscriptions|customers/referrals|referrals/leaderboard|affiliates?|viral)(?:/|['"`?]))"""
)
disabled_referral_money_patterns = {
    root / "android/app/src/main/kotlin/com/menumaker/data/remote/models/ReferralModels.kt": re.compile(
        r"""(?:totalEarningsCents|availableCreditsCents|pendingRewardsCents|rewardCents|earningsCents)\s*/\s*100|String\.format\(["']₹%\.2f"""
    ),
    root / "ios/MenuMaker/Data/Models/ReferralModels.swift": re.compile(
        r"""Double\((?:totalEarningsCents|availableCreditsCents|pendingRewardsCents|rewardCents|earningsCents)\)\s*/\s*100|String\(format:\s*"₹%\.2f"""
    ),
}
disabled_openapi_tags = {
    "affiliate",
    "affiliates",
    "delivery",
    "enhanced_referrals",
    "leaderboard",
    "ocr",
    "pos",
    "subscriptions",
    "tax",
    "tax_reports",
    "viral",
}
disabled_openapi_path = re.compile(
    r"""^/api/v1/(?:pos|delivery|ocr|tax|subscriptions)(?:/|$)|^/api/v1/customers/referrals(?:/|$)|^/api/v1/referrals/leaderboard(?:/|$)|^/api/v1/affiliates?(?:/|$)|^/api/v1/viral(?:/|$)|^/api/v1/leaderboard(?:/|$)"""
)

if self_test:
    disabled_route_fixtures = [
        '"/api/v1/pos/connect"',
        "'/delivery/create/order-1'",
        "`/api/v1/customers/referrals/stats`",
        '"/referrals/leaderboard"',
        '"/api/v1/affiliates/apply"',
        '"/viral/badges"',
    ]
    missing_route_matches = [fixture for fixture in disabled_route_fixtures if not disabled_route_literal.search(fixture)]
    if missing_route_matches:
        print("❌ runtime stub gate self-test: disabled route fixture was not detected", file=sys.stderr)
        for fixture in missing_route_matches:
            print(f"   - {fixture}", file=sys.stderr)
        sys.exit(1)

    money_fixtures = {
        "android": "val reward = rewardCents / 100.0",
        "ios": 'String(format: "₹%.2f", earnings)',
    }
    if not disabled_referral_money_patterns[root / "android/app/src/main/kotlin/com/menumaker/data/remote/models/ReferralModels.kt"].search(money_fixtures["android"]):
        print("❌ runtime stub gate self-test: Android referral money fixture was not detected", file=sys.stderr)
        sys.exit(1)
    if not disabled_referral_money_patterns[root / "ios/MenuMaker/Data/Models/ReferralModels.swift"].search(money_fixtures["ios"]):
        print("❌ runtime stub gate self-test: iOS referral money fixture was not detected", file=sys.stderr)
        sys.exit(1)

    openapi_fixtures = [
        "/api/v1/tax/gst-report",
        "/api/v1/subscriptions/current",
        "/api/v1/referrals/leaderboard",
        "/api/v1/affiliate/dashboard",
    ]
    missing_openapi_matches = [fixture for fixture in openapi_fixtures if not disabled_openapi_path.search(fixture)]
    if missing_openapi_matches:
        print("❌ runtime stub gate self-test: disabled OpenAPI fixture was not detected", file=sys.stderr)
        for fixture in missing_openapi_matches:
            print(f"   - {fixture}", file=sys.stderr)
        sys.exit(1)

violations: list[str] = []
for client_root in client_roots:
    if not client_root.exists():
        continue
    for path in client_root.rglob("*"):
        if path.suffix not in suffixes:
            continue
        if ".test." in path.name or ".spec." in path.name:
            continue
        if any(part in {"__tests__", "test", "tests"} for part in path.parts):
            continue
        text = path.read_text(encoding="utf-8")
        for line_number, line in enumerate(text.splitlines(), start=1):
            if disabled_route_literal.search(line):
                violations.append(f"{path.relative_to(root)}:{line_number}: {line.strip()}")
            money_pattern = disabled_referral_money_patterns.get(path)
            if money_pattern and money_pattern.search(line):
                violations.append(f"{path.relative_to(root)}:{line_number}: {line.strip()}")

openapi_path = root / "openapi/menumaker.v1.yaml"
if openapi_path.exists():
    try:
        spec = json.loads(openapi_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        violations.append(f"{openapi_path.relative_to(root)}: invalid generated JSON OpenAPI document: {exc}")
    else:
        for tag in spec.get("tags", []):
            name = str(tag.get("name", "")).strip().lower()
            if name in disabled_openapi_tags:
                violations.append(f"{openapi_path.relative_to(root)}: tag '{name}' advertises a disabled capability")

        for api_path, methods in sorted((spec.get("paths") or {}).items()):
            if disabled_openapi_path.search(api_path):
                violations.append(f"{openapi_path.relative_to(root)}: path '{api_path}' advertises a disabled capability")
            if not isinstance(methods, dict):
                continue
            for method, operation in sorted(methods.items()):
                if not isinstance(operation, dict):
                    continue
                operation_id = str(operation.get("operationId", "")).strip().lower()
                operation_tags = [str(tag).strip().lower() for tag in operation.get("tags", [])]
                disabled_tags = sorted(tag for tag in operation_tags if tag in disabled_openapi_tags)
                if disabled_tags:
                    violations.append(
                        f"{openapi_path.relative_to(root)}: {method.upper()} {api_path} uses disabled tag(s): {', '.join(disabled_tags)}"
                    )
                if re.search(r"^(pos|delivery|ocr|tax|subscription|affiliate|viral|leaderboard)_", operation_id):
                    violations.append(
                        f"{openapi_path.relative_to(root)}: {method.upper()} {api_path} has disabled operationId '{operation_id}'"
                    )

if violations:
    print("❌ runtime stub gate: disabled capability exposure found", file=sys.stderr)
    for violation in violations:
        print(f"   - {violation}", file=sys.stderr)
    sys.exit(1)
PY

echo "✅ runtime stub gate: pass"
