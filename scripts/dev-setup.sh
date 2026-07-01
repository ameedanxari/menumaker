#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHECK_ONLY=false

if [[ "${1:-}" == "--check" ]]; then
  CHECK_ONLY=true
elif [[ $# -gt 0 ]]; then
  echo "Usage: $0 [--check]" >&2
  exit 64
fi

add_bundled_toolchains() {
  local codex_node="/Applications/Codex.app/Contents/Resources/cua_node/bin"
  local android_jbr="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
  local docker_desktop="/Applications/Docker.app/Contents/Resources/bin"
  local project_tools="$ROOT_DIR/.tools/bin"
  local xcode_app

  if [[ -d "$project_tools" ]]; then
    export PATH="$project_tools:$PATH"
  fi

  if ! command -v node >/dev/null 2>&1 && [[ -x "$codex_node/node" ]]; then
    export PATH="$codex_node:$PATH"
  fi

  if ! java -version >/dev/null 2>&1 && [[ -x "$android_jbr/bin/java" ]]; then
    export JAVA_HOME="$android_jbr"
    export PATH="$JAVA_HOME/bin:$PATH"
  fi

  if ! command -v docker >/dev/null 2>&1 && [[ -x "$docker_desktop/docker" ]]; then
    export PATH="$docker_desktop:$PATH"
  fi

  if [[ "$(xcodebuild -version 2>/dev/null || true)" != Xcode\ * ]]; then
    xcode_app="$(find /Applications -maxdepth 1 -type d -name 'Xcode*.app' -print 2>/dev/null | sort | head -n 1)"
    if [[ -n "$xcode_app" && -d "$xcode_app/Contents/Developer" ]]; then
      export DEVELOPER_DIR="$xcode_app/Contents/Developer"
    fi
  fi

  if [[ -z "${ANDROID_SDK_ROOT:-}" && -f "$ROOT_DIR/android/local.properties" ]]; then
    export ANDROID_SDK_ROOT="$(sed -n 's/^sdk\.dir=//p' "$ROOT_DIR/android/local.properties" | sed 's/\\:/:/g; s/\\\\/\\/g' | head -n 1)"
  fi
}

missing=()

require_command() {
  local command_name="$1"
  local install_hint="$2"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    missing+=("$command_name — $install_hint")
  fi
}

add_bundled_toolchains

require_command node "install Node.js 20+ or run from Codex desktop"
require_command npm "install npm 10+ with Node.js"
require_command python3 "install Python 3"
require_command java "install Android Studio or a JDK supported by Gradle"
require_command docker "install and start Docker Desktop"
require_command terraform "install Terraform from developer.hashicorp.com/terraform/install"

if command -v docker >/dev/null 2>&1 && ! docker info >/dev/null 2>&1; then
  missing+=("docker daemon — start Docker Desktop, accept the subscription terms, and finish first-run setup")
fi

if [[ ! -d "${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$HOME/Library/Android/sdk}}/platforms/android-34" ]]; then
  missing+=("Android SDK — install SDK Platform 34, Build Tools 34.x, Platform Tools, and Command-line Tools from Android Studio, then set ANDROID_SDK_ROOT")
fi

if ! command -v xcodebuild >/dev/null 2>&1 \
  || [[ "$(xcodebuild -version 2>/dev/null || true)" != Xcode\ * ]]; then
  missing+=("Xcode — install the full Xcode app, then run: sudo xcode-select -s /Applications/Xcode.app/Contents/Developer")
fi

if (( ${#missing[@]} > 0 )); then
  echo "MenuMaker development prerequisites are missing:" >&2
  printf '  - %s\n' "${missing[@]}" >&2
  exit 2
fi

echo "Toolchains detected:"
node --version
npm --version
python3 --version
java -version 2>&1 | head -n 1
terraform version | head -n 1
xcodebuild -version | head -n 2

if [[ "$CHECK_ONLY" == true ]]; then
  echo "Toolchain check passed."
  exit 0
fi

cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example; replace placeholder provider credentials before integration testing."
fi

set -a
# shellcheck source=/dev/null
source .env
set +a

npm ci
docker compose up -d postgres minio createbuckets

for _ in {1..30}; do
  if docker compose exec -T postgres pg_isready -U menumaker >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

docker compose exec -T postgres pg_isready -U menumaker >/dev/null
npm run migrate
npm run build

echo "Ready to develop. Start MenuMaker with: npm run dev"
