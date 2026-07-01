# Remediation Prompt — Frontend Design Token Sync

_Closes gap:_ G6 · frontend-design-token-sync

**Closes user story:** As a UI Developer, I need styling to be strictly derived from design tokens, so that I can maintain visual consistency across the app.
**Change type:** create-new
**File:** `frontend/scripts/sync-tokens.js`
**Depends on:** none
**Test:** Modify a color in design-tokens.json, run script; UI must update.
**Estimated LOC:** +80
**Phase:** foundation

## Context
Frontend styling drifts from `design-tokens.json`.

## What to build
Synchronization script to generate Tailwind theme and CSS variables from `design-tokens.json`.

## Implementation guidance
- **Sync Script:** Create `frontend/scripts/sync-tokens.js`. Read `design-tokens.json`, generate `tokens.css` and `tailwind-tokens.cjs`.
- **Tailwind Integration:** Modify `frontend/tailwind.config.js` to extend theme with generated `tailwind-tokens.cjs`.

## State Matrix
- **default:** Styling reflects design-tokens.json.
- **loading:** N/A.
- **empty:** N/A.
- **error:** Script exits 1 if JSON is malformed.
- **disabled:** N/A.
- **success:** Generated files match JSON values.

## UI Design Constraints
- **Authority:** `frontend/src/design-tokens.json`.
- **Reference:** All CSS in `mobile.css` must use `var(--color-...)`.
- **Note:** This task depends on the UI Reference Source Map.

## Testing approach
- **Command:** `node frontend/scripts/sync-tokens.js && npm run dev`
- **Acceptance Criteria:** `:root` variables must match JSON.
