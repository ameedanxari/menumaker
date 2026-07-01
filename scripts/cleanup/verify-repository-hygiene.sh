#!/usr/bin/env bash
set -euo pipefail

ROOT="${ROOT:-$(pwd)}"
FIXTURES=""

if [[ "${1:-}" == "--fixtures" ]]; then
  FIXTURES="${2:-}"
fi

check_one() {
  local root="$1"
  local mode="${2:-repo}"
  local failures=0

  if [[ -f "$root/backend/coverage_output.txt" ]]; then
    echo "generated-artifact: backend/coverage_output.txt should not be tracked or present" >&2
    failures=$((failures + 1))
  fi
  if [[ -f "$root/backend/final_coverage.txt" ]]; then
    echo "generated-artifact: backend/final_coverage.txt should not be tracked or present" >&2
    failures=$((failures + 1))
  fi
  if [[ -f "$root/backend/test_output.txt" ]]; then
    echo "generated-artifact: backend/test_output.txt should not be tracked or present" >&2
    failures=$((failures + 1))
  fi
  if [[ -f "$root/android/app/google-services.json" ]] && grep -Eq 'menumaker-test|AIzaSyDummy|DummyKey|project_id": "menumaker-test' "$root/android/app/google-services.json"; then
    echo "fixture-in-production: android/app/google-services.json contains test Firebase values" >&2
    failures=$((failures + 1))
  fi
  if [[ -f "$root/UNOWNED.md" ]]; then
    echo "root-doc: UNOWNED.md is not an approved root document" >&2
    failures=$((failures + 1))
  fi
  if [[ -f "$root/frontend/src/sampleData.ts" ]]; then
    echo "runtime-sample: frontend/src/sampleData.ts is a production sample marker" >&2
    failures=$((failures + 1))
  fi
  if [[ "$mode" == "repo" ]]; then
    python3 scripts/cleanup/verify_ledger.py docs/engineering/cleanup-ledger.yaml >/dev/null || failures=$((failures + 1))
    python3 scripts/ci/verify_workflow_ownership.py docs/engineering/workflow-ownership.yaml .github/workflows >/dev/null || failures=$((failures + 1))
  fi
  return "$failures"
}

if [[ -n "$FIXTURES" ]]; then
  check_one "$FIXTURES/hygiene/good" fixture
  for bad in bad-coverage-output bad-firebase-config bad-root-doc bad-sample-marker; do
    if check_one "$FIXTURES/hygiene/$bad" fixture >/tmp/cleanup-fixture.out 2>&1; then
      echo "fixture expected to fail but passed: $bad" >&2
      exit 1
    fi
  done
  echo "✅ repository hygiene fixtures passed"
  exit 0
fi

check_one "$ROOT" repo
echo "✅ repository hygiene check passed"
