---
Status: current
Owner: product-platform
Review cadence: per capability-registry change
Last reviewed: 2026-06-20
---

# Capability index

The source of truth for state, owner, flags, route prefixes, consumers, tests, and known stub markers is [capability-registry.yaml](capability-registry.yaml). This page gives each capability exactly one current product section and points historical guides to their replacement.

Shared references:

- Registry: [capability-registry.yaml](capability-registry.yaml)
- OpenAPI: [../../openapi/menumaker.v1.yaml](../../openapi/menumaker.v1.yaml)
- Target architecture: [../architecture/target-state.md](../architecture/target-state.md)
- Operations guide: [../operations/runbooks/index.md](../operations/runbooks/index.md)
- Current status: [status.md](status.md)

## identity_auth

- Owner: identity
- Status: implemented
- Feature flag: AUTH_ENABLED
- Routes: `/api/v1/auth`
- Tests: `auth-session-routes.test.ts`, `jwt.test.ts`, `RefreshSession.test.ts`
- Consumers: web_auth_store, android_token_store, ios_auth_view_model
- Archived predecessors: root auth/security notes are superseded by this section, the registry, and security docs.

## business_catalog

- Owner: seller-experience
- Status: implemented
- Feature flag: BUSINESS_CATALOG_ENABLED
- Routes: `/api/v1/businesses`, `/api/v1/dishes`, `/api/v1/menus`, `/api/v1/media`
- Tests: `BusinessService.test.ts`, `DishService.test.ts`, `MenuService.test.ts`
- Consumers: frontend_menu_editor, android_seller_dashboard, ios_menu_editor
- Archived predecessors: root backend/menu/platform guides are provenance only.

## ordering_checkout

- Owner: ordering
- Status: implemented
- Feature flag: ORDERING_ENABLED
- Routes: `/api/v1/orders`, `/api/v1/cart`, `/api/v1/reorder`
- Tests: `OrderService.test.ts`, `OrderServiceFailure.test.ts`
- Consumers: frontend_orders, android_checkout, ios_cart
- Archived predecessors: reorder/mobile completion reports are superseded by this section and generated contract evidence.

## payments

- Owner: payments
- Status: implemented
- Feature flag: PAYMENTS_ENABLED
- Routes: `/api/v1/payments`, `/api/v1/payment-processors`, `/api/v1/payouts`
- Tests: `payment-webhook.integration.test.ts`, `credential-encryption.test.ts`
- Consumers: frontend_payment_processors, android_customer_payment, ios_payment_view_model
- Archived predecessors: Stripe/payment/payout guides are historical unless linked from the registry as evidence.

## platform_health

- Owner: platform-ops
- Status: implemented
- Feature flag: HEALTH_ENABLED
- Routes: `/api/v1/reports`
- Tests: `AnalyticsService.test.ts`, `telemetry.test.ts`, `health.test.ts`
- Consumers: admin_reports_dashboard
- Archived predecessors: old readiness and report summaries are superseded by [status.md](status.md).

## privacy_compliance

- Owner: privacy
- Status: implemented
- Feature flag: PRIVACY_ENABLED
- Routes: `/api/v1/gdpr`, `/api/v1/settings`
- Tests: `GDPRService.integration.test.ts`
- Consumers: frontend_settings, ios_settings, support_operations
- Archived predecessors: GDPR quick guides are superseded by [../security/data-inventory.yaml](../security/data-inventory.yaml) and [../security/threat-model.md](../security/threat-model.md).

## reviews_marketplace

- Owner: marketplace
- Status: implemented
- Feature flag: MARKETPLACE_ENABLED
- Routes: `/api/v1/reviews`, `/api/v1/marketplace`
- Tests: `ReviewService.test.ts`
- Consumers: frontend_public_menu, android_marketplace, ios_marketplace
- Archived predecessors: marketplace/review root guides are historical.

## coupons_promotions

- Owner: growth
- Status: implemented
- Feature flag: COUPONS_ENABLED
- Routes: `/api/v1/coupons`
- Tests: `CouponService.test.ts`, `EnhancedReferralService.test.ts`
- Consumers: frontend_coupons, android_cart, ios_coupon_browser
- Archived predecessors: coupon promotion guides are superseded by registry-backed service tests.

## referrals

- Owner: growth
- Status: implemented
- Feature flag: REFERRALS_ENABLED
- Routes: `/api/v1/referrals`
- Tests: `EnhancedReferralService.test.ts`
- Consumers: frontend_referrals, ios_referral_view
- Archived predecessors: referral root guides are superseded by registry-backed reward evidence.

## enhanced_referrals_affiliates

- Owner: growth
- Status: disabled
- Feature flag: ENHANCED_REFERRALS_ENABLED
- Routes: `/api/v1/affiliate`, `/api/v1/viral`, `/api/v1/leaderboard`
- Tests: `EnhancedReferralService.test.ts`
- Consumers: admin_growth_console
- Archived predecessors: affiliate expansion guides are historical until this capability is enabled.

## moderation

- Owner: trust-safety
- Status: implemented
- Feature flag: MODERATION_ENABLED
- Routes: `/api/v1/admin`
- Tests: `ModerationService.test.ts`
- Consumers: admin_moderation_queue
- Archived predecessors: admin backend guide is superseded by service tests and audit requirements.

## notification_outbox

- Owner: notifications
- Status: implemented
- Feature flag: NOTIFICATIONS_ENABLED
- Routes: `/api/v1/notifications`, `/api/v1/whatsapp`
- Tests: `NotificationOutbox.integration.test.ts`, `WhatsAppService.test.ts`
- Consumers: ios_notifications, android_notifications, support_operations
- Archived predecessors: WhatsApp setup notes are operational history unless promoted into a runbook.

## pos_sync

- Owner: integrations
- Status: disabled
- Feature flag: POS_SYNC_ENABLED
- Routes: `/api/v1/pos`
- Tests: `POSSyncService.test.ts`
- Consumers: frontend_integrations
- Archived predecessors: POS integration guide is historical until Square certification and pilot evidence are recorded.

## delivery_partner

- Owner: logistics
- Status: disabled
- Feature flag: DELIVERY_PARTNER_ENABLED
- Routes: `/api/v1/delivery`
- Tests: `DeliveryService.test.ts`
- Consumers: seller_order_detail
- Archived predecessors: delivery integration guide is historical until provider credentials and certification exist.

## ocr_import

- Owner: seller-experience
- Status: disabled
- Feature flag: OCR_ENABLED
- Routes: `/api/v1/ocr`
- Tests: `OCRService.test.ts`
- Consumers: seller_menu_import
- Archived predecessors: OCR import guide is historical until provider key and privacy review are complete.

## tax_reporting

- Owner: finance
- Status: disabled
- Feature flag: TAX_REPORTING_ENABLED
- Routes: `/api/v1/tax`
- Tests: `TaxReportService.test.ts`
- Consumers: seller_reports
- Archived predecessors: tax compliance guide is historical until tax evidence and waiver tracking are complete.

## subscriptions

- Owner: monetization
- Status: disabled
- Feature flag: SUBSCRIPTIONS_ENABLED
- Routes: `/api/v1/subscriptions`
- Tests: `subscription-webhook.integration.test.ts`
- Consumers: frontend_subscription_page
- Archived predecessors: subscription/payment phase guides are historical until paid-plan launch decision.

## i18n

- Owner: localization
- Status: implemented
- Feature flag: I18N_ENABLED
- Routes: `/api/v1/i18n`
- Tests: `TranslationService.test.ts`
- Consumers: frontend_settings, seller_menu_editor
- Archived predecessors: i18n root guide is superseded by registry-backed translation service evidence.
