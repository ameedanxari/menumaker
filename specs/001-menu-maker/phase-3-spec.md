# Feature Specification: MenuMaker Phase 3 (Scale)

**Branch**: `003-menu-maker-phase3` | **Date**: 2025-11-10 | **Priority**: P2–P3 (Scale Phase)  
**Timeline**: Month 6–12 post-MVP | **Input**: CONTEXT.md Phase 3 roadmap, learnings from Phase 1 & 2

---

## Executive Summary

Phase 3 transforms MenuMaker into a **multi-seller marketplace platform** with advanced tooling for sellers, comprehensive reporting for taxation, and deeper integrations with POS systems and delivery partners. Key features: multiple payment processors (Razorpay, PhonePe for India), automated tiered payouts, RTL/multi-language UI, advanced reporting (tax invoices, profit analysis), review/complaint workflows, and marketplace features (seller discovery, customer reviews, promotions). Target: 5,000+ sellers, Gross Merchandise Volume (GMV) of Rs. 50L+ per month.

**Success Metrics (Phase 3 exit)**:
- 5,000 sellers onboarded (10× MVP)
- Gross Merchandise Volume (GMV): Rs. 50L/month (500,000 orders @ avg Rs. 100)
- 30% on paid subscription tier (1,500 sellers @ avg Rs. 200/month = Rs. 30L MRR)
- 20% repeat order rate (baseline maintained from Phase 2)
- Marketplace GMV: 5% of total (peer-to-peer, seller discovery)
- Lighthouse > 90, API p95 < 150ms maintained

---

## User Stories (Priority Order)

### US3.1 – Multiple Payment Processors (Razorpay, PhonePe, Paytm) (P1 – Scale) 🚀
**As a** seller  
**I want to** choose from multiple local payment processors (Razorpay, PhonePe, Paytm, UPI)  
**So that** I can select the processor with lowest fees or best settlement terms for my market

**Acceptance Criteria**:
- [ ] Seller can connect one or more payment processors simultaneously (Stripe + Razorpay + PhonePe)
- [ ] Setup flow for each processor: OAuth or manual API key entry (varies by processor)
- [ ] Processor selection: on order creation, customer sees "Pay with {processor1/2/3}" buttons (seller configures priority)
- [ ] Processor-specific fees displayed: Razorpay (1.75%–2.36%), PhonePe (1% + GST), Paytm (2% + GST), UPI (0% + settlement fee)
- [ ] Settlement terms: daily, weekly, monthly per processor (stored in settings per processor)
- [ ] Webhook handling: each processor sends different webhook format; normalized in backend
- [ ] Reconciliation: monthly settlement report showing orders, fees, net payout per processor
- [ ] Automatic routing: highest priority processor if available; fallback to next if failed
- [ ] Refund: refund routed to same processor used for payment
- [ ] Cost transparency: order confirmation shows processor, fee, net amount
- [ ] Processor disconnect: orders automatically route to remaining active processors

**Test Scenarios**:
- Happy path: Seller connects Razorpay + PhonePe → customer chooses Razorpay → webhook confirms → payout scheduled
- Edge case: Razorpay fails (API down) → order routed to PhonePe automatically
- Edge case: Seller disconnects Razorpay mid-day → pending orders complete via PhonePe

**Out of Scope (Phase 3)**:
- International payment processors (Wise, OFX) — Phase 3.5+
- Cryptocurrency payments (deferred indefinitely)
- Multi-currency processing (Phase 3.5)

**Dependencies**:
- Razorpay OAuth + API (X.com partnership available)
- PhonePe Business API (requires KYC)
- Paytm for Business API
- UPI debit routing (via Razorpay/PhonePe)
- PCI Level 1 compliance audit (annual)

---

### US3.2 – Automated Tiered Payouts & Payout Scheduling (P1 – Scale) 🚀
**As a** seller  
**I want to** configure automatic payouts with flexible settlement frequencies and thresholds  
**So that** I can receive funds faster and have predictable cash flow

**Acceptance Criteria**:
- [ ] Payout settings (per processor):
  - Frequency: Daily (next business day), Weekly (every Monday), Monthly (on set date)
  - Minimum payout threshold (e.g., "hold payout if < Rs. 500")
  - Maximum hold period (e.g., "always payout by Friday even if < threshold")
- [ ] Seller can change frequency anytime; changes apply to next payout cycle
- [ ] Payout calculation: gross orders - processor fees - subscription fee (if paid tier) = net payout
- [ ] Payout holds: seller can manually hold payout (for reconciliation with accounting)
- [ ] Payout history: dashboard shows all payouts (date, amount, fees, status, transaction ID)
- [ ] Bank reconciliation: Razorpay/PhonePe settlement reconciled automatically; exceptions flagged
- [ ] Failed payouts: if bank rejects payout, retry next cycle; seller notified
- [ ] Subscription fee deduction: shown as line item in payout breakdown (transparent)
- [ ] Volume discount: 0.5% fee reduction if monthly GMV > Rs. 1L (automatic application)
- [ ] Tax compliance: gross payout tracked separately for GST/tax purposes

**Test Scenarios**:
- Happy path: Seller sets daily payouts, min threshold Rs. 500 → order for Rs. 600 placed → payout triggered next day
- Edge case: Multiple orders total Rs. 300, threshold Rs. 500 → payout held; new order added → threshold crossed → payout next day
- Edge case: Bank rejects payout → retry attempted; seller receives email notification + retry date

**Out of Scope (Phase 3)**:
- Escrow holds (for dispute resolution; Phase 3.5)
- Seller split payouts (multi-tier commission model; Phase 3.5)
- On-demand payout (instant; deferred, fees high)

**Dependencies**:
- Accounting system (track gross vs. net payouts)
- Bank reconciliation API integration
- Webhook error handling & retry logic
- Seller communication (email alerts for payout events)

---

### US3.3 – Multi-Language Support & RTL Layout (P1 – Scale) 🌍
**As a** seller or customer in India/Middle East  
**I want to** use MenuMaker in my language (Hindi, Marathi, Tamil, Arabic, etc.) with proper RTL layout  
**So that** I can operate comfortably without translation tools

**Acceptance Criteria**:
- [ ] UI translations for top 3 languages: English, Hindi, Tamil (Marathi as P2)
- [ ] Arabic support: RTL layout (mirror UI for right-to-left languages)
- [ ] Locale selector: seller chooses language in settings; applies to seller UI + public menu
- [ ] Date/time/currency formatting: locale-specific (e.g., "10/11/2025" vs. "11-10-2025", "Rs. 100" vs. "₹100")
- [ ] Form validation messages: translated error messages ("This field is required" → "यह फील्ड आवश्यक है")
- [ ] Public menu translatable: seller can add translations for dish names/descriptions (optional)
- [ ] Email templates: translated per seller locale (order confirmation, payout notifications)
- [ ] RTL layout: all UI elements mirror (navigation, modals, tables) for Arabic/Hebrew
- [ ] Accessibility: screen reader support for all languages (tested with NVDA/JAWS)
- [ ] Font support: embedded fonts for Devanagari (Hindi), Tamil, Arabic script rendering
- [ ] Performance: language packages lazy-loaded (not bundled by default)

**Test Scenarios**:
- Happy path: Seller sets language to Hindi → UI renders in Hindi → public menu translatable
- Edge case: Seller sets Hindi but customer views in English → public menu defaults to English; seller translation shown if available
- RTL: Seller sets Arabic → all elements mirror, text flows right-to-left, numbers render correctly

**Out of Scope (Phase 3)**:
- Machine translation (auto-translate dish descriptions; Phase 3.5)
- Regional payment processors (e.g., Indonesia-specific banks; Phase 3.5)
- Multiple currency pricing (Phase 3.5)

**Dependencies**:
- i18n library (react-i18next or similar)
- Translation files (JSON or YAML per language)
- Crowd translation (community-sourced or professional translator)
- RTL CSS framework updates
- Font hosting (Google Fonts regional CDNs)

---

### US3.4 – Advanced Reporting & Tax Compliance (P2 – Scale) 📊
**As a** seller or accountant  
**I want to** generate tax invoices, profit analysis, and GST compliance reports  
**So that** I can file taxes accurately and maintain audit trails

**Acceptance Criteria**:
- [ ] Tax Invoice generation: "Download Tax Invoice" per order → PDF with GST breakdown
  - Breakdown: item subtotal + GST (5%/18% per item category) = total
  - GSTIN field: seller enters GSTIN; appears on invoice (if registered)
  - Invoice numbering: auto-incremented per seller, audit-trail traceable
- [ ] GST Reports (monthly):
  - Outward supplies (B2C): count, total value, GST collected
  - Input tax credit eligible (if registered): downloadable as JSON for GST portal
  - HSN/SAC code auto-applied per item (food service = 9963)
- [ ] Profit Analysis:
  - Revenue breakdown: by month, by payment processor, by dish category
  - Expense breakdown: subscription fees, payment processor fees, delivery waivers
  - Net profit = revenue - expenses (graphical dashboard)
  - Export as PDF/CSV for accountant
- [ ] Compliance Reports:
  - Seller registration status (GST-registered: yes/no)
  - All payouts with dates, amounts, processor fees (for reconciliation with bank)
  - Refund/chargeback tracking (if any)
  - Export period: custom date range
- [ ] Customer PII Removal: compliance mode → customer names/phones masked (except seller's private notes)
- [ ] Data Retention: seller can request data deletion (30-day notice per GDPR); audit trail preserved for compliance
- [ ] Seller TDS: if seller is business entity, TDS deduction calculated (2% on payments > threshold)

**Test Scenarios**:
- Happy path: Seller clicks "Download GST Report" for Oct 2025 → report generated → GSTIN populated if registered
- Edge case: Seller has 5% + 18% GST items mixed → report shows both rates separately
- Edge case: Seller refunds 2 orders → refund amount shows in "Adjustments" on GST report

**Out of Scope (Phase 3)**:
- Automatic GST filing (Phase 3.5+)
- Multi-state GST (consolidated reporting; Phase 3.5+)
- TDS automated deduction (Phase 3.5+)

**Dependencies**:
- GST slab configuration (5%/18% per product category)
- Tax invoice PDF generation (Puppeteer or similar)
- GSTIN validation API (if integrating with Indian Tax system)
- Audit logging (all report generation tracked)

---

### US3.5 – Review & Complaint Workflow (P2 – Scale) ⭐
**As a** customer  
**I want to** leave a review and rating for a seller after order completion  
**So that** other customers can trust the seller and seller receives feedback for improvement

**Acceptance Criteria**:
- [ ] Post-order, customer receives email: "How was your order? Leave a review" (link valid 7 days)
- [ ] Review form: rating (1–5 stars), review text (optional, max 500 chars), photos (optional, up to 3)
- [ ] Review moderation: submitted reviews visible to seller first (24-hour window to respond/request removal)
- [ ] Public visibility: after 24h or seller approval, review appears on seller's public profile
- [ ] Review display: on seller profile page (average rating, review count, last 5 reviews)
- [ ] Complaint workflow: if customer rating < 3, flag as "complaint" → seller notified immediately
- [ ] Seller response: seller can reply to reviews publicly (e.g., "Thanks! We'll fix this.")
- [ ] Complaint resolution: seller & customer can message via email to resolve; marked as "resolved" when closed
- [ ] Review metrics: seller dashboard shows average rating, total reviews, review trends (monthly)
- [ ] Spam prevention: 1 review per customer per seller per week (duplicate reviews rejected)
- [ ] Review authenticity: only customers who actually ordered can review (verified by order history)

**Test Scenarios**:
- Happy path: Customer orders → receives review email → rates 5 stars → review published on seller profile
- Edge case: Customer rates 2 stars → flagged as complaint → seller receives alert → seller responds → marked resolved
- Edge case: Seller tries to review own order → rejected (can't review self)

**Out of Scope (Phase 3)**:
- AI sentiment analysis (flag offensive reviews; Phase 3.5)
- Review incentives (reward customers for leaving reviews; Phase 3.5)
- Video reviews (Phase 3.5+)

**Dependencies**:
- Review storage (new DB table)
- Email notification system (existing, reused)
- Moderation queue (seller dashboard)
- Review API endpoints (POST review, GET seller reviews, etc.)

---

### US3.6 – Marketplace & Seller Discovery (P2 – Scale) 🌐
**As a** customer  
**I want to** discover new sellers and food offerings on a marketplace without direct referral  
**So that** I can find variety and try new sellers

**Acceptance Criteria**:
- [ ] Marketplace homepage: "Browse All Sellers" with filters
  - Filter by: cuisine type (Indian, Chinese, Bakery, etc.), rating (≥3, ≥4, ≥5 stars), distance/location
  - Search: text search for sellers or dishes
  - Sort: by rating, by distance, by newest, by most popular
- [ ] Seller cards: seller name, avg rating, review count, top 3 dishes, distance (if location available)
- [ ] Seller profile page: all dishes, reviews, seller info (business hours, contact), map (if location available)
- [ ] Seller onboarding option: "Make Your Store Discoverable" (opt-in; seller grants permission)
- [ ] Privacy: location can be city-level (not exact address) unless seller opts-in to detailed location
- [ ] Featured sellers: platform can feature top-rated or new sellers (editorial)
- [ ] Category browsing: browse by cuisine → filter to sellers offering that cuisine
- [ ] Customer preferences: saved favorite sellers, repeat customers prioritized in search
- [ ] Analytics: seller dashboard shows "marketplace impressions" (profile views) and "marketplace orders" (conversions)

**Test Scenarios**:
- Happy path: Customer opens marketplace → filters by "Indian & near me" → selects seller → views menu → places order
- Edge case: Seller opts-out of marketplace → seller profile hidden from discovery; direct links still work

**Out of Scope (Phase 3)**:
- Promotional campaigns (seller paid placement; Phase 3.5)
- Delivery partner integration (delivery distance calc; Phase 3.5)
- Loyalty program (Phase 3.5+)

**Dependencies**:
- Marketplace homepage (new UI page)
- Search/filtering backend (elasticsearch optional if scale demand)
- Seller opt-in management
- Location services (geocoding for distance calc, if used)

---

### US3.7 – POS System Integration & Order Sync (P2 – Scale) 🔗
**As a** seller with a physical POS system  
**I want to** sync orders from MenuMaker into my POS (e.g., Square, Dine, Zoho Inventory)  
**So that** I don't have to manually enter orders twice and maintain single source of truth

**Acceptance Criteria**:
- [ ] Supported POS systems: Square, Dine, Zoho Inventory (MVP Phase 3: 3 integrations)
- [ ] Setup flow: seller clicks "Integrate POS" → OAuth to Square/etc. → select outlet
- [ ] Order sync: new MenuMaker orders automatically pushed to POS in real-time
- [ ] Sync details: customer name, phone, items (mapped to POS item codes), qty, total
- [ ] Sync failure handling: if POS API fails, order stored locally; retry every 5 min for 1 hour; seller notified
- [ ] Reverse sync (optional): POS inventory levels sync back to MenuMaker (mark items "out of stock" if 0 qty in POS)
- [ ] Disconnect: seller can disconnect POS anytime; orders revert to manual entry in POS
- [ ] Audit: seller can view sync history (all orders synced, failures, timestamps)

**Test Scenarios**:
- Happy path: Seller connects Square → customer places order → order appears in Square POS in < 10 sec
- Edge case: Square API down → order saved locally → retries every 5 min; seller sees warning badge "Sync pending"

**Out of Scope (Phase 3)**:
- Inventory management (Phase 3.5; complex, deferred)
- Multi-outlet support (Phase 3.5)
- Custom field mapping (Phase 3.5)

**Dependencies**:
- Square, Dine, Zoho API integration
- OAuth for each platform
- Webhook/polling for real-time or batch sync
- Error handling & user notifications

---

### US3.8 – Delivery Partner Integration (Swiggy, Zomato, Dunzo) (P3 – Scale) 🚗
**As a** seller or customer  
**I want to** enable delivery via third-party delivery partners (Swiggy, Zomato, Dunzo)  
**So that** sellers without own delivery fleet can still offer delivery

**Acceptance Criteria**:
- [ ] Seller opt-in: "Enable delivery with {provider}" in settings
- [ ] Seller-partner setup: seller registers/links account with delivery partner (outside MenuMaker)
- [ ] Order routed to delivery partner: if seller accepts delivery order, push to partner's system
- [ ] Delivery tracking: MenuMaker shows delivery status ("picked up", "en route", "delivered")
- [ ] Delivery cost: third-party fees passed to customer or absorbed by seller (seller configures)
- [ ] Delivery rating: customers can rate delivery separately from food rating
- [ ] Integration: API connection to Swiggy/Zomato delivery APIs (if available; otherwise manual partner)

**Test Scenarios**:
- Happy path: Seller enables Swiggy delivery → customer orders with delivery → order sent to Swiggy → delivery tracked

**Out of Scope (Phase 3)**:
- Negotiated delivery pricing (Phase 3.5+)
- Same-restaurant multi-order consolidation (Phase 3.5+)

**Dependencies**:
- Swiggy/Zomato delivery partner APIs (limited availability; may require partnership agreement)
- Delivery tracking webhook integration
- Fallback to manual delivery if API unavailable

---

### US3.9 – Promotions, Coupons & Discounts (P3 – Scale) 🎁
**As a** seller  
**I want to** create discount codes, seasonal promotions, and automatic discounts  
**So that** I can attract customers and increase order volume

**Acceptance Criteria**:
- [ ] Coupon creation: seller creates coupons with rules
  - Discount type: fixed (Rs. 50 off) or percentage (10% off)
  - Valid date range (e.g., "Oct 1–31")
  - Usage limit: per customer, per month, or unlimited
  - Minimum order value (e.g., "min Rs. 200 to apply")
  - Specific dishes or all dishes
- [ ] QR code generation: seller can generate QR for coupon (shareable on WhatsApp/Instagram)
- [ ] Automatic promotions: seller can set rules (e.g., "free delivery on orders > Rs. 500")
- [ ] Public menu display: eligible coupons/promotions shown on public menu
- [ ] Customer application: customer enters coupon code → discount calculated and shown before confirming
- [ ] Analytics: seller dashboard shows coupon redemption rate, discount given, uplift in order volume
- [ ] Expiration: expired coupons auto-archived; can't be applied

**Test Scenarios**:
- Happy path: Seller creates "FEST10" coupon (10% off, valid Oct) → customer enters code → 10% discount applied
- Edge case: Coupon expires Oct 31 → customer can't apply Nov 1

**Out of Scope (Phase 3)**:
- Platform-wide promotions (flash sales; Phase 3.5+)
- Loyalty points program (Phase 3.5+)

**Dependencies**:
- Coupon database schema
- Discount calculation logic
- QR code generation library

---

## Non-Functional Requirements (Phase 3)

### Performance (Scaled)
- **Page Load**: < 1.5s on 4G (improved from Phase 2: < 2s)
- **API Latency**: 99th percentile < 150ms (improved from Phase 2: < 250ms)
- **Search/Marketplace**: < 500ms for complex queries (seller discovery with filters)
- **Report Generation**: < 10s for tax invoice PDF generation
- **Database**: Sharding by seller_id if > 10M records (Phase 3.5+)

### Security (Enterprise-Grade)
- **PCI Level 1**: Annual audit compliance (payment processor integrations)
- **OAuth**: Secure multi-processor OAuth flows (PKCE, state validation)
- **Rate Limiting**: 10,000 requests/min per seller (bulk export rate-limited)
- **IP Whitelisting**: seller can whitelist IPs for API access (business tier)
- **Encryption**: all PII encrypted at rest (AES-256); in transit (TLS 1.3)
- **Audit Logging**: all sensitive actions logged (who, what, when); 1-year retention

### Reliability & Disaster Recovery
- **Uptime**: 99.9% target (SLA for paid tiers; alert if < 99.8%)
- **Failover**: multi-region failover (India primary, US secondary; Phase 3.5+)
- **Backup**: hourly snapshots; 30-day retention; tested monthly
- **Incident Response**: documented runbook for payment processor outages
- **Webhook Resilience**: all webhooks retry up to 10× over 24 hours

### Compliance & Legal
- **GST Compliance**: full GST report generation, auto-calculated taxes
- **GDPR/DPA**: data deletion workflows, consent management
- **RBI Compliance** (if payment processor): periodic audit
- **Terms & Conditions**: accept new T&C for Phase 3 features
- **Jurisdiction**: support India + US + EU (localized T&C; Phase 3.5+)

### Scalability
- **Database**: PostgreSQL sharding by seller_id (Phase 3.5 if scale high)
- **Cache**: Redis for marketplace search, session management (Phase 3.5)
- **CDN**: images cached on CDN (Cloudinary/Imgix; Phase 3.5)
- **API Gateway**: load balancing across multiple Fastify instances
- **Message Queue**: async jobs (email, webhooks, OCR) via Bull/RabbitMQ

---

## Edge Cases & Assumptions (Phase 3)

**New Assumptions**:
- Sellers comfortable managing multiple payment processors simultaneously
- Customers comfortable with marketplace discovery (opt-in for privacy)
- Third-party integrations (POS, delivery) are reliable and available
- Regional payment processor integrations available in India

**New Edge Cases**:
- Seller has orders from 2 processors, requests payout simultaneously → settled from both processors (no conflict)
- Customer leaves review for seller, seller deletes account → review archived (not deleted); preserved for 5 years
- POS sync fails → order not duplicated; seller can manually trigger sync retry
- RTL language: seller adds HTML entities in description → sanitized before rendering

---

## Testing Strategy (Phase 3)

**Unit Tests**: tax calculation (GST tiers), coupon logic, payout calculation with volume discounts  
**Integration Tests**: multi-processor payment flows, POS sync, marketplace search with filters  
**E2E Tests** (Playwright):
- Seller selects Razorpay → customer pays → payout scheduled → seller views tax invoice
- Customer discovers seller on marketplace → places order → leaves review → appears on seller profile
- Seller enables POS → order syncs to Square in real-time
- Seller creates coupon → customer applies → discount verified
- Seller exports GST report → CSV validates with accountant

**Performance Tests**: marketplace search with 10K sellers, tax report PDF generation < 10s  
**Security Tests**: OAuth flows, webhook signature validation, PII encryption  

**Test Coverage Goal**: > 80% (up from > 75% Phase 2)

---

## Success Criteria (Phase 3 Exit)

- ✅ 5,000 sellers onboarded (10× MVP)
- ✅ Gross Merchandise Volume: Rs. 50L/month
- ✅ 30% on paid subscription tier (1,500 sellers)
- ✅ Multiple payment processors integrated; 70% of orders via processors (vs. manual)
- ✅ Marketplace feature: 10% of orders from marketplace discovery
- ✅ 3+ POS systems integrated; active in 50+ sellers' workflows
- ✅ Advanced reporting: 80% of registered sellers generating tax reports monthly
- ✅ Review system: 20% of orders have reviews; avg seller rating 4.2/5 stars
- ✅ API p95 latency < 150ms maintained under 100× load (vs. MVP)
- ✅ Lighthouse score > 90 maintained (desktop & mobile)
- ✅ RTL layout verified for Arabic users
- ✅ Zero payment disputes (100% resolution rate for refunds)
- ✅ All tests passing (> 80% coverage)

---

## Out-of-Scope (Deferred to Phase 3.5+)

- International expansion (Europe, SE Asia, Americas)
- Machine translation (auto-translate menu items)
- AI-driven seller suggestions (personalized recommendations)
- Mobile app (iOS/Android native; current: PWA web-first)
- Advanced logistics (real-time delivery tracking with maps)
- B2B marketplace (seller-to-seller, wholesale)
- Influencer/affiliate program
- Seller insurance/compliance tool

---

## Dependencies & Sequencing

**Hard Dependencies** (must complete before Phase 3 implementation):
1. Phase 2 fully deployed & stable (> 99% uptime for 4 weeks)
2. 500+ sellers onboarded & engaging (Phase 2 success metrics met)
3. Payment processor accounts approved (Razorpay, PhonePe production keys)
4. GST compliance legal review (by accountant or tax advisor)
5. POS vendor partnerships established (Square, Dine, Zoho API access)

**Recommended Implementation Order** (for Phase 3, 6 months):
1. **Month 1**: Multiple payment processors (US3.1) + payouts (US3.2) — revenue foundation
2. **Month 2**: Advanced reporting & tax compliance (US3.4) — seller trust + compliance
3. **Month 2–3**: Multi-language & RTL (US3.3) — user experience expansion
4. **Month 3**: Review & complaint workflow (US3.5) — seller credibility
5. **Month 4**: Marketplace & seller discovery (US3.6) — customer acquisition
6. **Month 4–5**: POS integration (US3.7) — seller convenience
7. **Month 5–6**: Delivery partner integration (US3.8) + Promotions (US3.9) — revenue growth

**Total Phase 3 Timeline**: 24 weeks (6 months), aligning with CONTEXT.md "Month 6–12" window

---

## Next Steps

1. **Finalize Phase 3 data model** (`phase-3-data-model.md`): entities for reviews, promotions, POS integration metadata
2. **Generate Phase 3 API contracts** (`phase-3-api.openapi.yaml`): all new endpoints (reviews, marketplace, tax reports, promotions)
3. **Evaluate payment processor partnerships**: reach out to Razorpay, PhonePe for API access & SLA
4. **Design POS integrations**: API analysis for Square, Dine, Zoho (availability, sync frequency)
5. **Plan marketplace architecture**: search scalability (Elasticsearch) & recommendations
6. **Legal review**: GST compliance, terms & conditions for Phase 3 features

---

**Ready for**: Phase 3 data model → Phase 3 API contracts → Task breakdown (via `/speckit.tasks`)

