import type { CommandEnvelope, ContextName, DomainEventEnvelope, QueryEnvelope } from '../kernel/contracts.js';

export type ContextLayer = 'domain' | 'application' | 'infrastructure' | 'http';

export interface ContextCapability {
  readonly name: string;
  readonly enabledByDefault: boolean;
  readonly requiredAdapters: readonly string[];
}

export interface ContextModule {
  readonly name: ContextName;
  readonly displayName: string;
  readonly owns: readonly string[];
  readonly reads: readonly string[];
  readonly capabilities: readonly ContextCapability[];
  readonly commands: readonly string[];
  readonly queries: readonly string[];
  readonly events: readonly string[];
  readonly routes: readonly string[];
  readonly repositories: readonly string[];
  readonly services: readonly string[];
  readonly readiness: (adapters?: Record<string, unknown>) => ContextReadiness;
}

export interface ContextReadiness {
  readonly context: ContextName;
  readonly ready: boolean;
  readonly missingAdapters: readonly string[];
}

const required = (context: ContextName, names: readonly string[], adapters: Record<string, unknown> = {}): ContextReadiness => {
  const missingAdapters = names.filter((name) => !adapters[name]);
  return { context, ready: missingAdapters.length === 0, missingAdapters };
};

export const contextModules: readonly ContextModule[] = [
  {
    name: 'identity',
    displayName: 'Identity',
    owns: ['User', 'UserSettings', 'CookieConsent'],
    reads: ['Subscription'],
    capabilities: [{ name: 'account-identity', enabledByDefault: true, requiredAdapters: ['userRepository'] }],
    commands: ['identity.register_user', 'identity.refresh_session', 'identity.update_settings'],
    queries: ['identity.user_profile', 'identity.settings'],
    events: ['identity.user_registered', 'identity.settings_changed'],
    routes: ['/api/v1/auth', '/api/v1/settings'],
    repositories: ['userRepository', 'settingsRepository'],
    services: ['authService'],
    readiness: (adapters) => required('identity', ['userRepository'], adapters),
  },
  {
    name: 'businessCatalog',
    displayName: 'Business Catalog',
    owns: ['Business', 'BusinessSettings', 'Menu', 'MenuItem', 'Dish', 'DishCategory', 'CommonDish'],
    reads: ['User'],
    capabilities: [{ name: 'catalog-management', enabledByDefault: true, requiredAdapters: ['businessRepository'] }],
    commands: ['catalog.create_business', 'catalog.publish_menu', 'catalog.update_dish'],
    queries: ['catalog.public_menu', 'catalog.seller_catalog'],
    events: ['catalog.menu_published', 'catalog.dish_changed'],
    routes: ['/api/v1/businesses', '/api/v1/menus', '/api/v1/dishes'],
    repositories: ['businessRepository', 'menuRepository', 'dishRepository'],
    services: ['catalogService'],
    readiness: (adapters) => required('businessCatalog', ['businessRepository'], adapters),
  },
  {
    name: 'ordering',
    displayName: 'Ordering',
    owns: ['SavedCart', 'Order', 'OrderItem'],
    reads: ['Business', 'Dish', 'Coupon', 'Payment'],
    capabilities: [{ name: 'ordering', enabledByDefault: true, requiredAdapters: ['orderRepository'] }],
    commands: ['ordering.place_order', 'ordering.update_status', 'ordering.cancel_order'],
    queries: ['ordering.customer_orders', 'ordering.seller_board'],
    events: ['ordering.order_placed', 'ordering.status_changed'],
    routes: ['/api/v1/cart', '/api/v1/orders'],
    repositories: ['orderRepository', 'cartRepository'],
    services: ['orderService'],
    readiness: (adapters) => required('ordering', ['orderRepository'], adapters),
  },
  {
    name: 'paymentsBilling',
    displayName: 'Payments/Billing',
    owns: ['Payment', 'PaymentProcessor', 'Payout', 'PayoutSchedule', 'Subscription', 'TaxInvoice'],
    reads: ['Order', 'User'],
    capabilities: [{ name: 'payments', enabledByDefault: false, requiredAdapters: ['paymentGateway'] }],
    commands: ['payments.authorize', 'payments.capture', 'billing.renew_subscription'],
    queries: ['payments.state', 'payments.payout_ledger'],
    events: ['payments.authorized', 'payments.captured', 'billing.subscription_changed'],
    routes: ['/api/v1/payments', '/api/v1/subscriptions', '/api/v1/payouts'],
    repositories: ['paymentRepository'],
    services: ['paymentService'],
    readiness: (adapters) => required('paymentsBilling', ['paymentGateway'], adapters),
  },
  {
    name: 'promotionsReferrals',
    displayName: 'Promotions/Referrals',
    owns: ['Coupon', 'Referral', 'EnhancedReferral'],
    reads: ['User', 'Order'],
    capabilities: [{ name: 'promotions-referrals', enabledByDefault: true, requiredAdapters: ['promotionRepository'] }],
    commands: ['promotions.issue_coupon', 'promotions.redeem_coupon', 'referrals.apply'],
    queries: ['promotions.eligibility', 'referrals.stats'],
    events: ['promotions.coupon_redeemed', 'referrals.reward_granted'],
    routes: ['/api/v1/coupons', '/api/v1/referrals'],
    repositories: ['promotionRepository'],
    services: ['referralService'],
    readiness: (adapters) => required('promotionsReferrals', ['promotionRepository'], adapters),
  },
  {
    name: 'marketplaceReviews',
    displayName: 'Marketplace/Reviews',
    owns: ['Marketplace', 'MarketplaceListing', 'Review', 'ReviewHelpful'],
    reads: ['Business', 'Dish', 'User'],
    capabilities: [{ name: 'marketplace-reviews', enabledByDefault: true, requiredAdapters: ['marketplaceRepository'] }],
    commands: ['marketplace.publish_listing', 'reviews.submit', 'reviews.mark_helpful'],
    queries: ['marketplace.search', 'reviews.summary'],
    events: ['marketplace.listing_changed', 'reviews.review_submitted'],
    routes: ['/api/v1/marketplace', '/api/v1/reviews'],
    repositories: ['marketplaceRepository', 'reviewRepository'],
    services: ['marketplaceService'],
    readiness: (adapters) => required('marketplaceReviews', ['marketplaceRepository'], adapters),
  },
  {
    name: 'fulfilmentIntegrations',
    displayName: 'Fulfilment/Integrations',
    owns: ['POSIntegration', 'DeliveryIntegration'],
    reads: ['Order', 'Business'],
    capabilities: [{ name: 'fulfilment-integrations', enabledByDefault: false, requiredAdapters: ['integrationGateway'] }],
    commands: ['pos.sync', 'delivery.dispatch'],
    queries: ['integrations.health', 'delivery.status'],
    events: ['fulfilment.delivery_dispatched', 'integrations.sync_failed'],
    routes: ['/api/v1/pos', '/api/v1/delivery', '/api/v1/integrations'],
    repositories: ['integrationRepository'],
    services: ['posSyncService'],
    readiness: (adapters) => required('fulfilmentIntegrations', ['integrationGateway'], adapters),
  },
  {
    name: 'notifications',
    displayName: 'Notifications',
    owns: ['Notification', 'NotificationDevice', 'OrderNotification'],
    reads: ['User', 'Order'],
    capabilities: [{ name: 'notifications', enabledByDefault: true, requiredAdapters: ['notificationOutbox'] }],
    commands: ['notifications.enqueue', 'notifications.register_device', 'notifications.mark_read'],
    queries: ['notifications.inbox'],
    events: ['notifications.enqueued', 'notifications.delivered'],
    routes: ['/api/v1/notifications'],
    repositories: ['notificationRepository'],
    services: ['notificationService'],
    readiness: (adapters) => required('notifications', ['notificationOutbox'], adapters),
  },
  {
    name: 'complianceAdmin',
    displayName: 'Compliance/Admin',
    owns: ['AdminUser', 'AuditLog', 'ContentFlag', 'DeletionRequest', 'FeatureFlag', 'LegalTemplate', 'SupportTicket'],
    reads: ['User', 'Business', 'Review'],
    capabilities: [{ name: 'compliance-admin', enabledByDefault: true, requiredAdapters: ['auditRepository'] }],
    commands: ['admin.record_audit', 'privacy.request_deletion', 'admin.resolve_flag'],
    queries: ['admin.audit_trail', 'privacy.request_queue'],
    events: ['compliance.deletion_requested', 'admin.flag_resolved'],
    routes: ['/api/v1/admin', '/api/v1/gdpr'],
    repositories: ['auditRepository'],
    services: ['gdprService'],
    readiness: (adapters) => required('complianceAdmin', ['auditRepository'], adapters),
  },
  {
    name: 'reporting',
    displayName: 'Reporting',
    owns: ['TaxReport'],
    reads: ['Order', 'Payment', 'Payout', 'AuditLog'],
    capabilities: [{ name: 'reporting', enabledByDefault: true, requiredAdapters: ['reportProjectionStore'] }],
    commands: ['reporting.rebuild_projection', 'reporting.export'],
    queries: ['reporting.sales_dashboard', 'reporting.tax_summary'],
    events: ['reporting.projection_rebuilt'],
    routes: ['/api/v1/reports', '/api/v1/tax-reports'],
    repositories: ['reportRepository'],
    services: ['reportService'],
    readiness: (adapters) => required('reporting', ['reportProjectionStore'], adapters),
  },
];

export function createContextRegistry(modules: readonly ContextModule[] = contextModules): Map<ContextName, ContextModule> {
  const registry = new Map<ContextName, ContextModule>();
  for (const module of modules) {
    if (registry.has(module.name)) {
      throw new Error(`Duplicate context module: ${module.name}`);
    }
    registry.set(module.name, module);
  }
  return registry;
}

export function routeOwners(modules: readonly ContextModule[] = contextModules): Record<string, ContextName> {
  return Object.fromEntries(
    modules.flatMap((module) => module.routes.map((route) => [route, module.name] as const))
  );
}

export function assertPublishedContract(envelope: CommandEnvelope<string, unknown> | QueryEnvelope<string, unknown> | DomainEventEnvelope<string, unknown>): void {
  if (!envelope.owner) throw new Error('Published contract requires an owner');
  if (!envelope.name.includes('.')) throw new Error(`Published contract name must be namespaced: ${envelope.name}`);
}
