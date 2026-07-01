#!/usr/bin/env python3
import re
import sys
from pathlib import Path

errors: list[str] = []
sha_ref = re.compile(r"@[0-9a-f]{40}$")
uses_re = re.compile(r"uses:\s*([^#\s]+)")

for arg in sys.argv[1:]:
    path = Path(arg)
    text = path.read_text()
    lines = text.splitlines()

    if "permissions:" not in text:
        errors.append(f"{path}: workflow must declare least-privilege permissions")

    for idx, line in enumerate(lines, start=1):
        stripped = line.strip()
        if "|| true" in stripped or "|| echo" in stripped or "exit 0" in stripped and "if" not in stripped:
            errors.append(f"{path}:{idx}: fail-open command is prohibited: {stripped}")
        if stripped.startswith("continue-on-error:") and "true" in stripped:
            errors.append(f"{path}:{idx}: continue-on-error true is prohibited")
        match = uses_re.search(stripped)
        if match and not sha_ref.search(match.group(1)):
            errors.append(f"{path}:{idx}: action must be pinned to a full 40-char SHA: {match.group(1)}")

    if "deploy.yml" in path.name:
        required = [
            "environment:",
            "concurrency:",
            "terraform -chdir=infrastructure plan",
            "terraform -chdir=infrastructure apply",
            "npm run migration:run --workspace=backend",
            "aws ecs update-service",
            "aws s3 sync",
            "aws cloudfront create-invalidation",
            "scripts/release/verify-deployment.sh",
            "rollback",
            "incident-artifact.json",
        ]
    else:
        required = [
            "npm run migrate:test:clean --workspace=backend",
            "npm run build --workspace=backend",
            "npm run test:ci --workspace=frontend",
            "bash scripts/design-system/check-drift.sh",
            "xcodebuild -project MenuMaker.xcodeproj -scheme MenuMaker",
            "./gradlew openApiGenerate testSellerDebugUnitTest testCustomerDebugUnitTest",
            "terraform -chdir=infrastructure validate",
            "artifact-manifest.json",
            "sha256sum",
            "id-token:",
        ]
    for token in required:
        if token not in text:
            errors.append(f"{path}: missing required delivery evidence token: {token}")

    if re.search(r"image:\s*[^@\n]+:latest", text):
        errors.append(f"{path}: mutable :latest image reference is prohibited")

if errors:
    print("\n".join(f"❌ {error}" for error in errors), file=sys.stderr)
    sys.exit(1)

print("✅ workflow audit passed")
