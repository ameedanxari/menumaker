#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "usage: $0 --environment staging|production --expected-manifest <path> [--evidence <path>]" >&2
}

ENVIRONMENT=""
MANIFEST=""
EVIDENCE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --environment)
      ENVIRONMENT="${2:-}"
      shift 2
      ;;
    --expected-manifest)
      MANIFEST="${2:-}"
      shift 2
      ;;
    --evidence)
      EVIDENCE="${2:-}"
      shift 2
      ;;
    *)
      usage
      exit 2
      ;;
  esac
done

if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
  usage
  exit 2
fi

if [[ ! -f "$MANIFEST" ]]; then
  echo "expected manifest not found: $MANIFEST" >&2
  exit 2
fi

EVIDENCE="${EVIDENCE:-deployment-evidence-${ENVIRONMENT}.json}"
CURL_BIN="${CURL_BIN:-curl}"
AWS_BIN="${AWS_BIN:-aws}"
OPENSSL_BIN="${OPENSSL_BIN:-openssl}"
API_BASE_URL="${API_BASE_URL:-}"
WEB_BASE_URL="${WEB_BASE_URL:-}"
EXPECTED_IMAGE_DIGEST="${EXPECTED_IMAGE_DIGEST:-}"
EXPECTED_WEB_CHECKSUM="${EXPECTED_WEB_CHECKSUM:-}"
ECS_CLUSTER_NAME="${ECS_CLUSTER_NAME:-}"
ECS_SERVICE_NAME="${ECS_SERVICE_NAME:-}"
CLOUDFRONT_DISTRIBUTION_ID="${CLOUDFRONT_DISTRIBUTION_ID:-}"
SKIP_NETWORK="${VERIFY_DEPLOYMENT_SKIP_NETWORK:-false}"

redact() {
  sed -E 's/(secret|token|password|key|authorization)["=: ][^", ]+/\1=REDACTED/Ig'
}

manifest_value() {
  node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); console.log(data[process.argv[2]] ?? '')" "$MANIFEST" "$1"
}

IMAGE_DIGEST="$(manifest_value image_digest)"
WEB_CHECKSUM="$(manifest_value web_checksum)"
SOURCE_SHA="$(manifest_value source_sha)"
GATE_RUN_URL="$(manifest_value gate_run_url)"

failures=()
checks=()

record() {
  checks+=("{\"name\":\"$1\",\"status\":\"$2\",\"detail\":\"$(printf '%s' "$3" | redact | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read())[1:-1])')\"}")
}

fail_check() {
  failures+=("$1")
  record "$1" "fail" "$2"
}

pass_check() {
  record "$1" "pass" "$2"
}

if [[ ! "$IMAGE_DIGEST" =~ @sha256:[0-9a-f]{64}$ ]]; then
  fail_check "image_digest" "manifest image_digest is not pinned by sha256 digest"
else
  pass_check "image_digest" "$IMAGE_DIGEST"
fi

if [[ -n "$EXPECTED_IMAGE_DIGEST" && "$EXPECTED_IMAGE_DIGEST" != "$IMAGE_DIGEST" ]]; then
  fail_check "expected_image_digest" "expected $EXPECTED_IMAGE_DIGEST but manifest has $IMAGE_DIGEST"
elif [[ -n "$EXPECTED_IMAGE_DIGEST" ]]; then
  pass_check "expected_image_digest" "manifest matches expected image digest"
fi

if [[ -z "$WEB_CHECKSUM" ]]; then
  fail_check "web_checksum" "manifest web_checksum is empty"
elif [[ -n "$EXPECTED_WEB_CHECKSUM" && "$EXPECTED_WEB_CHECKSUM" != "$WEB_CHECKSUM" ]]; then
  fail_check "web_checksum" "expected $EXPECTED_WEB_CHECKSUM but manifest has $WEB_CHECKSUM"
else
  pass_check "web_checksum" "$WEB_CHECKSUM"
fi

if [[ "$SKIP_NETWORK" != "true" ]]; then
  if [[ -z "$API_BASE_URL" || -z "$WEB_BASE_URL" ]]; then
    fail_check "network_config" "API_BASE_URL and WEB_BASE_URL are required unless VERIFY_DEPLOYMENT_SKIP_NETWORK=true"
  else
    api_host="$(python3 -c 'from urllib.parse import urlparse; import sys; print(urlparse(sys.argv[1]).hostname or "")' "$API_BASE_URL")"
    if [[ -z "$api_host" ]]; then
      fail_check "dns" "could not parse API host"
    else
      if "$OPENSSL_BIN" s_client -connect "${api_host}:443" -servername "$api_host" </dev/null >/tmp/menumaker_tls.out 2>&1; then
        pass_check "tls" "TLS handshake succeeded for $api_host"
      else
        fail_check "tls" "TLS handshake failed for $api_host"
      fi
    fi

    if "$CURL_BIN" -fsS "${API_BASE_URL%/}/health" >/tmp/menumaker_health.out 2>&1; then
      pass_check "health" "API health passed"
    else
      fail_check "health" "API health failed"
    fi

    if "$CURL_BIN" -fsS "${API_BASE_URL%/}/api/v1/businesses?limit=1" >/tmp/menumaker_smoke.out 2>&1; then
      pass_check "read_only_smoke" "read-only API smoke passed"
    else
      fail_check "read_only_smoke" "read-only API smoke failed"
    fi

    if "$CURL_BIN" -fsS "${WEB_BASE_URL%/}/" >/tmp/menumaker_web.out 2>&1; then
      pass_check "web" "web endpoint passed"
    else
      fail_check "web" "web endpoint failed"
    fi
  fi

  if [[ -n "$ECS_CLUSTER_NAME" && -n "$ECS_SERVICE_NAME" ]]; then
    if "$AWS_BIN" ecs describe-services --cluster "$ECS_CLUSTER_NAME" --services "$ECS_SERVICE_NAME" >/tmp/menumaker_ecs.json 2>&1; then
      pass_check "ecs_service" "ECS service is describable"
    else
      fail_check "ecs_service" "ECS service describe failed"
    fi
  fi

  if [[ -n "$CLOUDFRONT_DISTRIBUTION_ID" ]]; then
    if "$AWS_BIN" cloudwatch describe-alarms --state-value ALARM >/tmp/menumaker_alarms.json 2>&1; then
      alarm_count="$(node -e "const fs=require('fs'); const p='/tmp/menumaker_alarms.json'; const data=JSON.parse(fs.readFileSync(p,'utf8')); console.log((data.MetricAlarms||[]).length)")"
      if [[ "$alarm_count" == "0" ]]; then
        pass_check "cloudwatch_alarms" "no alarms in ALARM state"
      else
        fail_check "cloudwatch_alarms" "$alarm_count alarms in ALARM state"
      fi
    else
      fail_check "cloudwatch_alarms" "CloudWatch alarm query failed"
    fi
  fi
else
  pass_check "network_checks" "skipped by VERIFY_DEPLOYMENT_SKIP_NETWORK=true"
fi

if [[ -n "${EXPECTED_MIGRATION_VERSION:-}" ]]; then
  if [[ "${ACTUAL_MIGRATION_VERSION:-}" == "$EXPECTED_MIGRATION_VERSION" ]]; then
    pass_check "migration_state" "migration version matches"
  else
    fail_check "migration_state" "expected migration ${EXPECTED_MIGRATION_VERSION}, got ${ACTUAL_MIGRATION_VERSION:-missing}"
  fi
else
  pass_check "migration_state" "migration state verified by deployment job before service promotion"
fi

status="pass"
if [[ ${#failures[@]} -gt 0 ]]; then
  status="fail"
fi

{
  printf '{\n'
  printf '  "environment": "%s",\n' "$ENVIRONMENT"
  printf '  "status": "%s",\n' "$status"
  printf '  "source_sha": "%s",\n' "$SOURCE_SHA"
  printf '  "gate_run_url": "%s",\n' "$GATE_RUN_URL"
  printf '  "checks": [%s]\n' "$(IFS=,; echo "${checks[*]}")"
  printf '}\n'
} > "$EVIDENCE"

if [[ "$status" != "pass" ]]; then
  echo "deployment verification failed; evidence: $EVIDENCE" >&2
  exit 1
fi

echo "deployment verification passed; evidence: $EVIDENCE"
