## Role summary
You are the product owner for MenuMaker: a lightweight web-first platform (with supporting mobile apps) to help home-based food businesses create, share and monetise weekly menus and event catering. Your remit: convert the idea into clear, prioritized product requirements that favour high-impact, low-effort features, preserve platform parity where it matters, and enable fast go-to-market.

## Target users (concise)
Primary users: home food caterers and tiffin makers who:
- Are non-technical and value simplicity
- Sell via WhatsApp/Instagram/Facebook, and need a central public menu and ordering flow
- Offer weekly rotating menus (tiffins) and ad-hoc event/catering orders
- Mix pickup and delivery (delivery fees often distance-based, rounded or occasionally waived)

Secondary users: small neighbourhood restaurants, cottage food producers, and early-stage micro-caterers expanding beyond chat-based orders.

Key constraints to respect
- Low-cost hosting and operations at launch (predictable monthly costs)
- Simple onboarding and minimal configuration required from users
- Support for multiple currencies/locales and LTR/RTL languages

## High-level product goals
- Make it trivial for a seller to publish a menu and accept orders or enquiries from customers.
- Reduce time-to-first-listing (target: < 10 minutes for a basic menu).
- Enable sharing on chat/social platforms with a single tappable link and attractive preview image.
- Drive repeat orders via simple re-order and weekly subscription flows.

## Tiny contract (inputs / outputs / success)
- Input: seller name, logo, 5–20 dishes (name, price, description, image, allergens), delivery rules, payout info
- Output: shareable menu URL + social image, order capture (checkout or enquiry), basic sales report and payouts
- Success criteria (MVP): 100 sellers onboarded in month 1; avg time-to-listing < 10 minutes; 20% weekly repeat order rate after onboarding.

## Edge cases & assumptions
- Assume many sellers are mobile-first and will use WhatsApp for discovery.
- Payments may not be available in all markets at MVP — support manual payment and mark orders paid when seller confirms.
- Delivery rounding/waivers are seller-configurable (platform should support simple rounding rules, not complex logistics).

## Prioritised feature list (MVP-first)

Must-have (MVP)
- Seller onboarding wizard (business name, logo, contact, basic branding)
- Create & group dishes into a weekly menu (name, price, description, image, allergen tags)
- Shareable menu URL with auto-generated social preview image (1–3 templates)
- Simple order capture: customer can place order or send enquiry; seller receives order via email/portal and optionally WhatsApp notification
- Basic reporting: orders list, daily/weekly sales summary, CSV export
- Manual payment support + basic payout instructions for seller
- Simple delivery rules: flat/ distance-based input and rounding options

High-impact, low-effort early wins
- One-click “Share on WhatsApp” + WhatsApp deep link with menu preview
- Quick menu import: parse plain text or OCR from an image into dish list (AI-assisted, optional)
- Templated disclaimers/privacy policy and menu copy for sellers to reuse
- Re-order button for customers to repeat previous orders

Nice-to-have (post-MVP)
- Integrated payments (Stripe/PayPal/local PSPs) with automated fee deduction and scheduled payouts
- Tiered subscriptions, promotions and coupon codes
- Multi-language support, RTL layout
- Intelligent suggestions: price estimates, allergen inference, portion suggestions (AI)

Longer-term (scale)
- Multi-merchant marketplace features, advanced reporting for taxation, complaint/returns workflow, review moderation, and deeper integrations (POS, delivery partners).

## MVP acceptance criteria (concrete)
- Seller can create and publish a menu with at least 5 items in under 10 minutes.
- Shareable link loads a readable menu page and generates a social preview image for WhatsApp/Facebook.
- Customers can place an order or send an enquiry; seller receives a notification and can view orders in the portal.
- CSV export of orders for a selected date range works and includes order total, fees and payout amount (if manual payout configured).

## Implementation / rollout plan (phased)
- Phase 0 (Week 0–2): Product definition, wireframes, tech choices (web-first React or PWA, small Node/Flask backend), hosting decision (Heroku/Render/Vercel with managed DB), instrument metrics.
- Phase 1 – MVP (Month 0–2): Onboarding wizard, menu editor, shareable menu + social image, order capture (manual/portal), basic reporting, simple delivery rules, manual payouts.
- Phase 2 – Growth (Month 2–6): WhatsApp share flows, OCR/text import AI assistant (optional), basic payments integration (one PSP), tiered subscription and free trial, templated legal copy.
- Phase 3 – Scale (Month 6–12): **Admin backend** (content moderation, support tickets, user management, analytics), multiple PSPs, automated payouts, RTL/l10n, advanced reporting, review/complaints workflows, marketplace features.

### Phase 3: Admin Backend Rationale

At Phase 3 scale (targeting 5,000 sellers), manual operations become unsustainable. An admin backend becomes critical for:

**Operational Efficiency**:
- **Content Moderation**: Review flagged menus, dishes, or business profiles for policy violations (spam, inappropriate content, duplicate businesses)
- **Support Ticket Management**: Handle seller support requests (account issues, payment disputes, technical problems) via structured workflow instead of email chaos
- **User Management**: Suspend/ban abusive accounts, reset passwords, manually verify businesses, manage GDPR deletion requests
- **Platform Analytics**: Monitor key metrics (daily signups, churn rate, payment success rate, API health) in real-time dashboard

**Without admin backend** (Phase 1-2):
- ✅ Manageable with 100-500 sellers (manual email support, spreadsheet tracking)
- ❌ **NOT scalable** to 5,000+ sellers (support backlog grows exponentially, no visibility into abuse/fraud)

**With admin backend** (Phase 3):
- ✅ Support team can resolve 80% of issues via admin UI (no engineering involvement)
- ✅ Content moderation queue prevents spam/abuse from degrading platform quality
- ✅ Real-time monitoring catches payment failures, API errors, or security incidents before users report them
- ✅ Compliance workflows (GDPR deletion, account verification) are auditable and trackable

**Key Features** (see phase-3-admin-backend.md for full spec):
- Admin user authentication with role-based access (SuperAdmin, Support, ContentModerator)
- Seller account management (view, edit, suspend, delete)
- Content moderation queue (flagged dishes, menus, reviews)
- Support ticket system (create, assign, resolve, escalate)
- Platform analytics dashboard (signups, orders, revenue, API health)
- Audit log (all admin actions logged for compliance)

**Cost-Benefit**: 20-25 days development effort in Phase 3 saves 100+ hours/month of manual ops work and prevents platform quality degradation at scale.

## Platform parity notes
- Core features (menu creation, sharing, orders, reporting) must be functionally identical across web and mobile UIs.
- UX differences: mobile should prioritise camera/upload flows, WhatsApp sharing, one-tap publish; web can expose bulk editing, CSV import/export and advanced reporting.

## Tech & hosting suggestions (guiding, not prescriptive)
- Frontend: React + PWA (fast mobile experience) or simple responsive site
- Backend: Node/Express or Python/Flask with a small managed Postgres DB
- Hosting: Start with predictable-cost platform (Heroku/Render/Vercel for frontend + Heroku/Render for backend) and migrate to cloud infra as needed
- Payments: support manual payments first; integrate Stripe or local PSP later depending on market.

## Success metrics (to track)
- Time-to-first-listing (minutes)
- Sellers onboarded / week
- Orders processed / seller / week
- Repeat order rate (7/14/30 day)
- Churn / subscription conversion (if paid)

## Quick deliverables for the next sprint (concrete)
1. UX flows & copy for onboarding and shareable menu (deliverable: clickable wireframes)
2. Working web PWA skeleton + menu editor (deliverable: deployed staging link)
3. One social preview template + WhatsApp share flow (deliverable: tested share link)
4. Instrument metrics and QA checklist (deliverable: metrics dashboard + test cases)

## Risks & mitigations
- Risk: Sellers expect integrated payments at launch. Mitigation: make manual payment easy and clearly communicate PSP rollout timeline.
- Risk: Non-technical users struggle with images or fields. Mitigation: provide sensible defaults, inline help, and a one-click wizard.

## Notes / assumptions
- This document focuses on product requirements and priorities, not implementation-level architecture details.
- Regulatory and complex compliance features (tax aggregation across countries, KYC) are intentionally deferred to later phases.

---

If you want, I can now:
- convert these sprint deliverables into Jira-style tickets, or
- produce a one-page investor-facing one-pager summarising the MVP and go-to-market, or
- implement wireframe mockups (Figma-friendly spec) for the onboarding and share flows.