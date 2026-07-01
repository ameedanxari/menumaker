# Task: Android Feature Parity Completion
_Gap: G4 · android-parity-audit_
**Change type:** create-new
**File:** android/app/src/main/kotlin/com/menumaker/ui/screens/menu/MenuScreen.kt
**Depends on:** none
**Test:** ./gradlew connectedCheck
**Estimated LOC:** +200
**Phase:** expand

## What to build
Implement missing Android screens for `/menu` and `/cart`.

## Implementation guidance
- Create `MenuScreen.kt` and `CartScreen.kt`.
- Use existing Jetpack Compose patterns found in `DashboardScreen.kt`.
- Update `NavGraph.kt` to expose the new screens.
