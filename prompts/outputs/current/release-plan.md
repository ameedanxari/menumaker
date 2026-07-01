# Release and Consolidation Plan

## Sequencing principles

- Foundation first: contracts, migrations, ownership, strict gates, security primitives, test harnesses, and deployment topology precede feature completion.
- A gap dependency exists only where its code artifact is required; independent remediation proceeds in parallel during execution.
- Every milestone ends with current machine evidence and an explicit user-review checkpoint for architectural, security, design, or destructive cleanup decisions.
- No production promotion occurs during planning; execution requires separate authorization.

## Milestone 0 — Preserve and baseline

- Preserve the May planning snapshot in `prompts/outputs/archive/2026-06-19-pre-consolidation-audit/`.
- Capture clean repository, contract, schema, build, test, documentation, and runtime-stub inventories.
- Provision complete Node/Java/Xcode/Terraform toolchains in CI; record local environment limitations as unverified, not passing.
- Approve packaging, AWS topology, API authority, schema authority, and data retention open decisions.

## Milestone 1 — Launch-blocking foundations

- G1: migration authority, clean/upgrade tests, restore evidence.
- G2: raw signed/idempotent payments, session rotation/revocation, secure browser/Android credentials.
- G4: OpenAPI authority, generated/validated web/Android/iOS clients.
- G8: strict build, PostgreSQL integration harness, central schema-valid fixtures.
- G9: bounded contexts, state ownership, module dependency gates.
- G11: data inventory, threat model, release security gate.
- Exit: strict backend/shared/frontend builds; migration/contract/security tests; no production mock payment; approved architecture/security checkpoints.

## Milestone 2 — Trustworthy platform journeys

- G5: seller/customer Android real-data states, offline fidelity, settings/media/payment, duplicate screen retirement.
- G6: Business/Customer iOS targets/schemes, production/test transport split, media/payment, real-backend smoke.
- G7: capability registry/enforcement and launch-scope stub completion.
- G8: representative web/native/backend primary role journeys.
- G12: reviewed tokens/components/state matrix before screen migrations.
- Exit: one seller and customer HTTP journey per platform; no sample fallback; all visible launch controls work or are explicitly unavailable.

## Milestone 3 — Production delivery and operations

- G3: AWS Terraform environment module, immutable fail-closed CI, protected promotion, rollback verification.
- G10: SLOs, OTel/CloudWatch/X-Ray, health semantics, alerts/synthetics, runbooks/drills.
- G11: GDPR completeness, credential encryption/rotation, mobile data-practice declarations.
- Exit: staging provisioned from reviewed plan; migrate→deploy→verify→rollback drill; signed evidence with actual RPO/RTO and zero critical alerts.

## Milestone 4 — Consolidation and cleanup

- G9: complete context/client layering and finite deprecation removal.
- G12: design drift/accessibility/visual gates.
- G13: authoritative docs tree, evidence-backed status, archived history, root cleanup.
- G14: reference-proven code/artifact/workflow cleanup and hygiene gate.
- Exit: architecture/docs/deprecation/cleanup ledgers pass; no unclassified runtime stub, duplicate authority, tracked generated output, unsupported readiness claim, or expired exception.

## Milestone 5 — Release candidate audit

- Re-run all gap acceptance commands on the immutable candidate.
- Verify mobile signing/archive/internal distribution and web/API staging artifacts.
- Run security/privacy, dependency/SBOM/provenance, contract, migration/restore, accessibility/visual, performance, and SLO checks.
- Complete seller/customer/admin/operator acceptance evidence and rollback decision.
- Release only when every critical/high gap is closed and medium/low residual risk has a named owner, decision, and non-misleading status.

## User-review checkpoints

1. AWS/runtime, schema, API, mobile packaging, and bounded-context ADRs before foundation execution continues.
2. Payment/session threat model and data inventory before credential/payment migrations.
3. `docs/design-system/review/index.html` before screen-level consolidation.
4. Documentation disposition and dead-code deletion manifests before apply.
5. Staging drill evidence and residual-risk register before production authorization.
