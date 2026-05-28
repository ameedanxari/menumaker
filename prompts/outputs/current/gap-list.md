# Exhaustive Production Readiness Gap List

## 1. Android Feature Parity (High Severity)
- **Description:** Implement missing `/menu` and `/cart` screens on Android to match iOS/Web.
- **Tasks:**
  - Create `android/app/src/main/kotlin/com/menumaker/ui/screens/menu/MenuScreen.kt`.
  - Create `android/app/src/main/kotlin/com/menumaker/ui/screens/cart/CartScreen.kt`.
  - Update `NavGraph` to include these screens.

## 2. iOS Target Linkage Resolution (Critical Severity)
- **Description:** Resolve `pbxproj` and `Package.swift` linkage for the Customer target.
- **Tasks:**
  - Manual review/edit of `ios/MenuMaker.xcodeproj/project.pbxproj` to add Customer target.

## 3. Infrastructure Stubbing (Medium Severity)
- **Description:** Provision robust IaC stubs that handle testing environments and assert production-readiness.
- **Tasks:**
  - Complete `infrastructure/main.tf` with conditional logic: if `env=production` and `aws_access_key` is missing, assert error.

## 4. End-to-End Integrated Validation (High Severity)
- **Description:** Create an E2E test suite covering the full user flow.
- **Tasks:**
  - Implement Web/API smoke test (Playwright).
  - Implement Mobile UI test (Appium/Compose Test).
