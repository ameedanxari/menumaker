# Remediation Prompt — Infrastructure Restoration

_Closes gap:_ G3 · infra-restoration

**Closes user story:** As a DevOps Engineer, I need to restore infrastructure-as-code files, so that I can manage production infrastructure securely.
**Change type:** create-new
**File:** `infrastructure/main.tf`
**Depends on:** none
**Test:** `terraform init` must complete successfully.
**Estimated LOC:** +200
**Phase:** foundation

## Context
The `infrastructure/` directory is missing.

## What to build
Re-create essential Terraform files in `infrastructure/`.

## Implementation guidance
- **Action:** Create `infrastructure/main.tf`, `infrastructure/variables.tf`, `infrastructure/outputs.tf`.
- **Precise change:** Define basic AWS provider and dummy infrastructure resources.

## Testing approach
- Run `terraform init`.
