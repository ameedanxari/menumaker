# Remediation Prompt — iOS Target, Transport, and Primary-Flow Consolidation

_Closes gap:_ G6 · ios-target-transport-and-primary-flow-consolidation

## Context

The Xcode project exposes only `MenuMaker`, `MenuMakerTests`, and `MenuMakerUITests`, while deployment and repository structure imply separate Business and Customer products/test suites. `Package.swift` does not match SwiftPM source layout. Production networking and approximately 1,300 lines of mutable UI-test response routing coexist in `APIClient.swift`, which lets mock success dominate test evidence and makes transport changes dangerous.

## What to build

Standardize on two thin app targets—MenuMaker-Business and MenuMaker-Customer—sharing one core source set and generated API transport; create matching schemes/test plans and bundle identities; split production, stub, and fixture transports behind protocols; finish media/payment flows; and run a smaller mock suite plus real fake-backend contract smoke tests.

## Implementation guidance

## R1 · Record the two-product packaging decision
- **Closes user story:** As a release manager, I need explicit iOS product ownership, so that signing, schemes, store records, and CI all refer to the same applications.
- **Change type:** create-new
- **File:** `docs/architecture/adr/0004-ios-business-customer-targets.md`
- **Precise change:** Select `MenuMaker-Business` (`com.creatrixe.MenuMaker.business`) and `MenuMaker-Customer` (`com.creatrixe.MenuMaker.customer`) app targets with shared Core/Data/Theme sources, target-specific entry points/assets/entitlements, matching UI-test targets, and a migration note from `com.creatrixe.MenuMaker`; deprecate the nonfunctional SwiftPM app-target claim.
- **Acceptance:** 
  - The ADR maps every source directory, asset catalog, entitlement, URL scheme, push environment, test target, and store record to shared/business/customer ownership.
  - Bundle-ID migration and keychain-access-group implications are explicit and require release-owner review before store upload.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** none
- **Test:** `rg -n "MenuMaker-Business|MenuMaker-Customer|com.creatrixe.MenuMaker.business|com.creatrixe.MenuMaker.customer|Keychain" docs/architecture/adr/0004-ios-business-customer-targets.md` finds every decision.
- **Estimated LOC:** +140
- **Phase:** mvp

## R2 · Create real application, test targets, and shared schemes
- **Closes user story:** As an iOS developer, I need Xcode targets that match release automation, so that both apps can compile, test, sign, and archive independently.
- **Change type:** modify-existing
- **File:** `ios/MenuMaker.xcodeproj/project.pbxproj`
- **File:** `ios/MenuMaker.xcodeproj/xcshareddata/xcschemes/MenuMaker-Business.xcscheme`
- **File:** `ios/MenuMaker.xcodeproj/xcshareddata/xcschemes/MenuMaker-Customer.xcscheme`
- **File:** `ios/MenuMaker/App/MenuMakerBusinessApp.swift`
- **File:** `ios/MenuMaker/App/MenuMakerCustomerApp.swift`
- **Precise change:** Add Business and Customer `PBXNativeTarget`s, target-specific SwiftUI `@main` files, Info/entitlement/build settings, shared source memberships, BusinessUITests and CustomerUITests targets, unit-test host configuration, and shared schemes/test plans; remove or repurpose the ambiguous MenuMaker app target only after migration compatibility is documented.
- **Acceptance:** 
  - `xcodebuild -list` reports both app and UI-test schemes, and each archive has the expected product/bundle identifier with no duplicate entry point.
  - Shared files compile once per target while customer-only/seller-only screens cannot leak into the other product's root navigation.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R1 (packaging/source ownership)
- **Test:** `cd ios && xcodebuild -project MenuMaker.xcodeproj -scheme MenuMaker-Business -destination 'generic/platform=iOS Simulator' build && xcodebuild -project MenuMaker.xcodeproj -scheme MenuMaker-Customer -destination 'generic/platform=iOS Simulator' build` exits 0.
- **Estimated LOC:** +500
- **Phase:** mvp

## R3 · Replace the invalid Swift package manifest with shared-core ownership
- **Closes user story:** As a maintainer, I need one valid dependency boundary, so that SwiftPM metadata does not falsely claim buildable targets.
- **Change type:** modify-existing
- **File:** `ios/Package.swift`
- **Precise change:** Either define a real `MenuMakerCore` target with explicit path/excludes and dependencies consumed by both Xcode apps, or delete the manifest if Xcode target membership remains authoritative; do not declare app libraries with absent `Sources/` directories.
- **Acceptance:** 
  - `swift package describe` succeeds when the manifest remains, and every declared target path exists.
  - Xcode and SwiftPM cannot compile competing copies of models/services with divergent build flags.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R2 (final target/source layout)
- **Test:** `cd ios && swift package describe` exits 0, or `test ! -f ios/Package.swift` confirms the reviewed removal path.
- **Estimated LOC:** ~80
- **Phase:** mvp

## R4 · Split production transport from mock fixtures
- **Closes user story:** As an iOS developer, I need injectable transports, so that production networking remains small and tests cannot accidentally ship mutable mock behavior.
- **Change type:** create-new
- **File:** `ios/MenuMaker/Core/Services/MenuMakerAPITransport.swift`
- **File:** `ios/MenuMakerTests/APITransportTests.swift`
- **Precise change:** Define an async protocol for generated G4 operations plus auth retry/cancellation; implement `URLSessionMenuMakerTransport` with typed status/error decoding, one bounded refresh retry, request IDs, redacted logging, and injected `URLSession`; move XCTest fixtures to test bundles and add `FixtureTransport`/`URLProtocolStub` outside production membership.
- **Acceptance:** 
  - Production sources contain no static mock coupons, unsafe `as! T`, endpoint string dispatcher, sleep-based fake latency, or XCTest environment detection.
  - Repositories receive a transport protocol and tests can assert exact request method/path/body without the network.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** remediation-authoritative-api-contract-and-client-generation.md (generated Swift transport models), R2 (target memberships)
- **Test:** `cd ios && xcodebuild test -project MenuMaker.xcodeproj -scheme MenuMaker-Business -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -only-testing:MenuMakerTests/APITransportTests` exits 0.
- **Estimated LOC:** +260
- **Phase:** mvp

## R5 · Reduce `APIClient` to a compatibility adapter and remove mock routing
- **Closes user story:** As a maintainer, I need one transport implementation, so that fixes are not duplicated across a monolithic client and generated operations.
- **Change type:** modify-existing
- **File:** `ios/MenuMaker/Core/Services/APIClient.swift`
- **File:** `ios/MenuMaker/App/MenuMakerApp.swift`
- **File:** `ios/MenuMaker/Data/Repositories/CartRepository.swift`
- **File:** `ios/MenuMaker/Data/Repositories/CouponRepository.swift`
- **File:** `ios/MenuMaker/ViewModels/CustomerCouponViewModel.swift`
- **File:** `ios/MenuMaker/Views/Customer/CouponBrowseView.swift`
- **Precise change:** Convert the class into a temporary adapter delegating to `MenuMakerAPITransport`, migrate repositories operation-by-operation, remove all `mock*Response` functions/static fixtures/unsafe generic casts, and delete the adapter after zero production references; preserve Keychain-based auth only through a dedicated session provider.
- **Acceptance:** 
  - The file is below 250 lines during compatibility and is deleted when migration completes.
  - A reference scan reports no production mock router and no repository creates `URLRequest` directly.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R4 (transport protocol and implementations)
- **Test:** `rg -n "mockResponse|mockCoupons|as! T|XCTestConfigurationFilePath" ios/MenuMaker --glob '*.swift'` returns no production matches.
- **Estimated LOC:** -1300
- **Phase:** mvp

## R6 · Complete image and payment flows against real boundaries
- **Closes user story:** As a seller or customer, I need media uploads and payments to use real services, so that visible controls complete their promised workflows.
- **Change type:** modify-existing
- **File:** `ios/MenuMaker/Shared/Constants/AppConstants.swift`
- **File:** `ios/MenuMaker/Views/Customer/ProfileView.swift`
- **File:** `ios/MenuMaker/Views/Customer/ReferralView.swift`
- **File:** `ios/MenuMaker/ViewModels/ReferralViewModel.swift`
- **File:** `ios/MenuMaker/Data/Models/ReferralModels.swift`
- **File:** `ios/MenuMaker/Views/More/MoreView.swift`
- **File:** `ios/MenuMaker/Data/Repositories/IntegrationRepository.swift`
- **File:** `ios/MenuMaker/ViewModels/IntegrationViewModel.swift`
- **File:** `ios/MenuMaker/ViewModels/ProfileViewModel.swift`
- **File:** `ios/MenuMaker/Views/Seller/MenuEditorView.swift`
- **File:** `ios/MenuMaker/Core/Services/ImageService.swift`
- **File:** `ios/MenuMaker/ViewModels/CustomerPaymentViewModel.swift`
- **File:** `ios/MenuMaker/Views/Customer/PaymentView.swift`
- **File:** `ios/MenuMakerTests/ImageServiceTests.swift`
- **File:** `ios/MenuMakerTests/PaymentViewModelTests.swift`
- **Precise change:** Wire PhotosPicker/camera permission education, image size/type validation, upload progress/cancel/retry, and backend media URLs through `ImageService`; replace saved-card mock assumptions in customer payment with provider-tokenized summaries and server-created intents; preserve loading/empty/error/disabled/success UI and never store PAN/CVV.
- **Acceptance:** 
  - Photo denial, oversize/type rejection, cancellation, retry, success, and server cleanup after abandoned upload are tested.
  - Payment cancellation/failure/pending/success and cash paths are verified through the secure G2 backend without client-authored success.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** remediation-payment-and-session-security-boundary.md (payment boundary), remediation-authoritative-api-contract-and-client-generation.md (generated media/payment operations), R4 (production transport)
- **Test:** `cd ios && xcodebuild test -project MenuMaker.xcodeproj -scheme MenuMaker-Customer -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -only-testing:MenuMakerTests/PaymentViewModelTests -only-testing:MenuMakerTests/ImageServiceTests` exits 0.
- **Estimated LOC:** +340
- **Phase:** mvp

## R7 · Add real-backend smoke tests per product
- **Closes user story:** As a release engineer, I need iOS tests that cross the HTTP boundary, so that passing fixture tests cannot conceal a broken production contract.
- **Change type:** create-new
- **File:** `ios/MenuMaker.xctestplan`
- **File:** `package.json`
- **Precise change:** Define separate unit/fixture and `RealBackendSmoke` configurations; launch the shared fake backend with canonical OpenAPI fixtures; cover Business login→menu update→order status and Customer login→browse→cart→order→payment-failure flows; collect screenshots/logs on failure and prohibit `UI-Testing` mock mode in the real configuration.
- **Acceptance:** 
  - Both app schemes execute their role journey through HTTP and fail when endpoint/method/response fixtures drift.
  - Unit tests remain fast and deterministic while the smoke configuration is independently required in CI.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R6 (completed primary flows)
- **Test:** `npm run test:ios:fake` exits 0 for both Business and Customer smoke configurations.
- **Estimated LOC:** +120
- **Phase:** mvp

## UI design constraints

- Existing product style is authoritative; the checked-in theme, assets, and tab structures are the design evidence for affected screens.
- Preserve `ColorTheme.swift`, asset colors, typography, tab structure, and existing visual density.
- Require default, loading, empty, error, disabled, offline/stale, and success states in affected screens.
- Maintain 44pt targets, VoiceOver labels/focus, Dynamic Type, reduced motion, RTL, and light/dark snapshots.
- Do not use a redesign to hide transport or target defects.

## What NOT to do

- Do not create raw project files from scratch; modify the checked-in project and verify with Xcode tooling.
- Do not leave UI-test routing or mutable fixture state in production target membership.
- Do not store card data or accept client-authored payment success.
