# Remediation Prompt — Backend Environment Validation

_Closes gap:_ G1 · backend-env-validation

**Closes user story:** As a Developer, I need the backend to validate environment variables at startup, so that missing configuration is caught early and clearly.
**Change type:** create-new
**File:** `backend/src/config/env.ts`
**Depends on:** none
**Test:** Rename .env, run npm run dev in backend; must exit 1 with error list.
**Estimated LOC:** +40
**Phase:** foundation

## Context
The backend currently lacks strict validation of environment variables at startup.

## What to build
Implement Zod-based environment validation.

## Implementation guidance
- **File:** `backend/src/config/env.ts` (create-new)
- **Precise change:** Define Zod schema, validate `process.env`, export `env` object.
- **File:** `backend/src/main.ts` (modify)
- **Precise change:** Import `env`, replace `process.env.*` with `env.*`.

## Testing approach
- Rename .env, run `npm run dev`. Acceptance: Process exits 1.
