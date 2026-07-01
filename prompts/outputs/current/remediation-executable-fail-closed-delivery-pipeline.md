# Remediation Prompt — Executable Fail-Closed Delivery Pipeline

_Closes gap:_ G3 · executable-fail-closed-delivery-pipeline

## Context

The Terraform root references modules that do not exist, variables/outputs are empty, deployment invokes two nonexistent iOS schemes, web deployment is a comment, and many CI checks convert failure into success. The current workflow can neither provision MenuMaker nor prove that a release artifact passed the same gates that production receives.

If pipeline changes surface status in a web app, existing product style is authoritative and the status contract must cover default, loading, empty, error, disabled, and success without inventing a parallel visual system.

## What to build

Adopt one concrete AWS target—ECS Fargate for the Fastify API, RDS PostgreSQL, private networking, S3/CloudFront for web/media, Route 53/ACM, Secrets Manager, CloudWatch, and environment-specific Terraform inputs—then consolidate CI into immutable build artifacts and a protected plan→migrate→deploy→verify→rollback promotion flow.

## Implementation guidance

## R1 · Record the production runtime and environment topology
- **Closes user story:** As an operator, I need one approved deployment topology, so that infrastructure code and runbooks do not target imaginary or conflicting platforms.
- **Change type:** create-new
- **File:** `docs/architecture/adr/0002-aws-production-runtime.md`
- **Precise change:** Select ECS Fargate, ALB, RDS PostgreSQL Multi-AZ, S3/CloudFront, Route 53/ACM, Secrets Manager, CloudWatch, ECR, and separate dev/staging/prod Terraform state; document rejected Lambda/EKS choices, region/data-residency caveat, cost assumptions, RPO/RTO, and the user-review checkpoint before first production apply.
- **Acceptance:** 
  - Every service has an owner, data classification, network zone, scaling boundary, and failure/rollback behavior.
  - The ADR explicitly states that catastrophic regional loss exceeds the initial RPO until a cross-region recovery decision is approved.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** none
- **Test:** `rg -n "ECS Fargate|RDS|S3|CloudFront|Route 53|ACM|Secrets Manager|RPO|RTO" docs/architecture/adr/0002-aws-production-runtime.md` finds all decisions.
- **Estimated LOC:** +150
- **Phase:** foundation

## R2 · Implement the reusable environment module
- **Closes user story:** As an infrastructure engineer, I need reproducible isolated environments, so that staging and production differ only through reviewed inputs.
- **Change type:** create-new
- **File:** `infrastructure/modules/environment/main.tf`
- **Precise change:** Create a reusable module wiring VPC/public-private subnets, NAT/egress, security groups, ALB, ECS cluster/service/task definition, RDS PostgreSQL, ECR, S3 media/web buckets, CloudFront, AWS Secrets Manager/KMS secret management, CloudWatch logs/alarms, Route 53/ACM inputs, encryption, backup retention, and least-privilege task roles.
- **Acceptance:** 
  - Databases and tasks have no public IP; ALB is the only public API ingress and TLS is mandatory.
  - Dev, staging, and prod use the same module while deletion protection, Multi-AZ, retention, capacity, and domains vary through validated inputs.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R1 (approved topology)
- **Test:** `terraform -chdir=infrastructure fmt -check -recursive && terraform -chdir=infrastructure validate` exits 0.
- **Estimated LOC:** +900
- **Phase:** foundation

## R3 · Wire environment-specific state, inputs, and outputs
- **Closes user story:** As a release engineer, I need explicit environment configuration, so that a production apply cannot accidentally reuse development state or credentials.
- **Change type:** modify-existing
- **File:** `infrastructure/main.tf`
- **File:** `infrastructure/.terraform.lock.hcl`
- **File:** `infrastructure/outputs.tf`
- **File:** `infrastructure/environments/dev.tfvars`
- **File:** `infrastructure/environments/staging.tfvars`
- **File:** `infrastructure/environments/prod.tfvars`
- **Precise change:** Replace missing `backend`/`database` modules with `module "environment"`, configure a version-constrained AWS provider and remote encrypted/locked state bootstrap instructions, and expose only non-secret outputs consumed by deployment verification.
- **Acceptance:** 
  - `terraform plan` for dev/staging/prod resolves every module path and contains no placeholder resource.
  - State keys, account IDs, domains, and secret ARNs are environment-specific and production destructive changes require an explicit approval policy.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R2 (environment module)
- **Test:** `for e in dev staging prod; do terraform -chdir=infrastructure plan -input=false -var-file=environments/$e.tfvars -detailed-exitcode || test $? -eq 2; done` produces plans without configuration errors.
- **Estimated LOC:** +120
- **Phase:** foundation

## R4 · Define validated variables and operational outputs
- **Closes user story:** As an operator, I need typed infrastructure inputs and useful outputs, so that unsafe defaults and hidden dependencies fail before apply.
- **Change type:** modify-existing
- **File:** `infrastructure/variables.tf`
- **File:** `infrastructure/fixtures/unsafe-prod.tfvars`
- **File:** `infrastructure/fixtures/mutable-image.tfvars`
- **File:** `infrastructure/fixtures/public-database.tfvars`
- **Precise change:** Define environment, AWS account/region, CIDRs, domain, image digest, desired capacity, RDS size/storage/backup retention, deletion protection, log retention, alarm targets, secret ARNs, and tags with validations that reject public database CIDRs, mutable image tags, weak production retention, or unknown environments.
- **Acceptance:** 
  - Production rejects `deletion_protection=false`, backup retention below 7 days, and images not pinned by digest.
  - No secret value is accepted as a plain Terraform variable or emitted as an output.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R3 (root module inputs)
- **Test:** `terraform -chdir=infrastructure validate` exits 0 and negative fixture plans reject all unsafe values.
- **Estimated LOC:** +210
- **Phase:** foundation

## R5 · Consolidate required CI into one fail-closed workflow
- **Closes user story:** As a maintainer, I need required checks to fail on defects, so that green status means the candidate was actually compiled and tested.
- **Change type:** modify-existing
- **File:** `.github/workflows/smart-ci.yml`
- **File:** `scripts/ci/audit_workflows.py`
- **Precise change:** Make lint, unit, PostgreSQL integration/migration, UI/E2E, build, and deploy stages explicit alongside strict TypeScript, contract, Android flavor, iOS scheme, Terraform validate/plan, secret scan, and dependency audit jobs; remove `|| true`/`|| echo`; use `DATABASE_URL`/`FRONTEND_URL`; pin actions to reviewed full commit SHAs; declare least-privilege `permissions`; and use ECR, versioned S3, and GitHub Actions artifacts as the artifact publication targets for checksummed immutable outputs.
- **Acceptance:** 
  - Deliberately failing each gate produces a failed required check; no test/build/lint/migration/health failure is converted to success.
  - The artifact manifest records source SHA, dependency locks, image digest, web checksum, Android AAB checksums, iOS archive checksum, and gate run URL.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** remediation-database-schema-and-release-integrity.md (migration commands), R4 (validated infrastructure)
- **Test:** `python3 scripts/ci/audit_workflows.py .github/workflows/smart-ci.yml` reports zero fail-open commands, mutable action tags, or undeclared permissions.
- **Estimated LOC:** +480
- **Phase:** foundation

## R6 · Replace placeholder deployment with protected artifact promotion
- **Closes user story:** As a product owner, I need staged promotion and rollback, so that production receives a reviewed artifact rather than a branch rebuild.
- **Change type:** modify-existing
- **File:** `.github/workflows/deploy.yml`
- **Precise change:** Consume the CI artifact manifest by SHA; require GitHub `staging`/`production` environments; run Terraform plan and approval before apply; execute the G1 migration job once; update ECS by image digest; publish the web checksum to S3/CloudFront; build/upload only real approved mobile scheme/flavors; verify `/health`, a read-only API smoke, CloudWatch alarms, and migration state; automatically roll back ECS/web on verification failure while never auto-reverting a destructive database migration.
- **Acceptance:** 
  - Production has an approval boundary and concurrency lock; a smoke failure restores the prior image/web artifact and creates an incident artifact.
  - Workflow references only schemes/flavors proven by `xcodebuild -list` and `./gradlew tasks`, with no comment-only deployment step.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R5 (immutable CI artifacts)
- **Test:** `python3 scripts/ci/audit_workflows.py .github/workflows/deploy.yml && actionlint .github/workflows/deploy.yml` exits 0.
- **Estimated LOC:** +420
- **Phase:** foundation

## R7 · Add deployment verification and rollback drills
- **Closes user story:** As an on-call engineer, I need repeatable release verification, so that I can detect and reverse a bad release within the stated RTO.
- **Change type:** create-new
- **File:** `scripts/release/verify-deployment.sh`
- **File:** `scripts/release/verify-deployment.bats`
- **Precise change:** Verify DNS/TLS, health/readiness, exact image/web digests, database migration version, read-only seller/customer smoke requests, CloudWatch alarm state, and synthetic media access; emit JSON evidence and support `--environment staging|production --expected-manifest <path>` without printing secrets.
- **Acceptance:** 
  - Wrong digest, pending migration, invalid TLS, 5xx response, or alarm state returns non-zero with a redacted evidence file.
  - A quarterly runbook exercise measures restore and artifact rollback time against the ADR targets.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R6 (promotion workflow)
- **Test:** `shellcheck scripts/release/verify-deployment.sh && bats scripts/release/verify-deployment.bats` exits 0.
- **Estimated LOC:** +260
- **Phase:** foundation

## What NOT to do

- Do not run `terraform apply -auto-approve` on every push to `main`.
- Do not rebuild source during promotion or use mutable container tags as release identity.
- Do not make production depend on nonexistent schemes, best-effort tests, or secrets stored in Terraform state.
