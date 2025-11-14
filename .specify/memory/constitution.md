# MenuMaker Project Constitution

## Guiding Principles

### 1. Code Quality & Maintainability
- **Type Safety**: Enforce TypeScript throughout (strict mode, no `any`).
- **Readability**: Clear naming, modular functions (< 50 lines each), comprehensive comments for business logic.
- **Testing**: Unit tests for logic (>70% coverage), contract tests for APIs, e2e for critical flows.
- **Linting**: ESLint + Prettier (consistent formatting; enforce on commit).

### 2. Testing Standards
- **Unit Tests**: Jest for business logic, utilities, service layers.
- **Contract Tests**: Verify OpenAPI compliance; test all request/response shapes.
- **Integration Tests**: Test workflows (e.g., seller onboarding → menu creation → order capture).
- **E2E Tests**: Playwright for critical user journeys (signup, menu publish, order place).
- **Acceptance Criteria**: Tests must validate MVP feature completeness, not just implementation details.

### 3. User Experience Consistency
- **Simplicity First**: Non-technical sellers must onboard in < 10 minutes with minimal configuration.
- **Sensible Defaults**: Pre-filled forms, one-click actions, inline help (tooltips/modals).
- **Mobile-First**: PWA responsive design; test on iOS Safari and Android Chrome.
- **Accessibility**: WCAG 2.1 Level AA (contrast, keyboard nav, screen readers for critical flows).
- **Error Messages**: Clear, actionable, non-technical language (no stack traces visible to sellers).

### 4. Performance & Reliability
- **Load Time**: First contentful paint < 2s on 4G; Lighthouse score > 90.
- **API Latency**: Most endpoints < 200ms (p95).
- **Uptime**: Target 99.5% (acceptable for MVP; escalate critical incidents < 1 hour).
- **Data Integrity**: No data loss on network failure; retry logic for async tasks (order notifications, OCR).
- **Image Optimization**: Lazy load, WebP where supported, resize on upload.

### 5. Security & Compliance
- **Auth**: JWT tokens (short-lived, refresh tokens for mobile); rate limit login attempts.
- **Data Privacy**: User/order data encrypted at rest; PII (phone, email) masked in logs.
- **HTTPS Only**: All communication encrypted; HSTS header set.
- **Input Validation**: Sanitize all user inputs server-side; reject oversized images/payloads.
- **Regulatory**: For MVP, support manual payments only; defer complex KYC/tax compliance to Phase 2+.

### 6. Development Velocity
- **Continuous Delivery**: Separate concerns (backend API, frontend UI); deploy independently.
- **Automation**: Linting, tests run on every PR; e2e smoke tests run pre-deploy.
- **Feedback Loop**: Metrics instrumented from day 1 (time-to-first-listing, order count, errors).
- **Iteration**: MVP scope is tight (onboarding, menu, orders, manual payouts); defer nice-to-have to later phases.

## Enforcement Gates

| Gate | Violation → Resolution |
|------|------|
| **Type Safety** | No TypeScript? PR blocks until fixed. |
| **Test Coverage** | < 70% unit coverage → PR review required + escalate if blocker. |
| **Performance** | Lighthouse < 90 → investigate, document tradeoff, or defer feature. |
| **Security** | No HTTPS or plaintext secrets in code → block deploy. |

## Recent Decisions
- Backend: Node.js + TypeScript (Fastify + Zod for validation) for fast iterations and type sharing with frontend.
- Frontend: React + TypeScript + PWA (Vite for fast HMR, TailwindCSS for rapid UI).
- Storage: S3-compatible (MinIO dev, AWS S3 prod) for images and social preview rendering.
- Database: PostgreSQL (managed via Heroku/Render initially).
- Auth: JWT + email/password; optional magic links in Phase 2.
- Payments: Manual payouts MVP; Stripe integration Phase 2.

## Key Trade-offs for MVP
- Complex i18n/RTL deferred to Phase 3 (English + one RTL language in Phase 2 if demand).
- Compliance/tax reporting deferred; focus on order tracking and basic CSV export.
- No integrated payments at launch (manual payment flow only).
- No advanced logistics; simple flat or distance-based delivery fee calculator.
