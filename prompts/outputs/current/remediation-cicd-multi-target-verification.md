# Remediation Prompt — CI/CD Multi-Target Verification

_Closes gap:_ G5 · cicd-multi-target-verification

**Closes user story:** As a Developer, I need unified CI/CD for all mobile targets and infrastructure, so that deployments are automated and reliable.
**Change type:** modify-existing
**File:** `.github/workflows/deploy.yml`
**Depends on:** G1 (backend-env-validation), G4 (infra-restoration)
**Test:** Push to feature branch; monitor GitHub Actions for build success.
**Estimated LOC:** +120
**Phase:** foundation

## Context
CI/CD workflows do not support multi-target mobile or Terraform automation.

## What to build
Update GitHub Actions to include builds for both iOS/Android targets and automated Terraform apply.

## Implementation guidance
- **File:** `.github/workflows/deploy.yml` (modify-existing)
- **Precise change:** Add jobs for `build-ios-customer`, `build-ios-business`, `build-android-customer`, `build-android-business`. Add `infrastructure` job for Terraform.

## Testing approach
- **Command:** Push to branch, check GitHub Actions tab.
- **Acceptance Criteria:** Successful builds for all 4 mobile variants and clean `terraform plan`.
