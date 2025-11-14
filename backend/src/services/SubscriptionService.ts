import Stripe from 'stripe';
import { Repository } from 'typeorm';
import { Subscription, SubscriptionTier, SUBSCRIPTION_TIERS } from '../models/Subscription.js';
import { Business } from '../models/Business.js';
import { Order } from '../models/Order.js';
import { AppDataSource } from '../config/database.js';
import { logMetric, logSecurityEvent } from '../utils/logger.js';

/**
 * Subscription service for managing Stripe Billing and subscription tiers
 */
export class SubscriptionService {
  private stripe: Stripe;
  private subscriptionRepository: Repository<Subscription>;
  private businessRepository: Repository<Business>;
  private orderRepository: Repository<Order>;

  constructor() {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }

    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-11-20.acacia',
      typescript: true,
    });

    this.subscriptionRepository = AppDataSource.getRepository(Subscription);
    this.businessRepository = AppDataSource.getRepository(Business);
    this.orderRepository = AppDataSource.getRepository(Order);
  }

  /**
   * Create a Stripe customer for a business
   */
  async createStripeCustomer(business: Business, email?: string): Promise<string> {
    try {
      const customer = await this.stripe.customers.create({
        email: email || business.email,
        name: business.name,
        metadata: {
          business_id: business.id,
          business_name: business.name,
        },
      });

      return customer.id;
    } catch (error) {
      const stripeError = error as Stripe.errors.StripeError;
      const customError = new Error(`Failed to create Stripe customer: ${stripeError.message}`) as Error & {
        statusCode: number;
        code: string;
      };
      customError.statusCode = 500;
      customError.code = 'STRIPE_CUSTOMER_CREATION_FAILED';
      throw customError;
    }
  }

  /**
   * Create or upgrade a subscription
   */
  async createSubscription(
    businessId: string,
    tier: SubscriptionTier,
    options?: {
      trialDays?: number;
      email?: string;
    }
  ): Promise<{ subscription: Subscription; clientSecret?: string }> {
    try {
      // Get business
      const business = await this.businessRepository.findOne({
        where: { id: businessId },
      });

      if (!business) {
        const error = new Error('Business not found') as Error & {
          statusCode: number;
          code: string;
        };
        error.statusCode = 404;
        error.code = 'BUSINESS_NOT_FOUND';
        throw error;
      }

      // Get or create subscription record
      let subscription = await this.subscriptionRepository.findOne({
        where: { business_id: businessId },
      });

      if (!subscription) {
        subscription = this.subscriptionRepository.create({
          business_id: businessId,
          tier: 'free',
          status: 'active',
        });
        await this.subscriptionRepository.save(subscription);
      }

      // If upgrading to free tier, cancel any existing Stripe subscription
      if (tier === 'free') {
        if (subscription.stripe_subscription_id) {
          await this.cancelSubscription(businessId);
        }

        subscription.tier = 'free';
        subscription.status = 'active';
        subscription.stripe_subscription_id = undefined;
        subscription.stripe_price_id = undefined;
        subscription.current_period_start = undefined;
        subscription.current_period_end = undefined;

        await this.subscriptionRepository.save(subscription);

        return { subscription };
      }

      // For paid tiers, create Stripe subscription
      const tierConfig = SUBSCRIPTION_TIERS[tier];

      // Create or get Stripe customer
      if (!subscription.stripe_customer_id) {
        const customerId = await this.createStripeCustomer(business, options?.email);
        subscription.stripe_customer_id = customerId;
        await this.subscriptionRepository.save(subscription);
      }

      // Create Stripe subscription
      const stripeSubscription = await this.stripe.subscriptions.create({
        customer: subscription.stripe_customer_id,
        items: [{ price: tierConfig.priceId! }],
        trial_period_days: options?.trialDays || 14, // Default 14-day trial
        payment_behavior: 'default_incomplete',
        payment_settings: {
          payment_method_types: ['card'],
          save_default_payment_method: 'on_subscription',
        },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          business_id: businessId,
          tier: tier,
        },
      });

      // Update subscription record
      subscription.tier = tier;
      subscription.status = stripeSubscription.status === 'trialing' ? 'trialing' : 'incomplete';
      subscription.stripe_subscription_id = stripeSubscription.id;
      subscription.stripe_price_id = tierConfig.priceId;
      subscription.current_period_start = new Date(stripeSubscription.current_period_start * 1000);
      subscription.current_period_end = new Date(stripeSubscription.current_period_end * 1000);

      if (stripeSubscription.trial_start && stripeSubscription.trial_end) {
        subscription.trial_start = new Date(stripeSubscription.trial_start * 1000);
        subscription.trial_end = new Date(stripeSubscription.trial_end * 1000);
      }

      await this.subscriptionRepository.save(subscription);

      // Get client secret for payment confirmation
      const latestInvoice = stripeSubscription.latest_invoice as Stripe.Invoice;
      const paymentIntent = latestInvoice?.payment_intent as Stripe.PaymentIntent;
      const clientSecret = paymentIntent?.client_secret;

      // Log metric
      if (process.env.NODE_ENV === 'production') {
        logMetric(console as any, 'subscription_created', tierConfig.price / 100, {
          businessId,
          tier,
        });
      }

      return { subscription, clientSecret: clientSecret || undefined };
    } catch (error) {
      const stripeError = error as Stripe.errors.StripeError;
      const customError = new Error(`Failed to create subscription: ${stripeError.message}`) as Error & {
        statusCode: number;
        code: string;
        details: unknown;
      };
      customError.statusCode = 500;
      customError.code = 'SUBSCRIPTION_CREATION_FAILED';
      customError.details = stripeError;
      throw customError;
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    businessId: string,
    options?: {
      immediate?: boolean; // Cancel immediately vs. at period end
    }
  ): Promise<Subscription> {
    try {
      const subscription = await this.subscriptionRepository.findOne({
        where: { business_id: businessId },
      });

      if (!subscription) {
        const error = new Error('Subscription not found') as Error & {
          statusCode: number;
          code: string;
        };
        error.statusCode = 404;
        error.code = 'SUBSCRIPTION_NOT_FOUND';
        throw error;
      }

      if (!subscription.stripe_subscription_id) {
        // Free tier, just mark as canceled
        subscription.status = 'canceled';
        subscription.canceled_at = new Date();
        await this.subscriptionRepository.save(subscription);
        return subscription;
      }

      // Cancel Stripe subscription
      if (options?.immediate) {
        await this.stripe.subscriptions.cancel(subscription.stripe_subscription_id);
        subscription.status = 'canceled';
        subscription.canceled_at = new Date();
      } else {
        await this.stripe.subscriptions.update(subscription.stripe_subscription_id, {
          cancel_at_period_end: true,
        });
        subscription.cancel_at_period_end = true;
      }

      await this.subscriptionRepository.save(subscription);

      return subscription;
    } catch (error) {
      const stripeError = error as Stripe.errors.StripeError;
      const customError = new Error(`Failed to cancel subscription: ${stripeError.message}`) as Error & {
        statusCode: number;
        code: string;
      };
      customError.statusCode = 500;
      customError.code = 'SUBSCRIPTION_CANCELLATION_FAILED';
      throw customError;
    }
  }

  /**
   * Resume a canceled subscription
   */
  async resumeSubscription(businessId: string): Promise<Subscription> {
    try {
      const subscription = await this.subscriptionRepository.findOne({
        where: { business_id: businessId },
      });

      if (!subscription || !subscription.stripe_subscription_id) {
        const error = new Error('Subscription not found') as Error & {
          statusCode: number;
          code: string;
        };
        error.statusCode = 404;
        error.code = 'SUBSCRIPTION_NOT_FOUND';
        throw error;
      }

      // Resume Stripe subscription
      await this.stripe.subscriptions.update(subscription.stripe_subscription_id, {
        cancel_at_period_end: false,
      });

      subscription.cancel_at_period_end = false;
      subscription.canceled_at = undefined;

      await this.subscriptionRepository.save(subscription);

      return subscription;
    } catch (error) {
      const stripeError = error as Stripe.errors.StripeError;
      const customError = new Error(`Failed to resume subscription: ${stripeError.message}`) as Error & {
        statusCode: number;
        code: string;
      };
      customError.statusCode = 500;
      customError.code = 'SUBSCRIPTION_RESUME_FAILED';
      throw customError;
    }
  }

  /**
   * Get subscription by business ID
   */
  async getSubscription(businessId: string): Promise<Subscription | null> {
    return await this.subscriptionRepository.findOne({
      where: { business_id: businessId },
      relations: ['business'],
    });
  }

  /**
   * Handle Stripe subscription webhooks
   */
  async handleSubscriptionWebhook(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;

    const localSubscription = await this.subscriptionRepository.findOne({
      where: { stripe_subscription_id: subscription.id },
    });

    if (!localSubscription) {
      console.error(`Subscription not found for Stripe subscription: ${subscription.id}`);
      return;
    }

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        localSubscription.status = subscription.status as any;
        localSubscription.current_period_start = new Date(subscription.current_period_start * 1000);
        localSubscription.current_period_end = new Date(subscription.current_period_end * 1000);
        localSubscription.cancel_at_period_end = subscription.cancel_at_period_end;

        if (subscription.canceled_at) {
          localSubscription.canceled_at = new Date(subscription.canceled_at * 1000);
        }

        if (subscription.trial_start && subscription.trial_end) {
          localSubscription.trial_start = new Date(subscription.trial_start * 1000);
          localSubscription.trial_end = new Date(subscription.trial_end * 1000);
        }

        await this.subscriptionRepository.save(localSubscription);
        break;

      case 'customer.subscription.deleted':
        localSubscription.status = 'canceled';
        localSubscription.canceled_at = new Date();
        await this.subscriptionRepository.save(localSubscription);
        break;

      case 'customer.subscription.trial_will_end':
        // Send notification to business (implement in Phase 2.1 WhatsApp)
        console.log(`Trial ending soon for subscription: ${subscription.id}`);
        break;
    }
  }

  /**
   * Check if business has reached order limit for current billing period
   */
  async checkOrderLimit(businessId: string): Promise<{
    allowed: boolean;
    current: number;
    limit: number;
    isUnlimited: boolean;
  }> {
    const subscription = await this.getSubscription(businessId);

    if (!subscription) {
      return { allowed: false, current: 0, limit: 0, isUnlimited: false };
    }

    const limit = subscription.getMaxOrders();

    // Unlimited orders
    if (limit === -1) {
      return { allowed: true, current: 0, limit: -1, isUnlimited: true };
    }

    // Get order count for current billing period
    const periodStart = subscription.current_period_start || new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    );

    const periodEnd = subscription.current_period_end || new Date(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      0
    );

    const orderCount = await this.orderRepository.count({
      where: {
        business_id: businessId,
        created_at: {
          $gte: periodStart,
          $lte: periodEnd,
        } as any,
      },
    });

    return {
      allowed: orderCount < limit,
      current: orderCount,
      limit,
      isUnlimited: false,
    };
  }

  /**
   * Create Stripe Customer Portal session for subscription management
   */
  async createPortalSession(businessId: string, returnUrl: string): Promise<string> {
    try {
      const subscription = await this.getSubscription(businessId);

      if (!subscription || !subscription.stripe_customer_id) {
        const error = new Error('No Stripe customer found') as Error & {
          statusCode: number;
          code: string;
        };
        error.statusCode = 404;
        error.code = 'STRIPE_CUSTOMER_NOT_FOUND';
        throw error;
      }

      const session = await this.stripe.billingPortal.sessions.create({
        customer: subscription.stripe_customer_id,
        return_url: returnUrl,
      });

      return session.url;
    } catch (error) {
      const stripeError = error as Stripe.errors.StripeError;
      const customError = new Error(`Failed to create portal session: ${stripeError.message}`) as Error & {
        statusCode: number;
        code: string;
      };
      customError.statusCode = 500;
      customError.code = 'PORTAL_SESSION_FAILED';
      throw customError;
    }
  }

  /**
   * Get all subscriptions (admin)
   */
  async getAllSubscriptions(filters?: {
    tier?: SubscriptionTier;
    status?: string;
  }): Promise<Subscription[]> {
    const where: any = {};
    if (filters?.tier) where.tier = filters.tier;
    if (filters?.status) where.status = filters.status;

    return await this.subscriptionRepository.find({
      where,
      relations: ['business'],
      order: { created_at: 'DESC' },
    });
  }
}
