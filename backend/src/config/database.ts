import { DataSource, type DataSourceOptions } from 'typeorm';
import dotenv from 'dotenv';

// Core entities
import { User } from '../models/User.js';
import { Business } from '../models/Business.js';
import { BusinessSettings } from '../models/BusinessSettings.js';
import { Dish } from '../models/Dish.js';
import { DishCategory } from '../models/DishCategory.js';
import { CommonDish } from '../models/CommonDish.js';
import { Menu } from '../models/Menu.js';
import { MenuItem } from '../models/MenuItem.js';
import { Order } from '../models/Order.js';
import { OrderItem } from '../models/OrderItem.js';
import { OrderNotification } from '../models/OrderNotification.js';

// Payment & Subscription entities
import { Payment } from '../models/Payment.js';
import { Payout } from '../models/Payout.js';
import { PayoutSchedule } from '../models/PayoutSchedule.js';
import { PaymentProcessor } from '../models/PaymentProcessor.js';
import { Subscription } from '../models/Subscription.js';

// Tax & Compliance entities
import { TaxInvoice } from '../models/TaxInvoice.js';

// Referral & GDPR entities
import { Referral } from '../models/Referral.js';
import { CookieConsent } from '../models/CookieConsent.js';
import { LegalTemplate } from '../models/LegalTemplate.js';
import { DeletionRequest } from '../models/DeletionRequest.js';

// Reorder & Cart entities
import { SavedCart } from '../models/SavedCart.js';

// Admin Backend entities
import { AdminUser } from '../models/AdminUser.js';
import { SupportTicket } from '../models/SupportTicket.js';
import { FeatureFlag } from '../models/FeatureFlag.js';
import { ContentFlag } from '../models/ContentFlag.js';
import { AuditLog } from '../models/AuditLog.js';

// Review & Marketplace entities
import { Review } from '../models/Review.js';
import {
  MarketplaceSettings,
  MarketplaceAnalytics,
  CustomerFavorite
} from '../models/Marketplace.js';
import { NotificationDevice } from '../models/NotificationDevice.js';

// POS Integration entities
import { POSIntegration, POSSyncLog } from '../models/POSIntegration.js';

// Delivery Integration entities
import {
  DeliveryIntegration,
  DeliveryTracking,
  DeliveryRating
} from '../models/DeliveryIntegration.js';

// Coupon & Promotion entities
import {
  Coupon,
  CouponUsage,
  AutomaticPromotion
} from '../models/Coupon.js';

// Enhanced Referral entities
import {
  CustomerReferral,
  ReferralLeaderboard,
  Affiliate,
  AffiliateClick,
  AffiliatePayout,
  ViralBadge
} from '../models/EnhancedReferral.js';
import { InitialMenuMakerSchema1718841600000 } from '../migrations/1718841600000-InitialMenuMakerSchema.js';

dotenv.config();

export const registeredEntities = [
  // Core entities
  User,
  Business,
  BusinessSettings,
  Dish,
  DishCategory,
  CommonDish,
  Menu,
  MenuItem,
  Order,
  OrderItem,
  OrderNotification,
  // Payment & Subscription
  Payment,
  Payout,
  PayoutSchedule,
  PaymentProcessor,
  Subscription,
  // Tax & Compliance
  TaxInvoice,
  // Referral & GDPR
  Referral,
  CookieConsent,
  LegalTemplate,
  DeletionRequest,
  // Reorder & Cart
  SavedCart,
  // Admin Backend
  AdminUser,
  SupportTicket,
  FeatureFlag,
  ContentFlag,
  AuditLog,
  // Review System
  Review,
  // Marketplace
  MarketplaceSettings,
  MarketplaceAnalytics,
  CustomerFavorite,
  // Notifications
  NotificationDevice,
  // POS Integration
  POSIntegration,
  POSSyncLog,
  // Delivery Integration
  DeliveryIntegration,
  DeliveryTracking,
  DeliveryRating,
  // Coupons & Promotions
  Coupon,
  CouponUsage,
  AutomaticPromotion,
  // Enhanced Referrals
  CustomerReferral,
  ReferralLeaderboard,
  Affiliate,
  AffiliateClick,
  AffiliatePayout,
  ViralBadge,
];

export const registeredMigrations = [
  InitialMenuMakerSchema1718841600000,
];

export function shouldSynchronize(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.DB_SYNCHRONIZE_LOCAL === 'true' && env.NODE_ENV !== 'production';
}

export function assertProductionSafeDatabaseConfig(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV === 'production' && env.DB_SYNCHRONIZE_LOCAL === 'true') {
    throw new Error('DB_SYNCHRONIZE_LOCAL=true is prohibited when NODE_ENV=production; run TypeORM migrations instead.');
  }
}

export function buildDataSourceOptions(env: NodeJS.ProcessEnv = process.env): DataSourceOptions {
  assertProductionSafeDatabaseConfig(env);
  return {
    type: 'postgres',
    url: env.DATABASE_URL,
    synchronize: shouldSynchronize(env),
    logging: env.NODE_ENV === 'development',
    entities: registeredEntities,
    migrations: registeredMigrations,
    migrationsTableName: 'schema_migrations',
    subscribers: [],
  };
}

export function createAppDataSource(env: NodeJS.ProcessEnv = process.env): DataSource {
  return new DataSource(buildDataSourceOptions(env));
}

export async function getPendingMigrationNames(
  dataSourceLike: Pick<DataSource, 'showMigrations'> & { migrations?: Array<{ name?: string }> }
): Promise<string[]> {
  const hasPendingMigrations = await dataSourceLike.showMigrations();
  if (!hasPendingMigrations) {
    return [];
  }
  return (dataSourceLike.migrations ?? [])
    .map((migration) => migration.name)
    .filter((name): name is string => Boolean(name));
}

export async function assertNoPendingMigrationsForAppStartup(dataSource: DataSource): Promise<void> {
  if (process.env.DB_MIGRATION_JOB === 'true') {
    return;
  }
  const pending = await getPendingMigrationNames(dataSource);
  if (pending.length > 0) {
    throw new Error(`Pending TypeORM migrations block application startup: ${pending.join(', ')}. Run the dedicated migration job first.`);
  }
}

export const AppDataSource = createAppDataSource();
