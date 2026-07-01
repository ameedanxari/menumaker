# Remediation Prompt — Backend Stub and Domain-Workflow Completion

_Closes gap:_ G7 · backend-stub-and-domain-workflow-completion

## Context

The backend advertises POS, analytics, referrals, coupons, moderation, support, tax, delivery, OCR, messaging, and other advanced domains, but several implementations throw `not implemented`, return fabricated operational values, skip side effects, or contain future-work comments. Shipping every route as active makes callers unable to distinguish complete behavior from demo scaffolding.

If capability removal changes a client screen, existing product style is authoritative and the client must preserve explicit default, loading, empty, error, disabled, and success states rather than masking server availability with fabricated content.

## What to build

Create a machine-readable capability registry, classify every stub as implement-now, feature-flagged unavailable, or remove, then complete launch-scope workflows with idempotency, auditability, error taxonomy, and integration tests. Disabled capabilities must return an explicit stable `FEATURE_UNAVAILABLE` response and remain absent from client navigation.

## Implementation guidance

## R1 · Inventory every advertised capability and stub
- **Closes user story:** As a product owner, I need an authoritative capability status, so that launch scope never includes placeholder behavior by accident.
- **Change type:** create-new
- **File:** `docs/product/capability-registry.yaml`
- **File:** `scripts/quality/verify_capability_registry.py`
- **File:** `backend/src/services/TranslationService.ts`
- **File:** `backend/tests/TranslationService.test.ts`
- **Precise change:** Enumerate every registered route/domain with owner, launch scope, status (`implemented`, `disabled`, `deprecated`), feature flag, dependencies, contract operation IDs, tests, known TODO/stub locations, and removal milestone; classify POS, analytics, referral rewards, QR generation, moderation actions, support email, tax waiver calculations, OCR, delivery, and notification side effects.
- **Acceptance:**
  - A scanner maps every `main.ts` route registration and every source TODO/not-implemented/placeholder marker to a registry row or approved non-functional comment exemption.
  - No capability is marked implemented without at least one backend integration test and one client or operator consumer.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** none
- **Test:** `python3 scripts/quality/verify_capability_registry.py` reports zero unclassified routes or stub markers.
- **Estimated LOC:** +260
- **Phase:** expand

## R2 · Enforce capability state at route registration
- **Closes user story:** As an API consumer, I need unavailable features to fail explicitly, so that placeholder data is never mistaken for a successful operation.
- **Change type:** create-new
- **File:** `backend/src/config/capabilities.ts`
- **File:** `backend/tests/capabilities.test.ts`
- **File:** `frontend/src/pages/AdminPortalPage.tsx`
- **File:** `backend/src/services/AdminService.ts`
- **Precise change:** Validate feature flags and required integration credentials at startup, expose `requireCapability(name)` middleware returning a stable 503 `FEATURE_UNAVAILABLE`, omit disabled operations from client navigation/discovery, and emit capability readiness in authenticated admin health without exposing secrets.
- **Acceptance:**
  - Missing launch-required credentials fail startup; optional disabled features return the documented code and never execute partial writes.
  - Capability status comes from validated config/registry, not scattered `process.env` checks.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R1 (classified capability registry)
- **Test:** `npm test --workspace=backend -- capabilities.test.ts --runInBand` covers enabled, disabled, missing-required, and misconfigured states.
- **Estimated LOC:** +180
- **Phase:** expand

## R3 · Complete or disable POS token refresh and sync
- **Closes user story:** As a seller, I need POS synchronization to refresh credentials and report durable outcomes, so that menu/order integration does not stop after token expiry.
- **Change type:** modify-existing
- **File:** `backend/src/services/POSSyncService.ts`
- **File:** `backend/src/routes/pos.ts`
- **File:** `backend/tests/POSSyncService.test.ts`
- **Precise change:** Implement provider adapters for only approved launch providers with encrypted credentials, compare-and-swap token refresh, request idempotency, cursor checkpoints, rate-limit backoff, typed permanent/retryable errors, sync-log audit records, and replay-safe item/order mapping; route all unapproved providers through the disabled capability state.
- **Acceptance:**
  - No launch provider path throws `Token refresh not implemented` or returns a stub success.
  - Tests cover expired token concurrency, rate limiting, partial page failure, resume from cursor, mapping conflict, revoked credentials, and replay.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R2 (capability enforcement)
- **Test:** `npm test --workspace=backend -- POSSyncService.test.ts --runInBand` exits 0 with provider HTTP fakes.
- **Estimated LOC:** +420
- **Phase:** expand

## R4 · Replace fabricated operational analytics with measured data
- **Closes user story:** As a seller or operator, I need analytics derived from recorded events and telemetry, so that dashboards do not display invented uptime or error values.
- **Change type:** modify-existing
- **File:** `backend/src/services/AnalyticsService.ts`
- **File:** `backend/tests/AnalyticsService.test.ts`
- **Precise change:** Separate seller business analytics from platform observability; calculate seller metrics from orders/payments/refunds within explicit timezones; obtain platform uptime/error/latency from the G10 telemetry adapter or mark unavailable; remove hard-coded 99.97 and placeholder arrays; define freshness and partial-data metadata.
- **Acceptance:**
  - All returned values trace to a SQL aggregation or telemetry query with range/timezone tests.
  - Empty/no-telemetry states are explicit and never represented by plausible constants.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R2 (capability state; telemetry is consumed through the observability adapter interface)
- **Test:** `npm test --workspace=backend -- AnalyticsService.test.ts --runInBand` verifies timezone, refund, empty, stale, and partial-source cases.
- **Estimated LOC:** +360
- **Phase:** expand

## R5 · Make rewards, coupons, moderation, and QR effects real or unavailable
- **Closes user story:** As a customer or moderator, I need promotions and moderation actions to produce audited state changes, so that rewards and safety controls match what the API reports.
- **Change type:** modify-existing
- **File:** `backend/src/services/EnhancedReferralService.ts`
- **File:** `backend/src/services/ReferralService.ts`
- **File:** `backend/src/services/CouponService.ts`
- **File:** `backend/src/services/PayoutService.ts`
- **File:** `backend/src/routes/enhancedReferrals.ts`
- **File:** `backend/src/routes/referrals.ts`
- **File:** `backend/src/models/EnhancedReferral.ts`
- **File:** `backend/src/models/Referral.ts`
- **File:** `backend/src/models/User.ts`
- **File:** `backend/src/services/ModerationService.ts`
- **File:** `backend/tests/CouponService.test.ts`
- **File:** `backend/tests/EnhancedReferralService.test.ts`
- **File:** `backend/tests/ModerationService.test.ts`
- **File:** `backend/tests/PayoutService.test.ts`
- **Precise change:** Post referral credit through an immutable ledger transaction, create coupons through `CouponService`, generate QR artifacts with a maintained encoder, and publish notification outbox entries atomically; coordinate `ModerationService` to hide/suspend/warn through typed content adapters and audit before/after state; disable any unresolved action instead of returning success.
- **Acceptance:**
  - Concurrent reward qualification credits each beneficiary exactly once and links ledger, coupon, notification, and referral IDs.
  - Moderation response status reflects the actual content/user mutation and every privileged action has actor, reason, target, before/after, and timestamp.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R2 (capability enforcement)
- **Test:** `npm test --workspace=backend -- EnhancedReferralService.test.ts ModerationService.test.ts --runInBand` covers concurrency, replay, rollback, and unavailable adapters.
- **Estimated LOC:** +520
- **Phase:** expand

## R6 · Deliver support and domain notifications through an outbox
- **Closes user story:** As a customer or support agent, I need promised email/WhatsApp/push notifications delivered or visibly failed, so that silent TODOs do not break service workflows.
- **Change type:** create-new
- **File:** `backend/src/models/NotificationOutbox.ts`
- **File:** `backend/src/services/SupportTicketService.ts`
- **File:** `backend/src/services/OrderService.ts`
- **File:** `backend/src/routes/orders.ts`
- **File:** `backend/tests/NotificationOutbox.integration.test.ts`
- **File:** `backend/tests/OrderService.test.ts`
- **File:** `backend/tests/OrderServiceFailure.test.ts`
- **File:** `backend/tests/utils/sharedFixtures.ts`
- **Precise change:** Add transactional outbox records with channel/template/locale/deduplication key, attempt state, next attempt, provider receipt, and redacted terminal error; enqueue from support, GDPR, referral, order, payment, and moderation transactions; dispatch through channel adapters with exponential retry, DLQ, opt-out enforcement, and operator replay audit.
- **Acceptance:**
  - Domain writes and notification intent commit atomically; provider outage does not roll back the domain action or lose intent.
  - Duplicate events send at most once per channel/deduplication key and terminal failures are queryable by support without message-body secrets.
  - Order route/service cancellation and read/update boundaries remain plan-owned while order notification and launch-scope ordering side effects are hardened.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R2 (capability/channel config)
- **Test:** `npm test --workspace=backend -- NotificationOutbox.integration.test.ts --runInBand` covers commit rollback, retry, dedupe, opt-out, DLQ, and replay.
- **Estimated LOC:** +390
- **Phase:** expand

## R7 · Remove placeholders from launch-scope source and OpenAPI
- **Closes user story:** As a release engineer, I need a mechanical stub gate, so that placeholder behavior cannot re-enter a capability marked implemented.
- **Change type:** modify-existing
- **File:** `scripts/quality/find-runtime-stubs.sh`
- **File:** `backend/src/services/DeliveryService.ts`
- **File:** `backend/src/routes/delivery.ts`
- **File:** `backend/tests/DeliveryService.test.ts`
- **File:** `backend/src/services/OCRService.ts`
- **File:** `backend/src/routes/ocr.ts`
- **File:** `backend/tests/OCRService.test.ts`
- **File:** `backend/src/services/TaxReportService.ts`
- **File:** `backend/src/services/TaxService.ts`
- **File:** `backend/src/routes/taxReports.ts`
- **File:** `backend/tests/TaxReportService.test.ts`
- **File:** `backend/src/services/SubscriptionService.ts`
- **File:** `backend/tests/SubscriptionService.test.ts`
- **Precise change:** Scan production source for TODO/FIXME/not-implemented/stub/placeholder and suspicious hard-coded success data, apply a small reviewed allowlist for harmless documentation/UI placeholders, cross-check capability status and OpenAPI exposure, and emit file/line/capability evidence. Extend the shared capability route coverage owned by R2 when R7 route hardening changes capability-gated endpoints.
- **Acceptance:**
  - The script fails when an implemented launch capability contains an unclassified runtime stub or a disabled capability is still advertised to clients.
  - Each allowlist entry has owner, reason, expiry date, and linked registry row.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R3 (POS), R4 (analytics), R5 (effects), R6 (notifications)
- **Test:** `bash scripts/quality/find-runtime-stubs.sh` exits 0 and its mutation fixtures detect each prohibited pattern; `npm test --workspace=backend -- DeliveryService.test.ts capabilities.test.ts --runInBand` covers R7 delivery route/service guardrails using the shared R2 capability test file.
- **Estimated LOC:** +180
- **Phase:** expand

## R8 · Preserve subscription webhook regression ownership during disabled-capability hardening
- **Closes user story:** As a release engineer, I need subscription lifecycle regressions to remain owned by the active backend capability plan, so that disabled-capability service hardening does not drift from webhook ingress guarantees.
- **Change type:** modify-existing
- **File:** `backend/src/main.ts`
- **File:** `backend/src/routes/subscriptions.ts`
- **File:** `backend/tests/subscription-webhook.integration.test.ts`
- **Precise change:** Keep subscription webhook raw-body, signature, idempotency, ordering, and lifecycle regression evidence tied to the backend capability-hardening plan while `subscriptions` remains disabled by default; any future service-layer fail-closed changes must continue to pass the webhook regression suite without requiring live Stripe credentials.
- **Acceptance:**
  - Subscription webhook regression coverage remains listed in the path ledger for this capability plan and does not collide with the payment/session security task's existing ownership.
  - Disabled subscription service-boundary changes still prove webhook lifecycle helpers, raw-body handling, idempotency, stale-event ordering, and trial metadata behavior through focused backend tests.
  - The task's named verification command is required before handoff whenever subscription fail-closed behavior is changed.
- **Depends on:** R2 (capability enforcement), R7 (stub/OpenAPI gate)
- **Test:** `npm test --workspace=backend -- SubscriptionService.test.ts subscription-webhook.integration.test.ts capabilities.test.ts --runInBand` exits 0 without live Stripe credentials.
- **Estimated LOC:** +0
- **Phase:** expand

## R9 · Preserve disabled capability client boundaries
- **Closes user story:** As a launch owner, I need client surfaces to match the disabled backend registry, so that users cannot start POS, delivery, subscription, OCR/tax, or enhanced-referral workflows that the server rejects as unavailable.
- **Change type:** modify-existing
- **File:** `frontend/src/pages/IntegrationsPage.tsx`
- **File:** `frontend/src/pages/SubscriptionPage.tsx`
- **File:** `frontend/src/components/subscription/SubscriptionStatusWidget.tsx`
- **File:** `frontend/src/pages/BusinessProfilePage.tsx`
- **File:** `frontend/src/pages/MenuEditorPage.tsx`
- **File:** `frontend/src/pages/OrdersPage.tsx`
- **File:** `frontend/src/pages/ReferralsPage.tsx`
- **File:** `frontend/src/services/api.ts`
- **File:** `frontend/src/services/api.test.ts`
- **File:** `android/app/src/main/kotlin/com/menumaker/data/repository/IntegrationRepository.kt`
- **File:** `android/app/src/main/kotlin/com/menumaker/data/repository/ReferralRepository.kt`
- **File:** `android/app/src/main/kotlin/com/menumaker/data/remote/api/ApiService.kt`
- **File:** `android/app/src/main/kotlin/com/menumaker/data/remote/models/ReferralModels.kt`
- **File:** `android/app/src/main/kotlin/com/menumaker/viewmodel/IntegrationViewModel.kt`
- **File:** `android/app/src/main/kotlin/com/menumaker/ui/screens/ReferralsScreen.kt`
- **File:** `android/app/src/main/kotlin/com/menumaker/viewmodel/ReferralViewModel.kt`
- **File:** `android/app/src/test/kotlin/com/menumaker/repository/IntegrationRepositoryTest.kt`
- **File:** `android/app/src/test/kotlin/com/menumaker/repository/ReferralRepositoryTest.kt`
- **File:** `android/app/src/test/kotlin/com/menumaker/testutils/FakeApiService.kt`
- **File:** `android/app/src/test/kotlin/com/menumaker/viewmodel/IntegrationViewModelTest.kt`
- **File:** `ios/MenuMaker/Data/Repositories/IntegrationRepository.swift`
- **File:** `ios/MenuMaker/Data/Repositories/ReferralRepository.swift`
- **File:** `ios/MenuMaker/Data/Models/ReferralModels.swift`
- **File:** `ios/MenuMaker/Shared/Constants/AppConstants.swift`
- **File:** `ios/MenuMaker/Core/Services/APIClient.swift`
- **File:** `ios/MenuMaker/Core/Services/AnalyticsService.swift`
- **File:** `ios/MenuMaker/ViewModels/IntegrationViewModel.swift`
- **File:** `ios/MenuMaker/Views/Customer/ReferralView.swift`
- **File:** `ios/MenuMaker/ViewModels/ReferralViewModel.swift`
- **File:** `ios/MenuMakerTests/IntegrationCapabilityBoundaryTests.swift`
- **File:** `ios/MenuMakerTests/ReferralCapabilityBoundaryTests.swift`
- **Precise change:** Keep client API wrappers, screens, repositories, and view models aligned with the disabled capability registry; POS and delivery connect flows must remain launch-gated locally, subscription billing methods must not expose live upgrade/portal calls while disabled, and enhanced referral UIs must not offer fake reward, leaderboard, affiliate, or payout success states.
- **Acceptance:**
  - Client code for disabled capabilities either displays an explicit launch-gated/disabled state or surfaces the backend `FEATURE_UNAVAILABLE` response without retrying into partial workflow side effects.
  - No visible button or wrapper method advertises live POS, delivery, paid subscription, OCR/tax import/reporting, or enhanced-referral reward/payout behavior until the matching registry row is enabled with evidence.
  - The path ledger records these client API wrapper, DTO/model, view-model, screen, compile-support, and regression-test files as modify-existing ownership for this backend capability-hardening plan without colliding with platform-specific UI/test tasks.
- **Depends on:** R2 (capability enforcement), R7 (stub/OpenAPI gate)
- **Test:** `PATH="$PWD/.tools/node/bin:/Applications/Codex.app/Contents/Resources/cua_node/bin:$PATH" node frontend/node_modules/typescript/bin/tsc --noEmit -p frontend/tsconfig.json && cd android && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew testSellerDebugUnitTest testCustomerDebugUnitTest --tests 'com.menumaker.repository.ReferralRepositoryTest' --tests 'com.menumaker.viewmodel.ReferralViewModelTest' && cd .. && DEVELOPER_DIR=/Applications/Xcode-27.0.0-Beta.app/Contents/Developer swiftc -parse ios/MenuMaker/Data/Repositories/IntegrationRepository.swift ios/MenuMaker/Data/Repositories/ReferralRepository.swift ios/MenuMaker/ViewModels/IntegrationViewModel.swift ios/MenuMaker/ViewModels/ReferralViewModel.swift ios/MenuMaker/Views/Customer/ReferralView.swift ios/MenuMaker/Data/Models/ReferralModels.swift ios/MenuMaker/Shared/Constants/AppConstants.swift ios/MenuMaker/Core/Services/APIClient.swift ios/MenuMaker/Core/Services/AnalyticsService.swift && cd ios && DEVELOPER_DIR=/Applications/Xcode-27.0.0-Beta.app/Contents/Developer xcodebuild test -project MenuMaker.xcodeproj -scheme MenuMaker-Business -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -only-testing:MenuMakerTests/ReferralCapabilityBoundaryTests && cd .. && python3 scripts/quality/verify_capability_registry.py && bash scripts/quality/find-runtime-stubs.sh` exits 0.
- **Estimated LOC:** +60
- **Phase:** expand

## R10 · Preserve generated execution plan artifacts in scope
- **Closes user story:** As a release engineer, I need the executor's regenerated planning artifacts to remain owned by the active remediation plan, so that ready-gate refreshes and safety checks do not report normal AI-prompt-library outputs as scope drift.
- **Change type:** modify-existing
- **File:** `prompts/outputs/current/architecture.md`
- **File:** `prompts/outputs/current/audit-report.md`
- **File:** `prompts/outputs/current/baseline-task-coverage.md`
- **File:** `prompts/outputs/current/brief-keywords.md`
- **File:** `prompts/outputs/current/delivery-order.md`
- **File:** `prompts/outputs/current/envelope-report.md`
- **File:** `prompts/outputs/current/execution-log.md`
- **File:** `prompts/outputs/current/external-accounts.md`
- **File:** `prompts/outputs/current/gap-list.md`
- **File:** `prompts/outputs/current/path-ledger.md`
- **File:** `prompts/outputs/current/phase-order-report.md`
- **File:** `prompts/outputs/current/product-vision.md`
- **File:** `prompts/outputs/current/project-context.md`
- **File:** `prompts/outputs/current/ready-to-execute-report.md`
- **File:** `prompts/outputs/current/release-plan.md`
- **File:** `prompts/outputs/current/remediation-android-real-data-and-primary-flow-completion.md`
- **File:** `prompts/outputs/current/remediation-authoritative-api-contract-and-client-generation.md`
- **File:** `prompts/outputs/current/remediation-backend-stub-and-domain-workflow-completion.md`
- **File:** `prompts/outputs/current/remediation-bounded-context-and-code-ownership-consolidation.md`
- **File:** `prompts/outputs/current/remediation-database-schema-and-release-integrity.md`
- **File:** `prompts/outputs/current/remediation-dead-code-generated-artifact-and-repository-cleanup.md`
- **File:** `prompts/outputs/current/remediation-design-system-and-ui-state-consolidation.md`
- **File:** `prompts/outputs/current/remediation-documentation-information-architecture-and-truth.md`
- **File:** `prompts/outputs/current/remediation-executable-fail-closed-delivery-pipeline.md`
- **File:** `prompts/outputs/current/remediation-ios-target-transport-and-primary-flow-consolidation.md`
- **File:** `prompts/outputs/current/remediation-observability-operability-and-resilience.md`
- **File:** `prompts/outputs/current/remediation-payment-and-session-security-boundary.md`
- **File:** `prompts/outputs/current/remediation-privacy-security-and-release-compliance.md`
- **File:** `prompts/outputs/current/remediation-trustworthy-test-and-verification-strategy.md`
- **File:** `prompts/outputs/current/resumption-checkpoint.md`
- **File:** `prompts/outputs/current/revise-report.md`
- **File:** `prompts/outputs/current/source-ledger.md`
- **File:** `prompts/outputs/current/store-submission.md`
- **File:** `prompts/outputs/current/task-contract.json`
- **File:** `prompts/outputs/current/task-graph.json`
- **File:** `prompts/outputs/current/task-schema-repair-report.md`
- **File:** `prompts/outputs/current/user-review-checkpoints.md`
- **File:** `.ai-prompts/safety-report.json`
- **File:** `.ai-prompts/safety-report-docs.json`
- **Precise change:** Keep these generated planning, readiness, source-ledger, graph, review, execution-log, path-ledger, and resumption-checkpoint artifacts declared as plan-owned paths because executor preflight and checkpointing intentionally refresh them while continuing this remediation prompt.
- **Acceptance:**
  - `validate-ready-to-execute.sh` can regenerate the AI-prompt-library artifacts and rebuild `path-ledger.md` without causing those files to appear as non-ledger scope drift.
  - The generated path ledger lists each refreshed planning/checkpoint artifact exactly once under this remediation prompt.
  - `task-graph.json` remains a machine-readable planning graph only and introduces no user-facing chart; tooltip, legend, loading, empty, and error behavior stay not applicable to this generated executor artifact.
  - Safety checks may still surface unrelated pre-existing deletes, but they no longer classify these generated plan/checkpoint outputs or generated safety-report JSON files as out-of-scope for this remediation prompt.
- **Depends on:** R1 (capability inventory), R7 (stub/OpenAPI gate)
- **Test:** `bash .ai-prompts/scripts/validate-ready-to-execute.sh prompts/outputs/current && bash .ai-prompts/scripts/safety-check-commit.sh --task prompts/outputs/current/remediation-backend-stub-and-domain-workflow-completion.md --ledger prompts/outputs/current/path-ledger.md --strict --report .ai-prompts/safety-report.json` reports no `out_of_scope_files` for generated planning artifacts.
- **Estimated LOC:** +3
- **Phase:** expand

## What NOT to do

- Do not return fabricated data to make a screen look complete.
- Do not keep optional integrations active with partial success semantics.
- Do not add new domain side effects without idempotency, audit evidence, and failure ownership.
