# Gap List

_Ordered by severity, then by dependency._

## G1 · database-schema-and-release-integrity
- **Severity:** critical
- **Description:** Create versioned migrations, zero-to-current and upgrade validation, backup/restore gates, and production schema ownership so the backend can safely start with `synchronize: false`.
- **Blocks:** G3
- **Blocked by:** none
- **Component:** `backend/src/config/database.ts`, `backend/src/models/`, `backend/src/migrations/`

## G2 · payment-and-session-security-boundary
- **Severity:** critical
- **Description:** Remove or environment-gate public mock payments, prove raw-body Stripe signatures and idempotent event handling, rotate/revoke refresh sessions, and replace exposed browser/Android token storage.
- **Blocks:** none
- **Blocked by:** none
- **Component:** `backend/src/routes/payments.ts`, `backend/src/routes/subscriptions.ts`, `backend/src/utils/jwt.ts`, `frontend/src/stores/authStore.ts`, `android/app/src/main/kotlin/com/menumaker/data/local/datastore/TokenDataStore.kt`

## G3 · executable-fail-closed-delivery-pipeline
- **Severity:** critical
- **Description:** Replace missing Terraform modules and placeholder deploy jobs with reviewed infrastructure plans, real web/API/mobile builds, protected promotion, rollback, post-deploy checks, and required fail-closed CI gates.
- **Blocks:** none
- **Blocked by:** G1
- **Reason:** Deployment verification needs the migration artifacts and clean-database command produced by G1 before it can safely promote a backend release.
- **Component:** `infrastructure/`, `.github/workflows/`

## G4 · authoritative-api-contract-and-client-generation
- **Severity:** high
- **Description:** Make a versioned API schema authoritative, align paths/methods/query names/status enums/responses, and generate or mechanically validate web, Android, and iOS clients against it.
- **Blocks:** G5, G6
- **Blocked by:** none
- **Component:** `backend/src/routes/`, `shared/`, `frontend/src/services/api.ts`, `android/app/src/main/kotlin/com/menumaker/data/remote/`, `ios/MenuMaker/Shared/Constants/AppConstants.swift`

## G5 · android-real-data-and-primary-flow-completion
- **Severity:** high
- **Description:** Replace seller/customer sample fallbacks and TODO interactions with repository-backed loading/error/empty states, secure payments/preferences/media, complete offline order fidelity, and remove duplicate screens.
- **Blocks:** none
- **Blocked by:** G4
- **Reason:** Android repositories and ViewModels need the canonical generated/validated endpoints and DTOs from G4 to replace currently drifting Retrofit methods without another manual contract fork.
- **Component:** `android/app/src/main/kotlin/com/menumaker/`

## G6 · ios-target-transport-and-primary-flow-consolidation
- **Severity:** high
- **Description:** Resolve seller/customer packaging, create real Xcode targets/schemes or one explicit role-switching product, separate test transport from production API code, align contracts, and finish media/payment flows.
- **Blocks:** none
- **Blocked by:** G4
- **Reason:** Splitting the iOS production/test transport should consume the canonical endpoints and DTO decisions from G4 rather than preserving the current divergent constants.
- **Component:** `ios/MenuMaker.xcodeproj/`, `ios/Package.swift`, `ios/MenuMaker/Core/Services/APIClient.swift`, `ios/MenuMaker/`

## G7 · backend-stub-and-domain-workflow-completion
- **Severity:** high
- **Description:** Inventory and either fully implement, explicitly feature-flag, or remove POS refresh, operational analytics, referral rewards, moderation actions, support notifications, QR generation, tax/delivery edge cases, and other placeholder domain behavior.
- **Blocks:** none
- **Blocked by:** none
- **Component:** `backend/src/services/`, `backend/src/routes/`

## G8 · trustworthy-test-and-verification-strategy
- **Severity:** high
- **Description:** Restore strict compilation, migration/contract/integration tests, representative page and native UI coverage, real-backend smoke tests, deterministic fixtures, and coverage scopes that include primary user journeys.
- **Blocks:** none
- **Blocked by:** none
- **Component:** `backend/`, `frontend/`, `android/`, `ios/`, `.github/workflows/`

## G9 · bounded-context-and-code-ownership-consolidation
- **Severity:** medium
- **Description:** Define target bounded contexts and dependency rules, split monolithic bootstrap/API/mock files, assign canonical state ownership, remove compatibility aliases, and establish architecture decision records.
- **Blocks:** none
- **Blocked by:** none
- **Component:** `backend/src/`, `shared/src/`, `frontend/src/`, `android/app/src/main/kotlin/`, `ios/MenuMaker/`

## G10 · observability-operability-and-resilience
- **Severity:** medium
- **Description:** Replace placeholder operational analytics with metrics/tracing/error reporting, SLOs and alerts, structured mobile telemetry, retry/idempotency policies, runbooks, and tested backup/restore and incident workflows.
- **Blocks:** none
- **Blocked by:** none
- **Component:** `backend/src/utils/logger.ts`, `backend/src/services/AnalyticsService.ts`, mobile services/workers, `infrastructure/`, `.github/workflows/`

## G11 · privacy-security-and-release-compliance
- **Severity:** medium
- **Description:** Produce a current threat/privacy model, minimize permissions and PII logs, verify GDPR deletion/export/retention, encrypt processor credentials, harden CI supply chain, and complete store privacy/data-safety declarations.
- **Blocks:** none
- **Blocked by:** none
- **Component:** `backend/src/services/GDPRService.ts`, `backend/src/models/PaymentProcessor.ts`, mobile manifests/services, `.github/workflows/`, release documentation

## G12 · design-system-and-ui-state-consolidation
- **Severity:** medium
- **Description:** Establish one governed token source and generation path, merge duplicate web primitives, map native themes, and require loading/empty/error/disabled/success, responsive, accessibility, and visual-regression evidence.
- **Blocks:** none
- **Blocked by:** none
- **Component:** `frontend/design-tokens.json`, `frontend/src/styles/`, `frontend/src/components/`, Android theme/screens, iOS theme/views

## G13 · documentation-information-architecture-and-truth
- **Severity:** medium
- **Description:** Classify 56 root documents and specs by authority/lifecycle, establish a small owned docs tree and index, reconcile readiness claims with live evidence, and archive superseded plans/reports with provenance.
- **Blocks:** none
- **Blocked by:** none
- **Component:** root `*.md`, `docs/`, `specs/`

## G14 · dead-code-generated-artifact-and-repository-cleanup
- **Severity:** low
- **Description:** Create a referenced/deprecation ledger, delete confirmed duplicate screens/components and runtime samples, remove tracked test outputs/config fixtures, consolidate legacy workflows, and enforce repository hygiene checks.
- **Blocks:** none
- **Blocked by:** none
- **Component:** repository-wide
