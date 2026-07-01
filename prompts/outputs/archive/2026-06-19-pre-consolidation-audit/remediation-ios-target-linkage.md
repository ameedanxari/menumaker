# Remediation Prompt — iOS Target Linkage

_Closes gap:_ G2 · ios-target-linkage

**Closes user story:** As an iOS Developer, I need the Customer target linked to core, so that I can build the app.
**Change type:** modify-existing
**File:** `ios/MenuMaker.xcodeproj/project.pbxproj`
**Depends on:** none
**Test:** Build the Customer scheme.
**Estimated LOC:** +50
**Phase:** foundation

## Context
iOS targets are not linked correctly.

## What to build
Fix `project.pbxproj` and `Package.swift` for Customer target linkage.

## Implementation guidance
- **File:** `ios/MenuMaker.xcodeproj/project.pbxproj` (modify)
- **Precise change:** Link `MenuMaker-Customer` to `MenuMakerCore`.

## Testing approach
- Build the project using `xcodebuild`.
