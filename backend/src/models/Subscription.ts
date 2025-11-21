import type { Relation } from 'typeorm';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Business } from './Business.js';

export type SubscriptionTier = 'free' | 'starter' | 'pro';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete';

/**
 * Subscription tier limits and features
 */
export const SUBSCRIPTION_TIERS = {
  free: {
    name: 'Free',
    price: 0,
    priceId: null, // No Stripe price for free tier
    currency: 'INR',
    interval: 'month' as const,
    features: {
      maxOrders: 20, // per month
      stripePayments: false,
      whatsappNotifications: false,
      prioritySupport: false,
      analytics: 'basic' as const,
      customDomain: false,
    },
    description: '20 orders/month, manual payment only, basic support',
  },
  starter: {
    name: 'Starter',
    price: 49900, // Rs. 499 in cents
    priceId: process.env.STRIPE_PRICE_ID_STARTER || 'price_starter', // Set in .env
    currency: 'INR',
    interval: 'month' as const,
    features: {
      maxOrders: 100, // per month
      stripePayments: true,
      whatsappNotifications: false,
      prioritySupport: false,
      analytics: 'standard' as const,
      customDomain: false,
    },
    description: '100 orders/month, Stripe payments, email support',
  },
  pro: {
    name: 'Pro',
    price: 99900, // Rs. 999 in cents
    priceId: process.env.STRIPE_PRICE_ID_PRO || 'price_pro', // Set in .env
    currency: 'INR',
    interval: 'month' as const,
    features: {
      maxOrders: -1, // unlimited
      stripePayments: true,
      whatsappNotifications: true,
      prioritySupport: true,
      analytics: 'advanced' as const,
      customDomain: true,
    },
    description: 'Unlimited orders, all integrations, priority support, WhatsApp',
  },
} as const;

@Entity('subscriptions')
@Index('idx_subscriptions_business_id_unique', ['business_id'], { unique: true })
@Index('idx_subscriptions_tier', ['tier'])
@Index('idx_subscriptions_status', ['status'])
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('idx_subscriptions_business_id_unique', { unique: true })
  business_id!: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business!: Business;

  @Column({ type: 'varchar', length: 20, default: 'free' })
  @Index('idx_subscriptions_tier')
  tier!: SubscriptionTier;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  @Index('idx_subscriptions_status')
  status!: SubscriptionStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  @Index('idx_subscriptions_stripe_customer_id')
  stripe_customer_id?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  stripe_subscription_id?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  stripe_price_id?: string;

  @Column({ type: 'timestamp', nullable: true })
  current_period_start?: Date;

  @Column({ type: 'timestamp', nullable: true })
  @Index('idx_subscriptions_current_period_end')
  current_period_end?: Date;

  @Column({ type: 'boolean', default: false })
  cancel_at_period_end!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  canceled_at?: Date;

  @Column({ type: 'timestamp', nullable: true })
  trial_start?: Date;

  @Column({ type: 'timestamp', nullable: true })
  trial_end?: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  /**
   * Check if subscription is currently in trial period
   */
  isInTrial(): boolean {
    if (!this.trial_end) return false;
    return new Date() < this.trial_end;
  }

  /**
   * Check if subscription is active (including trial)
   */
  isActive(): boolean {
    return this.status === 'active' || this.status === 'trialing';
  }

  /**
   * Get tier configuration
   */
  getTierConfig() {
    return SUBSCRIPTION_TIERS[this.tier];
  }

  /**
   * Check if a feature is available in current tier
   */
  hasFeature(feature: keyof typeof SUBSCRIPTION_TIERS.free.features): boolean {
    const config = this.getTierConfig();
    return !!config.features[feature];
  }

  /**
   * Get max orders allowed per month
   * Returns -1 for unlimited
   */
  getMaxOrders(): number {
    const config = this.getTierConfig();
    return config.features.maxOrders;
  }

  /**
   * Check if subscription allows Stripe payments
   */
  canAcceptOnlinePayments(): boolean {
    return this.hasFeature('stripePayments');
  }
}
