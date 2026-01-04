# Fake Backend (shared/mocks powered)

Lightweight HTTP server that serves `shared/mocks` as API responses for integration/UI testing and QA. Runs as a standalone Node process; no database or external deps.

## Run
```bash
# from repo root
FAKE_BACKEND_PORT=4000 npm run fake-backend:start
```
- Base URL: `http://localhost:4000/api/v1/` (iOS simulator)
- Android emulator: `http://10.0.2.2:4000/api/v1/`
- Status override: `?status=401` or header `x-mock-status: 401` (falls back to `shared/mocks/errors/{status}.json` if a resource-specific fixture is missing).

## Routes (seeded from shared/mocks)
- `POST /auth/login`
- `GET /auth/me`
- `GET /businesses`, `GET /businesses/:id`
- `GET /menus`, `GET /menus/:id`
- `GET /dishes`, `GET /dishes/:id`
- `GET /orders`, `GET /orders/:id`, `POST /orders` (in-memory create)
- `GET /coupons`, `POST /coupons/validate`
- `GET /reviews`, `POST /reviews` (in-memory create)
- `GET /notifications`
- `GET /favorites`
- `GET /marketplace`
- `GET /payments/processors`, `GET /payments/payouts`
- `GET /referrals/stats`, `GET /referrals/history`
- `GET /integrations`

Writes (orders/reviews) update in-memory data only; restart the server to reset state.

## Integration test helpers
- Android UI tests: `API_BASE_URL=http://10.0.2.2:4000/api/v1/ npm run test:android:fake`
- iOS UI tests: `API_BASE_URL=http://localhost:4000/api/v1/ npm run test:ios:fake`

These scripts start the fake backend and run the platform tests against it.

## QA / Debug menu guidance
- Android: build debug with `API_BASE_URL` set to the fake backend (or add a debug toggle to switch base URL at runtime).
- iOS: set `API_BASE_URL` env before launching, or add a debug settings toggle to override the base URL.
