# Remediation Prompt — Payment and Session Security Boundary

_Closes gap:_ G2 · payment-and-session-security-boundary

## Context

Payment routes currently expose a public mock-charge operation that persists succeeded payments, webhook handlers may receive parsed objects instead of Stripe's exact signed bytes, and refresh tokens are stateless JWTs with no rotation or revocation. Web access tokens are persisted in browser storage and Android tokens use plain Preferences DataStore. Stripe must remain the card-data boundary; MenuMaker must store only provider tokens and non-sensitive payment metadata.

For frontend authentication and payment surfaces, existing product style is authoritative and the interaction contract must cover default, loading, empty, error, disabled, and success without exposing secret or processor data.

## What to build

Create a fail-closed payment ingress and session lifecycle: exact raw webhook bytes, event deduplication, test-only mock routes that cannot register in production, refresh-token families with rotation/reuse detection, browser HttpOnly cookie sessions, protected Android storage, and integration tests for replay, tampering, logout, and compromised refresh tokens.

## Implementation guidance

## R1 · Persist refresh-token families and revocation state
- **Closes user story:** As an account holder, I need stolen refresh tokens to become unusable, so that logout and token rotation actually end compromised sessions.
- **Change type:** create-new
- **File:** `backend/src/models/RefreshSession.ts`
- **File:** `backend/tests/RefreshSession.test.ts`
- **Precise change:** Add a TypeORM entity with `id`, `user_id`, `family_id`, `token_hash`, `created_at`, `expires_at`, `rotated_at`, `revoked_at`, `replaced_by_id`, `reuse_detected_at`, `user_agent_hash`, and `ip_prefix`; store only SHA-256/HMAC token hashes and index active family/user lookups.
- **Acceptance:**
  - No raw refresh token or bearer credential is persisted or logged.
  - A reused rotated token revokes its entire family and records `reuse_detected_at`.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** none
- **Test:** `npm test --workspace=backend -- RefreshSession.test.ts --runInBand` verifies issue, rotate, revoke, expiry, and reuse detection.
- **Estimated LOC:** +110
- **Phase:** foundation

## R2 · Separate access and refresh signing/lifecycle rules
- **Closes user story:** As a security engineer, I need independently scoped token types, so that an access token cannot be replayed as a refresh credential.
- **Change type:** modify-existing
- **File:** `backend/src/utils/jwt.ts`
- **File:** `backend/tests/jwt.test.ts`
- **Precise change:** Add `typ`, `jti`, `sid`, issuer, and audience claims; use distinct validated access/refresh secrets or asymmetric keys; make access verification reject refresh tokens; reduce access lifetime to 15 minutes; and expose hashing helpers without logging token contents.
- **Acceptance:**
  - `verifyAccessToken` rejects a validly signed refresh token and wrong audience/issuer.
  - Key/secret configuration shorter than 32 bytes or shared between token types fails startup.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R1 (session identifiers and family model)
- **Test:** `npm test --workspace=backend -- jwt.test.ts --runInBand` exercises type confusion, expiry, wrong key, and audience failures.
- **Estimated LOC:** +140
- **Phase:** foundation

## R3 · Rotate sessions through authentication routes
- **Closes user story:** As a user, I need refresh and logout endpoints to update server-side session state, so that old credentials cannot silently survive account actions.
- **Change type:** modify-existing
- **File:** `backend/src/services/AuthService.ts`
- **File:** `backend/src/routes/auth.ts`
- **File:** `backend/tests/auth-session-routes.test.ts`
- **Precise change:** Issue one-time opaque refresh credentials backed by `RefreshSession`, rotate atomically on `/refresh`, revoke the family on `/logout` and password change, set refresh credentials in `HttpOnly; Secure; SameSite=Strict` cookies for the web origin, and return bearer refresh tokens only for explicitly identified native clients.
- **Acceptance:**
  - Concurrent refresh attempts allow exactly one successor and revoke the family when the loser is replayed.
  - Logout, password change, user suspension, and user ban invalidate active families before returning success.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R2 (typed token primitives)
- **Test:** `npm test --workspace=backend -- auth-session-routes.test.ts --runInBand` covers web cookie and native token modes.
- **Estimated LOC:** +240
- **Phase:** foundation

## R4 · Register exact raw-body capture before payment routes
- **Closes user story:** As a seller, I need payment events accepted only when Stripe's signature matches the original bytes, so that forged or mutated events cannot alter orders.
- **Change type:** modify-existing
- **File:** `backend/src/main.ts`
- **File:** `backend/tests/webhook-raw-body.test.ts`
- **Precise change:** Refactor plugin order to register a Fastify raw-body mechanism before routes, enable it only for `/api/v1/payments/webhook` and `/api/v1/subscriptions/webhook`, retain a bounded Buffer/string of the exact bytes, and reject webhook startup when either signing secret is absent in staging/production.
- **Acceptance:**
  - JSON parsing never mutates the payload supplied to `stripe.webhooks.constructEvent`.
  - Raw bodies are capped to a documented size and are never included in request/security logs.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** none
- **Test:** `npm test --workspace=backend -- webhook-raw-body.test.ts --runInBand` proves whitespace/key-order mutations fail signature verification.
- **Estimated LOC:** +95
- **Phase:** foundation

## R5 · Make payment events idempotent and remove production mock success
- **Closes user story:** As a customer, I need duplicate or forged payment events to be harmless, so that I am charged and fulfilled exactly once.
- **Change type:** modify-existing
- **File:** `backend/src/routes/payments.ts`
- **File:** `backend/tests/payment-webhook.integration.test.ts`
- **Precise change:** Register `/mock-charge` only when `NODE_ENV=test` and `ENABLE_FAKE_PAYMENTS=true`; require authenticated test fixtures even then; persist Stripe event IDs with a unique constraint; lock the related payment/order during transitions; ignore already-processed events; and validate allowed monotonic status transitions and amount/currency/order metadata.
- **Acceptance:**
  - Production route enumeration contains no `/mock-charge` endpoint.
  - Replaying the same signed event returns 2xx without a second payment/order transition, while a mismatched amount or order ID fails closed and raises a security event.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R4 (exact raw-body capture)
- **Test:** `NODE_ENV=test ENABLE_FAKE_PAYMENTS=true npm test --workspace=backend -- payment-webhook.integration.test.ts --runInBand` exits 0.
- **Estimated LOC:** +260
- **Phase:** foundation

## R6 · Apply the same ingress guarantees to subscription webhooks
- **Closes user story:** As a subscriber, I need billing events processed once and in order, so that retries cannot create contradictory subscription access.
- **Change type:** modify-existing
- **File:** `backend/src/routes/subscriptions.ts`
- **File:** `backend/tests/subscription-webhook.integration.test.ts`
- **Precise change:** Consume the exact raw body, persist/deduplicate event IDs, retrieve the current Stripe object when event ordering is stale, enforce subscription/customer/business ownership, and acknowledge only after the local transaction commits.
- **Acceptance:**
  - Duplicate, out-of-order, invalid-signature, unknown-customer, and handler-failure cases have deterministic retry-safe responses.
  - Access-tier changes are committed atomically with the processed-event receipt.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R4 (exact raw-body capture)
- **Test:** `npm test --workspace=backend -- subscription-webhook.integration.test.ts --runInBand` exits 0 with reordered event fixtures.
- **Estimated LOC:** +190
- **Phase:** foundation

## R7 · Remove persisted browser bearer tokens
- **Closes user story:** As a web user, I need credentials protected from injected JavaScript, so that an XSS defect does not reveal a reusable session token.
- **Change type:** modify-existing
- **File:** `frontend/src/stores/authStore.ts`
- **File:** `frontend/src/stores/authStore.test.ts`
- **Precise change:** Remove `accessToken` from persisted Zustand state, use same-origin credentialed requests with the HttpOnly refresh/session cookie, keep any short-lived access token in memory only when required, rehydrate identity through `/auth/me`, and implement CSRF protection for cookie-authenticated mutations.
- **Acceptance:**
  - Browser local/session storage and IndexedDB contain no access token, refresh token, JWT, or session secret after login and reload.
  - Reload, refresh rotation, logout, expired session, CSRF failure, and concurrent-tab logout have automated tests.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R3 (web cookie session contract)
- **Test:** `npm run test:ci --workspace=frontend -- authStore.test.ts && npm run test:e2e --workspace=frontend -- auth.spec.ts` exits 0.
- **Estimated LOC:** +180
- **Phase:** foundation

## R8 · Protect Android credentials and migrate existing installs
- **Closes user story:** As an Android user, I need tokens stored with device-backed protection, so that a copied preferences file does not expose my account.
- **Change type:** modify-existing
- **File:** `android/app/src/main/kotlin/com/menumaker/data/local/datastore/TokenDataStore.kt`
- **File:** `android/app/src/test/kotlin/com/menumaker/data/local/datastore/TokenDataStoreTest.kt`
- **Precise change:** Move refresh credentials to Android Keystore-backed encrypted storage, keep access credentials memory-scoped where practical, add a one-time migration that deletes plain preference keys after verified transfer, use seller/customer flavor-specific aliases, and wipe credentials when decryption or rotation fails.
- **Acceptance:**
  - A fresh and upgraded installation contains no token plaintext in the DataStore preferences XML.
  - Tests cover migration, key invalidation, logout wipe, failed decrypt, and customer/seller alias isolation.
  - The task's named verification command is required in CI and returns non-zero with the owning file and actionable diagnostics on regression.
- **Depends on:** R3 (native refresh-session contract)
- **Test:** `cd android && ./gradlew testSellerDebugUnitTest testCustomerDebugUnitTest --tests '*TokenDataStore*'` exits 0.
- **Estimated LOC:** +210
- **Phase:** foundation

## What NOT to do

- Never store PAN, CVV, raw Stripe payloads, bearer tokens, or refresh credentials in logs or application tables.
- Do not treat client-supplied payment success, amount, currency, or processor IDs as authoritative.
- Do not preserve `/mock-charge` behind an undocumented runtime default; its absence in production must be testable.
