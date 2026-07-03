import type { FastifyReply, FastifyRequest } from 'fastify';

export type CapabilityStatus = 'implemented' | 'disabled' | 'deprecated';

export interface CapabilityDefinition {
  name: string;
  owner: string;
  launchScope: boolean;
  status: CapabilityStatus;
  featureFlag: string;
  requiredEnv?: string[];
  optionalEnv?: string[];
  routePrefixes: string[];
  contractOperationIds: string[];
  tests: string[];
  clientOrOperatorConsumers: string[];
}

export interface CapabilityReadiness {
  name: string;
  status: CapabilityStatus;
  enabled: boolean;
  reason?: string;
  owner: string;
  routePrefixes: string[];
  tests: string[];
  dependenciesReady: boolean;
}

export class FeatureUnavailableError extends Error {
  readonly code = 'FEATURE_UNAVAILABLE';
  readonly statusCode = 503;
  constructor(readonly capability: string, message?: string) {
    super(message || `Capability ${capability} is unavailable`);
  }
}

export const capabilityRegistry: CapabilityDefinition[] = [
  {
    name: 'identity_auth',
    owner: 'identity',
    launchScope: true,
    status: 'implemented',
    featureFlag: 'AUTH_ENABLED',
    requiredEnv: ['JWT_SECRET'],
    routePrefixes: ['/api/v1/auth'],
    contractOperationIds: ['login', 'signup', 'refreshToken', 'logout'],
    tests: ['auth-session-routes.test.ts', 'jwt.test.ts', 'RefreshSession.test.ts'],
    clientOrOperatorConsumers: ['web_auth_store', 'android_token_store', 'ios_auth_view_model'],
  },
  {
    name: 'business_catalog',
    owner: 'seller-experience',
    launchScope: true,
    status: 'implemented',
    featureFlag: 'BUSINESS_CATALOG_ENABLED',
    routePrefixes: ['/api/v1/businesses', '/api/v1/dishes', '/api/v1/menus', '/api/v1/media'],
    contractOperationIds: ['listBusinesses', 'createDish', 'updateDish', 'uploadMedia'],
    tests: ['BusinessService.test.ts', 'DishService.test.ts', 'MenuService.test.ts'],
    clientOrOperatorConsumers: ['frontend_menu_editor', 'android_seller_dashboard', 'ios_menu_editor'],
  },
  {
    name: 'ordering_checkout',
    owner: 'ordering',
    launchScope: true,
    status: 'implemented',
    featureFlag: 'ORDERING_ENABLED',
    routePrefixes: ['/api/v1/orders', '/api/v1/cart', '/api/v1/reorder'],
    contractOperationIds: ['createOrder', 'getOrder', 'listCustomerOrders'],
    tests: ['OrderService.test.ts', 'OrderServiceFailure.test.ts'],
    clientOrOperatorConsumers: ['frontend_orders', 'android_checkout', 'ios_cart'],
  },
  {
    name: 'payments',
    owner: 'payments',
    launchScope: true,
    status: 'implemented',
    featureFlag: 'PAYMENTS_ENABLED',
    optionalEnv: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
    routePrefixes: ['/api/v1/payments', '/api/v1/payment-processors', '/api/v1/payouts'],
    contractOperationIds: ['createPaymentIntent', 'handlePaymentWebhook', 'listPaymentProcessors'],
    tests: ['payment-webhook.integration.test.ts', 'credential-encryption.test.ts'],
    clientOrOperatorConsumers: ['frontend_payment_processors', 'android_customer_payment', 'ios_payment_view_model'],
  },
  {
    name: 'platform_health',
    owner: 'platform-ops',
    launchScope: true,
    status: 'implemented',
    featureFlag: 'HEALTH_ENABLED',
    routePrefixes: ['/api/v1/reports'],
    contractOperationIds: ['getReports', 'exportAnalytics'],
    tests: ['AnalyticsService.test.ts', 'telemetry.test.ts', 'health.test.ts'],
    clientOrOperatorConsumers: ['admin_reports_dashboard'],
  },
  {
    name: 'privacy_compliance',
    owner: 'privacy',
    launchScope: true,
    status: 'implemented',
    featureFlag: 'PRIVACY_ENABLED',
    routePrefixes: ['/api/v1/gdpr', '/api/v1/settings'],
    contractOperationIds: ['exportPrivacyData', 'requestDeletion', 'updateSettings'],
    tests: ['GDPRService.integration.test.ts'],
    clientOrOperatorConsumers: ['frontend_settings', 'ios_settings', 'support_operations'],
  },
  {
    name: 'reviews_marketplace',
    owner: 'marketplace',
    launchScope: true,
    status: 'implemented',
    featureFlag: 'MARKETPLACE_ENABLED',
    routePrefixes: ['/api/v1/reviews', '/api/v1/marketplace'],
    contractOperationIds: ['listMarketplace', 'submitReview', 'favoriteBusiness'],
    tests: ['ReviewService.test.ts'],
    clientOrOperatorConsumers: ['frontend_public_menu', 'android_marketplace', 'ios_marketplace'],
  },
  {
    name: 'coupons_promotions',
    owner: 'growth',
    launchScope: true,
    status: 'implemented',
    featureFlag: 'COUPONS_ENABLED',
    routePrefixes: ['/api/v1/coupons'],
    contractOperationIds: ['createCoupon', 'validateCoupon', 'applyCoupon'],
    tests: ['CouponService.test.ts', 'EnhancedReferralService.test.ts'],
    clientOrOperatorConsumers: ['frontend_coupons', 'android_cart', 'ios_coupon_browser'],
  },
  {
    name: 'referrals',
    owner: 'growth',
    launchScope: true,
    status: 'implemented',
    featureFlag: 'REFERRALS_ENABLED',
    routePrefixes: ['/api/v1/referrals'],
    contractOperationIds: ['createReferral', 'claimReferralReward'],
    tests: ['EnhancedReferralService.test.ts'],
    clientOrOperatorConsumers: ['frontend_referrals', 'ios_referral_view'],
  },
  {
    name: 'enhanced_referrals_affiliates',
    owner: 'growth',
    launchScope: false,
    status: 'disabled',
    featureFlag: 'ENHANCED_REFERRALS_ENABLED',
    routePrefixes: [
      '/api/v1/affiliates',
      '/api/v1/badges',
      '/api/v1/customers/referrals',
      '/api/v1/referrals',
    ],
    contractOperationIds: ['applyForAffiliate', 'approveAffiliate', 'claimViralReward'],
    tests: ['EnhancedReferralService.test.ts'],
    clientOrOperatorConsumers: ['admin_growth_console'],
  },
  {
    name: 'moderation',
    owner: 'trust-safety',
    launchScope: true,
    status: 'implemented',
    featureFlag: 'MODERATION_ENABLED',
    routePrefixes: ['/api/v1/admin'],
    contractOperationIds: ['submitFlag', 'approveFlag', 'rejectFlag'],
    tests: ['ModerationService.test.ts'],
    clientOrOperatorConsumers: ['admin_moderation_queue'],
  },
  {
    name: 'notification_outbox',
    owner: 'notifications',
    launchScope: true,
    status: 'implemented',
    featureFlag: 'NOTIFICATIONS_ENABLED',
    routePrefixes: ['/api/v1/notifications', '/api/v1/whatsapp'],
    contractOperationIds: ['registerNotificationDevice', 'listNotifications', 'sendWhatsApp'],
    tests: ['NotificationOutbox.integration.test.ts', 'WhatsAppService.test.ts'],
    clientOrOperatorConsumers: ['ios_notifications', 'android_notifications', 'support_operations'],
  },
  {
    name: 'pos_sync',
    owner: 'integrations',
    launchScope: false,
    status: 'disabled',
    featureFlag: 'POS_SYNC_ENABLED',
    optionalEnv: ['SQUARE_CLIENT_ID', 'SQUARE_CLIENT_SECRET'],
    routePrefixes: ['/api/v1/pos'],
    contractOperationIds: ['createPOSIntegration', 'syncPOSOrder'],
    tests: ['POSSyncService.test.ts'],
    clientOrOperatorConsumers: ['frontend_integrations'],
  },
  {
    name: 'delivery_partner',
    owner: 'logistics',
    launchScope: false,
    status: 'disabled',
    featureFlag: 'DELIVERY_PARTNER_ENABLED',
    routePrefixes: ['/api/v1/delivery'],
    contractOperationIds: ['createDelivery', 'trackDelivery', 'cancelDelivery'],
    tests: ['DeliveryService.test.ts'],
    clientOrOperatorConsumers: ['seller_order_detail'],
  },
  {
    name: 'ocr_import',
    owner: 'seller-experience',
    launchScope: false,
    status: 'disabled',
    featureFlag: 'OCR_ENABLED',
    optionalEnv: ['ANTHROPIC_API_KEY'],
    routePrefixes: ['/api/v1/ocr'],
    contractOperationIds: ['parseMenuImage', 'parseMenuText'],
    tests: ['OCRService.test.ts'],
    clientOrOperatorConsumers: ['seller_menu_import'],
  },
  {
    name: 'tax_reporting',
    owner: 'finance',
    launchScope: false,
    status: 'disabled',
    featureFlag: 'TAX_REPORTING_ENABLED',
    routePrefixes: ['/api/v1/tax'],
    contractOperationIds: ['generateTaxReport', 'downloadTaxInvoice'],
    tests: ['TaxReportService.test.ts'],
    clientOrOperatorConsumers: ['seller_reports'],
  },
  {
    name: 'subscriptions',
    owner: 'monetization',
    launchScope: false,
    status: 'disabled',
    featureFlag: 'SUBSCRIPTIONS_ENABLED',
    optionalEnv: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET_SUBSCRIPTIONS'],
    routePrefixes: ['/api/v1/subscriptions'],
    contractOperationIds: ['createSubscription', 'handleSubscriptionWebhook'],
    tests: ['subscription-webhook.integration.test.ts'],
    clientOrOperatorConsumers: ['frontend_subscription_page'],
  },
  {
    name: 'i18n',
    owner: 'localization',
    launchScope: true,
    status: 'implemented',
    featureFlag: 'I18N_ENABLED',
    routePrefixes: ['/api/v1/i18n'],
    contractOperationIds: ['listTranslations', 'updateTranslation'],
    tests: ['TranslationService.test.ts'],
    clientOrOperatorConsumers: ['frontend_settings', 'seller_menu_editor'],
  },
];

export function getCapability(name: string): CapabilityDefinition | undefined {
  return capabilityRegistry.find((capability) => capability.name === name);
}

function envFlagEnabled(env: NodeJS.ProcessEnv, flag: string): boolean {
  const value = env[flag];
  if (value === undefined || value === '') return true;
  return !['0', 'false', 'off', 'disabled'].includes(value.toLowerCase());
}

function missingRequired(definition: CapabilityDefinition, env: NodeJS.ProcessEnv): string[] {
  return (definition.requiredEnv ?? []).filter((key) => !env[key]);
}

export function capabilityReadiness(
  definition: CapabilityDefinition,
  env: NodeJS.ProcessEnv = process.env
): CapabilityReadiness {
  const flagEnabled = envFlagEnabled(env, definition.featureFlag);
  const requiredMissing = missingRequired(definition, env);
  const enabled = definition.status === 'implemented' && flagEnabled && requiredMissing.length === 0;
  const reason = definition.status !== 'implemented'
    ? `${definition.status.toUpperCase()}_BY_REGISTRY`
    : !flagEnabled
      ? `${definition.featureFlag}_DISABLED`
      : requiredMissing.length > 0
        ? `MISSING_REQUIRED_ENV:${requiredMissing.join(',')}`
        : undefined;

  return {
    name: definition.name,
    status: definition.status,
    enabled,
    reason,
    owner: definition.owner,
    routePrefixes: definition.routePrefixes,
    tests: definition.tests,
    dependenciesReady: requiredMissing.length === 0,
  };
}

export function getCapabilityReadiness(env: NodeJS.ProcessEnv = process.env): CapabilityReadiness[] {
  return capabilityRegistry.map((definition) => capabilityReadiness(definition, env));
}

export function validateCapabilities(env: NodeJS.ProcessEnv = process.env): CapabilityReadiness[] {
  const readiness = getCapabilityReadiness(env);
  const startupFailures = readiness.filter((item) => {
    const definition = getCapability(item.name)!;
    return definition.launchScope && definition.status === 'implemented' && !item.dependenciesReady;
  });

  if (startupFailures.length > 0) {
    throw new Error(
      `Missing launch-required capability configuration: ${startupFailures
        .map((item) => `${item.name}:${item.reason}`)
        .join('; ')}`
    );
  }

  return readiness;
}

export function assertCapabilityEnabled(name: string, env: NodeJS.ProcessEnv = process.env): CapabilityReadiness {
  const definition = getCapability(name);
  if (!definition) {
    throw new FeatureUnavailableError(name, `Capability ${name} is not registered`);
  }

  const readiness = capabilityReadiness(definition, env);
  if (!readiness.enabled) {
    throw new FeatureUnavailableError(name, readiness.reason || `Capability ${name} is unavailable`);
  }

  return readiness;
}

export function requireCapability(name: string, env: NodeJS.ProcessEnv = process.env) {
  return async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      assertCapabilityEnabled(name, env);
    } catch (error) {
      const unavailable = error instanceof FeatureUnavailableError
        ? error
        : new FeatureUnavailableError(name);
      return reply.status(unavailable.statusCode).send({
        success: false,
        error: {
          code: unavailable.code,
          message: unavailable.message,
          capability: unavailable.capability,
        },
      });
    }
  };
}

export function publicCapabilityDiscovery(env: NodeJS.ProcessEnv = process.env) {
  return getCapabilityReadiness(env)
    .filter((item) => item.enabled)
    .map((item) => ({
      name: item.name,
      owner: item.owner,
      status: item.status,
      route_prefixes: item.routePrefixes,
    }));
}
