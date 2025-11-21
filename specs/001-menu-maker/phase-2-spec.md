# Feature Specification: MenuMaker Phase 2 (Growth)

**Branch**: `002-menu-maker-phase2` | **Date**: 2025-11-10 | **Priority**: P1–P2 (Growth Phase)  
**Timeline**: Month 2–6 post-MVP | **Input**: CONTEXT.md Phase 2 roadmap, MVP spec.md learnings

---

## Executive Summary

Phase 2 focuses on **growth through better integration, payment support, and seller enablement**. Key features: WhatsApp automation, AI-assisted menu import (OCR/text), basic payment processor integration (Stripe/PayPal), tiered subscriptions with free trial, templated legal copy, and re-order flow for customers. These features directly address MVP feedback: sellers want easier menu setup, customers want quick re-order, and payment integration reduces friction.

**Success Metrics (Phase 2 exit)**:
- 500 sellers onboarded (5× MVP)
- 10% using WhatsApp automation
- 30% utilizing OCR/text import
- 5% on paid subscription tier
- 15% weekly repeat order rate (from 20% MVP baseline via re-order feature)
- Lighthouse > 90, API p95 < 200ms maintained

---

## User Stories (Priority Order)

### US2.1 – WhatsApp Order Notifications & Status Updates (P1 – Growth) 🚀
**As a** seller  
**I want to** receive order notifications via WhatsApp and send status updates to customers via WhatsApp  
**So that** I can manage orders without leaving WhatsApp and customers stay engaged

**Acceptance Criteria**:
- [ ] Seller connects WhatsApp Business Account via OAuth (or manual number + API key)
- [ ] Seller configures: receive order notifications (yes/no), send status updates (yes/no)
- [ ] On new order, seller receives WhatsApp message: "New order from {customer_name}: {dish_names} × {qty}, Total: {amount}, {customer_phone}"
- [ ] Seller can reply via WhatsApp or mark order paid/fulfilled in portal
- [ ] When seller marks order status (confirmed/ready/fulfilled), customer receives WhatsApp: "Your order is {status}. {delivery_details}."
- [ ] Customer can click link in message to view order status in portal (auth-optional)
- [ ] Opt-out: Seller can disable WhatsApp notifications anytime (settings)
- [ ] Message delivery: retry failed messages up to 3× (exponential backoff)
- [ ] Cost: WhatsApp Business API charges per message; phase budget ~ Rs. 1/order for small sellers

**Test Scenarios**:
- Happy path: Order placed → seller receives WhatsApp → status updated → customer receives WhatsApp
- Edge case: WhatsApp account disconnected → fallback to email notification
- Edge case: Customer phone invalid → graceful error, seller notified

**Out of Scope (Phase 3+)**:
- Two-way WhatsApp chat (support chatbot deferred)
- Automated responses/templates
- WhatsApp catalog integration

**Dependencies**:
- WhatsApp Business API account (Twilio or native)
- Phone number verification
- Message encryption/PII handling

---

### US2.2 – AI-Assisted Menu Import (OCR & Text Parse) (P1 – Growth) 🚀
**As a** seller  
**I want to** upload an image or paste text of a menu and have the system extract dishes into my menu  
**So that** I can onboard 10 dishes in < 2 minutes instead of manual entry

**Acceptance Criteria**:
- [ ] "Import Menu" button in menu editor with two tabs: Image Upload & Paste Text
- [ ] Image upload: seller uploads menu photo/PDF/screenshot
- [ ] OCR engine (Tesseract or Claude Vision API) extracts text: dish names, descriptions, prices
- [ ] AI assistant (Claude/GPT) parses text to structure: {name, description, price, category}
- [ ] Preview extracted dishes before import: auto-populated form fields for manual correction
- [ ] Seller can edit price/description before saving
- [ ] Allergen tags: AI suggests common allergens (dairy, nuts, gluten) based on description; seller confirms
- [ ] Success rate: extract 80%+ of dishes with < 10% price errors for typical restaurant menus
- [ ] Text paste: seller pastes menu text (e.g., "Samosa - Rs. 20, Roti - Rs. 5") and AI parses
- [ ] Cost: OCR + Vision API ~$0.01–0.05 per image (Claude Vision $0.003/image; Tesseract free)
- [ ] Time to import 10 dishes: < 2 minutes (vs. 10 min manual)

**Test Scenarios**:
- Happy path: Seller uploads menu image → OCR extracts → AI structures → preview correct → import
- Edge case: Poor image quality (blurry/rotated) → OCR retries with preprocessing; fallback: manual text entry
- Edge case: Multi-language menu (English + Hindi) → parse both languages

**Out of Scope (Phase 2 MVP)**:
- Handwriting recognition (Phase 3)
- Multi-page PDF support (Phase 3)
- Category/section auto-detection (Phase 3)

**Dependencies**:
- OCR library (Tesseract.js for browser or server-side)
- Vision API integration (Claude, OpenAI, or Google Vision)
- Cost estimation & billing model (per-import quota or included in subscription)

---

### US2.3 – Templated Legal Copy & Privacy Policy Generator (P1 – Growth) 🎯
**As a** seller  
**I want to** generate templated disclaimer, T&C, and privacy policy copy for my menu and store  
**So that** I can comply with regulations without hiring a lawyer

**Acceptance Criteria**:
- [ ] "Legal Documents" tab in settings with options: Terms & Conditions, Privacy Policy, Refund/Cancellation Policy
- [ ] Template picker: seller selects country (India, US, EU, etc.) → pre-filled jurisdiction-specific templates
- [ ] Customization: seller can edit pre-filled copy (business name, email, contact, delivery terms)
- [ ] "Preview" button: renders styled copy in modal
- [ ] "Publish" button: saves to business profile; displayed on public menu (linked footer)
- [ ] Pre-made templates for: Refund (pickup vs. delivery), Payment terms (manual payout), Allergen disclaimer
- [ ] Templates are Markdown and render as HTML on public menu
- [ ] Versioning: track changes to legal copy (audit trail for dispute resolution)
- [ ] One-click copy-paste for sellers to share on WhatsApp/Instagram bio

**Test Scenarios**:
- Happy path: Seller selects India template → customizes → publishes → appears on public menu footer
- Edge case: Seller changes refund policy mid-month → old version archived; new version becomes active

**Out of Scope (Phase 2)**:
- Automated compliance checking
- Jurisdiction-specific law updates (Phase 3)
- Lawyer review integration (Phase 3+)

**Dependencies**:
- Template library (Markdown files, versioned in repo)
- Localization for 3–5 key jurisdictions (MVP: India, US, UK)

---

### US2.4 – Integrated Payment Processing (Stripe & Paypal) (P1 – Growth) 🚀
**As a** seller  
**I want to** accept payments directly via Stripe/PayPal without manual bank transfers  
**So that** I can reduce payment friction and get faster payouts

**Acceptance Criteria**:
- [ ] Seller can enable payment processor in settings: Stripe Connect OR PayPal (not both initially)
- [ ] Setup flow: seller clicks "Connect Stripe" → OAuth to Stripe Dashboard → returns API key
- [ ] Seller configures: transfer account (bank account linked in Stripe), settlement frequency (daily/weekly/monthly)
- [ ] Order flow: if processor enabled, customer sees "Pay with Stripe" button instead of manual payment
- [ ] Customer pays via Stripe checkout: card, Apple Pay, Google Pay
- [ ] Order status auto-updated to "paid" after Stripe webhook confirms payment
- [ ] Settlement: Stripe automatically transfers net amount (after fees) to seller bank account per schedule
- [ ] Dashboard shows: gross revenue, Stripe fees (2.9% + $0.30), net payout (amount → seller)
- [ ] Seller can enable/disable processor anytime; orders revert to manual payment if disabled
- [ ] Payment reconciliation: monthly report showing orders processed, fees, payouts
- [ ] Refund flow: seller can refund via Stripe (amount refunded to customer card)
- [ ] Cost transparency: on order confirmation email, show breakdown: order_total + fees = amount_charged

**Test Scenarios**:
- Happy path: Seller connects Stripe → customer pays → webhook confirms → seller gets notified → payout scheduled
- Edge case: Payment declined → customer sees clear error; seller notified; order stays pending
- Edge case: Seller refunds order → refund processed in < 1 min; customer card updated in 1–2 business days

**Out of Scope (Phase 2 MVP)**:
- PayPal integration (P2, if demand; Stripe sufficient for MVP)
- Local PSPs (India: Razorpay, PhonePe, etc. deferred to Phase 2.5 or Phase 3)
- Automated split payments (multi-seller marketplace deferred to Phase 3)

**Dependencies**:
- Stripe Connect API (for seller payout management)
- Webhooks for payment confirmation & settlement
- PCI compliance (no card data stored; Stripe handles)
- Fee calculation & transparency in UX

---

### US2.5 – Tiered Subscriptions & Free Trial (P1 – Growth) 🎯
**As a** seller or platform owner  
**I want to** offer free 30-day trial + paid subscription tiers with premium features  
**So that** we can monetize and sustain platform operations while bootstrapping adoption

**Acceptance Criteria**:
- [ ] Subscription tiers (on signup or after 30-day trial):
  - **Free**: up to 5 dishes, 1 menu, manual payment only, basic reporting, no WhatsApp integration
  - **Pro** (Rs. 99–199/month): unlimited dishes, 5 menus, Stripe/WhatsApp integration, advanced reports (6mo history, profit calc)
  - **Business** (Rs. 299–499/month): all Pro + OCR import, templated legal copy, custom branding (logo on public menu), customer re-order feature, priority email support
- [ ] New sellers default to Free tier (with 30-day trial boost: all Pro features)
- [ ] After trial expires, seller prompted to upgrade; free tier activated if no upgrade
- [ ] Subscription renewal: monthly billing; card charged on billing date
- [ ] Cancellation: seller can cancel anytime; service remains active until end of paid period
- [ ] Upgrade/downgrade: changes apply at next billing cycle; prorated refund for early downgrade
- [ ] Usage limits enforced: free tier max 5 dishes rejected at creation with message "Upgrade to Pro to add more dishes"
- [ ] Subscription dashboard: current tier, renewal date, invoice history, upgrade/downgrade buttons
- [ ] Payment: Stripe Billing API for recurring charges
- [ ] Tax: GST calculated & displayed in India; VAT for EU (Phase 3)

**Test Scenarios**:
- Happy path: New seller signs up → gets 30-day free trial → receives Pro features → trial expires → downgraded to free
- Happy path: Free tier seller upgrades to Pro → payment charged → features unlocked immediately
- Edge case: Seller hits dish limit on free tier → sees message + upgrade CTA + "Show me Pro tier benefits" button

**Out of Scope (Phase 2)**:
- Family/team billing
- Custom tier creation
- Usage-based pricing (Phase 3)

**Dependencies**:
- Stripe Billing (recurring subscriptions)
- Feature flag system (to enforce tier-based limits)
- Webhook handling (subscription events: created, renewed, canceled)

---

### US2.6 – Customer Re-order & Saved Carts (P2 – Growth) 🎯
**As a** customer  
**I want to** see my previous orders and re-order with one click  
**So that** I can quickly place repeat orders without manually selecting dishes again

**Acceptance Criteria**:
- [ ] Public order form includes "Previous Orders" tab (if customer phone matches previous customer)
- [ ] Logic: on order submission, check if customer phone exists in past orders (last 90 days)
- [ ] If found, show: "Welcome back! Your previous order" with dishes list
- [ ] Customer can: "Quick Re-order" (one-click, same dishes + qty) or "Modify" (edit dishes/qty before ordering)
- [ ] Cart persistence: if customer has browser cookies enabled, save cart items across sessions
- [ ] "Saved Carts" feature: customer can save custom cart (e.g., "My Weekly Tiffin") and reorder from saved preset
- [ ] For authenticated customers (later): linked order history in personal dashboard
- [ ] Analytics: track re-order rate (% of orders from repeat customers) per seller
- [ ] Time-to-order reduced: from ~2min (full form) to ~20sec (re-order)

**Test Scenarios**:
- Happy path: Customer places order on Wed → on Friday, returns to menu → sees "Previous Order" → clicks re-order → order submitted
- Edge case: Customer clears cookies → cart resets; still shows "Previous Orders" if phone matched

**Out of Scope (Phase 2)**:
- Subscription re-orders (automated weekly orders; Phase 2.5 or Phase 3)
- Customer account integration (Phase 3)

**Dependencies**:
- Phone-based customer lookup (not requiring login)
- Browser local storage for cart persistence
- Analytics event tracking (re-order vs. first-order)

---

## Non-Functional Requirements (Phase 2)

### Performance (Maintained/Improved)
- **Page Load**: < 2s on 4G (same as MVP)
- **API Latency**: 99th percentile < 250ms (improved from < 500ms)
- **Image OCR**: < 5s for typical menu image (including API latency)
- **Database Queries**: Still < 100ms (add indexes for subscription checks)
- **WebSocket latency** (for real-time WhatsApp updates): < 500ms (if implemented; MVP: polling OK)

### Security (Enhanced)
- **OAuth**: Secure Stripe & WhatsApp OAuth flows (pkce, state validation)
- **PCI Compliance**: No card data stored; Stripe handles (audit quarterly)
- **API Keys**: Encrypted storage, rotation policy (90 days)
- **Webhooks**: Signed verification (Stripe signature validation)
- **Rate Limiting**: 1000 requests/min per seller (up from 100/day MVP)

### Reliability
- **Uptime**: 99.5% target (alert if < 99%)
- **Payment Webhook Retries**: 24-hour retry window for Stripe webhooks
- **WhatsApp Retries**: 3× retry with exponential backoff; fallback to email
- **Database Backups**: Daily automated + hourly snapshots (Heroku/Render managed)

### Compliance & Legal
- **GDPR**: Explicit data retention policy (delete inactive seller data after 12 months)
- **Data Residency**: Support India + US regions (Phase 3 expansion)
- **Accessibility**: WCAG 2.1 Level AA maintained
- **i18n**: English primary; prepare codebase for Hindi/regional languages (Phase 3)

---

## Edge Cases & Assumptions (Phase 2)

**New Assumptions**:
- Sellers comfortable with OAuth (Stripe, WhatsApp); if not, manual fallback provided
- Customers comfortable entering phone number (for re-order lookup); privacy explained
- OCR success rate 80% acceptable (manual correction expected for remaining 20%)
- Stripe fees (~2.9% + $0.30) acceptable to sellers (vs. flat manual fees)

**New Edge Cases**:
- Seller cancels subscription mid-month → features revoked immediately; data preserved for 30 days
- Payment processor fails → fallback to manual payment; seller notified
- OCR extracts prices incorrectly (e.g., reads "Rs. 20–30" as "20–30") → preview allows manual correction
- WhatsApp number changed → old messages bounced; seller prompted to re-verify

---

## Testing Strategy (Phase 2)

**Unit Tests**: Fee calculation (Stripe), subscription tier enforcement, OCR parser  
**Integration Tests**: Stripe webhook handling, WhatsApp message sending, subscription lifecycle  
**E2E Tests** (Playwright):
- Seller enables Stripe → customer pays → order marked paid
- Seller uploads menu image → OCR extracts → review & import
- Customer re-orders from previous order
- Subscription trial expires → features downgraded

**Contract Tests**: Stripe API responses, WhatsApp API responses (webhook signatures)  
**Performance Tests**: OCR latency < 5s, API response time < 250ms under load  

**Test Coverage Goal**: > 75% (up from > 70% MVP)

---

## Testing & Payment Safety

### Manual Testing Checklist (Pre-Production)
- [ ] 3+ seller accounts test Stripe integration (real test cards provided)
- [ ] 5+ customer test orders via Stripe (verify webhook → order marked paid)
- [ ] Test refund flow (seller initiates, customer sees refund in 1–2 days)
- [ ] WhatsApp notifications tested with 2 sellers (real phone numbers)
- [ ] OCR tested with 10+ menu images (photo, PDF, screenshot quality variations)
- [ ] Subscription tier limits enforced (free tier rejects > 5 dishes)
- [ ] Trial expiry tested (manual time-travel in staging DB)

### Staging Environment
- Stripe test mode active (no real charges)
- WhatsApp test account (sandbox numbers)
- OCR testing against staging Vision API quota

---

## Success Criteria (Phase 2 Exit)

- ✅ 500 sellers onboarded (5× MVP)
- ✅ 10% of sellers using WhatsApp notifications (50 sellers)
- ✅ 30% of new sellers using OCR import (150 sellers)
- ✅ 5% on paid subscription tier (25 sellers, generating Rs. 5k MRR)
- ✅ 15% weekly repeat order rate (via re-order feature)
- ✅ Stripe integration processing 10% of orders by volume
- ✅ API p95 latency < 250ms maintained under 10× load
- ✅ Lighthouse score > 90 maintained (desktop & mobile)
- ✅ All tests passing (> 75% coverage)
- ✅ Zero payment disputes (100% resolution rate for refunds)

---

## Out-of-Scope (Deferred to Phase 3+)

- Marketplace features (multi-seller, customer marketplace)
- Local payment processors (Razorpay, PhonePe for India)
- Two-way WhatsApp chat / AI support chatbot
- Multi-language UI (Phase 3+)
- Advanced inventory management
- Review/rating system
- Delivery partner integrations
- Tax invoice generation (Phase 3)

---

## Dependencies & Sequencing

**Hard Dependencies** (must complete before Phase 2 implementation):
1. Phase 1 (MVP) fully deployed & stable (> 99% uptime for 2 weeks)
2. Customer feedback from Phase 1 sellers (collected via surveys/interviews)
3. Stripe account approved (sandbox + production keys)
4. WhatsApp Business Account set up (if pursuing WhatsApp feature)

**Recommended Implementation Order** (for Phase 2):
1. **Week 1–2**: Stripe integration (US2.4) — highest impact for revenue growth
2. **Week 3–4**: Tiered subscriptions (US2.5) — foundation for monetization
3. **Week 5**: WhatsApp notifications (US2.1) — improves seller engagement
4. **Week 6**: OCR import (US2.2) — accelerates seller onboarding
5. **Week 7**: Customer re-order (US2.6) — improves repeat order rate
6. **Week 8**: Templated legal copy (US2.3) — compliance + trust

**Total Phase 2 Timeline**: 8 weeks (2 months), aligning with CONTEXT.md "Month 2–6" window

---

## Next Steps

1. **Finalize Phase 2 data model** (`phase-2-data-model.md`): new entities for subscriptions, payments, OCR metadata
2. **Generate Phase 2 API contracts** (`phase-2-api.openapi.yaml`): all new endpoints (Stripe webhooks, WhatsApp, subscription management)
3. **Collect seller feedback** (from Phase 1 MVP): prioritize which Phase 2 features to build first
4. **Set up Stripe account** & obtain API keys for staging
5. **Plan architecture changes**: webhook handling, async job queue for OCR/WhatsApp
6. **Design Phase 2 UI mockups**: payment flow, subscription settings, re-order cart

---

**Ready for**: Phase 2 data model → Phase 2 API contracts → Task breakdown (via `/speckit.tasks`)

