# Feature Specification: MenuMaker MVP

**Branch**: `001-menu-maker` | **Date**: 2025-11-10 | **Priority**: P1 (MVP)  
**Objective**: Build a lightweight web-first platform enabling home food business owners to create, publish, and monetise weekly menus and event catering orders.

---

## Executive Summary

Home food caterers and tiffin makers need a simple, fast way to publish menus and accept orders without managing multiple WhatsApp chats or Facebook groups. MenuMaker solves this by providing a 10-minute onboarding, a shareable menu link with social media preview, and a basic order portal.

**MVP Scope**: Seller onboarding → menu creation → shareable public menu → order capture → basic reporting → manual payouts.  
**Success Metric**: 100 sellers onboarded in month 1; avg time-to-first-listing < 10 minutes; 20% weekly repeat order rate.

---

## User Stories (Priority Order)

### US1 – Seller Onboarding & Business Setup (P1 – MVP) 🎯
**As a** home food business owner  
**I want to** sign up and configure my business profile in under 5 minutes  
**So that** I can start publishing menus without technical barriers

**Acceptance Criteria**:
- [ ] Seller signs up via email/password (no phone required; optional for later phases)
- [ ] Onboarding form accepts: business name, logo (image upload), primary contact (email), phone (optional), delivery location (text or coordinates)
- [ ] Seller receives confirmation email with dashboard link
- [ ] Dashboard loads with empty state: "Create your first menu" CTA
- [ ] Form validation is clear and non-technical (e.g., "Logo file must be under 2MB, JPG or PNG")
- [ ] Onboarding time: < 5 minutes for non-technical user

**Test Scenarios**:
- Happy path: New seller signs up, completes profile, receives email
- Edge case: Large image upload (> 2MB) → rejected with user-friendly message
- Edge case: Duplicate email → clear error, password reset link offered

**Out of Scope (Phase 2+)**:
- Social sign-up (Google/WhatsApp)
- Multi-location support
- Advanced branding (theme editor, custom domain)

---

### US2 – Create & Manage Weekly Menu (P1 – MVP) 🎯
**As a** seller  
**I want to** add dishes to a weekly menu in < 5 minutes using a simple form  
**So that** customers can see what I'm offering this week

**Acceptance Criteria**:
- [ ] Seller can create a menu with a title, start/end date (defaults to this week)
- [ ] Add dishes to menu: name, description (50–500 chars), price, image, allergen tags (multi-select)
- [ ] Image upload: drag-drop or file picker; resizes to 800×600 automatically
- [ ] Allergen tags: predefined list (dairy, nuts, gluten, vegan, etc.); multi-select
- [ ] Ability to reorder dishes (drag-drop or up/down arrows)
- [ ] Save & publish button (publishes immediately; live on public menu URL)
- [ ] Edit existing menu: update dish prices, descriptions, reorder, delete dishes
- [ ] Can have only ONE active weekly menu at a time (new weekly menu replaces previous)
- [ ] Time to add 5 dishes: < 3 minutes for non-technical user

**Test Scenarios**:
- Happy path: Seller adds 5 dishes, publishes menu, menu appears on public URL
- Edge case: Seller uploads low-quality image → auto-resized, compressed
- Edge case: Seller edits menu while it's public → changes appear immediately

**Out of Scope (Phase 2+)**:
- Multi-location menus
- Menu categories/sections (simple flat list MVP)
- Scheduling menus weeks in advance
- Import from CSV or OCR (nice-to-have, Phase 2)

---

### US3 – Shareable Public Menu & Social Preview (P1 – MVP) 🎯
**As a** seller or customer  
**I want to** share a menu link on WhatsApp/Instagram that shows a visually appealing preview  
**So that** I can drive orders without manual re-typing

**Acceptance Criteria**:
- [ ] Public menu URL: `https://menu-maker.app/businesses/{slug}/menu` (pretty-printable)
- [ ] Public menu page shows: business name, logo, menu title, all dishes (name, price, description, allergen icons)
- [ ] Page is mobile-friendly and loads in < 2s on 4G
- [ ] Social media preview (OG tags): title, description, image (auto-generated or uploaded)
- [ ] "Share on WhatsApp" button: one-click deep link to WhatsApp with menu URL + "Check out our menu!" text
- [ ] Share button also offers: copy link, share on Facebook (if available Phase 2)
- [ ] Social preview image: templated (1–3 design options), auto-generated with business name + top 3 dishes
- [ ] QR code option: generate QR pointing to menu URL (optional nice-to-have)

**Test Scenarios**:
- Happy path: Seller clicks share, WhatsApp opens with pre-filled text + menu URL
- Happy path: Customer opens menu link in phone browser → mobile-friendly, readable
- Social preview: Post to WhatsApp → preview card shows business name + dishes

**Out of Scope (Phase 2+)**:
- Custom social preview designs
- Advanced template designer
- QR code customization

---

### US4 – Order Capture & Customer Checkout (P1 – MVP) 🎯
**As a** customer  
**I want to** place an order or send an enquiry from the public menu without creating an account  
**So that** I can quickly express intent to order

**Acceptance Criteria**:
- [ ] Public menu includes "Place Order" or "Send Enquiry" button (toggle seller preference)
- [ ] Order form: customer name, phone, delivery type (pickup/delivery), delivery address (if delivery), special notes
- [ ] Customer selects dishes from menu: qty and price populated
- [ ] Order total calculated: sum of dish prices + delivery fee (if applicable)
- [ ] "Confirm Order" submits; customer receives email confirmation
- [ ] Seller receives email notification (and optionally WhatsApp notification in Phase 2) with order details
- [ ] Seller can view order in dashboard with: customer info, dishes, total, status (pending → paid/fulfilled → completed)
- [ ] Manual order status updates by seller: pending → confirmed → ready for pickup/out for delivery → fulfilled
- [ ] Enquiry flow: optional, allows customer to ask questions before ordering (future Phase 2: chatbot)

**Test Scenarios**:
- Happy path: Customer places order, receives email, seller sees order in dashboard
- Happy path: Seller marks order as fulfilled, order moves to history
- Edge case: Customer enters invalid phone → form validation error, clear message

**Out of Scope (MVP)**:
- Online payment (Phase 2+)
- Auto-confirm via payment (Phase 2+)
- Customer login & order history (Phase 2+)
- Delivery tracking map (Phase 3+)

---

### US5 – Basic Reporting & Order Management (P1 – MVP) 🎯
**As a** seller  
**I want to** see a summary of orders, sales, and export data for records/accounting  
**So that** I can track business performance and keep records

**Acceptance Criteria**:
- [ ] Dashboard shows: total orders this week, total sales (currency), average order value
- [ ] Orders list: filterable by date range, status (pending/confirmed/fulfilled)
- [ ] Each order row: customer name, dishes, total, status, actions (edit notes, mark fulfilled, delete)
- [ ] CSV export: download orders for a date range with all details (customer, dishes, quantities, total, fees, net)
- [ ] Reporting tab: simple charts (orders/day, revenue/day for past 7/14/30 days)
- [ ] Mobile-friendly: data fits on phone screen (scrollable table or card view)

**Test Scenarios**:
- Happy path: Seller filters orders by date, exports CSV
- Happy path: Dashboard shows correct total sales and order count

**Out of Scope (Phase 2+)**:
- Tax reports
- Profit analysis
- Advanced analytics (funnel, repeat customer rate, etc.)
- Integration with accounting software

---

### US6 – Delivery Rules & Fee Calculation (P1 – MVP) 🎯
**As a** seller  
**I want to** configure how I charge for delivery (flat rate, distance-based, or free)  
**So that** orders calculate the correct total including delivery

**Acceptance Criteria**:
- [ ] Seller configures delivery rules in settings:
  - Flat fee (e.g., "Rs. 50 per delivery")
  - Distance-based: base fee + per-km (e.g., "Rs. 20 base + Rs. 5 per km")
  - Free delivery option
  - Minimum order value for free delivery (optional)
- [ ] During checkout, delivery fee is calculated and shown before confirming order
- [ ] Rounding rules: distance rounded to nearest km (configurable)
- [ ] Delivery fee can be waived per-order by seller (manual override in order details)
- [ ] CSV export includes delivery fee breakdown

**Test Scenarios**:
- Happy path: Seller sets flat fee; order calculated correctly
- Edge case: Distance-based fee with rounding (e.g., 2.3 km → 2 or 3 km per rule)

**Out of Scope (Phase 2+)**:
- Real geolocation/maps integration
- Delivery partners integration
- Zone-based pricing

---

### US7 – Manual Payment & Payout Instructions (P1 – MVP) 🎯
**As a** seller  
**I want to** configure how customers pay and how I receive payouts  
**So that** I can operate without third-party payment gateways initially

**Acceptance Criteria**:
- [ ] Seller configures payment method in settings:
  - Cash on pickup/delivery (default)
  - Bank transfer (seller provides account details)
  - UPI (seller provides UPI ID)
  - Other manual method (text field)
- [ ] Payment instruction appears on order confirmation to customer
- [ ] Order status includes payment status: unpaid → paid (seller marks manually)
- [ ] Seller can mark order paid in dashboard or via email link (one-click "Mark Paid")
- [ ] Payout info: seller manually provides bank details or UPI (stored encrypted)
- [ ] CSV export includes payment status per order

**Test Scenarios**:
- Happy path: Seller sets bank transfer as payment method; appears on customer email
- Happy path: Seller marks order paid from dashboard

**Out of Scope (Phase 2+)**:
- Automated payouts
- Integration with payment processors
- Payout scheduling
- Fee deduction

---

## Non-Functional Requirements

### Performance
- **Page Load**: Public menu and order form < 2s on 4G (Lighthouse > 90)
- **API Latency**: 99th percentile < 500ms
- **Database Queries**: < 100ms for typical queries (N+1 avoided)
- **Images**: Auto-compressed to < 200KB; lazy-loaded on mobile

### Security
- **HTTPS**: All traffic encrypted
- **Auth**: JWT tokens (15 min expiry, refresh token 7 days for web)
- **Input Validation**: All inputs validated server-side; XSS/SQL injection prevented
- **Rate Limiting**: 10 login attempts per IP per hour; 100 orders/seller/day
- **Data Privacy**: PII (phone, emails) masked in logs; no payment details stored (reference only)

### Accessibility
- **WCAG 2.1 Level AA**: Color contrast, keyboard navigation, alt text for images
- **Mobile**: Responsive 320px–2560px; touch-friendly buttons (min 44×44px)
- **Screen Readers**: Critical flows (order form, dashboard) tested

### Localization (MVP Phase)
- **Language**: English primary; support for one additional language (RTL) in Phase 2
- **Currency**: Support USD, INR, EUR (configurable per seller; Phase 2)
- **Timezone**: Auto-detect or allow manual setting

### Reliability
- **Uptime**: 99% target (alert on < 99.5%)
- **Data Backup**: Daily automated backups (Heroku/Render managed)
- **Error Handling**: Graceful degradation; user-friendly error messages
- **Retry Logic**: Async tasks (email notifications) retry up to 3× with exponential backoff

---

## Edge Cases & Assumptions

**Assumptions**:
- Sellers are in supported timezones (will default to Asia/Kolkata for MVP, expand later)
- Most sellers use phones to manage orders (mobile PWA primary experience)
- Customers discover menu via WhatsApp share from sellers (not app store search)
- Payment initially manual; no PCI compliance burden

**Edge Cases Handled**:
- Seller publishes empty menu → show warning, allow publish after 1+ dish added
- Customer orders > inventory → seller manually manages (no inventory tracking MVP)
- Delivery address invalid/missing → order form requires it for delivery type
- Seller deletes menu while order pending → order stays in history; reference menu info in order record

---

## Acceptance Checklist

- [ ] All user stories have independent acceptance criteria
- [ ] Non-functional requirements (performance, security) are measurable
- [ ] MVP scope is clear (no Phase 2+ features in acceptance criteria)
- [ ] Each story tested with 2+ scenarios (happy path + edge case)
- [ ] Accessibility requirements included (WCAG Level AA)
- [ ] Success metrics tied to business outcomes (time-to-listing, repeat orders)

---

## Out-of-Scope (Deferred to Phase 2+)

- Integrated payment processing (Stripe, PayPal, local PSP)
- Automated payouts and fee deduction
- Customer accounts and order history
- Advanced menu scheduling (multiple weeks ahead)
- AI-assisted OCR/text import
- Multi-language UI and RTL layout
- Reviews and ratings
- Complaint/return workflows
- Integration with POS or delivery partners
- Tax compliance and invoice generation

---

## Testing Strategy

**Unit Tests**: Business logic (fee calculation, order totals, status transitions)  
**Contract Tests**: API endpoints and request/response schemas  
**Integration Tests**: End-to-end workflows (signup → menu → order → payout)  
**E2E Tests**: Critical user journeys in Playwright (seller signup, menu publish, order place)  
**Acceptance Tests**: Verify success metrics (time-to-listing, email delivery, CSV export accuracy)  

**Test Coverage Goal**: > 70% (unit + integration); all API endpoints contract tested.
