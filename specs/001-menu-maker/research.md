# Research & Technical Decisions: MenuMaker MVP

**Input**: Feature spec + Implementation plan  
**Updated**: 2025-11-10

---

## Overview

This document captures research and justifications for key technical decisions made during MVP planning. All "NEEDS CLARIFICATION" from plan.md have been resolved below.

---

## 1. Backend Runtime & Framework

### Decision: Node.js 20 LTS + Fastify

**Rationale**:
- Node.js 20 LTS provides 18+ months of active support (until April 2026); stable for MVP production use.
- Fastify chosen over Express/Koa for:
  - 2–3× faster performance (relevant for image generation, CSV export under load)
  - Built-in validation plugin ecosystem (Zod integration)
  - Strong TypeScript support with clear types
  - Schema-driven API (OpenAPI schema generation)
  - Active community; many plugins for async tasks, auth, CORS

**Alternatives Considered**:
- Express: Slower but more mature ecosystem; chosen against for MVP velocity.
- Hapi: More heavy-weight; overkill for MVP scope.
- Python/FastAPI: Equally valid; Node chosen for faster iteration with TypeScript sharing between frontend/backend.

**Verification**: Fastify 4.x + TypeScript support confirmed on npm; examples with JWT auth + Zod exist.

---

## 2. Frontend Framework & Tooling

### Decision: React 19 + TypeScript + Vite + TailwindCSS + PWA

**Rationale**:
- React 19 newest stable version; good TypeScript support; large component library ecosystem.
- Vite: Fast build & HMR; PWA plugins available; significantly faster than Webpack/CRA.
- TypeScript: Type-safe components; easier refactoring; integrates with backend types.
- TailwindCSS: Rapid UI iteration; no CSS build overhead; built-in responsive + dark mode.
- PWA: No app store approval needed; works offline with service workers; installable on mobile.

**Alternatives Considered**:
- Vue/Nuxt: Comparable; React chosen for team familiarity (assumed).
- Native React Native: Deferred to Phase 2/3; web PWA sufficient for MVP discovery + order placement.
- Angular: Heavier; over-engineered for MVP.

**Verification**: React 19, Vite 5, TypeScript 5.x, TailwindCSS 3.x all stable and widely used.

---

## 3. State Management & API Communication

### Decision: React Query (TanStack Query) + Fetch API + Zod Validation

**Rationale**:
- React Query (v5) handles caching, re-fetching, deduplication; no manual Redux boilerplate.
- Fetch API: Built-in to modern browsers; lightweight; sufficient for MVP API calls.
- Zod: Runtime validation of API responses; catches schema mismatches early; shared with backend.

**Alternatives Considered**:
- Redux + Redux Thunk: More boilerplate; over-engineered for MVP scope.
- Apollo GraphQL: GraphQL not planned for MVP; REST OpenAPI simpler.
- RTK Query: Good but React Query more lightweight for MVP.

**Verification**: React Query well-documented; Zod widely adopted for runtime validation.

---

## 4. Database

### Decision: PostgreSQL 15+ (Managed Heroku/Render)

**Rationale**:
- Mature, reliable, widely supported.
- Managed instances (Heroku Postgres, Render Postgres) eliminate ops overhead at MVP stage.
- ACID compliance important for financial data (orders, payouts).
- Easy backups and migration to larger instances as scale grows.

**Alternatives Considered**:
- SQLite: Insufficient for multi-seller concurrency; no managed hosting simplicity.
- MongoDB: Schemaless risky for financial data; normalization needed for orders.
- Firebase/Firestore: Vendor lock-in; not cost-predictable for MVP.

**Verification**: Heroku Postgres and Render Postgres both proven for startups; TypeORM migration support confirmed.

---

## 5. ORM & Migrations

### Decision: TypeORM + Database Migrations (Flyway or TypeORM CLI)

**Rationale**:
- TypeORM provides type-safe entity definitions; repositories for queries; excellent TypeScript support.
- Migrations ensure schema versioning and rollback capability.
- TypeORM supports composite indexes, constraints, and complex queries for reporting (orders, CSV export).

**Alternatives Considered**:
- Prisma: Excellent DX; Schema definition is clean; code generation is fast. Could be considered if team prefers; TypeORM chosen for fine-grained control over indexes.
- Sequelize: More verbose; less TypeScript ergonomic.
- Raw SQL: Too error-prone for MVP pace.

**Verification**: TypeORM 0.3+ stable; Postgres adapter mature; many production examples.

---

## 6. Authentication

### Decision: JWT + Email/Password (Bcrypt) + Refresh Tokens

**Rationale**:
- JWT stateless; scales horizontally without session store.
- Email/password: Simple, no third-party dependency at MVP (no social login complexity).
- Bcrypt: Industry-standard, salted hashing; resistant to rainbow tables.
- Refresh tokens (7-day expiry) allow secure long-lived sessions for PWA without exposing access token.
- Short-lived access tokens (15 min) reduce damage from token theft.

**Alternatives Considered**:
- Session-based + Redis: Added complexity (Redis dependency); JWT simpler for MVP.
- OAuth/Google Sign-In: Adds complexity; manual email/password sufficient and more seller control.
- Magic Links: Good UX; deferred to Phase 2 (nice-to-have).

**Verification**: JWT standard (RFC 7519); Bcrypt (node-bcrypt) production-ready; examples with Fastify JWT plugin confirmed.

---

## 7. File Storage

### Decision: S3-Compatible Object Store (MinIO Dev, AWS S3 Prod)

**Rationale**:
- S3 API is industry standard; MinIO provides local drop-in replacement for dev.
- Decouples file storage from main DB; easier backups and CDN integration.
- Supports image resizing and optimization (via serverless or image worker in Phase 2).
- Cost-predictable at MVP scale.

**Alternatives Considered**:
- Store images in DB: Bloats DB; slow queries; bad for backups.
- Local filesystem: Not scalable once deployed to multiple servers.
- Cloudinary/Imgix: SaaS cost adds up; can integrate later for image optimization.

**Verification**: MinIO compatible with AWS S3 SDK; sharp.js for image resizing confirmed.

---

## 8. Validation Framework

### Decision: Zod (Runtime Validation)

**Rationale**:
- Zod schemas define data shape both for TypeScript types (via `z.infer<>`) and runtime validation.
- Error messages can be customized for non-technical users (e.g., "Phone must be 10–15 digits").
- Shared between backend (request validation) and frontend (form validation).
- Small bundle size; no build-time codegen overhead.

**Alternatives Considered**:
- Yup: Similar; Zod has better TypeScript integration and error customization.
- JSON Schema: More verbose; less ergonomic for TypeScript.
- Class-Validator (decorators): Heavier; overkill for MVP.

**Verification**: Zod 3.x stable; widely used in TypeScript projects; Fastify has plugin for request validation.

---

## 9. Testing Strategy

### Decision: Jest (Unit/Integration) + Playwright (E2E) + Contract Tests (OpenAPI)

**Rationale**:
- Jest: Fast, excellent TypeScript support, built-in mocking, good coverage reporting.
- Playwright: Reliable E2E; cross-browser (Chromium, Firefox, WebKit); mobile device emulation; screenshots on failure.
- Contract tests: Validate API schema against OpenAPI spec; catch breaking changes early.
- Coverage goal: >70% for unit/integration; smoke tests for E2E (not 100% coverage for MVP).

**Alternatives Considered**:
- Vitest: Faster than Jest; comparable; Jest chosen for maturity.
- Cypress: Good UX; Playwright chosen for better CI/CD integration and performance.
- Mocha + Chai: Too manual for MVP pace.

**Verification**: Jest, Playwright, and contract testing tools all production-ready. Examples with Fastify confirmed.

---

## 10. Hosting & Deployment

### Decision: Heroku/Render (MVP) → Cloud (AWS/GCP) at Scale

**Rationale**:
- Heroku/Render offer:
  - Managed Postgres + Redis (optional)
  - Built-in CI/CD (GitHub integration)
  - Predictable monthly costs ($50–200/month for MVP)
  - One-button deploy from GitHub
  - Auto-scaling as traffic grows
  - Zero DevOps overhead needed initially
- Platform supports Node.js and Docker workloads natively.
- Easy to migrate to AWS/GCP later if needed (containerized, standard stack).

**Alternatives Considered**:
- Self-hosted (EC2/DigitalOcean): Requires ops; not recommended for MVP.
- Vercel (frontend only): Good for frontend; no backend support.
- AWS ECS/Lambda: More complex; overkill for MVP; revisit at Phase 2.

**Verification**: Heroku and Render both proven for startup MVPs; pricing documented; deployment docs available.

---

## 11. Frontend Hosting

### Decision: Vercel or Same Backend (Static Files)

**Rationale**:
- Option A (Vercel): Separate frontend SPA; fast CDN; built-in Lighthouse CI.
- Option B (Same backend): Serve React build as static files from Fastify; simpler single deployment.
- For MVP: Option B simpler (no separate CI/CD); Option A better for scale.

**Recommendation**: Use Option B for MVP (simpler); migrate to Vercel/CDN in Phase 2 if needed.

**Verification**: Serving SPA from Fastify well-documented; example repos available.

---

## 12. Email Notifications

### Decision: SendGrid (Production) / Mailhog (Dev)

**Rationale**:
- SendGrid: Reliable email delivery; good API; free tier 100 emails/day (sufficient for MVP).
- Mailhog: Local dev mail server; no internet dependency; easy to view emails in browser.
- Async queues (Bull/RabbitMQ) deferred to Phase 2; synchronous email send sufficient for MVP.

**Alternatives Considered**:
- Twilio SendGrid: Same as SendGrid (Twilio acquired).
- AWS SES: Cheaper but reputation management harder; SendGrid simpler.
- In-house SMTP: Not recommended; blacklist risk.

**Verification**: SendGrid SDKs available for Node; Mailhog for local dev confirmed.

---

## 13. Image Processing

### Decision: Sharp.js (Server-Side) for MVP; Serverless (Phase 2)

**Rationale**:
- MVP: Sharp.js processes images on upload (resize to 800×600, compress to JPEG);
  stored in S3.
- Phase 2: Migrate to serverless (AWS Lambda + Sharp or Cloudinary) if load high.
- MVP server-side keeps architecture simple; no external API calls.

**Alternatives Considered**:
- Cloudinary: SaaS; costs add up at MVP scale.
- Serverless from day 1: Over-engineered; adds complexity (Lambda cold starts, etc.).
- Client-side (browser API): Quality control harder; some browsers don't support Canvas.

**Verification**: Sharp.js stable; performance benchmarks show < 100ms for typical image resize.

---

## 14. Social Preview Image Generation

### Decision: Sharp.js + HTML-to-Canvas (Temporary) / Puppeteer (Phase 2)

**Rationale**:
- MVP: Generate simple templated images (business name + top 2 dishes) using Sharp.js or html-to-image.
- Phase 2: Migrate to Puppeteer or headless browser for more complex designs.
- Templates: 1–3 pre-designed static templates (no design freedom initially).

**Alternatives Considered**:
- Figma API: Overkill; external API dependency.
- Canva: SaaS; not suitable for programmatic generation.
- ImageMagick: Legacy; Sharp.js preferred.

**Verification**: html-to-image and Sharp.js both support image generation; examples with Next.js/Node confirmed.

---

## 15. Real-Time Notifications (Phase 2+)

### Decision: Deferred; Polling for MVP

**Rationale**:
- MVP: Polling (fetch orders every 10 sec) sufficient; rare seller is glued to dashboard.
- Phase 2: WebSockets (Socket.IO or native WS) for real-time order updates.
- Email notifications more critical for MVP (push).

**Verification**: Will implement when needed based on seller feedback.

---

## 16. Payment Integration (Phase 2+)

### Decision: Manual Payouts (MVP); Stripe/PayPal (Phase 2)

**Rationale**:
- MVP: Manual payment configuration (bank transfer, UPI, cash) only; seller marks order paid.
- Phase 2: Integrate Stripe Connect or Razorpay for automated payments.
- Avoids PCI compliance burden; reduces initial complexity.

**Alternatives Considered**:
- Square, Adyen, etc.: Similar trade-offs; Stripe chosen for documentation + community.

---

## 17. CLI & Tooling

### Decision: npm scripts for build/test/deploy; GitHub Actions for CI/CD

**Rationale**:
- npm scripts: Standard, no additional tool installation needed.
- GitHub Actions: Free for public repos; native GitHub integration; YAML-based config.
- ESLint + Prettier: Enforce code style; easy to integrate in CI.

**Alternatives Considered**:
- Gulp/Grunt: Legacy; npm scripts sufficient.
- GitLab CI: Good but GitHub Actions more native for GitHub repos.
- Jenkins: Over-engineered for MVP.

**Verification**: ESLint, Prettier, GitHub Actions all standard tooling.

---

## 18. Logging & Monitoring (MVP Phase)

### Decision: Console Logging (Dev); Sentry (Production) for Errors

**Rationale**:
- MVP: Console logging sufficient for debugging in development.
- Production: Sentry for error tracking and alerting; free tier 5000 errors/month.
- Defer: APM (Application Performance Monitoring) and detailed metrics to Phase 2.

**Alternatives Considered**:
- DataDog, New Relic: Full APM; overkill for MVP cost.
- ELK Stack: Self-hosted; ops overhead.

**Verification**: Sentry SDK for Node and React available; free tier sufficient for MVP.

---

## 19. Internationalization (i18n) (Phase 2+)

### Decision: Deferred; English MVP; Structure for i18n

**Rationale**:
- MVP: English only; UI structure designed to support i18n (no hardcoded strings in components).
- Phase 2: Add one RTL language (Arabic or Hebrew) + Hindi for India market.
- Library choice: i18next or react-i18next (industry standard).

**Verification**: Will implement when market demand clear.

---

## 20. Infrastructure as Code

### Decision: Heroku/Render UI (MVP); Terraform (Phase 2)

**Rationale**:
- MVP: Manual Heroku/Render setup via web UI; documented in README.
- Phase 2: Terraform for reproducible infrastructure as code.

**Verification**: Heroku Terraform provider exists for future migration.

---

## Summary Table: Technology Stack

| Component | Choice | Rationale | Verified |
|-----------|--------|-----------|----------|
| Backend Runtime | Node.js 20 LTS | Fast iteration, TypeScript support | ✅ |
| Backend Framework | Fastify 4.x | Performance, validation ecosystem | ✅ |
| Frontend | React 19 + TypeScript | Type-safe, PWA support | ✅ |
| Build Tool | Vite 5 | Fast HMR, PWA plugins | ✅ |
| Styling | TailwindCSS 3 | Rapid UI iteration | ✅ |
| Validation | Zod | Runtime type safety, error messages | ✅ |
| ORM | TypeORM | Type-safe entities, migrations | ✅ |
| Database | PostgreSQL 15+ | Managed Heroku/Render | ✅ |
| Auth | JWT + Bcrypt | Stateless, secure | ✅ |
| Storage | S3 (MinIO dev) | Decoupled, scalable | ✅ |
| Testing | Jest + Playwright | Unit/E2E, reliable | ✅ |
| Email | SendGrid/Mailhog | Delivery, dev testing | ✅ |
| Image Processing | Sharp.js | Fast, flexible | ✅ |
| Hosting | Heroku/Render | Managed, cost-predictable | ✅ |
| CI/CD | GitHub Actions | Native, free | ✅ |
| Error Tracking | Sentry | Production errors | ✅ |
| **Phase 2+ Additions** | | | |
| Logging | Winston + Papertrail | Structured logs, Heroku-native | ✅ |
| Analytics | Firebase Analytics | Free, cross-platform | ✅ |
| Crash Monitoring | Firebase Crashlytics | 99%+ crash-free target | ✅ |
| API Versioning | Path-based (/api/v1/) | Zero-downtime, 12-month support | ✅ |
| Common Dishes | Pre-populated catalog | Reduce onboarding to <30 min | ✅ |
| Environments | Dev/Staging/Prod | Mobile debug menu | ✅ |
| Referral System | Cookie-based tracking | Reduce CAC to Rs. 150 | ✅ |
| **Phase 3 Additions** | | | |
| Admin Backend | React + RBAC | 70% ops reduction | ✅ |
| Design System | Storybook + Tokens | 80%+ component reuse | ✅ |

---

## Risks & Mitigation

| Risk | Mitigation |
|------|-----------|
| Sharp.js performance under load (image processing) | Profile early; migrate to serverless if needed (Phase 2) |
| JWT token expiry UX friction | Implement auto-refresh on 401; clear UX for re-login |
| S3 storage costs at scale | Monitor usage; migrate to CDN + lazy loading if needed |
| Email deliverability issues | Monitor Sentry; use Mailhog in dev; SendGrid reputation high |
| TypeORM query N+1 problems | Use eager loading, indexes; audit queries early |
| Heroku/Render scale limits | Monitor dyno usage; migrate to AWS at Phase 2 if needed |

---

## 21. Logging Infrastructure (Phase 2+)

### Decision: Winston + Papertrail (Heroku-optimized)

**Rationale**:
- Winston: Structured JSON logging with request ID tracing; PII masking built-in
- Papertrail: Heroku-native log aggregation (100MB/month free tier)
- Alternative: Datadog Logs (more expensive), CloudWatch (AWS only)
- Structured logging enables better debugging, security audit trails, and compliance

**Implementation**:
- Log levels: debug, info, warn, error
- Request ID tracing via middleware (track requests across services)
- PII masking: auto-redact email, phone, card numbers from logs
- Log rotation: 7-day retention in Papertrail (upgrade for longer)

**Phase**: Implemented in Phase 1 foundation, enhanced in Phase 2

**Specification**: See [logging-strategy.md](001-menu-maker/logging-strategy.md)

---

## 22. Analytics & Crash Monitoring (Phase 2+)

### Decision: Firebase Analytics + Firebase Crashlytics + Sentry (Backend)

**Rationale**:
- **Firebase Analytics**: Free, unlimited events, no sampling; cross-platform (web + mobile)
- **Firebase Crashlytics**: 99%+ crash-free target; automatic crash reports for mobile apps
- **Sentry**: Backend error tracking (Node.js); source maps support; release tracking
- Alternative: Amplitude (more expensive), Mixpanel (limited free tier)
- Firebase chosen for cost (free), simplicity (single SDK), and cross-platform support

**Event Taxonomy (20+ events)**:
- User events: `seller_signed_up`, `seller_logged_in`, `menu_published`
- Business events: `order_placed`, `payment_completed`, `dish_created`
- Referral events: `referral_link_clicked`, `referral_signup_completed`
- Engagement events: `feature_used`, `support_ticket_created`

**Success Metrics**:
- 99%+ crash-free rate (Crashlytics)
- 100% of critical user flows tracked (Analytics)
- <2 hour mean time to detect (MTTD) for production errors (Sentry)

**Phase**: Implemented in Phase 2

**Specification**: See [analytics-instrumentation.md](001-menu-maker/analytics-instrumentation.md)

---

## 23. API Versioning Policy (Phase 2+)

### Decision: Path-based versioning (/api/v1/, /api/v2/), zero-downtime deployment

**Rationale**:
- Path-based versioning: clear, explicit, easy to route (`/api/v1/users` vs. `/api/v2/users`)
- Zero-downtime: Run v1 and v2 in parallel during migration period (blue-green deployment)
- 12-month support policy: v1 supported for 12 months after v2 launch
- 6-month deprecation notice: email sellers 6 months before v1 sunset
- Alternative: Header-based versioning (e.g., `Accept: application/vnd.menumaker.v1+json`) - more complex

**Versioning Middleware**:
```typescript
export function versionMiddleware(req: Request, res: Response, next: NextFunction) {
  const versionMatch = req.path.match(/^\/api\/(v\d+)\//);
  const version = versionMatch[1] as 'v1' | 'v2';

  res.setHeader('X-API-Version', version);
  res.setHeader('X-API-Version-Latest', config.latestVersion);

  if (config.deprecated && config.sunsetDate) {
    res.setHeader('Sunset', new Date(config.sunsetDate).toUTCString());
  }
  next();
}
```

**Phase**: Implemented in Phase 2 (v1 baseline), Phase 3 (v2 for breaking changes)

**Specification**: See [api-versioning-policy.md](001-menu-maker/api-versioning-policy.md)

---

## 24. Common Dishes Catalog & Menu Categories (Phase 1)

### Decision: Pre-populated dish templates + user-defined categories

**Rationale**:
- **Problem**: Sellers spend 2+ hours manually entering 50+ dishes
- **Solution**: 200+ common dishes (Samosa, Biryani, Masala Dosa, etc.) with suggested prices, allergens
- **Quick-import workflow**: Seller selects dishes from catalog → customizes price/description → imports
- **User categories**: Sellers can create custom categories (e.g., "Appetizers", "Main Course", "Chef's Specials")
- **Impact**: Reduce onboarding time from 2+ hours to <30 minutes

**Data Model**:
```typescript
@Entity('common_dishes')
export class CommonDish {
  @Column({ type: 'varchar', length: 100 })
  name: string; // "Samosa", "Masala Dosa"

  @Column({ type: 'integer', nullable: true })
  min_price_cents: number; // Suggested price range (e.g., Rs. 20-30)

  @Column({ type: 'simple-array', nullable: true })
  default_allergens: string[]; // ["gluten", "dairy"]

  @Column({ type: 'integer', default: 0 })
  popularity_score: number; // 0-100 for sorting (most popular dishes first)
}

@Entity('dish_categories')
export class DishCategory {
  @Column({ type: 'varchar', length: 50 })
  name: string; // "Appetizers", "Main Course", "Desserts"

  @Column({ type: 'integer', default: 0 })
  sort_order: number; // Display order on menu

  @Column({ type: 'boolean', default: false })
  is_default: boolean; // Platform-provided categories (e.g., "Drinks")
}
```

**Phase**: Implemented in Phase 1 (critical for reducing onboarding friction)

**Specification**: See [common-dishes-catalog.md](001-menu-maker/common-dishes-catalog.md)

---

## 25. Environment Strategy (Dev/Staging/Prod) (Phase 1+)

### Decision: Three-tier (Dev → Staging → Prod), mobile debug menu

**Rationale**:
- **Dev**: Local development (localhost), feature branches, fast iteration
- **Staging**: Pre-production testing, mirrors prod config, smoke tests before deploy
- **Prod**: Production environment, high availability, monitoring
- **Mobile debug menu**: Dev builds allow environment switching via hidden debug menu (10-tap on logo)
- Alternative: Dev → Prod only (risky for breaking changes), Dev → Staging → Canary → Prod (overkill for MVP)

**Environment Variables**:
```bash
# .env.development
NODE_ENV=development
API_URL=http://localhost:3000
DATABASE_URL=postgresql://localhost:5432/menumaker_dev

# .env.staging
NODE_ENV=staging
API_URL=https://staging-api.menumaker.app
DATABASE_URL=postgresql://staging-db.render.com:5432/menumaker_staging

# .env.production
NODE_ENV=production
API_URL=https://api.menumaker.app
DATABASE_URL=postgresql://prod-db.render.com:5432/menumaker_prod
```

**Mobile Debug Menu**:
- React Native: 10-tap on logo reveals debug menu
- Allows switching between Dev, Staging, Prod API endpoints
- Displays: current environment, API version, build number, device info

**Phase**: Implemented in Phase 1 (dev/prod), enhanced in Phase 2 (staging added)

**Specification**: See [environment-strategy.md](001-menu-maker/environment-strategy.md)

---

## 26. Referral System Architecture (Phase 2)

### Decision: Cookie-based click tracking + referral code attribution

**Rationale**:
- **Problem**: Need to track viral growth, reduce CAC from Rs. 500-800 (paid ads) to Rs. 150 (referrals)
- **Solution**: Referral codes (e.g., `PRIYA2024`) with 7-day attribution window
- **Tracking funnel**: Link clicked → Cookie set → Signup → First menu published → Reward triggered
- **Fraud prevention**: IP/device fingerprinting, max 10 referrals/month, self-referral blocked

**Technical Implementation**:
- Cookie: `menumaker_referral_code=PRIYA2024` (7-day expiry, HttpOnly, Secure)
- Attribution: When user signs up, check cookie for referral code → link to referrer
- Reward: After first menu published, credit both referrer and referee (Rs. 500 or 1 month Pro)
- Database: `Referral` entity with `status` field (`link_clicked` → `signup_completed` → `first_menu_published`)

**Success Metrics**:
- 30% of signups via referral program (vs. 70% direct/ads)
- Viral coefficient k = 0.5-0.8 (each seller refers 0.5-0.8 new sellers)
- CAC reduction: Rs. 150 (referral) vs. Rs. 500-800 (paid ads)

**Phase**: Implemented in Phase 2

**Specification**: See [phase-2-referral-system.md](001-menu-maker/phase-2-referral-system.md)

---

## 27. Admin Backend Architecture (Phase 3)

### Decision: React admin UI + RBAC (Super Admin, Moderator, Support Agent)

**Rationale**:
- **Problem**: Cannot scale to 5,000 sellers without admin tools (user management, content moderation, analytics)
- **Solution**: Secure admin dashboard at `/admin` with role-based access control
- **Features**: User management (suspend/ban), content moderation queue, platform analytics, support tickets, feature flags, audit logs
- **Security**: 2FA mandatory, IP whitelist, 4-hour session timeout, immutable audit logs

**Tech Stack**:
- Frontend: React admin UI (reuses design system components)
- Backend: 25+ admin API endpoints (`GET /api/v1/admin/users`, `POST /api/v1/admin/users/{id}/suspend`)
- Database: `AdminUser`, `AuditLog`, `SupportTicket` entities
- Authentication: Separate admin JWT tokens (not shared with seller tokens)

**RBAC Roles**:
- **Super Admin**: Full access (user management, moderation, analytics, feature flags, audit logs)
- **Moderator**: Content moderation, view analytics, view users (no ban/suspend)
- **Support Agent**: Support tickets, view users (no ban/suspend/moderation)

**Success Metrics**:
- 70% reduction in manual ops work (vs. manual email/spreadsheet management)
- <2 hour avg content moderation response time
- 90%+ support tickets responded within 24 hours (SLA compliance)

**Phase**: Implemented in Phase 3 (Month 11, CRITICAL for scaling)

**Specification**: See [phase-3-admin-backend.md](001-menu-maker/phase-3-admin-backend.md)

---

## Decisions Deferred to Phase 2+

- Integrated payment processors (Stripe, PayPal, Razorpay)
- Real-time WebSocket notifications
- Advanced i18n (RTL, multiple languages)
- AI/OCR image parsing
- Customer accounts & repeat order history
- Delivery partner integrations
- Tax compliance & invoicing
- APM & detailed metrics
- Infrastructure-as-Code (Terraform)
- Advanced security (2FA, API keys for third-party access)

---

## Next Steps

1. **Validate this document** with team (any corrections or additions?)
2. **Use for task breakdown**: `/speckit.tasks` will reference these decisions.
3. **Code generation**: SpecKit will use these tech choices to scaffold backend + frontend.
4. **Setup local dev**: Clone, run `docker-compose up`, follow quickstart.md.
