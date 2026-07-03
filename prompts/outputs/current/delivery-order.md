---
generated_at: 2026-07-03T07:52:22Z
total_tasks: 14
phase_counts:
  foundation: 8
  mvp: 2
  expand: 1
  polish: 3
phase_inversions: []
cycle_tasks: []
missing_phase_field: []
---

# Delivery Order

_Canonical execution order. The executor reads this verbatim to pick the next task. Order is:_
_1) **Phase** — foundation < mvp < expand < polish_
_2) **Topological** — within a phase, Depends-on edges define order_
_3) **Lexical** — final tiebreak when two tasks are independent within a phase_

## Phase — foundation

1. `remediation-authoritative-api-contract-and-client-generation.md` (depends on: none)
2. `remediation-bounded-context-and-code-ownership-consolidation.md` (depends on: remediation-authoritative-api-contract-and-client-generation.md)
3. `remediation-database-schema-and-release-integrity.md` (depends on: none)
4. `remediation-design-system-and-ui-state-consolidation.md` (depends on: none)
5. `remediation-executable-fail-closed-delivery-pipeline.md` (depends on: remediation-database-schema-and-release-integrity.md)
6. `remediation-observability-operability-and-resilience.md` (depends on: remediation-executable-fail-closed-delivery-pipeline.md)
7. `remediation-payment-and-session-security-boundary.md` (depends on: none)
8. `remediation-privacy-security-and-release-compliance.md` (depends on: remediation-executable-fail-closed-delivery-pipeline.md)

## Phase — mvp

9. `remediation-android-real-data-and-primary-flow-completion.md` (depends on: remediation-authoritative-api-contract-and-client-generation.md, remediation-payment-and-session-security-boundary.md)
10. `remediation-ios-target-transport-and-primary-flow-consolidation.md` (depends on: remediation-authoritative-api-contract-and-client-generation.md, remediation-payment-and-session-security-boundary.md)

## Phase — expand

11. `remediation-backend-stub-and-domain-workflow-completion.md` (depends on: none)

## Phase — polish

12. `remediation-documentation-information-architecture-and-truth.md` (depends on: none)
13. `remediation-dead-code-generated-artifact-and-repository-cleanup.md` (depends on: remediation-android-real-data-and-primary-flow-completion.md, remediation-bounded-context-and-code-ownership-consolidation.md, remediation-design-system-and-ui-state-consolidation.md, remediation-documentation-information-architecture-and-truth.md, remediation-executable-fail-closed-delivery-pipeline.md, remediation-ios-target-transport-and-primary-flow-consolidation.md)
14. `remediation-trustworthy-test-and-verification-strategy.md` (depends on: remediation-android-real-data-and-primary-flow-completion.md, remediation-authoritative-api-contract-and-client-generation.md, remediation-database-schema-and-release-integrity.md, remediation-ios-target-transport-and-primary-flow-consolidation.md)

