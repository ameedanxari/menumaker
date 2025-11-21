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
