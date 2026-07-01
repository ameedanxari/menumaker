#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FIXTURES_DIR=""

if [[ "${1:-}" == "--fixtures" ]]; then
  FIXTURES_DIR="${2:-}"
fi

NODE_BIN="${NODE_BIN:-node}"
PYTHON_BIN="${PYTHON_BIN:-python3}"

run_expect_failure() {
  local label="$1"
  shift
  if "$@" >/tmp/menumaker-design-system-fixture.out 2>&1; then
    echo "❌ fixture was not detected: ${label}" >&2
    cat /tmp/menumaker-design-system-fixture.out >&2
    return 1
  fi
  echo "✅ detected seeded ${label}"
}

if [[ -n "$FIXTURES_DIR" ]]; then
  cd "$ROOT_DIR"
  run_expect_failure "token regression" "$NODE_BIN" frontend/scripts/validate-tokens.cjs "$FIXTURES_DIR/token-regression.json"
  run_expect_failure "state matrix regression" "$PYTHON_BIN" scripts/design-system/verify_state_matrix.py "$FIXTURES_DIR/bad-state-matrix.yaml" frontend/src android/app/src/main ios/MenuMaker
  run_expect_failure "review artifact regression" "$NODE_BIN" scripts/design-system/validate-review-artifact.mjs "$FIXTURES_DIR/bad-review.html"
  echo "✅ design-system fixture regressions are detected"
  exit 0
fi

cd "$ROOT_DIR"

"$NODE_BIN" frontend/scripts/validate-tokens.cjs frontend/design-tokens.json
"$NODE_BIN" frontend/scripts/sync-tokens.cjs --check
"$NODE_BIN" scripts/design-system/validate-review-artifact.mjs docs/ui-consistency/review/index.html
"$PYTHON_BIN" scripts/design-system/verify_state_matrix.py docs/design-system/state-matrix.yaml frontend/src android/app/src/main ios/MenuMaker

if rg -n "from ['\"][^'\"]*(components/common/Button|\\.\\./common/Button|\\.\\./\\.\\./components/common/Button)|import\\([^)]*(components/common/Button|\\.\\./common/Button)" frontend/src \
  --glob '*.ts' --glob '*.tsx' \
  --glob '!components/common/**' \
  --glob '!**/*.test.ts' --glob '!**/*.test.tsx' >/tmp/menumaker-design-system-imports.out; then
  echo "❌ duplicate Button primitive import detected outside compatibility folder:" >&2
  cat /tmp/menumaker-design-system-imports.out >&2
  exit 1
fi

if rg -n "#[0-9a-fA-F]{3,8}" frontend/src/components/ui \
  --glob '*.ts' --glob '*.tsx' \
  --glob '!**/*.test.ts' --glob '!**/*.test.tsx' >/tmp/menumaker-design-system-raw-values.out; then
  echo "❌ raw brand/semantic color value found in canonical ui primitives:" >&2
  cat /tmp/menumaker-design-system-raw-values.out >&2
  exit 1
fi

if ! rg -n "44px|48dp|44pt|VoiceOver|TalkBack|reduced_motion|rtl|no_color_only" docs/design-system/state-matrix.yaml >/dev/null; then
  echo "❌ state matrix is missing touch-target/a11y coverage" >&2
  exit 1
fi

if ! rg -n "light|dark|RTL|responsive|contrast|Approval or feedback" docs/ui-consistency/review/index.html >/dev/null; then
  echo "❌ review artifact is missing visual-review evidence" >&2
  exit 1
fi

echo "✅ design-system drift gate passed"
