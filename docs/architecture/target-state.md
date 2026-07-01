# MenuMaker Target-State Architecture

MenuMaker remains one deployable Fastify modular monolith until ownership,
transactions, and observability are proven. The target state is not a
microservice split. It is a bounded-context map that makes writes, reads,
events, and portal responsibilities explicit enough to test.

## Dependency rule

Contexts expose commands, queries, events, and projections through
`backend/src/kernel/contracts.ts`. A context may read another context through
published queries or projections, but it may not import another context's
mutable entity, repository, service, or route implementation. Seller,
customer, and admin are experiences; they are not canonical data owners.

Allowed direction inside one context is:

`domain -> application -> infrastructure -> http`

The shared kernel is limited to IDs, money, UTC time, errors, command/query
metadata, event envelopes, pagination, and projection checkpoints.

## Bounded contexts

| Context | Purpose | Primary consumers | Commands | Queries/projections | Events |
|---|---|---|---|---|---|
| Identity | Users, admins, sessions, account settings, consent | seller, customer, admin | register user, refresh session, update settings, revoke session | user profile, account settings, consent history | identity.user_registered, identity.settings_changed |
| Business Catalog | Business profiles, menus, dishes, categories, catalog media | seller, customer, marketplace | create business, update menu, publish dish, classify common dish | public menu, seller catalog, catalog projection | catalog.menu_published, catalog.dish_changed |
| Ordering | Carts, orders, order items, reorder flows | customer, seller, fulfilment | create cart, place order, update status, cancel order | customer order list, seller order board, order detail | ordering.order_placed, ordering.status_changed |
| Payments/Billing | Payments, subscriptions, processors, payouts, tax invoices/reports | seller, customer, admin | authorize payment, capture payment, settle payout, renew subscription | payment state, payout ledger, tax report | payments.authorized, payments.captured, billing.subscription_changed |
| Promotions/Referrals | Coupons, referrals, rewards, viral campaigns | seller, customer, reporting | issue coupon, redeem coupon, apply referral, grant reward | coupon eligibility, referral stats | promotions.coupon_redeemed, referrals.reward_granted |
| Marketplace/Reviews | Listings, marketplace search, reviews, moderation signals | customer, seller, admin | publish listing, submit review, mark review helpful, flag content | searchable seller card, review summary | marketplace.listing_changed, reviews.review_submitted |
| Fulfilment/Integrations | POS sync, delivery integrations, processor integrations | seller, operations | sync POS, dispatch delivery, retry integration | integration health, delivery status | fulfilment.delivery_dispatched, integrations.sync_failed |
| Notifications | Notification outbox, devices, order notifications | seller, customer, operations | enqueue notification, register device, mark read | notification inbox, delivery receipts | notifications.enqueued, notifications.delivered |
| Compliance/Admin | Audit logs, deletion requests, content flags, legal templates, feature flags, support | admin, compliance | record audit, request deletion, resolve flag, update feature flag | audit trail, privacy request queue | compliance.deletion_requested, admin.flag_resolved |
| Reporting | Read-only analytics, tax summaries, operational dashboards | seller, admin | rebuild projection, export report | sales dashboard, tax summary, audit evidence | reporting.projection_rebuilt |

## Canonical state ownership

Every TypeORM model under `backend/src/models` has exactly one write owner.
Read projections are listed only where another context may maintain a
denormalized view.

| Entity/Table | Write owner | Read projections |
|---|---|---|
| AdminUser | Compliance/Admin | Identity, Reporting |
| AuditLog | Compliance/Admin | Reporting |
| Business | Business Catalog | Marketplace/Reviews, Reporting |
| BusinessSettings | Business Catalog | Identity, Reporting |
| CommonDish | Business Catalog | Marketplace/Reviews |
| ContentFlag | Compliance/Admin | Marketplace/Reviews |
| CookieConsent | Identity | Compliance/Admin |
| Coupon | Promotions/Referrals | Ordering, Reporting |
| DeletionRequest | Compliance/Admin | Identity |
| DeliveryIntegration | Fulfilment/Integrations | Ordering, Reporting |
| Dish | Business Catalog | Ordering, Marketplace/Reviews |
| DishCategory | Business Catalog | Marketplace/Reviews |
| EnhancedReferral | Promotions/Referrals | Reporting |
| FeatureFlag | Compliance/Admin | all contexts as read-only config |
| LegalTemplate | Compliance/Admin | Identity |
| Marketplace | Marketplace/Reviews | Business Catalog, Reporting |
| MarketplaceListing | Marketplace/Reviews | Business Catalog, Reporting |
| Menu | Business Catalog | Ordering, Marketplace/Reviews |
| MenuItem | Business Catalog | Ordering |
| Notification | Notifications | Identity, Reporting |
| NotificationDevice | Notifications | Identity |
| Order | Ordering | Payments/Billing, Notifications, Reporting |
| OrderItem | Ordering | Business Catalog, Reporting |
| OrderNotification | Notifications | Ordering |
| POSIntegration | Fulfilment/Integrations | Business Catalog |
| Payment | Payments/Billing | Ordering, Reporting |
| PaymentProcessor | Payments/Billing | Fulfilment/Integrations |
| Payout | Payments/Billing | Reporting |
| PayoutSchedule | Payments/Billing | Reporting |
| Referral | Promotions/Referrals | Identity, Reporting |
| Review | Marketplace/Reviews | Business Catalog, Reporting |
| ReviewHelpful | Marketplace/Reviews | Reporting |
| SavedCart | Ordering | Business Catalog |
| Subscription | Payments/Billing | Identity, Reporting |
| SupportTicket | Compliance/Admin | Identity |
| TaxInvoice | Payments/Billing | Reporting, Compliance/Admin |
| TaxReport | Reporting | Payments/Billing, Compliance/Admin |
| User | Identity | Ordering, Marketplace/Reviews, Notifications, Reporting |
| UserSettings | Identity | Notifications |

## Workflow boundaries

| Workflow | Atomic boundary | Idempotency key | Ordering key | Replay owner | Fail-closed behavior |
|---|---|---|---|---|---|
| Order placement | Ordering creates `Order` + `OrderItem` in one transaction, then emits `ordering.order_placed` | `place_order:{cart_id}:{actor_id}` | `order:{order_id}` | Ordering | no payment authorization without committed order |
| Payment authorization | Payments/Billing authorizes against a committed order projection | `payment_authorize:{order_id}:{processor}` | `payment:{payment_id}` | Payments/Billing | order remains pending_payment and notification is withheld |
| Subscription renewal | Payments/Billing renews subscription and writes invoice atomically | `subscription_renew:{subscription_id}:{period}` | `subscription:{subscription_id}` | Payments/Billing | feature access is not extended until invoice is committed |
| Referral reward | Promotions/Referrals grants reward after eligibility and anti-replay checks | `referral_reward:{referral_id}:{referred_user_id}` | `referral:{referral_id}` | Promotions/Referrals | reward is denied on ambiguous eligibility |
| Audit/privacy request | Compliance/Admin writes audit trail before side effects | `audit:{actor_id}:{correlation_id}` | `subject:{subject_id}` | Compliance/Admin | destructive privacy action stops if audit write fails |
| Notification delivery | Notifications claims an outbox row and records delivery attempt | `notify:{event_id}:{channel}` | `notification:{notification_id}` | Notifications | delivery is retried; source transaction is not rolled back |
| Reporting projection | Reporting rebuilds from event/projection checkpoints | `projection:{name}:{checkpoint}` | `projection:{name}` | Reporting | stale projection is marked stale rather than guessed |

## Forbidden writers

- Portals must not write canonical state directly; they call context
  commands.
- Reporting never writes source tables.
- Marketplace/Reviews cannot mutate `Business`, `Menu`, or `Dish` records.
- Payments/Billing cannot mutate `Order` status directly; it emits payment
  events consumed by Ordering.
- Notifications cannot mutate order/payment/referral state.
- Shared kernel must not contain repositories, route plugins, or TypeORM
  entities.

## Initial migration stance

The first migration step is additive: publish contracts, modules, ledgers,
and verifiers while keeping current runtime routes intact. Later prompts may
move implementations behind the module registry one context at a time.
