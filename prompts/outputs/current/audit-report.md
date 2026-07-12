# Audit Report

_Audited: 2026-07-11_
_Method: latest ai-prompt-library `c7039ba`; read-only fan-out across backend and clients; local Node/npm execution unavailable._

## Components

### `backend/`
- **Completion:** 65%
- **What works:**
  - Fastify registers broad auth, business, menu, order, payment, subscription, marketplace, review, notification, GDPR, admin, POS, delivery, coupon, referral, and reporting routes.
  - TypeORM entities model core ordering plus later payment, admin, promotion, integration, and compliance domains.
  - JWT secret presence/length is enforced and seller/admin middleware exists.
  - Unit tests cover core services, selected routes, middleware, coupons, reviews, and WhatsApp.
- **What is broken or missing:**
  - `npm run build` executes `tsc || exit 0`; TypeScript errors cannot fail local or CI builds, and `tsconfig.json` disables strictness, unused checks, fallthrough checks, and emit-on-error protection.
  - Production disables TypeORM synchronization and relies on one large initial migration; zero-to-current and upgrade validation are not evidenced, and schema/entity parity remains unproven.
  - Environment validation covers only six variables while payment, storage, email, OCR, POS, referrals, and messaging consume many unvalidated variables.
  - `POST /payments/mock-charge` is public and writes succeeded payment records; webhook raw-body capture is configured without a registered raw-body plugin, so signature verification is not proven (`SRC-001`, `SRC-002`).
  - JWT refresh tokens have no rotation, server-side revocation, token family, logout invalidation, or account-state recheck beyond user existence.
  - POS token refresh throws `not implemented`; analytics returns hard-coded uptime/error values; referral, QR, moderation, support-email, and tax calculations contain explicit stubs/TODOs.
  - Route/service/model files have accumulated compatibility aliases and private-repository access, obscuring domain boundaries.
- **Key files reviewed:**
  - `backend/src/main.ts` — monolithic plugin/route bootstrap with no raw-body registration and no dependency-injected app factory for integration tests.
  - `backend/src/config/env.ts` — narrow fail-fast schema omits most production integrations.
  - `backend/src/config/database.ts` — production relies on migrations that do not exist.
  - `backend/src/routes/payments.ts` — production Stripe and public mock payment behavior share a route module.
  - `backend/src/services/POSSyncService.ts` — multiple provider refresh paths are intentionally unimplemented.
  - `backend/src/services/AnalyticsService.ts` — operational metrics are placeholder values.
  - `backend/src/utils/jwt.ts` — signed access/refresh tokens share one secret and lack lifecycle state.
  - `backend/package.json` — build failure is intentionally swallowed.
  - `backend/jest.config.js` — coverage gate exists but excludes entity behavior and tests fewer than half of services.
- **Risks for production:**
  - Schema deployment, payment integrity, authorization lifecycle, and integration correctness are launch blockers.

### `frontend/`
- **Completion:** 70%
- **What works:**
  - React routing covers auth, seller dashboard/profile/menu/orders/reports/subscription, payment/payout/integration/coupon/referral pages, public menus, profile, settings, and customer orders.
  - Lazy loading, an error boundary, accessibility helpers, responsive utilities, dark mode, Tailwind tokens, component tests, store tests, and Playwright flows exist.
  - Stripe Elements components and API/store layers are present.
- **What is broken or missing:**
  - `authStore.ts` persists bearer access tokens through Zustand local storage; a single XSS can expose the token (`SRC-003`, `SRC-004`).
  - The API client is a large hand-written contract independent of shared schemas and native clients; drift cannot be detected at compile time.
  - Vitest coverage excludes nearly every page, layout, menu/subscription component, provider, modal/table/theme component, and complex form, so reported coverage does not represent primary flows.
  - Error monitoring is TODO-only and analytics can silently return null; no production observability integration is wired.
  - Two Button implementations (`components/common` and `components/ui`) and multiple token JSON copies create competing component/style authorities.
  - No admin portal route exists despite a large admin backend.
- **Key files reviewed:**
  - `frontend/src/App.tsx` — broad route map but no admin surface and only client-side auth gating.
  - `frontend/src/services/api.ts` — manually duplicates API paths and DTO assumptions.
  - `frontend/src/stores/authStore.ts` — persists the access token in browser storage.
  - `frontend/vitest.config.ts` — excludes the majority of user-facing functionality from coverage.
  - `frontend/playwright.config.ts` — starts only Vite; E2E reliability depends on external backend state.
  - `frontend/src/styles/tokens.css` and `frontend/tailwind.config.js` — useful theme primitives with unclear generation authority.
  - `frontend/src/components/common/Button.tsx` and `frontend/src/components/ui/Button.tsx` — duplicate primitives.
- **Risks for production:**
  - Credential theft, API drift, and misleading coverage can mask failures in checkout, seller operations, and account management.

### `android/`
- **Completion:** 55%
- **What works:**
  - Seller/customer flavors, Compose navigation, Retrofit, Hilt, Room, DataStore, WorkManager, Firebase, localization, repositories, ViewModels, unit tests, property tests, and UI/page-object tests are present.
  - Customer marketplace/menu/cart/order/payment/review/referral routes and seller dashboard/order/menu/integration routes are represented.
  - Offline DAOs and a background order sync worker exist.
- **What is broken or missing:**
  - `SellerViewModel.loadDashboardData()` does not load a business or domain data, statistics are TODO, and average rating always returns `0.0`.
  - Seller screens substitute hard-coded dishes/orders/reviews whenever repository state is empty, making empty/error states look successful.
  - Settings clear-cache/cart and help/legal navigation, profile/review image upload, and notification preference persistence are TODO-only.
  - Saved payment cards are hard-coded; production secure-storage integration is absent.
  - Token migration exists, but the current wrapper is reversible Base64 in ordinary preferences rather than Keystore-backed storage.
  - Retrofit methods/paths diverge from backend routes: PATCH versus PUT, `business_id` versus `businessId`, `/profile` versus `/auth/profile`, `/notifications/read-all` versus `/mark-all-read`, and nonexistent generic integration/analytics endpoints (`SRC-009`).
  - Duplicate `CartScreen` and `MenuScreen` files exist in competing packages; only one of each is navigated.
  - Repository cache conversion drops order items; sync submits partial order data and prints exceptions instead of classifying/retrying failures.
- **Key files reviewed:**
  - `android/app/build.gradle.kts` — flavors and extensive dependencies exist, with repeated release configuration and test-only endpoint defaults.
  - `android/app/src/main/kotlin/com/menumaker/ui/navigation/NavGraph.kt` — broad route map with duplicated/import-placement drift.
  - `android/app/src/main/kotlin/com/menumaker/data/remote/api/ApiService.kt` — hand-written contract conflicts with backend.
  - `android/app/src/main/kotlin/com/menumaker/viewmodel/SellerViewModel.kt` — primary seller dashboard load is a no-op.
  - `android/app/src/main/kotlin/com/menumaker/ui/screens/seller/SellerScreens.kt` — sample data is used as runtime fallback.
  - `android/app/src/main/kotlin/com/menumaker/data/local/datastore/TokenDataStore.kt` — credentials use plain preferences.
  - `android/app/src/main/kotlin/com/menumaker/data/repository/OrderRepository.kt` — cached orders lose item detail.
  - `android/app/src/main/kotlin/com/menumaker/workers/SyncWorker.kt` — partial payload and weak retry/error handling.
- **Risks for production:**
  - The seller app can appear populated while disconnected, mutating calls can fail with 404/405, and credential at-rest protection is insufficient.

### `ios/`
- **Completion:** 60%
- **What works:**
  - SwiftUI seller/customer role switching, broad screens, repositories/ViewModels, Keychain token storage, theme assets, localization, unit tests, UI tests, and fake API coverage exist.
  - The Xcode project now has separate Business/Customer app and UI-test targets/schemes.
- **What is broken or missing:**
  - Signed distribution, staging/live API validation, and real-provider smoke evidence are not present.
  - `Package.swift` declares targets without matching `Sources/<target>` structure and does not define application products; it is not a substitute for missing Xcode targets.
  - Historical target/scheme claims in this report are superseded by the current Xcode project layout.
  - `APIClient.swift` mixes production HTTP, token refresh, mutable test fixtures, unsafe generic casts, and approximately 1,300 lines of mock routing in one production source file.
  - iOS endpoint constants independently drift from backend paths (`businessOrders`, marketplace search, reviews, referrals, favorites, integrations, analytics) (`SRC-009`).
  - Menu photo upload remains placeholder-only and several UI tests validate mocks rather than backend compatibility.
  - `MenuMakerApp.swift` contains an obsolete embedded debugging task checklist in production source.
- **Key files reviewed:**
  - `ios/MenuMaker.xcodeproj/project.pbxproj` — Business/Customer app and UI-test targets are present.
  - `ios/MenuMaker.xcodeproj/xcshareddata/xcschemes/` — role-specific schemes are present.
  - `ios/Package.swift` — library target declarations do not align with repository layout or release packaging.
  - `ios/MenuMaker/Core/Services/APIClient.swift` — production and UI-test transports are coupled.
  - `ios/MenuMaker/Shared/Constants/AppConstants.swift` — hand-maintained path and product constants.
  - `ios/MenuMaker/App/MenuMakerApp.swift` — role switch works but test/reset concerns and stale task prose are embedded.
  - `ios/MenuMaker/Core/Services/KeychainManager.swift` — tokens are stored in Keychain.
- **Risks for production:**
  - Mobile deployment is guaranteed to reference missing schemes, and mock-heavy tests cannot prove server compatibility.

### `shared/`
- **Completion:** 35%
- **What works:**
  - Core User/Business/Dish/Menu/Order/Payout types and Zod schemas are exported.
  - Backend core routes/services reuse selected shared validation and input types.
- **What is broken or missing:**
  - Frontend does not depend on or import `@menumaker/shared`; native clients maintain unrelated models.
  - Newer domains—payments, subscriptions, coupons, marketplace, reviews, referrals, notifications, admin, POS, delivery, GDPR—are absent or partial.
  - Date-bearing TypeScript interfaces describe runtime `Date` objects even though JSON transports strings.
  - No OpenAPI/schema generation or contract conformance test connects routes to clients (`SRC-009`).
- **Key files reviewed:**
  - `shared/src/index.ts` — exports types, validation, and date utility only.
  - `shared/src/types/index.ts` — partial domain model and response vocabulary.
  - `shared/src/validation/*.ts` — validation is limited to core domains.
  - `shared/package.json` — build-only package with no tests or API generation.
- **Risks for production:**
  - Four divergent contracts make cross-platform regressions likely and parity work repetitive.

### `infrastructure/` and `.github/workflows/`
- **Completion:** 20%
- **What works:**
  - Docker Compose defines local PostgreSQL and MinIO.
  - CI, PR, nightly, smart-CI, and deploy workflows attempt backend/web/mobile coverage.
  - Terraform selects AWS as the intended provider.
- **What is broken or missing:**
  - Terraform references `./modules/backend` and `./modules/database`, which do not exist; variables and outputs files are empty.
  - `deploy.yml` performs automatic `terraform apply` from `main` without an explicit plan/approval boundary, then invokes nonexistent iOS schemes and contains only a comment for web deployment.
  - CI supplies `DB_HOST`/`DB_NAME` variables while the application requires `DATABASE_URL` and `FRONTEND_URL`; startup cannot be trusted.
  - Lint, tests, coverage, migrations, formatting, health checks, and other steps frequently use `|| echo`/`|| true`, converting failures into green builds.
  - Five overlapping workflows duplicate setup and gates; third-party actions are tag-pinned and workflow permissions are not explicitly minimized (`SRC-006`, `SRC-007`).
  - No rollback, artifact promotion, environment protection, secret manager integration, database backup/restore, metrics/alerts, or post-deploy verification is implemented.
- **Key files reviewed:**
  - `infrastructure/main.tf` — references absent modules.
  - `infrastructure/variables.tf` and `outputs.tf` — empty.
  - `docker-compose.yml` — usable local dependencies but default/public development credentials and bucket policy.
  - `.github/workflows/deploy.yml` — placeholder deployment and invalid iOS schemes.
  - `.github/workflows/ci.yml` and `pr-checks.yml` — important checks are fail-open.
  - `.github/workflows/nightly-e2e.yml` — migration/startup failures can be swallowed.
  - `.github/workflows/smart-ci.yml` — large overlapping workflow increases maintenance and drift.
- **Risks for production:**
  - There is no executable production deployment path or trustworthy required gate.

### Documentation and repository hygiene
- **Completion:** 30%
- **What works:**
  - Detailed feature guides, API/spec documents, platform reports, security analysis, and testing plans preserve substantial project knowledge.
  - `specs/001-menu-maker/` provides a more coherent requirements nucleus than root status reports.
- **What is broken or missing:**
  - Fifty-six Markdown files sit at repository root while `docs/` contains one file; navigation and ownership are unclear.
  - README, NEXT-STEPS, mobile status files, and completion summaries claim production readiness while current code and other reports list broken/missing functionality (`SRC-010`).
  - Historical audits, generated summaries, implementation plans, guides, and current operating docs are mixed without dates, owners, status, or authority labels.
  - Tracked backend test/coverage text outputs and `android/app/google-services.json` are repository noise; the Firebase file contains obvious test-project identities but still establishes a poor secret/config pattern.
  - Duplicate web primitives, Android screens, legacy workflows, stale in-source checklists, compatibility aliases, and runtime sample data lack a removal/deprecation ledger.
- **Key files reviewed:**
  - `README.md`, `NEXT-STEPS.md`, `MOBILE-APPS-STATUS.md`, `IMPLEMENTATION-READY.md` — conflicting readiness narratives.
  - `docs/UITest_Plan.md` — extensive missing/broken flow inventory.
  - `specs/001-menu-maker/` — detailed but not reconciled to implementation.
  - `backend/coverage_output.txt`, `backend/final_coverage.txt`, `backend/test_output.txt` — tracked generated output.
- **Risks for production:**
  - Engineers and operators cannot reliably identify current truth, causing duplicate work and unsafe release decisions.

## Cross-cutting concerns

### Test coverage
- **Unit tests:** strongest on Android structure; backend covers 14 test files against 35 services; frontend has 26 tests but excludes most primary UI; iOS has five unit-test files for sixteen ViewModels.
- **Integration tests:** backend route coverage is selective; no authoritative cross-client contract suite or migration-from-zero test exists.
- **E2E / UI tests:** many files exist, but web does not start its backend, iOS mostly routes through in-process mocks under XCTest, Android uses fakes, and no current environment could execute the native toolchains.
- **Verification environment:** Node/npm, Java, full Xcode, and Terraform were unavailable on this machine; build/test results are therefore unproven rather than failed, except statically impossible paths/schemes/modules.

### CI/CD
- Multiple overlapping workflows are fail-open; production Terraform and deploy definitions are incomplete and unsafe to treat as release automation.

### Observability
- Backend has structured Pino request logs and request IDs, but no metrics/tracing/alerting/SLO pipeline; analytics reports hard-coded operational values and mobile sync uses `printStackTrace`/`print`.

### Security
- Positive controls include Helmet, rate limiting, JWT secret validation, admin RBAC/2FA checks, iOS Keychain, and Stripe signature calls.
- Launch blockers include public mock payments, unproven webhook raw bodies, persistent web tokens, plain Android token storage, no refresh revocation, incomplete environment validation, unpinned CI actions, and absent least-privilege workflow permissions (`SRC-001`–`SRC-007`).

### Documentation
- The documentation corpus is valuable but lacks a single current source, lifecycle metadata, ownership, and archival boundaries.

### Design system and UI theme
- **Existing theme authority:** yes — web and both native clients have established theme sources.
- **Tokens and styling:** duplicate web token JSON/CSS/generated Tailwind files plus independent Android/iOS colors.
- **Component library:** competing web `common`/`ui` primitives and platform-local components; no governed cross-platform token contract.
- **UI risks:** sample data masks empty/error states, accessibility/state coverage is incomplete, and duplicated components can drift visually.

## Open questions
- Confirm single-versus-separate seller/customer mobile app packaging before target consolidation.
- Confirm production AWS topology, launch regions, and RPO/RTO before infrastructure planning is finalized.
- Confirm launch payment processors/markets and whether public cash/mock behavior must remain in non-production environments.
- Identify legally required documentation and retention records before dead-document deletion.
