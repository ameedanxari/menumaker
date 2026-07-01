# Remediation Prompt — Authoritative API Contract and Client Generation

_Closes gap:_ G4 · authoritative-api-contract-and-client-generation

## Context

Fastify routes, the web `ApiClient`, Android Retrofit annotations, iOS endpoint constants/repositories, and `@menumaker/shared` currently form four manually maintained contracts. They disagree on HTTP methods, query names, paths, response wrappers, order statuses, integrations, analytics, and date types. Parity work cannot be reliable until one versioned contract becomes authoritative.

Where generated-client migration touches frontend behavior, existing product style is authoritative and affected surfaces must retain a state matrix for default, loading, empty, error, disabled, and success; this plan authorizes no visual redesign.

## What to build

Create and validate an OpenAPI 3.1 contract from explicit Fastify route schemas, standardize wire models and error/pagination/idempotency conventions, generate TypeScript/Kotlin/Swift clients into reproducible directories, adapt platform repositories behind stable interfaces, and gate every pull request on zero undocumented routes or generated-client drift.

## Implementation guidance

## R1 · Record API authority and compatibility policy
- **Closes user story:** As a client developer, I need one versioned API authority, so that all platforms implement the same behavior and compatibility rules.
- **Change type:** create-new
- **File:** `docs/architecture/adr/0003-api-contract-authority.md`
- **Precise change:** Select OpenAPI 3.1 generated from Fastify route schemas as authority; define `/api/v1`, snake_case wire fields, ISO-8601 UTC strings, integer minor currency units, canonical order/payment statuses, error envelope, pagination, idempotency keys, deprecation windows, and generated-client ownership.
- **Acceptance:** 
  - The ADR resolves every known method/path/query/status conflict listed in `audit-report.md`.
  - Breaking changes require `/api/v2` or a documented compatibility adapter and cannot be hidden in regenerated code.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** none
- **Test:** `rg -n "OpenAPI 3.1|snake_case|ISO-8601|minor|idempotency|deprecation|api/v1" docs/architecture/adr/0003-api-contract-authority.md` finds every rule.
- **Estimated LOC:** +130
- **Phase:** foundation

## R2 · Create a dependency-injected app factory with complete route schemas
- **Closes user story:** As a backend maintainer, I need routes to declare their wire contract, so that documentation and runtime validation cannot diverge.
- **Change type:** create-new
- **File:** `backend/src/app.ts`
- **Precise change:** Move Fastify construction/plugin/route registration from `main.ts` into `buildApp(dependencies, options)`; require JSON schemas for params/query/body/success/error on every route; register security schemes and version metadata; expose `app.swagger()` after routes; and make databases/providers injectable for contract/integration tests.
- **Acceptance:** 
  - Every registered `/api/v1` operation has an `operationId`, tags, request schema, success schema, and shared error responses.
  - Building the app with test dependencies does not open a port or initialize production providers.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R1 (wire-format policy)
- **Test:** `npm test --workspace=backend -- app-contract.test.ts --runInBand` finds zero undocumented operations.
- **Estimated LOC:** +420
- **Phase:** foundation

## R3 · Commit the canonical generated specification and drift check
- **Closes user story:** As a reviewer, I need a deterministic contract diff, so that API changes are visible before clients break.
- **Change type:** create-new
- **File:** `openapi/menumaker.v1.yaml`
- **Precise change:** Generate a stable, sorted OpenAPI document from `buildApp`, including auth, business, menu, dish, order, payment, subscription, payout, coupon, marketplace, review, referral, notification, settings, admin, POS, delivery, GDPR, OCR, media, and reporting operations; add descriptions for authorization and idempotency behavior without embedding secrets or server-specific URLs.
- **Acceptance:** 
  - Regeneration from an unchanged checkout is byte-for-byte identical.
  - A breaking-change detector rejects removed/renamed operations, required fields, enum values, or response shapes unless the API major version changes.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R2 (schema-complete app factory)
- **Test:** `npm run api:generate --workspace=backend && git diff --exit-code -- openapi/menumaker.v1.yaml && npm run api:breaking-check --workspace=backend` exits 0.
- **Estimated LOC:** +2200
- **Phase:** foundation

## R4 · Generate the TypeScript web/shared client
- **Closes user story:** As a web developer, I need generated request and response types, so that invalid API calls fail during compilation rather than in production.
- **Change type:** modify-existing
- **File:** `shared/package.json`
- **File:** `shared/src/index.ts`
- **File:** `shared/src/generated/api.ts`
- **File:** `package-lock.json`
- **File:** `frontend/src/utils/analytics.ts`
- **Precise change:** Add pinned OpenAPI TypeScript generation and validation scripts that emit `shared/src/generated/api.ts`; export wire DTOs and operation types; keep domain helpers hand-written outside the generated directory; and make `shared` a frontend dependency instead of duplicating response interfaces in `frontend/src/services/api.ts`. Preserve the frontend analytics service's compile-time public API while generated client types are introduced, including any named exports required by existing analytics tests.
- **Acceptance:** 
  - Generated files contain a header forbidding manual edits and are reproducible from `openapi/menumaker.v1.yaml`.
  - Frontend production code has zero manually written endpoint strings outside one generated-client adapter.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R3 (canonical OpenAPI document)
- **Test:** `npm run api:generate --workspace=shared && npm run build --workspace=shared && npm run build --workspace=frontend` exits 0 with no generated diff.
- **Estimated LOC:** +80
- **Phase:** foundation

## R5 · Replace Android's handwritten Retrofit contract
- **Closes user story:** As an Android developer, I need generated API models and methods, so that seller/customer flavors cannot drift from backend paths.
- **Change type:** modify-existing
- **File:** `android/app/build.gradle.kts`
- **File:** `android/app/src/main/kotlin/com/menumaker/ui/navigation/NavGraph.kt`
- **File:** `android/app/src/main/kotlin/com/menumaker/ui/screens/customer/CustomerScreens.kt`
- **File:** `android/app/src/main/kotlin/com/menumaker/ui/screens/customer/CartScreen.kt`
- **File:** `android/app/src/main/kotlin/com/menumaker/ui/screens/seller/SellerScreens.kt`
- **File:** `android/app/src/customer/kotlin/com/menumaker/ui/screens/customer/MyOrdersScreen.kt`
- **File:** `android/app/src/seller/kotlin/com/menumaker/ui/navigation/NavGraph.kt`
- **File:** `android/app/src/seller/kotlin/com/menumaker/ui/screens/seller/OrdersScreen.kt`
- **File:** `android/app/src/main/kotlin/com/menumaker/ui/debug/DebugMenuScreen.kt`
- **File:** `android/app/src/sharedTest/kotlin/com/menumaker/fixtures/SharedMockLoader.kt`
- **Precise change:** Add a pinned OpenAPI Kotlin generation task producing Retrofit/Gson sources under `build/generated/openapi`; wire generation before compilation; replace `ApiService.kt` and duplicate remote DTO ownership through repository adapters; keep Room/domain entities separate from wire DTOs; and fail build when the spec or generated output is stale. Preserve Android navigation and screen compilation while generated API sources are wired into the variant build, including repairing pre-existing syntax/import drift exposed by the mandatory seller/customer unit-test compile without changing UI behavior.
- **Acceptance:** 
  - PATCH/PUT, query names, notification paths, profile paths, integration paths, analytics paths, and status enums match the canonical spec.
  - Seller and customer unit tests compile against the same generated operation set with no copied endpoint annotations.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R3 (canonical OpenAPI document)
- **Test:** `cd android && ./gradlew openApiGenerate testSellerDebugUnitTest testCustomerDebugUnitTest` exits 0.
- **Estimated LOC:** +150
- **Phase:** foundation

## R6 · Replace iOS endpoint constants with generated transport models
- **Closes user story:** As an iOS developer, I need generated request/response types and paths, so that repositories cannot call backend routes that do not exist.
- **Change type:** create-new
- **File:** `ios/Scripts/generate-openapi-client.sh`
- **File:** `ios/MenuMaker/Generated/API/MenuMakerGeneratedAPI.swift`
- **Precise change:** Pin a Swift OpenAPI generator/runtime, generate transport code into `ios/MenuMaker/Generated/API`, verify a clean diff, and adapt repositories through a small `MenuMakerAPITransport` protocol while keeping SwiftUI domain/view models independent of generated structs.
- **Acceptance:** 
  - Business orders, marketplace, reviews, referrals, favorites, integrations, analytics, and status enums compile from the canonical spec.
  - The production target contains no mutable endpoint registry duplicated from `AppConstants.API.Endpoints`.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R3 (canonical OpenAPI document)
- **Test:** `cd ios && bash Scripts/generate-openapi-client.sh --check && xcodebuild -project MenuMaker.xcodeproj -scheme MenuMaker -destination 'generic/platform=iOS Simulator' build` exits 0.
- **Estimated LOC:** +180
- **Phase:** foundation

## R7 · Enforce cross-platform contract conformance
- **Closes user story:** As a release manager, I need contract checks across every client, so that one platform cannot ship against a stale server API.
- **Change type:** create-new
- **File:** `scripts/contracts/verify-all.sh`
- **Precise change:** Regenerate OpenAPI and all three clients in clean temporary directories, compare tracked/generated outputs, run an OpenAPI breaking-change check, compile adapter fixtures, and exercise a shared fake-server suite for auth, seller menu/order, customer checkout, payment, notification, and error/pagination envelopes.
- **Acceptance:** 
  - Any undocumented backend route or stale/generated client causes a non-zero exit naming the operation and platform.
  - The fake server validates request and response bodies against the same schema rather than maintaining another freehand mock contract.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R4 (TypeScript client), R5 (Android client), R6 (iOS client)
- **Test:** `bash scripts/contracts/verify-all.sh` exits 0 from a clean checkout.
- **Estimated LOC:** +320
- **Phase:** foundation

## What NOT to do

- Do not make generated DTOs the persistence/domain model or edit generated files by hand.
- Do not preserve divergent paths with silent client aliases; compatibility belongs at the server boundary and must be deprecated explicitly.
- Do not generate a schema from TypeScript interfaces alone; runtime routes and validation must be covered.
