# Remediation Prompt — Android Parity Audit

_Closes gap:_ G4 · android-parity-audit

**Closes user story:** As an Android Developer, I need a feature parity audit and baseline UI tests, so that the Android app matches the Web/iOS experience.
**Change type:** create-new
**File:** `android/PARITY_AUDIT.md`
**Depends on:** none
**Test:** `./gradlew connectedCheck`
**Estimated LOC:** +150
**Phase:** expand

## Context
The Android application trails behind Web and iOS.

## What to build
Perform a deep-dive audit of `android/` against `frontend/` and `ios/`. Create `android/PARITY_AUDIT.md` and implement baseline UI verification tests.

## Implementation guidance
- **Audit Report:** Create `android/PARITY_AUDIT.md`. Map routes to screens, evaluate UI consistency with `frontend/src/design-tokens.json`.
- **Baseline UI Tests:** Implement `android/app/src/androidTest/java/com/menumaker/ui/ParityCheckTest.kt`. Verify key UI components.
- **Theme Sync:** Update `android/app/src/main/java/com/menumaker/ui/theme/Color.kt` to match design tokens.

## State Matrix
- **default:** Standard screen state.
- **loading:** Verify `CircularProgressIndicator` presence.
- **empty:** Verify empty state message.
- **error:** Verify error snackbar.
- **disabled:** Verify disabled state.
- **success:** Verify successful navigation.

## UI Design Constraints
- **Authority:** `frontend/src/design-tokens.json`.
- **Note:** This task depends on the UI Reference Source Map.

## Testing approach
- `./gradlew connectedCheck`
- **Acceptance Criteria:** `PARITY_AUDIT.md` comprehensive, UI tests pass on emulator.
