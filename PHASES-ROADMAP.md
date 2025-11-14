# MenuMaker: Complete Roadmap (Phases 0–3.5)

**Document**: PHASES-ROADMAP.md
**Date**: 2025-11-11 (Updated)
**Status**: Published for all stakeholders
**Scope**: MVP launch through 18-month scale-out vision

---

## Executive Overview

MenuMaker evolves from **MVP (Phase 1)** through **Growth (Phase 2)** to **Scale (Phase 3)** and **Mobile Apps (Phase 3.5)**, addressing market needs with comprehensive platform features:

| Phase | Timeline | Goal | Sellers | GMV/Month | Key Features |
|-------|----------|------|---------|-----------|--------------|
| **Phase 0** | Weeks 0–2 | Spec & Setup | — | — | Requirements, tech stack, local env |
| **Phase 1** | Months 0–2 | MVP Launch | 100 | Rs. 5L | Core menu, orders, manual payment, common dishes |
| **Phase 2** | Months 2–6 (+1 week) | Growth | 500 | Rs. 25L | Payments, WhatsApp, OCR, subscriptions, **referrals**, **GDPR foundation** |
| **Phase 3** | Months 6–14 (+8 weeks) | Scale | 5,000 | Rs. 500L | Multi-PSP, marketplace, **admin backend**, **reviews**, **content moderation**, **GDPR full**, **design system** |
| **Phase 3.5** | Months 14–18 | Mobile Apps | 10,000 | Rs. 1Cr | iOS/Android apps, **app review prompts**, deep linking |

**Total Timeline**: **18 months (78 weeks)** - Phases execute with strategic overlaps (Phase 2 starts Month 2, Phase 3 starts Month 6)
**Total Budget**: **Rs. 1,130L** (see detailed breakdown below) - Comprehensive 18-month investment covering development, infrastructure, marketing, legal compliance, and mobile apps

---

## Phase 0: Foundation & Spec (Weeks 0–2)

### Objective
Define product requirements, verify technology stack, set up local development environment, and create implementation blueprint for MVP.

### Key Deliverables
- ✅ Product specification (phase-1-spec.md)
- ✅ Technology research & decisions (research.md)
- ✅ Data model design (data-model.md)
- ✅ API contract (api.openapi.yaml)
- ✅ Acceptance test scenarios (quickstart.md)
- ✅ Local dev environment (Docker Compose + db migrations)
- ✅ Project constitution (governance + principles)

### Success Criteria (Phase 0)
- ✅ All 7 MVP user stories specified with acceptance criteria
- ✅ Tech stack rationale documented (20 decisions verified)
- ✅ API contract complete (30+ endpoints)
- ✅ Data model finalized (10 entities with schemas)
- ✅ Local dev setup working (docker-compose + migrations)
- ✅ Team aligned on MVP scope and non-negotiables

### What Gets Built
- Specification documents only (no code)
- All project decisions documented
- SpecKit-ready artifact bundle (~130 KB)

### What Doesn't Get Built
- No production code yet
- No mobile apps (deferred)
- No integrations (deferred)

### Estimated Timeline
- **Duration**: 2 weeks
- **Team**: 1 product owner + 1 tech lead (part-time)
- **Blocker**: None (all decisions documented)

### Next Gate
→ Proceed to Phase 1 if:
- ✅ Spec approved by stakeholders
- ✅ Tech stack approved by engineering
- ✅ Budget allocated (Phase 1–3 ~Rs. 50–100L dev cost)
- ✅ Team capacity confirmed (1–3 developers)

---

## Phase 1: MVP Launch (Months 0–2)

### Objective
Ship minimum viable product with core features (onboarding, menu creation, order capture, manual payment, basic reporting) to gain market traction and customer feedback.

### Key Features
| User Story | Status | Priority | Effort (days) |
|------------|--------|----------|---------------|
| US1: Seller onboarding | MVP | P1 | 5 |
| US2: Create & manage weekly menu | MVP | P1 | 6 |
| US3: Shareable public menu + social preview | MVP | P1 | 8 |
| US4: Order capture & checkout | MVP | P1 | 10 |
| US5: Basic reporting & order management | MVP | P1 | 5 |
| US6: Delivery rules & fee calculation | MVP | P1 | 4 |
| US7: Manual payment & payout | MVP | P1 | 4 |

**Total MVP Effort**: ~42 developer-days (6 weeks with 1 dev, 2 weeks with 3 devs)

### Tech Stack (Phase 1)
- **Backend**: Node.js 20 LTS + Fastify + TypeORM + PostgreSQL
- **Frontend**: React 19 + Vite + TailwindCSS + PWA
- **Testing**: Jest (unit/integration) + Playwright (e2e)
- **Hosting**: Heroku/Render (managed Postgres)
- **Storage**: MinIO (dev), AWS S3 (prod)
- **CI/CD**: GitHub Actions (push → test → deploy)

### Architecture (Phase 1)
```
┌─────────────────────────────────┐
│ React PWA Frontend              │
│ (Onboarding, Dashboard, Menu)   │
└──────────┬──────────────────────┘
           │ HTTPS API
           ▼
┌─────────────────────────────────┐
│ Fastify Backend (Node.js)       │
│ (Auth, Menus, Orders, Reporting)│
├─────────────────────────────────┤
│ PostgreSQL | S3 Storage | Email │
└─────────────────────────────────┘
```

### Success Metrics (Phase 1 Exit)
- ✅ 100 sellers onboarded (target: month 1 adoption)
- ✅ Time-to-first-listing < 10 minutes (avg user experience)
- ✅ 20% weekly repeat order rate (customer stickiness)
- ✅ Lighthouse score > 90 (desktop & mobile)
- ✅ API p95 latency < 200ms (performance baseline)
- ✅ 99% uptime (reliability target)
- ✅ All acceptance tests passing
- ✅ > 70% test coverage

### Out of Scope (Phase 1)
- ❌ Integrated payments (manual only; Phase 2)
- ❌ WhatsApp integration (Phase 2)
- ❌ Multi-language support (Phase 3)
- ❌ Marketplace (Phase 3)
- ❌ Advanced reporting (Phase 3)
- ❌ Mobile apps (deferred; PWA primary)

### Rollout Strategy (Phase 1)
1. **Week 1–2**: Setup + foundational infrastructure (DB, auth, API scaffold)
2. **Week 3–4**: Core features (onboarding, menu editor, public menu)
3. **Week 5–6**: Order flow + reporting (order capture, CSV export)
4. **Week 7**: Testing + polish (e2e, performance tuning, UX refinement)
5. **Week 8**: Staging deployment + smoke tests
6. **Week 9**: Beta user onboarding (10–20 sellers)
7. **Week 10**: Public launch (GA release)
8. **Weeks 11–12**: Monitoring + iteration based on feedback

### Launch Checklist (Phase 1)
- [ ] All 7 user stories fully implemented & tested
- [ ] Public menu loads in < 2s on 4G
- [ ] Email notifications working (order confirmation, payout info)
- [ ] CSV export validated (accurate order data)
- [ ] Mobile UX tested (responsive design, forms work on phone)
- [ ] Security audit passed (HTTPS, JWT validation, input sanitization)
- [ ] Performance benchmarks met (Lighthouse > 90, API p95 < 200ms)
- [ ] Seller documentation complete (onboarding guide, FAQ, support email)
- [ ] Analytics instrumented (track signups, time-to-listing, repeat order rate)
- [ ] Incident response plan documented (what to do if API down, DB issues)

### Estimated Timeline & Cost
- **Duration**: 10 weeks (2.5 months)
- **Team**: 1–3 developers, 1 designer (part-time)
- **Dev Cost**: Rs. 25–50L (depending on team size & rate)
- **Infrastructure Cost**: ~Rs. 20–30K/month (Heroku, S3, SendGrid)

### Next Gate
→ Proceed to Phase 2 if:
- ✅ 100+ sellers onboarded
- ✅ Launch metrics (repeat order rate, time-to-listing) met
- ✅ 0 critical bugs; all P1/P2 bugs resolved
- ✅ Seller feedback collected & analyzed
- ✅ Customer acquisition cost (CAC) < Rs. 100/seller
- ✅ No payment/security incidents

---

## Phase 2: Growth (Months 2–6 + 1 week, Parallel with Phase 1 Tail)

### Objective
Increase seller adoption (500 target) and revenue through payment integration, better onboarding (OCR), seller engagement (WhatsApp), and customer re-order features. Introduce freemium subscription model to monetize platform. **NEW**: Add viral growth through referrals and establish GDPR compliance foundation.

### Key Features
| User Story | Status | Priority | Effort (days) |
|------------|--------|----------|---------------|
| US2.1: WhatsApp notifications | Growth | P1 | 8 |
| US2.2: OCR menu import | Growth | P1 | 10 |
| US2.3: Templated legal copy + **GDPR foundation** | Growth | P1 | **7** (+3 days) |
| US2.4: Payment processors (Stripe) | Growth | P1 | 12 |
| US2.5: Tiered subscriptions | Growth | P1 | 10 |
| US2.6: Customer re-order | Growth | P2 | 6 |
| **US2.7: Referral system (NEW)** | **Growth** | **P1** | **4-5** |

**Total Phase 2 Effort**: ~58 developer-days (8–9 weeks with 1 dev, 3 weeks with 3 devs) - **+8 days from original**

### New Features Detail

#### US2.7: Referral System (Viral Growth Engine)
- **Goal**: Achieve 30% of new signups via referrals
- **Features**:
  - Seller referral codes (e.g., "PRIYA2024")
  - Shareable links (WhatsApp, SMS, Email, clipboard)
  - Referral tracking (click → signup → first menu published)
  - Rewards: 1 month Pro tier OR Rs. 500 account credit
  - Referral dashboard with stats and funnel analytics
- **API Endpoints**: 5 new endpoints (see phase-2-referral-system.md)
- **Success Metrics**: 30% signup rate via referrals, Rs. 150 CAC (vs Rs. 500 paid ads)
- **Specification**: [phase-2-referral-system.md](specs/001-menu-maker/phase-2-referral-system.md)

#### US2.3 Enhancement: GDPR Foundation
- **Added Features**:
  - Cookie consent banner (necessary, analytics, marketing categories)
  - "Delete my account" workflow (7-day grace period)
  - Privacy policy generator (auto-populate based on data collection)
  - Data retention policy (3 years orders, immediate profile deletion)
- **Success Metrics**: <24 hours deletion request processing
- **Specification**: See [COMPREHENSIVE-NEW-REQUIREMENTS.md](specs/COMPREHENSIVE-NEW-REQUIREMENTS.md#2-gdpr-compliance--privacy)

### Architecture Changes (Phase 2)
```
┌──────────────────────────────────┐
│ React PWA (Enhanced)             │
│ + OCR upload, re-order UI        │
└──────────┬───────────────────────┘
           │ HTTPS API
           ▼
┌──────────────────────────────────┐
│ Fastify Backend (Upgraded)       │
│ + Webhook handlers (Stripe)      │
│ + OCR service integration        │
│ + Subscription enforcement       │
│ + WhatsApp client                │
├──────────────────────────────────┤
│ PostgreSQL | S3 | Email | Stripe │
│ Webhooks   | WhatsApp | OCR API  │
└──────────────────────────────────┘
```

### Tech Stack Additions (Phase 2)
- **Payments**: Stripe SDK + Webhooks
- **WhatsApp**: Twilio WhatsApp Business API (or Stripe partner)
- **OCR**: Tesseract.js (browser) or Claude Vision API (server)
- **Subscriptions**: Stripe Billing (recurring charges)
- **Job Queue**: Bull (async tasks: emails, OCR, webhooks)

### Success Metrics (Phase 2 Exit)
- ✅ 500 sellers onboarded (5× MVP)
- ✅ 10% using WhatsApp integration (50 sellers)
- ✅ 30% using OCR import (150 sellers)
- ✅ 5% on paid subscription tier (25 sellers, Rs. 5K MRR)
- ✅ 15% repeat order rate (up from 20% baseline in MVP; dip expected due to new users)
- ✅ API p95 latency < 250ms (slight increase due to Stripe calls)
- ✅ Stripe processing 10% of orders by volume (rest manual)
- ✅ > 75% test coverage (up from 70%)

### Out of Scope (Phase 2)
- ❌ Multiple payment processors (Razorpay, PhonePe; Phase 3)
- ❌ Automated payouts (Phase 3)
- ❌ Marketplace (Phase 3)
- ❌ Review system (Phase 3)

### Rollout Strategy (Phase 2)
1. **Week 1–2**: Payment processor integration (Stripe setup + API, webhook handling)
2. **Week 3–4**: Subscription management (tier enforcement, billing, customer portal)
3. **Week 5**: WhatsApp integration (connect account, send notifications)
4. **Week 6**: OCR menu import (upload, parse, preview, import flow)
5. **Week 7**: Re-order feature + templated legal copy
6. **Week 8**: Testing + bug fixes
7. **Week 9**: Staging deployment + seller UAT
8. **Week 10+**: Phased rollout to Phase 1 sellers

### Estimated Timeline & Cost
- **Duration**: **17 weeks** (4+ months, parallel start @ Month 2) - **+1 week from original**
- **Team**: 1–2 developers, 1 product person (part-time)
- **Dev Cost**: **Rs. 18–28L** (incremental; Phase 1 engineers continue) - **+Rs. 3L from original**
- **Infrastructure Cost**: ~Rs. 50–70K/month (Stripe fees, WhatsApp API, OCR)

### Next Gate
→ Proceed to Phase 3 if:
- ✅ 500+ sellers onboarded
- ✅ Payment volume positive (10% of orders via Stripe)
- ✅ 25 sellers on paid subscription (recurring revenue active)
- ✅ Repeat order rate maintained/improved
- ✅ No payment disputes or security incidents
- ✅ Seller NPS > 7/10 (satisfaction)

---

## Phase 3: Scale (Months 6–14, +8 weeks extended)

### Objective
Expand marketplace to 5,000 sellers, enable multiple payment processors, implement advanced seller tooling (tax compliance, POS integrations, delivery partner support), and build customer discovery features. **NEW**: Build critical admin backend for platform management, implement content moderation & reviews, achieve GDPR full compliance, and establish comprehensive design system. Target Rs. 500L GMV/month.

### Key Features
| User Story | Status | Priority | Effort (days) |
|------------|--------|----------|---------------|
| US3.1: Multiple payment processors | Scale | P1 | 15 |
| US3.2: Automated tiered payouts | Scale | P1 | 10 |
| US3.3: Multi-language & RTL | Scale | P1 | 14 |
| US3.4: Advanced reporting + **GDPR full compliance** | Scale | **P1** | **22** (+10 days) |
| US3.5: Review workflow + **content moderation** | Scale | **P1** | **24** (+14 days) |
| US3.6: Marketplace & seller discovery | Scale | P2 | 16 |
| US3.7: POS integration (Square, Dine, Zoho) | Scale | P2 | 18 |
| US3.8: Delivery partner integration | Scale | P3 | 12 |
| US3.9: Promotions & coupons | Scale | P3 | 8 |
| **US3.10: Admin backend platform (NEW - CRITICAL)** | **Scale** | **P1** | **20-25** |
| **US3.11: Enhanced referral & viral features (NEW)** | **Scale** | **P2** | **8-10** |
| **US3.12: Design system & theming (NEW)** | **Scale** | **P1** | **12-15** |

**Total Phase 3 Effort**: ~175 developer-days (25 weeks with 1 dev, 6-7 weeks with 3 devs) - **+60 days from original (+8 weeks)**

### New Features Detail

#### US3.10: Admin Backend Platform (CRITICAL)
**Why Critical**: Cannot manage 5,000 sellers without admin tools

- **Features**:
  - User management (view, suspend, ban sellers/customers)
  - Content moderation queue (flagged reviews, offensive content)
  - Platform analytics dashboard (GMV, sellers, orders, uptime)
  - Support ticket system (basic CRM)
  - Feature flags management (enable/disable features by tier)
  - Audit logs (track all admin actions)
  - Role-based access control (Super Admin, Moderator, Support Agent)
- **Tech Stack**: React admin UI, same Node.js backend
- **Security**: 2FA mandatory, IP whitelist, 4-hour session timeout
- **API Endpoints**: 25+ admin endpoints
- **Success Metrics**: 70% reduction in manual ops work, <2 hour moderation response time
- **Specification**: [phase-3-admin-backend.md](specs/001-menu-maker/phase-3-admin-backend.md)

#### US3.5 Enhancement: Content Moderation & Reviews
**Original**: Basic complaint workflow
**Enhanced**: Full content safety + review system

- **Content Moderation**:
  - "Report offensive content" button (reviews, dishes, images)
  - Auto-hide after 3 flags
  - Admin moderation queue with approve/reject
  - Appeal process for false flags
- **Review System**:
  - Customer reviews (1-5 stars + written feedback)
  - Verified purchase badge
  - Seller responses to reviews
  - Testimonial collection for marketing
  - Review incentives (Rs. 50 credit for review)
- **App Store Compliance**: Required for iOS/Android approval
- **Success Metrics**: 30% review submission rate, >4.5 avg rating
- **Specification**: [COMPREHENSIVE-NEW-REQUIREMENTS.md](specs/COMPREHENSIVE-NEW-REQUIREMENTS.md#3-reviews--testimonials-system)

#### US3.4 Enhancement: GDPR Full Compliance
**Original**: Tax compliance and reporting
**Enhanced**: Complete GDPR compliance + tax

- **Added Features**:
  - Data portability (export all user data as JSON/CSV)
  - Right to be forgotten (complete data deletion)
  - Consent management (track all consents, allow withdrawal)
  - GDPR audit trail (who accessed what data)
  - Data processing agreements
- **Legal Requirements**: Required for EU expansion
- **Success Metrics**: <12 hours for data export/deletion requests
- **Specification**: [COMPREHENSIVE-NEW-REQUIREMENTS.md](specs/COMPREHENSIVE-NEW-REQUIREMENTS.md#2-gdpr-compliance--privacy)

#### US3.11: Enhanced Referral & Viral Features
**Extension of US2.7 from Phase 2**

- **New Features**:
  - Customer referrals (share favorite seller → both get discount)
  - Referral leaderboard (top referrers get monthly prizes)
  - Affiliate program (influencer tracking codes with commissions)
  - Social sharing incentives (Instagram story integration)
- **Success Metrics**: 40% signup via referrals (up from 30% Phase 2)
- **Specification**: See phase-2-referral-system.md (Future Enhancements section)

#### US3.12: Design System & Theming (NEW - FOUNDATION)
**Why Important**: Consistency across web + iOS + Android at scale

- **Deliverables**:
  - Design tokens (JSON): colors, typography, spacing, shadows
  - Component library (Storybook): 20+ reusable components
  - Figma design system (linked to code)
  - Brand guidelines (logo, voice, imagery)
  - Accessibility patterns (WCAG 2.1 AA compliance)
  - Dark mode strategy
  - Platform theming (iOS SwiftUI, Android Material You, Web Tailwind)
- **Benefits**: 50% faster design-to-code, 80%+ component reuse
- **Success Metrics**: Lighthouse accessibility score 100/100
- **Specification**: [COMPREHENSIVE-NEW-REQUIREMENTS.md](specs/COMPREHENSIVE-NEW-REQUIREMENTS.md#4-design-system--theming-guidelines)

### Architecture Changes (Phase 3)
```
┌──────────────────────────────────┐
│ React PWA (Enterprise)           │
│ + Marketplace, reviews, promos   │
│ + i18n, RTL layout               │
│ + Advanced reports               │
└──────────┬───────────────────────┘
           │ HTTPS API
           ▼
┌──────────────────────────────────┐
│ Fastify Backend (Scale-out)      │
│ + Multi-processor payout logic   │
│ + Marketplace search (Elasticsearch)
│ + POS integrations (Square, etc) │
│ + Delivery partner sync          │
│ + Tax invoice generation         │
│ + Review moderation              │
├──────────────────────────────────┤
│ PostgreSQL (sharded) | Redis     │
│ + S3 | Email | Stripe + others   │
│ + Razorpay, PhonePe, Paytm       │
│ + Square, Dine, Zoho APIs        │
│ + Delivery partner APIs          │
└──────────────────────────────────┘
```

### Tech Stack Additions (Phase 3)
- **Multi-processor**: Razorpay, PhonePe, Paytm SDKs + webhook handling
- **Search**: Elasticsearch (marketplace seller discovery)
- **Cache**: Redis (search, sessions, caching)
- **i18n**: react-i18next + translation files (Hindi, Tamil, Arabic, etc.)
- **POS**: Square SDK, Dine API, Zoho Inventory API
- **Delivery**: Swiggy, Zomato delivery partner APIs (if available)
- **Reporting**: Puppeteer (PDF generation for tax invoices)
- **Database**: PostgreSQL sharding by seller_id (if needed)

### Success Metrics (Phase 3 Exit)
- ✅ 5,000 sellers onboarded (10× MVP, 10× Phase 2)
- ✅ Gross Merchandise Volume (GMV): Rs. 500L/month
- ✅ 30% on paid subscription tier (1,500 sellers, ~Rs. 30L MRR recurring)
- ✅ Multiple payment processors: 70% of orders via integrated payments
- ✅ Marketplace: 10% of orders from discovery (vs. direct links)
- ✅ Review system: 30% of orders have reviews; avg seller rating 4.5/5 **[Updated]**
- ✅ 3+ POS integrations active; 50+ sellers using
- ✅ Advanced reporting: 80% of registered sellers generating tax reports
- ✅ RTL languages: 5% of sellers/customers using non-English
- ✅ API p95 latency < 150ms (improved from Phase 2)
- ✅ Lighthouse > 90 maintained (accessibility score 100/100) **[Updated]**
- ✅ 99.9% uptime (SLA for paid tiers)
- ✅ > 80% test coverage
- ✅ **Admin backend operational**: 70% reduction in manual ops work **[NEW]**
- ✅ **Content moderation**: <2 hour avg response time, <5% false positives **[NEW]**
- ✅ **GDPR compliance**: <12 hours for data export/deletion requests **[NEW]**
- ✅ **Design system adoption**: 80%+ component reuse across platforms **[NEW]**
- ✅ **Enhanced referrals**: 40% of new signups via referral program **[NEW]**

### Out of Scope (Phase 3)
- ❌ International expansion (EU, SE Asia; Phase 3.5+)
- ❌ Native mobile apps (iOS/Android; Phase 3.5+)
- ❌ AI-powered recommendations (Phase 3.5+)
- ❌ B2B marketplace (wholesale; Phase 3.5+)
- ❌ Influencer/affiliate program (Phase 3.5+)

### Rollout Strategy (Phase 3)
1. **Months 1–2** (Month 6–7 overall):
   - Multiple payment processors (Razorpay, PhonePe, Paytm)
   - Automated tiered payouts + settlement reconciliation
   - Tax invoice generation & GST compliance
   - **Design system foundation** (design tokens, component library)
2. **Months 2–3** (Month 8–9 overall):
   - Multi-language UI (English, Hindi, Tamil, Arabic)
   - RTL layout for Arabic/regional languages
   - Advanced reporting dashboard
   - **GDPR foundation** (cookie consent, data deletion API)
3. **Months 3–5** (Month 9–11 overall):
   - **Admin backend platform** (user management, moderation queue, analytics dashboard)
   - **Content moderation system** (flagging, auto-hide, appeal process)
   - **Review system** (customer reviews, seller responses, testimonials)
   - Seller discovery marketplace (search, filters, ratings)
   - Promotions & coupon system
4. **Months 5–6** (Month 11–12 overall):
   - POS integrations (Square, Dine, Zoho)
   - Delivery partner integration (Swiggy, Zomato if available)
   - **Enhanced referral features** (customer referrals, leaderboard, affiliate program)
5. **Months 6–7** (Month 12–13 overall):
   - **GDPR full compliance** (data portability, consent management, audit trail)
   - **Design system completion** (Figma integration, accessibility patterns, dark mode)
   - Performance optimization (Elasticsearch, caching, CDN)
6. **Month 8** (Month 14 overall):
   - Security audit (PCI Level 1)
   - GDPR compliance audit
   - Documentation & launch

### Estimated Timeline & Cost
- **Duration**: 32 weeks (8 months, parallel start @ Month 6) **[Updated +8 weeks]**
- **Team**: 2–4 developers, 1 product person, 1 DevOps engineer
- **Dev Cost**: Rs. 88-148L (major scaling phase) **[Updated +Rs. 48-68L]**
- **Infrastructure Cost**: ~Rs. 200–300K/month (multi-processor fees, POS APIs, marketplace search, CDN)

### Next Gate (Phase 3+)
→ Proceed to Phase 3.5 or expansion if:
- ✅ 5,000+ sellers onboarded
- ✅ GMV > Rs. 500L/month
- ✅ 30% monthly recurring revenue (MRR) from subscriptions
- ✅ 99.9% uptime maintained
- ✅ Profitability achieved (revenue > operating costs)
- ✅ Seller NPS > 8/10
- ✅ Market expansion opportunity validated (new geography/language)

---

## Phase 3.5: Mobile Apps (Months 14–18, 4 months)

### Objective
Launch native iOS and Android applications to enhance mobile user experience, enable app store distribution, and implement mobile-specific features like app review prompts, push notifications, and deep linking. Target 40% of sellers using mobile apps within 6 months.

### Key Features
| User Story | Status | Priority | Effort (days) |
|------------|--------|----------|---------------|
| US3.5.1: React Native iOS app | Mobile | P1 | 20 |
| US3.5.2: React Native Android app | Mobile | P1 | 18 |
| US3.5.3: App review prompts (StoreKit 2 / In-App Review) | Mobile | P1 | 3 |
| US3.5.4: Push notifications (Firebase Cloud Messaging) | Mobile | P2 | 8 |
| US3.5.5: Deep linking & social sharing | Mobile | P2 | 6 |
| US3.5.6: Offline mode (menu editing) | Mobile | P3 | 12 |
| US3.5.7: Camera integration (dish photos) | Mobile | P2 | 5 |
| US3.5.8: App store optimization & submission | Mobile | P1 | 8 |

**Total Phase 3.5 Effort**: ~80 developer-days (16 weeks with 1 dev, 4 months with 2 devs)

### New Features Detail

#### US3.5.3: App Review Prompts (CRITICAL for App Store Success)
**Implementation**: Native review prompts after meaningful usage

- **Trigger Conditions**:
  - After seller publishes their 3rd menu (verified engagement)
  - After receiving 10th order (successful business outcome)
  - After 30 days of app usage (sustained usage)
  - Never more than 3 times per year (Apple/Google guidelines)
- **Platform SDKs**:
  - iOS: StoreKit 2 `SKStoreReviewController.requestReview()`
  - Android: In-App Review API `ReviewManager.launchReviewFlow()`
- **Tracking**: Firebase Analytics event `app_review_prompted`, `app_review_submitted`
- **Target**: 50% of eligible users accept review prompt, >4.5 star avg rating
- **Specification**: [COMPREHENSIVE-NEW-REQUIREMENTS.md](specs/COMPREHENSIVE-NEW-REQUIREMENTS.md#5-mobile-app-review-prompts)

#### US3.5.4: Push Notifications
**Why Important**: Re-engagement and order notifications

- **Use Cases**:
  - New order received (real-time)
  - Menu published successfully
  - Payment received notification
  - Weekly engagement nudge ("Update your menu for weekend rush")
  - Promotional campaigns (Pro subscription offers)
- **Tech Stack**: Firebase Cloud Messaging (FCM) for both iOS/Android
- **Opt-in Required**: Requested after 1st menu published (contextual timing)
- **Target**: 60% opt-in rate, 25% notification open rate

#### US3.5.5: Deep Linking & Social Sharing
**Why Important**: Viral growth and customer acquisition

- **Deep Links**:
  - `menumaker://business/{businessId}` → Opens specific seller menu
  - `menumaker://referral/{code}` → Referral code signup flow
  - Universal links (iOS) + App Links (Android) for web → app handoff
- **Social Sharing**:
  - "Share Menu" button → Instagram Stories, WhatsApp, Facebook
  - Pre-filled message: "Check out my menu on MenuMaker! [link]"
  - Share referral code directly from app
- **Tech Stack**: React Native Deep Linking API, `react-native-share`
- **Target**: 20% of sellers share menu at least once

#### US3.5.6: Offline Mode
**Why Important**: Network reliability in India (inconsistent connectivity)

- **Offline Capabilities**:
  - View existing menus (cached locally)
  - Edit dish details (queued for sync)
  - Add new dishes (queued for upload)
  - View order history (last 100 orders cached)
- **Sync Strategy**: Background sync when online, conflict resolution (last-write-wins)
- **Tech Stack**: AsyncStorage, Redux Persist, background fetch
- **Target**: 95% sync success rate, <5 second sync time

#### US3.5.7: Camera Integration
**Why Important**: Faster dish photo uploads, better image quality

- **Features**:
  - Native camera capture (vs. web upload)
  - In-app image cropping and rotation
  - Batch upload (select multiple photos)
  - OCR dish name extraction (Phase 2 OCR integration)
- **Tech Stack**: `react-native-camera`, `react-native-image-crop-picker`
- **Target**: 80% of dishes have photos (vs. 60% on web)

### Architecture (Phase 3.5)
```
┌─────────────────────────────────────────┐
│ React Native iOS App                    │
│ + StoreKit 2 (app reviews)              │
│ + Universal Links                       │
│ + Push Notifications (APNs)             │
│ + Offline mode (AsyncStorage)           │
└──────────────┬──────────────────────────┘
               │ HTTPS API
               ▼
┌──────────────────────────────────────────┐
│ Fastify Backend (Existing from Phase 3) │
│ + Push notification service (FCM)       │
│ + Deep link routing                     │
└──────────────────────────────────────────┘
               ▲
┌──────────────┴──────────────────────────┐
│ React Native Android App                │
│ + In-App Review API                     │
│ + App Links                             │
│ + Push Notifications (FCM)              │
│ + Offline mode (AsyncStorage)           │
└─────────────────────────────────────────┘
```

### Tech Stack Additions (Phase 3.5)
- **Mobile Framework**: React Native (iOS + Android, 95%+ code sharing)
- **Navigation**: React Navigation 6.x
- **State Management**: Redux Toolkit (shared with web)
- **Offline Storage**: AsyncStorage, Redux Persist
- **Push Notifications**: Firebase Cloud Messaging (FCM)
- **Deep Linking**: React Native Deep Linking API
- **Camera**: react-native-camera, react-native-image-crop-picker
- **Social Sharing**: react-native-share
- **App Review**: Native modules (StoreKit 2, In-App Review API)
- **Analytics**: Firebase Analytics (shared with web)
- **Crashlytics**: Firebase Crashlytics (mobile-specific)

### Success Metrics (Phase 3.5 Exit)
- ✅ iOS app launched on App Store (live, approved)
- ✅ Android app launched on Google Play Store (live, approved)
- ✅ 40% of sellers using mobile apps (2,000+ active users)
- ✅ App Store rating >4.5 stars (both iOS/Android)
- ✅ App review prompt acceptance rate >50%
- ✅ Push notification opt-in rate >60%
- ✅ Deep link click-through rate >30% (referral links)
- ✅ Offline mode: 95%+ sync success rate
- ✅ Crash-free rate >99.5% (Firebase Crashlytics)
- ✅ App install-to-signup conversion >70%

### Rollout Strategy (Phase 3.5)
1. **Month 1** (Month 14 overall):
   - React Native setup (iOS + Android project scaffolding)
   - Core navigation and authentication screens
   - Menu management screens (view, edit, create)
   - API integration (reuse existing Phase 3 endpoints)
2. **Month 2** (Month 15 overall):
   - App review prompt implementation (StoreKit 2 / In-App Review)
   - Push notifications setup (FCM)
   - Camera integration and image upload
   - Deep linking setup
3. **Month 3** (Month 16 overall):
   - Offline mode implementation
   - Social sharing features
   - Beta testing (TestFlight for iOS, Google Play Internal Testing for Android)
   - Bug fixes and performance optimization
4. **Month 4** (Month 17 overall):
   - App Store submission (iOS App Store, Google Play Store)
   - App store optimization (screenshots, descriptions, keywords)
   - Launch marketing campaign
   - Post-launch monitoring and bug fixes

### Estimated Timeline & Cost
- **Duration**: 16 weeks (4 months, parallel start @ Month 14)
- **Team**: 2 mobile developers (React Native), 1 designer, 1 QA engineer
- **Dev Cost**: Rs. 30–50L
- **Infrastructure Cost**: ~Rs. 20–30K/month (Firebase free tier, Apple Developer $99/year, Google Play $25 one-time)
- **App Store Fees**: Apple Developer Program ($99/year), Google Play ($25 one-time)

### Next Gate (Phase 3.5+)
→ Proceed to Phase 4 (Expansion) if:
- ✅ 10,000+ sellers on platform (2× Phase 3 scale)
- ✅ GMV > Rs. 1,000L/month (2× Phase 3)
- ✅ Mobile apps: 5,000+ active users
- ✅ Profitability: 20%+ profit margin
- ✅ International expansion validated (1+ new country/language)
- ✅ Seller NPS > 8/10
- ✅ Customer NPS > 7/10

---

## Summary: Phase Dependency & Flow

```
Phase 0 (Spec)
    │
    ▼
Phase 1 (MVP) ─── Product Launch ─── Seller Feedback
    │
    ├─────────────────────────────────────────────────┐
    │                                                   │
    ▼ (Weeks 0–2)                                      ▼
Phase 2 (Growth)                                Phase 1 Iteration
    │ (Month 2–6)                                  (Month 2–4)
    │ + Referral System                           - Bug fixes
    │ + GDPR Foundation                           - Performance
    │                                              - Seller support
    │
    └─────────────────────────────────────────────────┘
    │
    ▼
Phase 3 (Scale)
    │ (Month 6–14, +8 weeks extended)
    │ + Admin Backend (CRITICAL)
    │ + Content Moderation & Reviews
    │ + GDPR Full Compliance
    │ + Design System
    │
    ▼
Phase 3.5 (Mobile Apps)
    │ (Month 14–18, 4 months)
    │ + iOS & Android Apps
    │ + App Review Prompts
    │ + Push Notifications
    │ + Deep Linking
    │
    ▼
Phase 4+ (Expansion)
    │
    ├─ International markets
    ├─ Advanced AI features
    ├─ B2B marketplace
    └─ Influencer/affiliate program
```

### Key Milestones

| Milestone | Phase | Timeline | Success Metric |
|-----------|-------|----------|----------------|
| Spec Complete | 0 | Week 2 | All docs approved |
| MVP Launch | 1 | Month 2 | 100 sellers onboarded |
| Payment Integration | 2 | Month 4 | 10% orders via Stripe |
| Referral System Live | 2 | Month 5 | 30% signups via referrals |
| 500 Sellers | 2 | Month 6 | Growth target met |
| Multi-Processor | 3 | Month 9 | 70% orders via processors |
| Admin Backend Live | 3 | Month 11 | 70% reduction in manual ops |
| Reviews & Moderation | 3 | Month 12 | 30% review submission rate |
| Design System Complete | 3 | Month 13 | 80% component reuse |
| 5,000 Sellers | 3 | Month 14 | Scale target met |
| iOS App Launch | 3.5 | Month 16 | Live on App Store |
| Android App Launch | 3.5 | Month 16 | Live on Google Play |
| Mobile App Success | 3.5 | Month 18 | 40% sellers using apps |
| Profitability | 3.5 | Month 18 | Revenue > Costs |

---

## Platform Consistency Across Phases

### Core Principles (All Phases)
- **Simplicity First**: Minimal configuration required; sensible defaults
- **Mobile-First**: PWA primary (responsive design for all features)
- **Trust**: Clear pricing, transparent fees, secure transactions
- **Speed**: < 2s page load, < 200ms API latency (scaled per phase)
- **Seller Success**: Onboarding < 10 min, support email, educational content

### Feature Parity
- **Menu Creation**: Identical UX across web/PWA (mobile and desktop)
- **Order Capture**: Same customer experience regardless of payment processor (Stripe vs. manual vs. Razorpay)
- **Reporting**: Dashboard features consistent; advanced reports added incrementally (Phase 3)
- **Settings**: All configuration in one dashboard; consistent language

### Scaling Considerations
- **Phase 1**: Single server OK (monolith)
- **Phase 2**: Load balancing needed (Fastify horizontal scale)
- **Phase 3**: Database sharding, Elasticsearch for search, Redis caching required

---

## Team Evolution

| Phase | Engineering | Product | Design | DevOps/Infra |
|-------|-------------|---------|--------|-------------|
| Phase 0 | 1 (lead) | 1 | — | 0.5 |
| Phase 1 | 1–3 | 1 | 1 (part-time) | 0.5 |
| Phase 2 | 1–2 | 0.5 | 0.5 | 0.5 |
| Phase 3 | 2–4 | 1 | 1 | 1 |

**Notes**: Team size estimates assume startup/bootstrap context (high autonomy, full-stack developers). For larger orgs, split into specialized backend/frontend/QA teams.

---

## Risk Mitigation by Phase

### Phase 1 Risks
- **Risk**: MVP features take longer than estimated
  - **Mitigation**: MoSCoW prioritization; defer nice-to-haves to Phase 2
- **Risk**: Scale issues (too many signups day 1)
  - **Mitigation**: Closed beta (100 sellers); gradual rollout; monitor API latency
- **Risk**: Security incident (data breach, payment fraud)
  - **Mitigation**: Pre-launch security audit; no card data stored (Stripe handles)

### Phase 2 Risks
- **Risk**: OCR quality poor (80% accuracy insufficient)
  - **Mitigation**: Manual correction flow; fallback to text paste
- **Risk**: WhatsApp API reliability (messages don't deliver)
  - **Mitigation**: Fallback to email notifications; retry logic
- **Risk**: Payment processor API changes (breaking changes)
  - **Mitigation**: Version API calls; monitor Stripe/processor changelogs

### Phase 3 Risks
- **Risk**: Marketplace search slow (many sellers, complex filters)
  - **Mitigation**: Elasticsearch for search; caching; CDN for images
- **Risk**: Payout complexity (multiple processors, different settlement terms)
  - **Mitigation**: Clear reconciliation reports; manual override if needed
- **Risk**: POS integration brittleness (3rd-party APIs unreliable)
  - **Mitigation**: Order stored locally; async sync; seller sees sync status

---

## Go-No-Go Criteria (Gate Between Phases)

### Phase 0 → Phase 1
- ✅ Spec approved by leadership
- ✅ Tech stack approved by engineering team
- ✅ Budget allocated (Rs. 25–50L dev)
- ✅ Team assembled (1–3 developers available)

### Phase 1 → Phase 2
- ✅ 100+ sellers onboarded (MVP launch successful)
- ✅ Repeat order rate 20% or better (product-market fit signal)
- ✅ Time-to-listing < 10 min (onboarding smooth)
- ✅ 0 critical security issues
- ✅ Seller NPS > 6/10

### Phase 2 → Phase 3
- ✅ 500+ sellers onboarded (5× MVP growth)
- ✅ 10% of orders via Stripe (payment integration working)
- ✅ 5% on paid subscription (monetization active)
- ✅ Repeat order rate ≥ 15% (stickiness improving)
- ✅ Seller NPS > 7/10
- ✅ Monthly burn rate < MRR (path to profitability visible)

### Phase 3 → Expansion (Phase 3.5+)
- ✅ 5,000+ sellers onboarded (scale achieved)
- ✅ Rs. 500L GMV/month (revenue target)
- ✅ 30% on paid subscriptions (recurring revenue > Rs. 30L MRR)
- ✅ Profitability achieved (monthly revenue > operating costs)
- ✅ 99.9% uptime maintained
- ✅ Seller NPS > 8/10
- ✅ Market expansion opportunity identified & validated

---

## Success Metrics Dashboard (Track Across Phases)

| Metric | Phase 1 Target | Phase 2 Target | Phase 3 Target | Phase 3.5 Target | Unit |
|--------|----------------|----------------|----------------|------------------|------|
| Sellers Onboarded | 100 | 500 | 5,000 | 5,000+ | Count |
| GMV (Gross Merchandise Value) | Rs. 5L | Rs. 25L | Rs. 500L | Rs. 500L+ | INR/month |
| Repeat Order Rate | 20% | 15%+ | 20%+ | 25%+ | % |
| Avg Time-to-Listing | < 10 min | < 5 min | < 2 min | < 1 min | Minutes |
| Paid Subscription % | — | 5% | 30% | 30%+ | % of sellers |
| Monthly Recurring Revenue | Rs. 0 | Rs. 1L | Rs. 30L | Rs. 30L+ | INR |
| API p95 Latency | < 200ms | < 250ms | < 150ms | < 150ms | Milliseconds |
| Lighthouse Score | > 90 | > 90 | > 90 | > 90 | Score |
| Uptime | 99% | 99% | 99.9% | 99.9% | % |
| Test Coverage | > 70% | > 75% | > 80% | > 80% | % |
| Seller NPS | > 6 | > 7 | > 8 | > 8 | Score |
| Payment Disputes | 0% | < 1% | < 0.5% | < 0.5% | % |
| **Mobile App Users** | — | — | — | **40%** | **% of sellers** |
| **App Store Rating** | — | — | — | **>4.5** | **Stars** |
| **Crash-Free Rate** | — | — | — | **>99.5%** | **%** |
| **Referral Signups** | — | **30%** | **40%** | **40%+** | **% of signups** |
| **Content Moderation Time** | — | — | **<2 hours** | **<2 hours** | **Avg response** |
| **Admin Ops Efficiency** | — | — | **70% reduction** | **70% reduction** | **vs. manual** |

---

## Budget Estimate (Phases 0–3.5, 18 months)

| Category | Phase 0 | Phase 1 | Phase 2 | Phase 3 | Phase 3.5 | **Total** |
|----------|---------|---------|---------|---------|-----------|----------|
| **Development** | Rs. 5L | Rs. 35L | Rs. 23L | Rs. 118L | Rs. 40L | **Rs. 221L** |
| **Infrastructure** | Rs. 5K | Rs. 50K | Rs. 150K | Rs. 2L | Rs. 30K | **Rs. 4.35L** |
| **Third-Party APIs** | — | Rs. 50K | Rs. 250K | Rs. 1L | Rs. 10K | **Rs. 4.1L** |
| **Legal/Compliance** | Rs. 2L | Rs. 2L | Rs. 5L | Rs. 15L | Rs. 5L | **Rs. 29L** |
| **Marketing/Growth** | — | Rs. 10L | Rs. 15L | Rs. 35L | Rs. 20L | **Rs. 80L** |
| **Contingency (10%)** | Rs. 1.2L | Rs. 9.7L | Rs. 7.1L | Rs. 17.1L | Rs. 6.5L | **Rs. 41.6L** |
| | | | | | | |
| **Phase Total** | **Rs. 13.2L** | **Rs. 106.7L** | **Rs. 150.4L** | **Rs. 588.1L** | **Rs. 271.5L** | **Rs. 1,129.9L** |
| **Cumulative** | **Rs. 13.2L** | **Rs. 119.9L** | **Rs. 270.3L** | **Rs. 858.4L** | **Rs. 1,129.9L** | — |

**Notes**:
- Development costs assume startup rates (Rs. 2–3L/month/dev; scales with team size)
- Infrastructure includes hosting (Heroku/Render), databases, storage, CDN
- Third-party APIs (Stripe, Razorpay, WhatsApp, OCR, FCM) pay-as-you-grow
- Legal/Compliance includes GST setup, terms drafting, security audit, GDPR compliance, app store fees
- Marketing includes seller acquisition, user research, community building, app store optimization
- Contingency at 10% for overruns or unforeseen challenges
- **Phase 3 increase**: Admin backend, content moderation, GDPR full compliance, design system (+Rs. 58L dev cost)
- **Phase 3.5 (NEW)**: Mobile apps (iOS + Android), app store fees, mobile-specific marketing

**ROI Projection** (Phase 3.5 end, Month 18):
- Annual GMV: Rs. 6,000L (Rs. 500L/month × 12)
- Platform fee: 1–2% of GMV = Rs. 60–120L/year
- Subscription revenue: Rs. 360L/year (Rs. 30L/month × 12)
- **Total Revenue**: Rs. 420–480L/year
- **Operating Cost**: ~Rs. 250L/year (team, infrastructure, marketing, app store fees)
- **Gross Profit**: Rs. 170–230L/year (40–48% margin)
- **Payback Period**: ~24–30 months (from Phase 1 launch)

---

## Conclusion

MenuMaker evolves from a simple MVP (Phase 1) into a comprehensive marketplace platform with native mobile apps (Phase 3.5) over 18 months, targeting 5,000 sellers, Rs. 500L monthly GMV, and 40% mobile app adoption. Each phase builds on previous learnings, de-risks assumptions, and adds features based on seller feedback and market demand.

**Key Success Factors**:
1. **Launch Phase 1 on time** (month 2) to validate PMF and gain early traction
2. **Gather seller feedback** after each phase to inform roadmap prioritization
3. **Maintain performance & reliability** as scale increases (caching, DB optimization, monitoring)
4. **Build trust through transparency** (clear pricing, secure payments, easy support)
5. **Celebrate milestones** (100 → 500 → 5,000 sellers → mobile apps launch) to maintain momentum
6. **Prioritize admin backend in Phase 3** - critical for scaling to 5,000 sellers without manual ops bottleneck
7. **Launch mobile apps by Month 18** - essential for user acquisition, retention, and app store visibility

**Critical Path Dependencies**:
- Phase 1 → Phase 2: Payment integration validates monetization model
- Phase 2 → Phase 3: Referral system reduces CAC, enabling faster seller acquisition
- Phase 3 → Phase 3.5: Admin backend must be operational before mobile app launch (content moderation for app store compliance)

**Next Steps**:
- ✅ Phase 0 (Spec) complete; approved by stakeholders
- → **Start Phase 1** with engineering team (code generation + implementation)
- → Track Phase 1 success metrics weekly
- → Plan Phase 2 features based on Phase 1 seller feedback (Month 1–2)
- → Begin admin backend planning in Month 5 (Phase 3 prep)

---

**Document Version**: 1.0  
**Last Updated**: 2025-11-10  
**Maintained By**: Product & Engineering Leadership  
**Review Frequency**: Monthly (update based on Phase progress)

