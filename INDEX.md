# MenuMaker Project Index

**Date**: 2025-11-12
**Status**: ✅ **Specifications Ready for Development**

---

## 📚 Quick Start (5 minutes)

### **For Developers using SpecKit**
```bash
cd /Users/macintosh/Documents/Projects/MenuMaker
specify tasks    # Generate implementation tasks
specify implement # Start implementation
```

### **Essential Reading Order**
1. [`CONTEXT.md`](./CONTEXT.md) — Product vision (5 min)
2. [`specs/001-menu-maker/phase-1-spec.md`](./specs/001-menu-maker/phase-1-spec.md) — Phase 1 MVP features (10 min)
3. [`specs/001-menu-maker/plan.md`](./specs/001-menu-maker/plan.md) — Tech stack & architecture (10 min)
4. [`specs/001-menu-maker/data-model.md`](./specs/001-menu-maker/data-model.md) — Database design (15 min)

---

## 📁 Project Structure

### **Root Level**
- [`CONTEXT.md`](./CONTEXT.md) — Original product vision with Phase 3 admin backend rationale
- [`IMPLEMENTATION-READY.md`](./IMPLEMENTATION-READY.md) — Executive summary & success metrics
- [`PHASES-ROADMAP.md`](./PHASES-ROADMAP.md) — Complete 18-month roadmap (Rs. 1,130L budget)
- [`.specify/memory/constitution.md`](./.specify/memory/constitution.md) — Project principles

### **Phase 1: MVP (Months 0-2)**
Location: `specs/001-menu-maker/`

**Core Specifications:**
- [`phase-1-spec.md`](./specs/001-menu-maker/phase-1-spec.md) — 7 user stories with acceptance criteria
- [`data-model.md`](./specs/001-menu-maker/data-model.md) — Complete data model (all phases included)
- [`plan.md`](./specs/001-menu-maker/plan.md) — Technical architecture, stack decisions
- [`quickstart.md`](./specs/001-menu-maker/quickstart.md) — Acceptance scenarios & smoke tests

**API Contracts:**
- [`contracts/api.openapi.yaml`](./specs/001-menu-maker/contracts/api.openapi.yaml) — Phase 1 REST API (30+ endpoints)
- Note: `/ocr/parse` endpoint returns 501 (stub only in Phase 1)

### **Phase 2: Growth (Months 2-6)**
Location: `specs/001-menu-maker/`

**Core Specifications:**
- [`phase-2-spec.md`](./specs/001-menu-maker/phase-2-spec.md) — 7 user stories (WhatsApp, OCR, payments, subscriptions, GDPR foundation, re-order, referrals)
- [`phase-2-referral-system.md`](./specs/001-menu-maker/phase-2-referral-system.md) — Detailed referral system spec
- [`GDPR-COMPLIANCE-SUMMARY.md`](./specs/001-menu-maker/GDPR-COMPLIANCE-SUMMARY.md) — GDPR implementation guide

**API Contracts:**
- [`contracts/phase-2-3-api-extensions.yaml`](./specs/001-menu-maker/contracts/phase-2-3-api-extensions.yaml) — Phase 2-3 API additions (50+ endpoints)

**Key Phase 2 Clarifications:**
- GDPR: Foundation only (cookie consent, basic deletion); full compliance in Phase 3
- Referrals: Basic seller-to-seller system; leaderboards/gamification in Phase 3
- OCR: Full implementation (replaces Phase 1 stub)

### **Phase 3: Scale (Months 6-12)**
Location: `specs/001-menu-maker/`

**Core Specifications:**
- [`phase-3-spec.md`](./specs/001-menu-maker/phase-3-spec.md) — 11 user stories (multi-PSP, reviews, analytics, GDPR full compliance, admin backend)
- [`phase-3-admin-backend.md`](./specs/001-menu-maker/phase-3-admin-backend.md) — Complete admin backend spec

**Key Phase 3 Features:**
- Admin backend (content moderation, support tickets, user management)
- GDPR full compliance (data portability, consent dashboard, automated deletion)
- Enhanced referrals (leaderboards, customer referrals, affiliate program)

### **Phase 3.5: Mobile Apps (Months 14-18)**
Location: `specs/`

**Mobile Specifications:**
- [`mobile-architecture.md`](./specs/mobile-architecture.md) — React Native strategy
- [`004-mobile-ios/spec.md`](./specs/004-mobile-ios/spec.md) — iOS app specification
- [`005-mobile-android/spec.md`](./specs/005-mobile-android/spec.md) — Android app specification
- [`MOBILE-EXPANSION-SUMMARY.md`](./specs/MOBILE-EXPANSION-SUMMARY.md) — Mobile rollout plan

---

## 📊 Technical Stack Summary

### Backend
- **Runtime**: Node.js 20 LTS
- **Framework**: Fastify 4.x
- **ORM**: TypeORM 0.3.x
- **Database**: PostgreSQL 15+ (managed Heroku/Render)
- **Auth**: JWT + Bcrypt + Refresh tokens
- **Storage**: S3-compatible (MinIO dev, AWS S3 prod)

### Frontend
- **Framework**: React 19 + TypeScript
- **Build**: Vite 5.x
- **Styling**: TailwindCSS 3.x
- **PWA**: Workbox for offline support
- **State**: React Query + Context API

### Testing
- **Unit**: Jest + Supertest
- **E2E**: Playwright
- **Contract**: OpenAPI validators

### Infrastructure
- **MVP Hosting**: Heroku/Render
- **Scale Hosting**: AWS (ECS, RDS, S3, CloudFront)
- **CI/CD**: GitHub Actions
- **Monitoring**: Sentry + CloudWatch

---

## 🎯 Development Timeline

| Phase | Duration | Budget | Deliverables |
|-------|----------|--------|--------------|
| **Phase 0** | Weeks 0-2 | Rs. 5.6L | Specs complete ✅ |
| **Phase 1 (MVP)** | Months 0-2 (10 weeks) | Rs. 134.7L | 7 user stories, 100 sellers |
| **Phase 2 (Growth)** | Months 2-6 | Rs. 174.3L | Payments, subscriptions, referrals, 500 sellers |
| **Phase 3 (Scale)** | Months 6-12 | Rs. 343.6L | Admin backend, GDPR full, multi-PSP, 5,000 sellers |
| **Phase 3.5 (Mobile)** | Months 14-18 | Rs. 271.5L | iOS + Android apps |
| **TOTAL** | **18 months** | **Rs. 1,130L** | Complete platform with 5,000+ sellers |

**Phase 1 Breakdown** (10 weeks with 1 developer):
- Weeks 1-6: Coding (all 7 user stories)
- Weeks 7-8: Testing & polish
- Weeks 9-10: Beta testing

---

## ✅ Specification Completeness

**Phase 1 (MVP)**: ✅ 100% Complete
- All 7 user stories documented with acceptance criteria
- Complete data model (21 entities across all phases)
- Full API specification (30+ Phase 1 endpoints)
- Technical architecture finalized
- Testing scenarios documented

**Phase 2 (Growth)**: ✅ 100% Complete
- All 7 user stories documented
- Data model extended with Phase 2-3 entities
- API extensions documented (50+ new endpoints)
- GDPR compliance strategy finalized

**Phase 3 (Scale)**: ✅ 100% Complete
- All 11 user stories documented
- Admin backend fully specified
- GDPR full compliance documented

**Phase 3.5 (Mobile)**: ✅ 100% Complete
- iOS and Android specs finalized
- React Native architecture documented

---

## 🔧 Environment Setup

**Required:**
- Node.js v20+ (current: v24.10.0 ✅)
- PostgreSQL 15+ (via Docker)
- Docker & Docker Compose
- Git (current: v2.51.0 ✅)

**Optional but Recommended:**
- SpecKit CLI (for task management)
- Claude Code (for AI-assisted development)

---

## 📝 Key Files by Role

### **Product Managers**
1. [`CONTEXT.md`](./CONTEXT.md) — Market opportunity, target users, product vision
2. [`PHASES-ROADMAP.md`](./PHASES-ROADMAP.md) — Complete 18-month plan, budget, timeline
3. [`specs/001-menu-maker/phase-1-spec.md`](./specs/001-menu-maker/phase-1-spec.md) — MVP user stories

### **Backend Engineers**
1. [`specs/001-menu-maker/plan.md`](./specs/001-menu-maker/plan.md) — Architecture decisions
2. [`specs/001-menu-maker/data-model.md`](./specs/001-menu-maker/data-model.md) — Database schema
3. [`specs/001-menu-maker/contracts/api.openapi.yaml`](./specs/001-menu-maker/contracts/api.openapi.yaml) — API contract
4. [`specs/001-menu-maker/GDPR-COMPLIANCE-SUMMARY.md`](./specs/001-menu-maker/GDPR-COMPLIANCE-SUMMARY.md) — Data retention policy

### **Frontend Engineers**
1. [`specs/001-menu-maker/phase-1-spec.md`](./specs/001-menu-maker/phase-1-spec.md) — User stories & UX requirements
2. [`specs/001-menu-maker/contracts/api.openapi.yaml`](./specs/001-menu-maker/contracts/api.openapi.yaml) — API endpoints
3. [`specs/mobile-architecture.md`](./specs/mobile-architecture.md) — Mobile strategy (Phase 3.5)

### **QA Engineers**
1. [`specs/001-menu-maker/quickstart.md`](./specs/001-menu-maker/quickstart.md) — Acceptance scenarios
2. [`specs/001-menu-maker/phase-1-spec.md`](./specs/001-menu-maker/phase-1-spec.md) — Acceptance criteria

### **DevOps Engineers**
1. [`specs/001-menu-maker/plan.md`](./specs/001-menu-maker/plan.md) — Infrastructure requirements
2. [`.specify/memory/constitution.md`](./.specify/memory/constitution.md) — Deployment standards

---

## 🚀 Next Steps

### **Using SpecKit (Recommended)**
```bash
cd /Users/macintosh/Documents/Projects/MenuMaker

# Generate implementation tasks from specs
specify tasks

# Start implementation with AI assistance
specify implement
```

### **Manual Implementation**
1. Set up local environment (Docker, PostgreSQL, Node.js)
2. Start with Phase 1 backend: Create TypeORM entities from [`data-model.md`](./specs/001-menu-maker/data-model.md)
3. Implement API endpoints from [`api.openapi.yaml`](./specs/001-menu-maker/contracts/api.openapi.yaml)
4. Build React frontend following [`phase-1-spec.md`](./specs/001-menu-maker/phase-1-spec.md)
5. Test using scenarios from [`quickstart.md`](./specs/001-menu-maker/quickstart.md)

---

## 📞 Getting Help

**Specification Questions:**
- Product requirements → Check relevant phase spec (phase-1-spec.md, phase-2-spec.md, etc.)
- Technical architecture → Check [`plan.md`](./specs/001-menu-maker/plan.md)
- Database design → Check [`data-model.md`](./specs/001-menu-maker/data-model.md)
- API contracts → Check [`api.openapi.yaml`](./specs/001-menu-maker/contracts/api.openapi.yaml)

**Development Support:**
- Use SpecKit CLI for task breakdown and AI-assisted implementation
- All specifications are complete and unambiguous for agentic AI development

---

## ✨ Success Criteria

**Phase 1 Launch Goals:**
- [ ] All 7 user stories implemented & tested
- [ ] 100 sellers onboarded in month 1
- [ ] Average time-to-first-listing < 10 minutes
- [ ] 20% weekly repeat order rate
- [ ] Lighthouse score > 90
- [ ] API p95 latency < 200ms
- [ ] > 70% test coverage

**Platform Scale Goals (18 months):**
- [ ] 5,000+ sellers onboarded
- [ ] Rs. 500L/month GMV
- [ ] 30% on paid subscriptions
- [ ] Mobile apps live (iOS + Android)

---

**Last Updated**: 2025-11-12
**Status**: ✅ All specifications complete and verified
**Next Phase**: Phase 1 development (start immediately)
