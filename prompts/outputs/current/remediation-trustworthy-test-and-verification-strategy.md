# Remediation Prompt — Trustworthy Test and Verification Strategy

_Closes gap:_ G8 · trustworthy-test-and-verification-strategy

## Context

MenuMaker contains many tests, but backend compilation is intentionally fail-open, frontend coverage excludes most user-facing code, web E2E does not own backend startup, native UI suites rely heavily on platform fakes, iOS production code contains its mock router, and CI frequently converts failures into warnings. Test count therefore overstates confidence in cross-platform behavior.

## What to build

Create a testing pyramid tied to risk and capability status: strict compilation; deterministic unit/property tests; PostgreSQL integration and migration tests; OpenAPI contract fixtures; one canonical fake backend; real HTTP smoke journeys per role/platform; representative accessibility/visual tests; mutation/coverage/flake metrics; and CI gates that preserve failure exit codes.

For UI verification, preserve the audited existing theme authority and explicitly cover default, loading, empty, error, disabled, and success states rather than relying on screenshot presence alone.

## Implementation guidance

## R1 · Restore strict compiler and lint gates incrementally
- **Closes user story:** As a maintainer, I need compiler failures to block changes, so that tests never run against code that only emitted by ignoring type defects.
- **Change type:** modify-existing
- **File:** `backend/tsconfig.json`
- **File:** `backend/jest.config.js`
- **File:** `backend/eslint.config.js`
- **File:** `backend/strict-compiler-debt.json`
- **File:** `scripts/quality/verify-strict-compiler-baseline.mjs`
- **Precise change:** Enable `noEmitOnError`, strict null checks, no implicit any/returns/fallthrough, consistent casing, and unused checks in a staged baseline; create a checked debt file for temporary suppressions with owner/expiry; remove Jest diagnostic ignore codes as source is corrected.
- **Acceptance:**
  - `npm run build --workspace=backend` fails for introduced type/null/unused/fallthrough defects.
  - The suppression baseline is monotonically non-increasing and no production directory is excluded from compilation.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** none
- **Test:** `npm run lint --workspace=backend && npm run build --workspace=backend` exits 0 with no swallowed status.
- **Estimated LOC:** +60
- **Phase:** polish

## R2 · Add isolated PostgreSQL/API integration harness
- **Closes user story:** As a backend developer, I need tests against real PostgreSQL and Fastify injection, so that transaction, relation, auth, and route behavior is verified together.
- **Change type:** create-new
- **File:** `backend/tests/integration/testHarness.ts`
- **Precise change:** Provision a disposable PostgreSQL database/container per suite, run G1 migrations, build the injected G4 app, seed deterministic factories, stub only external provider boundaries, reset tables safely, capture request IDs, and provide authenticated customer/seller/admin clients.
- **Acceptance:**
  - Tests cannot connect to development/production database names and fail if migrations are pending.
  - Harness teardown detects open handles, leaked rows, and unconsumed provider expectations.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** remediation-database-schema-and-release-integrity.md (migration harness), remediation-authoritative-api-contract-and-client-generation.md (app factory)
- **Test:** `npm test --workspace=backend -- tests/integration --runInBand --detectOpenHandles` exits 0.
- **Estimated LOC:** +360
- **Phase:** polish

## R3 · Cover launch-critical backend invariants
- **Closes user story:** As a product owner, I need critical domain invariants tested, so that concurrency and failure paths cannot corrupt orders, payments, rewards, or permissions.
- **Change type:** create-new
- **File:** `backend/tests/integration/criticalJourneys.test.ts`
- **Precise change:** Test signup/session rotation, seller ownership/RBAC, menu publication/versioning, concurrent order totals/status transitions, payment webhook idempotency, subscription entitlement, coupon/referral single-use, GDPR export/deletion cascade, admin moderation audit, and notification outbox transaction rollback with happy path plus at least two failures each.
- **Acceptance:**
  - Monetary totals are property-tested in integer minor units and concurrent duplicate commands have one durable effect.
  - Authorization tests cover customer, seller-owner, other seller, support, moderator, super-admin, suspended, and banned identities.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R2 (integration harness)
- **Test:** `npm test --workspace=backend -- criticalJourneys.test.ts --runInBand` exits 0.
- **Estimated LOC:** +650
- **Phase:** polish

## R4 · Make frontend coverage representative and E2E self-contained
- **Closes user story:** As a web developer, I need primary pages and journeys inside quality gates, so that a high coverage number cannot exclude the product itself.
- **Change type:** modify-existing
- **File:** `frontend/vitest.config.ts`
- **File:** `frontend/playwright.config.ts`
- **File:** `frontend/src/App.tsx`
- **File:** `frontend/src/components/layouts/DashboardLayout.tsx`
- **File:** `frontend/src/components/subscription/SubscriptionStatusWidget.tsx`
- **File:** `frontend/src/pages/BusinessProfilePage.tsx`
- **File:** `frontend/src/pages/IntegrationsPage.tsx`
- **File:** `frontend/src/pages/MenuEditorPage.tsx`
- **File:** `frontend/src/pages/OrdersPage.tsx`
- **File:** `frontend/src/pages/PublicMenuPage.tsx`
- **File:** `frontend/src/pages/ReferralsPage.tsx`
- **File:** `frontend/src/pages/SubscriptionPage.tsx`
- **File:** `frontend/src/pages/LoginPage.tsx`
- **File:** `frontend/src/pages/SignupPage.tsx`
- **File:** `frontend/src/components/menu/DishFormModal.tsx`
- **File:** `frontend/src/components/menu/DishCard.tsx`
- **File:** `frontend/src/stores/menuStore.ts`
- **File:** `frontend/tests/e2e/auth.spec.ts`
- **File:** `frontend/tests/e2e/customer-order.spec.ts`
- **File:** `frontend/tests/e2e/menu-management.spec.ts`
- **File:** `frontend/tests/e2e/seller-order-management.spec.ts`
- **File:** `frontend/tests/e2e/helpers.ts`
- **Precise change:** Remove blanket page/layout/menu/subscription/form/provider exclusions; set risk-based thresholds for statements/branches/functions/lines; require tests for auth, public menu/cart/checkout, seller menu/orders/reports/payments/settings; and configure Playwright `webServer` to start both migrated backend plus frontend with deterministic data and teardown.
- **Acceptance:**
  - Coverage includes every route component in `App.tsx` or carries a reviewed line-level exclusion with reason.
  - E2E passes from a clean checkout without a manually running backend and fails when backend health or fixture seed fails.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** remediation-authoritative-api-contract-and-client-generation.md (typed client), R2 (test backend pattern)
- **Test:** `npm run test:ci --workspace=frontend && npm run test:e2e --workspace=frontend -- --project=chromium` exits 0.
- **Estimated LOC:** +220
- **Phase:** polish

## R5 · Centralize and validate cross-platform fixtures
- **Closes user story:** As a mobile tester, I need one contract-valid fixture set, so that web, Android, and iOS mocks cannot disagree while all tests pass.
- **Change type:** create-new
- **File:** `shared/mocks/manifest.json`
- **File:** `shared/mocks/api/v1/auth_signup/201.json`
- **File:** `shared/mocks/api/v1/auth_login/200.json`
- **File:** `shared/mocks/api/v1/auth_get_me/200.json`
- **File:** `shared/mocks/api/v1/business_list/200.json`
- **File:** `shared/mocks/api/v1/menu_list/200.json`
- **File:** `shared/mocks/api/v1/order_list/200.json`
- **File:** `shared/mocks/api/v1/order_create/201.json`
- **File:** `shared/mocks/api/v1/payment_create_intent/201.json`
- **File:** `shared/mocks/api/v1/coupon_list/200.json`
- **File:** `shared/mocks/api/v1/notification_list/200.json`
- **File:** `shared/mocks/api/v1/report_dashboard/200.json`
- **File:** `shared/fake-backend/validate-fixtures.js`
- **Precise change:** Inventory fixtures by OpenAPI operation/status/scenario, store JSON under `shared/mocks/api/v1/<operationId>/`, validate each body against the canonical schema, migrate Android/iOS/web consumers incrementally, and preserve platform-only UI state outside API fixtures.
- **Acceptance:**
  - Every fixture has operation ID, status, schema hash, scenario, source, and consumers; conflicting copies are rejected.
  - Production builds contain no fixture manifest/data and tests fail when the OpenAPI schema changes incompatibly.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** remediation-authoritative-api-contract-and-client-generation.md (canonical schema)
- **Test:** `node shared/fake-backend/validate-fixtures.js openapi/menumaker.v1.yaml shared/mocks/manifest.json` exits 0.
- **Estimated LOC:** +320
- **Phase:** polish

## R6 · Add real-HTTP Android and iOS role smoke suites
- **Closes user story:** As a release engineer, I need native smoke journeys against the canonical fake backend, so that platform fakes do not conceal networking and decoding defects.
- **Change type:** modify-existing
- **File:** `shared/fake-backend/run-with-server.js`
- **File:** `shared/fake-backend/server.js`
- **Precise change:** Start a schema-valid deterministic server on an ephemeral port, expose readiness/reset/seed controls only to localhost test processes, launch Android seller/customer and iOS Business/Customer smoke suites with that URL through the existing package scripts, capture requests/responses redacted, and fail on unhandled operation or fixture mismatch.
- **Acceptance:**
  - Each product covers login plus its primary seller/customer journey over HTTP without platform repository fakes.
  - Server shutdown, port collision, test timeout, and malformed client request return non-zero and preserve diagnostics.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** remediation-android-real-data-and-primary-flow-completion.md (Android primary flows), remediation-ios-target-transport-and-primary-flow-consolidation.md (iOS smoke plans), R5 (central fixtures)
- **Test:** `npm run test:android:fake && npm run test:ios:fake` exits 0 in a fully provisioned mobile CI runner.
- **Estimated LOC:** +240
- **Phase:** polish

## R7 · Measure quality, flakes, and untested change risk
- **Closes user story:** As an engineering lead, I need quality trends tied to changed code, so that coverage growth is real and flaky tests cannot be normalized.
- **Change type:** create-new
- **File:** `scripts/quality/build-quality-report.ts`
- **File:** `scripts/quality/fixtures/good/quality-input.json`
- **File:** `scripts/quality/fixtures/bad-critical-coverage/quality-input.json`
- **File:** `scripts/quality/fixtures/bad-skipped-test/quality-input.json`
- **File:** `scripts/quality/fixtures/bad-mutation-score/quality-input.json`
- **File:** `scripts/quality/fixtures/bad-retry-dependent-pass/quality-input.json`
- **Precise change:** Aggregate strict-build, lint, unit/integration/E2E/UI, coverage, mutation score for payment/order invariants, test duration, retry/flake rate, skipped tests, changed-file coverage, and dashboard quality kpi metrics into JSON/Markdown; expose filter definitions plus chart and table-ready rows with tooltip and legend metadata; set release thresholds and quarantine expiry ownership without converting quarantine failures to success.
- **Acceptance:**
  - The report fails a release on reduced critical coverage, new skipped/only tests, mutation threshold regression, or retry-dependent pass.
  - Metrics are comparable by commit and platform and link to raw artifacts rather than hand-written summaries.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R3 (backend critical suite), R4 (web gates), R6 (native smoke suites)
- **Test:** `node --import tsx scripts/quality/build-quality-report.ts --fixtures scripts/quality/fixtures` passes good fixtures and rejects each regression fixture.
- **Estimated LOC:** +340
- **Phase:** polish

## What NOT to do

- Do not count files, mocks, or excluded code as evidence of functional coverage.
- Do not make CI green with retries, `|| true`, swallowed startup failures, or stale narrative reports.
- Do not duplicate API fixtures inside platform languages after centralization.
