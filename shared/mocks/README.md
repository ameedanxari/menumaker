# Shared API Fixtures

Centralized mock payloads for all platforms. Files are grouped by API and status code, using snake_case keys that mirror backend responses. Load these in tests instead of platform-specific fakes.

## Structure
- `shared/mocks/<resource>/<scenario>/<status>.json` for endpoint-specific payloads (e.g., `auth/login/400.json`).
- `shared/mocks/<resource>/<status>.json` for simple resources (e.g., `dishes/200.json`).
- Status files represent canonical responses: `200` (success), `400` (validation), `401` (unauthenticated), `404` (not found), `500` (server).

## Coverage (initial set)
- auth: `login {200,400,401}`, `me {200,401}`
- businesses: `list 200`, `detail {200,404}`
- menus: `list 200`, `detail {200,404}`
- dishes: `list 200`, `detail 404`
- orders: `list 200`, `detail {200,404}`
- coupons: `list 200`, `validate 400`
- reviews: `list 200`
- notifications: `list 200`
- favorites: `list 200`
- payments: `processors 200`, `payouts 200`
- marketplace: `list 200`
- referrals: `stats 200`, `history 200`
- integrations: `list 200`
- generic errors: `errors/{400,401,404,500}.json`

## Conventions
- Time values are ISO8601 UTC strings.
- Monetary fields are integer cents.
- Reuse IDs across resources where possible to keep relationships consistent (`business-1`, `dish-1`, `order-1`).
- Error payloads include `success: false`, `status`, `code`, and `message`.
