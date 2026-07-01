#!/usr/bin/env bats

setup() {
  TMPDIR="$(mktemp -d)"
  MANIFEST="$TMPDIR/artifact-manifest.json"
  cat > "$MANIFEST" <<JSON
{
  "source_sha": "0123456789abcdef0123456789abcdef01234567",
  "image_digest": "333333333333.dkr.ecr.us-east-1.amazonaws.com/menumaker-prod-api@sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  "web_checksum": "web-checksum",
  "gate_run_url": "https://github.example/actions/runs/1"
}
JSON
}

teardown() {
  rm -rf "$TMPDIR"
}

@test "verification passes with offline network checks and matching digests" {
  run env VERIFY_DEPLOYMENT_SKIP_NETWORK=true \
    EXPECTED_IMAGE_DIGEST="333333333333.dkr.ecr.us-east-1.amazonaws.com/menumaker-prod-api@sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" \
    EXPECTED_WEB_CHECKSUM="web-checksum" \
    scripts/release/verify-deployment.sh \
      --environment production \
      --expected-manifest "$MANIFEST" \
      --evidence "$TMPDIR/evidence.json"

  [ "$status" -eq 0 ]
  [ -f "$TMPDIR/evidence.json" ]
  grep -q '"status": "pass"' "$TMPDIR/evidence.json"
}

@test "wrong image digest fails without printing secrets" {
  run env VERIFY_DEPLOYMENT_SKIP_NETWORK=true \
    EXPECTED_IMAGE_DIGEST="333333333333.dkr.ecr.us-east-1.amazonaws.com/menumaker-prod-api@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" \
    scripts/release/verify-deployment.sh \
      --environment production \
      --expected-manifest "$MANIFEST" \
      --evidence "$TMPDIR/evidence.json"

  [ "$status" -ne 0 ]
  grep -q '"status": "fail"' "$TMPDIR/evidence.json"
  ! grep -qi 'password' "$TMPDIR/evidence.json"
}

@test "pending migration state fails" {
  run env VERIFY_DEPLOYMENT_SKIP_NETWORK=true \
    EXPECTED_MIGRATION_VERSION="InitialMenuMakerSchema1718841600000" \
    ACTUAL_MIGRATION_VERSION="pending" \
    scripts/release/verify-deployment.sh \
      --environment staging \
      --expected-manifest "$MANIFEST" \
      --evidence "$TMPDIR/evidence.json"

  [ "$status" -ne 0 ]
  grep -q 'migration_state' "$TMPDIR/evidence.json"
}
