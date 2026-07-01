#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FIXTURES_DIR=""
CI_CONTRACT_ONLY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --fixtures)
      FIXTURES_DIR="${2:?--fixtures requires a directory}"
      shift 2
      ;;
    --ci-contract-only)
      CI_CONTRACT_ONLY=true
      shift
      ;;
    *)
      echo "unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

required_ci_commands=(
  "python3 scripts/security/verify_data_inventory.py docs/security/data-inventory.yaml backend/src/models frontend/src android/app/src/main ios/MenuMaker"
  "python3 scripts/security/validate_threat_model.py docs/security/threat-model.md docs/security/data-inventory.yaml"
  "npm test --workspace=backend -- GDPRService.integration.test.ts --runInBand"
  "npm test --workspace=backend -- credential-encryption.test.ts --runInBand"
  "python3 scripts/release/verify_mobile_data_practices.py docs/release/mobile-data-practices.yaml ios/MenuMaker/Info.plist android/app/src/main/AndroidManifest.xml"
  "bash scripts/security/release-security-gate.sh --ci-contract-only"
)

check_ci_contract() {
  local workflow="${1:-$ROOT_DIR/.github/workflows/smart-ci.yml}"
  local missing=0
  for command in "${required_ci_commands[@]}"; do
    if ! grep -Fq "$command" "$workflow"; then
      echo "ERROR: $workflow missing CI-required command: $command" >&2
      missing=1
    fi
  done
  return "$missing"
}

check_workflow_security() {
  local workflow="$1"
  local failed=0
  if grep -Eq "uses: [^@]+@(v[0-9]+|main|master|latest)\\b" "$workflow"; then
    echo "ERROR: $workflow contains mutable action tag" >&2
    failed=1
  fi
  if grep -Eq "uses: [^@]+@[0-9a-f]{7,39}\\b" "$workflow"; then
    echo "ERROR: $workflow contains short action SHA; use full-length commit SHA" >&2
    failed=1
  fi
  if grep -Eq "contents:[[:space:]]*write|packages:[[:space:]]*write|actions:[[:space:]]*write|pull-requests:[[:space:]]*write" "$workflow"; then
    echo "ERROR: $workflow grants excessive write permissions" >&2
    failed=1
  fi
  return "$failed"
}

scan_secrets() {
  local target="$1"
  if grep -RInE "(AKIA[0-9A-Z]{16}|sk_live_[0-9A-Za-z]{16,}|STRIPE_SECRET_KEY=sk_|password=.{12,}|secret=.{12,})" "$target" >/tmp/menumaker-secret-scan.txt 2>/dev/null; then
    sed 's/^/ERROR: potential secret: /' /tmp/menumaker-secret-scan.txt >&2
    return 1
  fi
}

check_vulnerability_fixture() {
  local file="$1"
  python3 - "$file" <<'PY'
import json, sys
path = sys.argv[1]
data = json.load(open(path))
critical = data.get("metadata", {}).get("vulnerabilities", {}).get("critical", 0)
high = data.get("metadata", {}).get("vulnerabilities", {}).get("high", 0)
if critical or high:
    print(f"ERROR: {path} contains high/critical vulnerabilities", file=sys.stderr)
    raise SystemExit(1)
PY
}

check_license_fixture() {
  local file="$1"
  if grep -Eiq '"license"[[:space:]]*:[[:space:]]*"(GPL|AGPL|LGPL|SSPL)' "$file"; then
    echo "ERROR: $file contains unapproved copyleft license without exception" >&2
    return 1
  fi
}

check_exception_fixture() {
  local file="$1"
  python3 - "$file" <<'PY'
import re, sys
from datetime import date
path = sys.argv[1]
text = open(path).read()
for expiry in re.findall(r"expires_at:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})", text):
    if date.fromisoformat(expiry) < date.today():
        print(f"ERROR: {path} contains expired exception {expiry}", file=sys.stderr)
        raise SystemExit(1)
PY
}

run_single_gate() {
  local target="$1"
  local status=0
  if [[ -f "$target/workflow.yml" ]]; then
    check_workflow_security "$target/workflow.yml" || status=1
  fi
  if [[ -f "$target/config.env" ]]; then
    scan_secrets "$target" || status=1
  fi
  if [[ -f "$target/npm-audit.json" ]]; then
    check_vulnerability_fixture "$target/npm-audit.json" || status=1
  fi
  if [[ -f "$target/package-lock.json" ]]; then
    check_license_fixture "$target/package-lock.json" || status=1
  fi
  if [[ -f "$target/exceptions.yaml" ]]; then
    check_exception_fixture "$target/exceptions.yaml" || status=1
  fi
  return "$status"
}

if [[ "$CI_CONTRACT_ONLY" == true ]]; then
  check_ci_contract
  check_workflow_security "$ROOT_DIR/.github/workflows/smart-ci.yml"
  echo "release security CI contract OK"
  exit 0
fi

if [[ -n "$FIXTURES_DIR" ]]; then
  FIXTURES_DIR="$ROOT_DIR/$FIXTURES_DIR"
  run_single_gate "$FIXTURES_DIR/release-security/good"
  for violation in mutable-action excessive-permission secret vulnerability license expired-exception; do
    if run_single_gate "$FIXTURES_DIR/release-security/$violation" >/tmp/menumaker-release-gate-$violation.out 2>&1; then
      echo "ERROR: fixture $violation unexpectedly passed" >&2
      cat "/tmp/menumaker-release-gate-$violation.out" >&2 || true
      exit 1
    fi
  done
  echo "release security fixtures OK"
  exit 0
fi

check_ci_contract
check_workflow_security "$ROOT_DIR/.github/workflows/smart-ci.yml"
scan_secrets "$ROOT_DIR/.github" || exit 1
mkdir -p "$ROOT_DIR/artifacts/security"
cat > "$ROOT_DIR/artifacts/security/release-security-evidence.json" <<JSON
{
  "generated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "controls": ["ci_contract", "action_pin_policy", "least_privilege_permissions", "secret_scan"],
  "claim_boundary": "Evidence covers only local static checks executed by scripts/security/release-security-gate.sh."
}
JSON
echo "release security gate OK"
