import { FastifyInstance} from 'fastify';
import { SubscriptionService } from '../services/SubscriptionService.js';
import { authenticate } from '../middleware/auth.js';
import { SubscriptionTier, SUBSCRIPTION_TIERS } from '../models/Subscription.js';
import { logSecurityEvent } from '../utils/logger.js';

export async function subscriptionRoutes(fastify: FastifyInstance): Promise<void> {
  const subscriptionService = new SubscriptionService();

  /**
   * GET /subscriptions/tiers
   * Get available subscription tiers and pricing
   * Public endpoint
   */
  fastify.get('/tiers', async (request, reply) => {
    const tiers = Object.entries(SUBSCRIPTION_TIERS).map(([key, config]) => ({
      tier: key,
      name: config.name,
      price: config.price,
      currency: config.currency,
      interval: config.interval,
      features: config.features,
      description: config.description,
    }));

    reply.send({
      success: true,
      data: { tiers },
    });
  });

  /**
   * GET /subscriptions/current
   * Get current subscription for authenticated business
   * Authenticated endpoint
   */
  fastify.get('/current', {
    preHandler: authenticate,
  }, async (request, reply) => {    // Get business from auth middleware
    const businessId = request.user!.businessId;

    if (!businessId) {
      reply.status(400).send({
        success: false,
        error: {
          code: 'NO_BUSINESS',
          message: 'User has no business associated',
        },
      });
      return;
    }

    const subscription = await subscriptionService.getSubscription(businessId);

    if (!subscription) {
      reply.status(404).send({
        success: false,
        error: {
          code: 'SUBSCRIPTION_NOT_FOUND',
          message: 'No subscription found for this business',
        },
      });
      return;
    }

    const tierConfig = subscription.getTierConfig();

    reply.send({
      success: true,
      data: {
        subscription: {
          id: subscription.id,
          tier: subscription.tier,
          status: subscription.status,
          isActive: subscription.isActive(),
          isInTrial: subscription.isInTrial(),
          currentPeriodStart: subscription.current_period_start,
          currentPeriodEnd: subscription.current_period_end,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          trialEnd: subscription.trial_end,
          features: tierConfig.features,
          price: tierConfig.price,
          currency: tierConfig.currency,
        },
      },
    });

  });

  /**
   * POST /subscriptions/subscribe
   * Create or upgrade subscription
   * Authenticated endpoint
   */
  fastify.post('/subscribe', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { tier, trialDays, email } = request.body as {
      tier: SubscriptionTier;
      trialDays?: number;
      email?: string;
    };

    // Validate tier
    if (!['free', 'starter', 'pro'].includes(tier)) {
      reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_TIER',
          message: 'Invalid subscription tier',
        },
      });
      return;
    }    const businessId = request.user!.businessId;

    if (!businessId) {
      reply.status(400).send({
        success: false,
        error: {
          code: 'NO_BUSINESS',
          message: 'User has no business associated',
        },
      });
      return;
    }

    const { subscription, clientSecret } = await subscriptionService.createSubscription(
      businessId,
      tier,
      { trialDays, email }
    );

    // Log security event
    logSecurityEvent(request.log, `Subscription created/upgraded: ${tier}`, {
      requestId: request.id,
      userId: request.user!.userId,
      businessId,
      tier,
      severity: 'low',
    });

    reply.send({
      success: true,
      data: {
        subscription: {
          id: subscription.id,
          tier: subscription.tier,
          status: subscription.status,
          currentPeriodStart: subscription.current_period_start,
          currentPeriodEnd: subscription.current_period_end,
          trialEnd: subscription.trial_end,
        },
        clientSecret, // For payment confirmation if needed
      },
    });

  });

  /**
   * POST /subscriptions/cancel
   * Cancel subscription
   * Authenticated endpoint
   */
  fastify.post('/cancel', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { immediate } = request.body as { immediate?: boolean };    const businessId = request.user!.businessId;

    if (!businessId) {
      reply.status(400).send({
        success: false,
        error: {
          code: 'NO_BUSINESS',
          message: 'User has no business associated',
        },
      });
      return;
    }

    const subscription = await subscriptionService.cancelSubscription(businessId, {
      immediate,
    });

    // Log security event
    logSecurityEvent(request.log, `Subscription canceled: ${subscription.tier}`, {
      requestId: request.id,
      userId: request.user!.userId,
      businessId,
      immediate,
      severity: 'medium',
    });

    reply.send({
      success: true,
      data: {
        subscription: {
          id: subscription.id,
          tier: subscription.tier,
          status: subscription.status,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          canceledAt: subscription.canceled_at,
        },
      },
    });

  });

  /**
   * POST /subscriptions/resume
   * Resume canceled subscription
   * Authenticated endpoint
   */
  fastify.post('/resume', {
    preHandler: authenticate,
  }, async (request, reply) => {    const businessId = request.user!.businessId;

    if (!businessId) {
      reply.status(400).send({
        success: false,
        error: {
          code: 'NO_BUSINESS',
          message: 'User has no business associated',
        },
      });
      return;
    }

    const subscription = await subscriptionService.resumeSubscription(businessId);

    // Log security event
    logSecurityEvent(request.log, `Subscription resumed: ${subscription.tier}`, {
      requestId: request.id,
      userId: request.user!.userId,
      businessId,
      severity: 'low',
    });

    reply.send({
      success: true,
      data: {
        subscription: {
          id: subscription.id,
          tier: subscription.tier,
          status: subscription.status,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        },
      },
    });

  });

  /**
   * GET /subscriptions/portal
   * Get Stripe Customer Portal URL for subscription management
   * Authenticated endpoint
   */
  fastify.get('/portal', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { returnUrl } = request.query as { returnUrl: string };

    if (!returnUrl) {
      reply.status(400).send({
        success: false,
        error: {
          code: 'MISSING_RETURN_URL',
          message: 'Return URL is required',
        },
      });
      return;
    }    const businessId = request.user!.businessId;

    if (!businessId) {
      reply.status(400).send({
        success: false,
        error: {
          code: 'NO_BUSINESS',
          message: 'User has no business associated',
        },
      });
      return;
    }

    const portalUrl = await subscriptionService.createPortalSession(businessId, returnUrl);

    reply.send({
      success: true,
      data: { portalUrl },
    });

  });

  /**
   * GET /subscriptions/usage
   * Get current usage vs. limits
   * Authenticated endpoint
   */
  fastify.get('/usage', {
    preHandler: authenticate,
  }, async (request, reply) => {    const businessId = request.user!.businessId;

    if (!businessId) {
      reply.status(400).send({
        success: false,
        error: {
          code: 'NO_BUSINESS',
          message: 'User has no business associated',
        },
      });
      return;
    }

    const usage = await subscriptionService.checkOrderLimit(businessId);

    reply.send({
      success: true,
      data: { usage },
    });

  });

  /**
   * POST /subscriptions/webhook
   * Handle Stripe subscription webhook events
   * Public endpoint (called by Stripe)
   */
  fastify.post('/webhook', {
    config: {
      rawBody: true,
    },
  }, async (request, reply) => {
    const signature = request.headers['stripe-signature'];

    if (!signature || typeof signature !== 'string') {
      reply.status(400).send({
        success: false,
        error: {
          code: 'MISSING_SIGNATURE',
          message: 'Stripe signature header is required',
        },
      });
      return;
    }    const rawBody = (request as any).rawBody || request.body;

    // Construct and verify webhook event
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_SUBSCRIPTIONS;
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET_SUBSCRIPTIONS not configured');
    }

    const stripe = (subscriptionService as any).stripe;
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    // Process subscription event
    await subscriptionService.handleSubscriptionWebhook(event);

    // Log webhook processing
    logSecurityEvent(request.log, `Subscription webhook processed: ${event.type}`, {
      requestId: request.id,
      method: request.method,
      path: request.url,
      severity: 'low',
    });

    reply.send({
      success: true,
      data: {
        processed: true,
        eventType: event.type,
        eventId: event.id,
      },
    });

  });
}
