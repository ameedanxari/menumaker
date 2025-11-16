import { FastifyRequest, FastifyReply } from 'fastify';
import { SubscriptionService } from '../services/SubscriptionService.js';

/**
 * Middleware to check subscription tier limits
 * Use this before creating orders to enforce order limits
 */
export async function checkSubscriptionLimits(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const subscriptionService = new SubscriptionService();

    // Get business ID from request body or params
    const body = request.body as Record<string, unknown>;
    const businessId = (body?.business_id as string) || (request.params as Record<string, string>)?.businessId;

    if (!businessId) {
      // If no business ID, let the route handler deal with validation
      return;
    }

    // Check order limit
    const { allowed, current, limit, isUnlimited } = await subscriptionService.checkOrderLimit(
      businessId
    );

    if (!allowed && !isUnlimited) {
      reply.status(403).send({
        success: false,
        error: {
          code: 'ORDER_LIMIT_REACHED',
          message: `You have reached your order limit (${current}/${limit}). Please upgrade your subscription to continue.`,
          details: {
            current,
            limit,
            upgradeRequired: true,
          },
        },
      });
      return;
    }

    // Attach usage info to request for logging
    (request as any).subscriptionUsage = { current, limit, isUnlimited };
  } catch (error) {
    // Log error but don't block request
    console.error('Subscription limit check failed:', error);
  }
}

/**
 * Middleware to check if a specific feature is available in subscription tier
 */
export function requireFeature(feature: string) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      const subscriptionService = new SubscriptionService();

      // Get business ID from authenticated user
      const businessId = request.user?.businessId;

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
        reply.status(403).send({
          success: false,
          error: {
            code: 'NO_SUBSCRIPTION',
            message: 'No subscription found for this business',
          },
        });
        return;
      }

      // Check if feature is available
      const hasFeature = subscription.hasFeature(feature as any);

      if (!hasFeature) {
        const tierConfig = subscription.getTierConfig();
        reply.status(403).send({
          success: false,
          error: {
            code: 'FEATURE_NOT_AVAILABLE',
            message: `This feature is not available in your current plan (${tierConfig.name}). Please upgrade to access this feature.`,
            details: {
              currentTier: subscription.tier,
              feature,
              upgradeRequired: true,
            },
          },
        });
        return;
      }
    } catch (error) {
      console.error('Feature check failed:', error);
      reply.status(500).send({
        success: false,
        error: {
          code: 'FEATURE_CHECK_FAILED',
          message: 'Failed to verify feature access',
        },
      });
    }
  };
}

/**
 * Middleware to check if subscription is active
 */
export async function requireActiveSubscription(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const subscriptionService = new SubscriptionService();

    const businessId = request.user?.businessId;

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
      reply.status(403).send({
        success: false,
        error: {
          code: 'NO_SUBSCRIPTION',
          message: 'No subscription found for this business',
        },
      });
      return;
    }

    if (!subscription.isActive()) {
      reply.status(403).send({
        success: false,
        error: {
          code: 'SUBSCRIPTION_NOT_ACTIVE',
          message: 'Your subscription is not active. Please reactivate to continue.',
          details: {
            status: subscription.status,
            tier: subscription.tier,
          },
        },
      });
      return;
    }
  } catch (error) {
    console.error('Active subscription check failed:', error);
    reply.status(500).send({
      success: false,
      error: {
        code: 'SUBSCRIPTION_CHECK_FAILED',
        message: 'Failed to verify subscription status',
      },
    });
  }
}
