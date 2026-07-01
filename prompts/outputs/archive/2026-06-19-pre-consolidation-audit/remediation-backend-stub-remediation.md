# Remediation Prompt — Backend Stub Remediation

_Closes gap:_ G7 · backend-stub-remediation

**Closes user story:** As a Business Owner, I need Tax, Review, and Marketplace features to be functional, so that I can manage my business legally and reach customers.
**Change type:** modify-existing
**File:** `backend/src/routes/taxReports.ts`
**Depends on:** G1 (backend-env-validation)
**Test:** `npm test` in backend; services and routes must pass.
**Estimated LOC:** +400
**Phase:** expand

## Context
"Phase 3" routes are currently stubs.

## What to build
Implement core logic for Tax reporting, Review management, and Marketplace discovery services.

## Implementation guidance
- **Database Schema Updates:** Create `TaxReport.ts`, `Review.ts`, `MarketplaceListing.ts` in `backend/src/models/`.
- **Service Layer Logic:** Create `TaxService.ts`, `ReviewService.ts`, `MarketplaceService.ts` in `backend/src/services/`.
- **Route Implementation:** Modify `backend/src/routes/taxReports.ts`, `reviews.ts`, `marketplace.ts` to call services.

## Testing approach
- **Command:** `npm test`
- **Acceptance Criteria:** Unit tests for all 3 services must pass. Integration tests verify business rating updates on review submission.
