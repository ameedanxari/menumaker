# Task: Infrastructure Stubbing & Readiness Assertions
_Gap: G3 · infra-restoration_
**Change type:** modify-existing
**File:** infrastructure/main.tf
**Depends on:** none
**Test:** terraform plan
**Estimated LOC:** +100
**Phase:** foundation

## What to build
Complete IaC stubs in `infrastructure/main.tf` with assertions for production readiness.

## Implementation guidance
- Add `terraform` block with required providers.
- Implement `null_resource` or `check` blocks that assert AWS keys are present for production.
