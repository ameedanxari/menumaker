# Remediation Prompt — Design-System and UI-State Consolidation

_Closes gap:_ G12 · design-system-and-ui-state-consolidation

## Context

MenuMaker has an established orange/semantic theme on web, Android, and iOS, but the web holds duplicate token JSON/CSS/generated Tailwind sources, `components/common` and `components/ui` expose competing primitives, and native themes are maintained independently. Sample-data fallbacks and uneven state handling obscure empty/error behavior. This is a governance and consistency effort, not a redesign.

The static design-system review artifact remains the user-approval checkpoint for this consolidation plan.

## What to build

Establish one versioned platform-neutral token authority and deterministic web/Android/iOS generators, consolidate primitives around documented component contracts, create an HTML review artifact, require a complete state/accessibility matrix, and add visual/semantic drift gates while preserving current brand, typography intent, density, and navigation.

## Implementation guidance

## R1 · Define the canonical token schema
- **Closes user story:** As a designer and developer, I need one token authority, so that brand and semantic changes propagate consistently to every platform.
- **Change type:** modify-existing
- **File:** `frontend/design-tokens.json`
- **File:** `frontend/scripts/validate-tokens.cjs`
- **Precise change:** Make this the canonical source with versioned primitive/semantic/component layers for color, typography, spacing, radius, elevation, motion, breakpoint, focus, and state roles; preserve current orange/neutral/semantic palette; remove platform syntax and duplicate aliases; record deprecation/migration metadata.
- **Acceptance:** 
  - Every currently used web CSS/Tailwind, Android Material, and iOS asset/theme value maps to a canonical token or a documented platform exception.
  - Semantic contrast pairs satisfy WCAG AA (4.5:1 normal text, 3:1 large text/UI) in light and dark themes.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** none
- **Test:** `node frontend/scripts/validate-tokens.cjs frontend/design-tokens.json` validates schema, references, cycles, contrast, and required roles.
- **Estimated LOC:** +320
- **Phase:** foundation

## R2 · Generate web, Android, and iOS token outputs
- **Closes user story:** As a platform developer, I need deterministic generated theme files, so that manual copies cannot drift across releases.
- **Change type:** modify-existing
- **File:** `frontend/scripts/sync-tokens.cjs`
- **File:** `frontend/src/design-tokens.json`
- **File:** `frontend/src/styles/tokens.css`
- **File:** `frontend/tailwind-tokens.cjs`
- **File:** `android/app/src/main/kotlin/com/menumaker/ui/theme/GeneratedTokens.kt`
- **File:** `android/app/src/main/res/values/generated_colors.xml`
- **File:** `ios/MenuMaker/Shared/Theme/GeneratedTokens.swift`
- **File:** `ios/MenuMaker/Generated/DesignTokens/asset-colors.json`
- **Precise change:** Generate `frontend/src/styles/tokens.css`, `frontend/tailwind-tokens.cjs`, Android Compose `GeneratedTokens.kt`/resource colors, and iOS `GeneratedTokens.swift`/asset-color input from the canonical JSON; add generated headers/check mode/formatting, explicit dark-mode/system-appearance output, and a brand namespace proving a second brand can perform a config-driven brand swap without code changes; remove `frontend/src/design-tokens.json` after reference migration.
- **Acceptance:** 
  - Two generation runs are byte-identical and `--check` fails on manual generated-file edits.
  - Web/Android/iOS compile without hard-coded duplicate brand/semantic values outside approved exceptions.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R1 (canonical schema)
- **Test:** `node frontend/scripts/sync-tokens.cjs --check && bash scripts/design-system/check-drift.sh` exits 0 without relying on unrelated worktree diffs.
- **Estimated LOC:** +300
- **Phase:** foundation

## R3 · Consolidate web primitives and contracts
- **Closes user story:** As a frontend developer, I need one accessible component primitive per role, so that screens do not diverge through duplicate Button/Input/Card implementations.
- **Change type:** modify-existing
- **File:** `frontend/src/components/ui/index.ts`
- **Precise change:** Define canonical Button, Input, Select, Textarea, Card, Modal, Table, ThemeToggle, feedback, and state primitives with typed variants/sizes/slots; migrate consumers from `components/common/Button`; encode focus/loading/disabled/error semantics from generated tokens; deprecate then delete duplicates after import proof.
- **Acceptance:** 
  - Production source imports one Button authority and component variants contain no raw brand hex/spacing values.
  - Keyboard, focus restore/trap, accessible name/error, loading announcement, disabled behavior, and ref forwarding tests cover each interactive primitive.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R2 (generated tokens)
- **Test:** `npm run test:ci --workspace=frontend -- components/ui && npm run build --workspace=frontend` exits 0.
- **Estimated LOC:** +380
- **Phase:** foundation

## R4 · Create the visual UI-consistency review evidence
- **Closes user story:** As a product owner, I need a browsable component and token review, so that consolidation is approved before dependent screens change.
- **Change type:** create-new
- **File:** `docs/ui-consistency/review/index.html`
- **File:** `scripts/design-system/validate-review-artifact.mjs`
- **Precise change:** Build a static self-contained review showing token swatches/typography/spacing/radius/motion, web/native mappings, component variants, default/loading/empty/error/disabled/success states, light/dark, responsive widths, RTL, Dynamic Type/font scaling, keyboard/focus, screen-reader notes, contrast results, and links to current source/theme files with a non-redesign statement.
- **Reference Evidence:** Link existing product files `frontend/design-tokens.json`, `frontend/src/styles/tokens.css`, `android/app/src/main/kotlin/com/menumaker/ui/theme/`, and `ios/MenuMaker/Shared/Theme/ColorTheme.swift`; state that these local product sources are authoritative and external Mobbin/Figma research is not needed for this non-redesign consolidation.
- **Acceptance:** 
  - The artifact loads locally without a build server and has no missing assets/placeholder sections.
  - User-review checkpoint records approval/feedback before screen migration tasks proceed.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R3 (canonical component contracts)
- **Test:** `node scripts/design-system/validate-review-artifact.mjs docs/ui-consistency/review/index.html` verifies required sections, links, contrast table, and state matrix.
- **Estimated LOC:** +650
- **Phase:** foundation

## R5 · Standardize cross-platform UI state and accessibility
- **Closes user story:** As a user, I need consistent feedback for loading, no data, errors, disabled actions, and success, so that every platform remains understandable and operable.
- **Change type:** create-new
- **File:** `docs/design-system/state-matrix.yaml`
- **File:** `scripts/design-system/verify_state_matrix.py`
- **Precise change:** Define state semantics/copy/actions/live announcements for auth, public menu, cart/checkout, seller dashboard/menu/orders, payments, settings, and admin flows; map web components, Android Composables, and iOS Views; require 44pt/48dp targets, keyboard/focus order, VoiceOver/TalkBack labels, reduced motion, zoom/font scaling, RTL, and no color-only status.
- **Acceptance:** 
  - Every primary flow has default/loading/empty/error/disabled/success plus offline/pending where applicable, with one recovery action per error class.
  - Automated axe/Compose/XCTest checks plus manual keyboard/VoiceOver/TalkBack evidence report zero critical/serious violations.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R4 (reviewed design system)
- **Test:** `python3 scripts/design-system/verify_state_matrix.py docs/design-system/state-matrix.yaml frontend/src android/app/src/main ios/MenuMaker` exits 0.
- **Estimated LOC:** +300
- **Phase:** foundation

## R6 · Gate token, component, and rendered-visual drift
- **Closes user story:** As a maintainer, I need visual and semantic regression gates, so that later feature work cannot bypass the consolidated design system.
- **Change type:** create-new
- **File:** `scripts/design-system/check-drift.sh`
- **File:** `scripts/design-system/fixtures/token-regression.json`
- **File:** `scripts/design-system/fixtures/bad-state-matrix.yaml`
- **File:** `scripts/design-system/fixtures/bad-review.html`
- **Precise change:** Run token generation check, raw-value/import duplication scan, component/state coverage, axe-core/automated a11y checks, a 44x44 web/iOS and 48x48 Android touch-target audit, and light/dark/RTL visual-regression diffs for representative web, Android, and iOS seller/customer screens with deterministic fixtures and reviewed thresholds.
- **Acceptance:** 
  - Unreviewed token output, duplicate primitive, missing state, contrast regression, accessibility violation, or rendered-visual drift returns non-zero with platform/screen evidence.
  - Baseline updates require a linked design review and cannot run automatically in ordinary CI.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R5 (state matrix)
- **Test:** `bash scripts/design-system/check-drift.sh --fixtures scripts/design-system/fixtures` detects seeded token, import, state, contrast, and image regressions.
- **Estimated LOC:** +260
- **Phase:** foundation

## UI design constraints

- Existing theme authority is yes; preserve the orange brand palette, semantic roles, density, typography intent, and current web/tab navigation.
- External inspiration is not required for brand direction; source files are the reviewed evidence and must be linked in the artifact.
- Dashboard components must specify KPI, filter, chart, table, tooltip, and legend behavior plus default, loading, empty, error, disabled, and success states.
- No screen redesign or new component library is authorized.

## What NOT to do

- Do not hand-edit generated theme outputs or keep a second token JSON as a convenience copy.
- Do not consolidate components by removing accessibility, loading, or error semantics.
- Do not update visual baselines merely to make CI green.
