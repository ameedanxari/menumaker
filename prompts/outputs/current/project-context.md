# Project Context

_Derived from:_
- `MY_PROJECT.md` — production-readiness objective and supported platforms.
- `package.json`, `backend/`, `frontend/`, and `shared/` — JavaScript workspace topology and implemented API/web domains.
- `android/` and `ios/` — native seller/customer clients, build configuration, navigation, and test surfaces.
- `infrastructure/`, `.github/workflows/`, and `docker-compose.yml` — local and production delivery intent.
- `specs/`, root Markdown files, and `docs/` — requirements, historical plans, guides, and status claims.

## Roles
- **Customer:** discovers sellers, browses menus, orders, pays, tracks delivery, reviews, and manages profile/preferences.
- **Seller:** manages a food business, dishes, menus, orders, promotions, payments, payouts, reports, and integrations.
- **Super admin:** manages users, moderation, analytics, feature flags, audit logs, and other administrators.
- **Moderator:** reviews content flags and applies moderation actions.
- **Support agent:** handles support tickets and reads user/business context without moderation authority.
- **Delivery partner:** external actor represented by delivery integration and tracking data, not a first-party portal.

## Product Identity
- **Product name:** MenuMaker
- **Short name / code name:** MenuMaker
- **iOS bundle ID:** `com.creatrixe.MenuMaker`
- **Android application ID:** `com.menumaker` with `.seller` and `.customer` flavor suffixes
- **Web app slug:** `menumaker`
- **Store listing title:** MenuMaker
- **Default locale:** English (`en`); Hindi, Tamil, Urdu, and Arabic resources also exist in native clients.

## Design Context
- **UI surfaces present:** web, seller mobile, customer mobile, admin API; no admin web portal observed.
- **Existing theme authority:** yes — established web tokens plus native color/theme sources exist.
- **Design source files inspected:** `frontend/design-tokens.json`, `frontend/src/design-tokens.json`, `frontend/src/styles/tokens.css`, `frontend/tailwind.config.js`, `android/app/src/main/kotlin/com/menumaker/ui/theme/`, `ios/MenuMaker/Shared/Theme/ColorTheme.swift`.
- **Token/source of truth:** ambiguous; web has duplicate token JSON plus generated Tailwind tokens, while native platforms maintain independent values.
- **Tailwind usage:** Tailwind 3 `tailwind.config.js` backed by `tailwind-tokens.cjs`.
- **CSS/UI framework:** Tailwind/React, Material 3/Jetpack Compose, SwiftUI.
- **Component library:** web `components/ui`, `components/common`, and `components/forms`; native reusable components are platform-local.
- **Typography style:** platform-local defaults/scales; no proven cross-platform typography authority.
- **Color/style notes:** orange primary palette, semantic success/warning/error/info colors, light/dark support; token drift risk across platforms.
- **Navigation style:** web dashboard layout; Android Compose navigation; iOS seller/customer tab bars.
- **Visual density:** standard.
- **Reference/research needs:** none because existing product style is authoritative; missing states and accessibility require implementation review, not external visual research.
- **Redesign requested:** no.

## Entities
- `User { id: uuid, email: string, password_hash: string, full_name?: string, phone?: string, address?: string, role: string, referral_code?: string, account_credit_cents: integer }`
- `Business { id: uuid, owner_id: uuid, name: string, slug: string, primary_color: string, locale: string, timezone: string, is_published: boolean }`
- `BusinessSettings { id: uuid, business_id: uuid, delivery/payment/currency settings }`
- `Dish { id: uuid, business_id: uuid, category_id?: uuid, name: string, price_cents: integer, is_available: boolean }`
- `Menu { id: uuid, business_id: uuid, status: draft|published|archived, version: integer }`
- `MenuItem { id: uuid, menu_id: uuid, dish_id: uuid, price_override_cents?: integer }`
- `Order { id: uuid, business_id: uuid, menu_id: uuid, customer_id?: uuid, total_cents: integer, payment_status: string, order_status: string }`
- `OrderItem { id: uuid, order_id: uuid, dish_id: uuid, quantity: integer, price_at_purchase_cents: integer }`
- `Payment { id: uuid, order/business references, processor identifiers, amount/status fields }`
- `Subscription { id: uuid, business/customer and Stripe billing state }`
- `Payout { id: uuid, business_id: uuid, gross/platform/net amounts, status }`
- `Coupon`, `Review`, `Referral`, `Notification`, `POSIntegration`, `DeliveryIntegration`, `AuditLog`, and `SupportTicket` are implemented as backend entities.

## Relationships
- `User` owns `Business` (1:0..1).
- `Business` owns `Dish`, `DishCategory`, `Menu`, `Order`, and `Payout` (1:many).
- `Menu` contains `MenuItem` and receives `Order` (1:many).
- `Dish` appears in `MenuItem` and `OrderItem` (1:many).
- `Order` contains `OrderItem`, notifications, and payment state (1:many / 1:0..many).
- `AdminUser` acts on users, businesses, content flags, support tickets, and audit logs through role-gated routes.

## Flows
- **Seller onboarding:** sign up → authenticate → create business → configure profile/settings → create dishes/menu → publish.
- **Customer order:** discover seller → browse menu → add cart items → apply promotion → choose fulfillment/payment → create order → track status → review.
- **Seller fulfilment:** receive order → confirm/prepare → mark ready/out for delivery/fulfilled → payout/reporting.
- **Subscription:** choose tier → create Stripe subscription → process webhook → enforce usage/tier → portal/cancel/resume.
- **Administration:** authenticate admin → review tickets/flags/users → moderate or configure flags → record audit event.
- **Release:** validate/build/test → provision infrastructure → deploy web/API → build/sign seller and customer apps → store submission.

## Constraints
- Web, backend, iOS, and Android must reach integrated feature parity and production-readiness.
- PostgreSQL is the canonical relational store; MinIO/S3-compatible storage is used for media.
- Node.js 20+, npm 10+, iOS 17+, and Android API 30+ are declared.
- Existing product theme must be preserved; consolidation should establish one governed token pipeline.
- Tests may use a fake backend, but production builds must not expose mock payment or sample-data paths.

## Regulatory & Research Context
- **Regulated domain signals:** payments, identity, privacy/GDPR, tax reporting — backend services, `.env.example`, and guides.
- **Jurisdiction / market:** India is strongly implied by INR, Razorpay, Paytm, PhonePe, Hindi/Tamil/Urdu resources; GDPR support also targets EU data rights.
- **Cloud/provider signals:** AWS Terraform provider plus S3-compatible storage; deployment target is otherwise unresolved.
- **Sensitive data classes:** credentials/tokens, identity/contact data, delivery addresses/location, payment metadata, tax records, and uploaded media.
- **Current research required:** yes — payment webhook integrity, browser/mobile credential storage, and CI supply-chain controls affect production safety.
- **Source-ledger seed rows:** Stripe webhook documentation, OWASP session guidance, GitHub Actions secure-use guidance, Android security guidance, and exact local implementation paths.
- **Fan-out recommended:** yes — backend, frontend, Android, iOS, infrastructure/CI, architecture/contracts, and documentation are distinct audit slices; this run performs them serially because delegated agents were not requested.

## Tech Decisions
- TypeScript/Fastify/TypeORM/PostgreSQL backend.
- React/Vite/Tailwind/Zustand/TanStack Query web application.
- Kotlin/Compose/Retrofit/Room/Hilt Android application with seller/customer flavors.
- Swift/SwiftUI iOS application using URLSession and Keychain.
- npm workspaces for `backend`, `frontend`, and `shared`.
- GitHub Actions for CI/CD and Terraform with AWS provider for intended production infrastructure.

## Existing Implementation Status
- `backend/`: ~65% — broad route/entity coverage, but release, security, migrations, stubs, and contract correctness are incomplete.
- `frontend/`: ~70% — primary seller/customer web flows exist, but auth storage, test scope, UI consolidation, and API drift remain.
- `android/`: ~55% — extensive structure/tests exist, but core seller data, settings, media, payment, duplicated screens, and route contracts are incomplete.
- `ios/`: ~60% — broad SwiftUI surface exists, but target/scheme packaging, API contract drift, and production/test client separation are incomplete.
- `shared/`: ~35% — core TypeScript schemas exist and are used by part of the backend, but not by the frontend or native clients and not for many newer domains.
- `infrastructure/`: ~10% — root configuration references absent modules; variables and outputs are empty.
- `.github/workflows/`: ~30% — broad workflow intent exists, but many checks fail open and deployment contains placeholder/nonexistent targets.
- Documentation: ~30% reliable — useful specs/guides exist but 56 root Markdown files contain contradictory and stale completion claims.

## Open Questions
- Which AWS runtime and managed services are the intended production deployment target?
- Should seller and customer mobile experiences ship as separate store apps or one role-switching binary per platform?
- Which payment processors and geographic markets are launch scope versus post-launch integrations?
- Is GDPR/EU launch scope mandatory at first release, and what retention/deletion policy has legal approval?
- Which historical documents must be retained as records versus archived or deleted after consolidation?
