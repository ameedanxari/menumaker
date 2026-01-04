import { DataSource } from 'typeorm';
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
import { Review, ReviewResponse } from '../models/Review.js';
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

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  // Synchronize is set to true for development (product not live yet)
  // Set to false when deploying to production and use migrations
  synchronize: process.env.NODE_ENV !== 'production',
  logging: process.env.NODE_ENV === 'development',
  entities: [
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
    ReviewResponse,
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
  ],
  subscribers: [],
});
