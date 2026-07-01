---
generated_at: 2026-05-28T07:11:33Z
total_tasks: 7
phase_counts:
  foundation: 5
  mvp: 0
  expand: 2
  polish: 0
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

1. `remediation-backend-env-validation.md` (depends on: none)
2. `remediation-cicd-multi-target-verification.md` (depends on: none)
3. `remediation-frontend-design-token-sync.md` (depends on: none)
4. `remediation-infra-restoration.md` (depends on: none)
5. `remediation-ios-target-linkage.md` (depends on: none)

## Phase — mvp

_(no tasks in this phase)_

## Phase — expand

6. `remediation-android-parity-audit.md` (depends on: none)
7. `remediation-backend-stub-remediation.md` (depends on: none)

## Phase — polish

_(no tasks in this phase)_
