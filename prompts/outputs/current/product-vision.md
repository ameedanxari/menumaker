# Product Vision

## Outcome

MenuMaker enables food-business sellers to publish menus and fulfil orders while customers discover, purchase, track, and review across web, Android, and iOS. The immediate outcome is not new feature breadth: it is a trustworthy, consolidated implementation whose release status is proved by current builds, contracts, migrations, tests, operational signals, and recoverability.

## Users and essential journeys

- **Seller:** authenticate → create/configure business → maintain dishes/menu → publish → receive/update orders → reconcile payments/payouts.
- **Customer:** authenticate or use public discovery → browse menu → cart/checkout → pay or choose approved cash flow → track order → review.
- **Support/moderation/admin:** authenticate with strong controls → inspect tenant-scoped records → take role-authorized action → leave immutable audit evidence.
- **Operator/release engineer:** build one immutable candidate → migrate safely → promote through staging → verify SLOs/data → roll back application artifacts or execute approved recovery.

## Product principles

1. Real state over demo plausibility: no runtime sample fallback or fabricated success metric.
2. One contract and one canonical write owner per domain state.
3. Payments, orders, subscriptions, rewards, privacy actions, and audit evidence fail closed where integrity is uncertain.
4. Seller/customer experiences preserve the established MenuMaker visual identity while sharing governed tokens and semantics.
5. A readiness claim must link to time-bounded machine evidence; unknown or unavailable verification is labelled unverified.
6. Cleanup preserves provenance and removes only reference-proven dead or generated material.

## Scope of this plan

- Close 14 audited gaps across database/release, payment/session security, CI/IaC, API contracts, Android, iOS, backend stubs, testing, architecture, observability, privacy, design system, documentation, and repository hygiene.
- Consolidate the existing codebase as a modular monolith plus thin platform clients before considering service decomposition.
- Archive old plans and reports; establish a governed documentation and deprecation lifecycle.

## Explicit non-goals

- No redesign/rebrand or replacement UI framework.
- No premature microservice split.
- No new unapproved payment/POS/delivery provider.
- No claim of legal/regulatory certification from technical controls alone.
- No destructive deletion of unknown-provenance documents or dynamically referenced mobile resources.

## Success evidence

- Final planning gate passes with an acyclic dependency graph and file ownership ledger.
- Execution later proves clean migrations, strict builds, contract regeneration, primary role journeys, signed/idempotent payments, mobile product builds, Terraform plans, staged deployment/rollback, SLO telemetry, privacy workflows, and a clean documentation/repository audit.
