# Phase 2 & 3 Data Model Extensions

**Document**: phase-2-data-model.md  
**Date**: 2025-11-10  
**Scope**: New entities and schema changes required for Phase 2 growth features

---

## Phase 2 New Entities

### PaymentProcessor
Stores payment processor configuration and API keys for seller (encrypted).

```typescript
// TypeORM Entity
export class PaymentProcessor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Business, (b) => b.paymentProcessors)
  business: Business;

  @Column('varchar', { length: 50 })
  provider: 'stripe' | 'razorpay' | 'phonepe' | 'paytm'; // Phase 2: Stripe only

  @Column('text')
  apiKeyEncrypted: string; // Encrypted Stripe API key

  @Column('text', { nullable: true })
  webhookSigningKeyEncrypted: string; // Encrypted webhook secret

  @Column('varchar', { length: 50 })
  settlementFrequency: 'daily' | 'weekly' | 'monthly'; // When to settle payouts

  @Column('integer', { default: 0 })
  minPayoutThresholdCents: number; // Min amount before payout (e.g., 50000 = Rs. 500)

  @Column('boolean', { default: true })
  isActive: boolean; // Can disable processor anytime

  @Column('timestamp')
  connectedAt: Date;

  @Column('timestamp', { nullable: true })
  lastSuccessfulSync: Date; // Last time payout was successful

  @Column('timestamp')
  createdAt: Date;

  @Column('timestamp', { onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}

// Zod Validation
const PaymentProcessorSchema = z.object({
  provider: z.enum(['stripe', 'razorpay', 'phonepe', 'paytm']),
  apiKeyEncrypted: z.string().min(10),
  settlementFrequency: z.enum(['daily', 'weekly', 'monthly']),
  minPayoutThresholdCents: z.number().int().min(0).max(1000000),
  isActive: z.boolean(),
});
```

### Subscription
Tracks seller's subscription tier (Free, Pro, Business).

```typescript
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Business)
  @JoinColumn()
  business: Business;

  @Column('varchar', { length: 50 })
  tier: 'free' | 'pro' | 'business'; // MVP: 3 tiers

  @Column('varchar', { length: 50 })
  billingCycle: 'monthly' | 'annual'; // Billing frequency

  @Column('integer')
  pricePerCycleCents: number; // Price in cents (e.g., 9900 = Rs. 99)

  @Column('timestamp')
  currentPeriodStart: Date; // Subscription current billing cycle start

  @Column('timestamp')
  currentPeriodEnd: Date; // Subscription current billing cycle end (renewal date)

  @Column('timestamp', { nullable: true })
  trialEndDate: Date; // If in trial, when trial ends

  @Column('boolean', { default: false })
  inTrial: boolean; // New sellers default to trial

  @Column('varchar', { length: 50 })
  status: 'active' | 'past_due' | 'canceled' | 'paused'; // Stripe status

  @Column('text', { nullable: true })
  stripeSubscriptionId: string; // Stripe subscription ID (for Stripe Billing API)

  @Column('integer', { default: 0 })
  failedPaymentCount: number; // Retry count if payment fails

  @Column('timestamp')
  createdAt: Date;

  @Column('timestamp', { onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}

// Zod Validation
const SubscriptionSchema = z.object({
  tier: z.enum(['free', 'pro', 'business']),
  billingCycle: z.enum(['monthly', 'annual']),
  pricePerCycleCents: z.number().int().min(0),
  inTrial: z.boolean(),
  status: z.enum(['active', 'past_due', 'canceled', 'paused']),
});
```

### UserPreferences
Stores user-level preferences (language, timezone, communication preferences).

```typescript
export class UserPreferences {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User)
  @JoinColumn()
  user: User;

  @Column('varchar', { length: 10 })
  language: string; // 'en', 'hi', 'ta', etc. (Phase 3 expansion)

  @Column('varchar', { length: 50 })
  timezone: string; // 'Asia/Kolkata', 'UTC', etc.

  @Column('boolean', { default: true })
  receiveEmailNotifications: boolean;

  @Column('boolean', { default: false })
  receiveWhatsappNotifications: boolean; // Phase 2 feature

  @Column('boolean', { default: false })
  receiveOrderReminders: boolean; // Auto-reminder emails for unpaid orders

  @Column('timestamp')
  createdAt: Date;

  @Column('timestamp', { onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}

// Zod Validation
const UserPreferencesSchema = z.object({
  language: z.string().length(2).optional(),
  timezone: z.string().optional(),
  receiveEmailNotifications: z.boolean(),
  receiveWhatsappNotifications: z.boolean(),
  receiveOrderReminders: z.boolean(),
});
```

### Template
Stores templated legal copy, email templates, etc.

```typescript
export class Template {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Business, (b) => b.templates, { nullable: true })
  business: Business; // Null = system default template

  @Column('varchar', { length: 100 })
  templateType: 'privacy_policy' | 'terms_conditions' | 'refund_policy' | 'allergen_disclaimer';

  @Column('varchar', { length: 50 })
  jurisdiction: string; // 'IN', 'US', 'GB', etc.

  @Column('text')
  content: string; // Markdown content

  @Column('text', { nullable: true })
  customizations: string; // JSON: {businessName, email, phone, etc.} to be replaced

  @Column('varchar', { length: 50 })
  version: string; // v1.0, v1.1, etc. (for audit trail)

  @Column('boolean', { default: false })
  isPublished: boolean; // Published templates appear on public menu

  @Column('timestamp')
  createdAt: Date;

  @Column('timestamp', { onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}

// Zod Validation
const TemplateSchema = z.object({
  templateType: z.enum(['privacy_policy', 'terms_conditions', 'refund_policy', 'allergen_disclaimer']),
  jurisdiction: z.string().length(2),
  content: z.string().min(100),
  version: z.string(),
  isPublished: z.boolean(),
});
```

### OCRImportLog
Audit trail for OCR imports (track what was imported, accuracy, corrections).

```typescript
export class OCRImportLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Business)
  business: Business;

  @ManyToOne(() => Menu, { nullable: true })
  menu: Menu; // Menu created/updated from OCR import

  @Column('varchar', { length: 50 })
  sourceType: 'image' | 'text_paste' | 'pdf'; // What was uploaded

  @Column('text')
  sourceUrl: string; // S3 URL to source image/PDF

  @Column('integer')
  extractedItemCount: number; // How many dishes extracted

  @Column('float')
  confidenceScore: number; // Overall accuracy (0.0–1.0)

  @Column('text')
  extractedJsonRaw: string; // Raw extraction result from OCR/Vision API

  @Column('text', { nullable: true })
  userCorrections: string; // JSON: what user corrected before importing

  @Column('varchar', { length: 50 })
  status: 'pending_review' | 'imported' | 'rejected' | 'partially_imported';

  @Column('timestamp')
  createdAt: Date;

  @Column('timestamp', { onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}

// Zod Validation
const OCRImportLogSchema = z.object({
  sourceType: z.enum(['image', 'text_paste', 'pdf']),
  extractedItemCount: z.number().int().min(1),
  confidenceScore: z.number().min(0).max(1),
  status: z.enum(['pending_review', 'imported', 'rejected', 'partially_imported']),
});
```

---

## Phase 2 Schema Extensions (Existing Entities)

### Business (Extension)
Add new fields to track subscription and payment preferences.

```typescript
// Add to Business entity:

@OneToMany(() => PaymentProcessor, (pp) => pp.business)
paymentProcessors: PaymentProcessor[]; // All connected payment processors

@OneToOne(() => Subscription, (s) => s.business)
subscription: Subscription; // Current subscription tier

@OneToMany(() => Template, (t) => t.business)
templates: Template[]; // Custom legal templates (overrides system defaults)

@Column('varchar', { length: 20 })
whatsappBusinessAccountId: string; // Null if not connected; Phase 2 feature

@Column('boolean', { default: false })
whatsappNotificationsEnabled: boolean; // Seller preference for WhatsApp order notifications

@Column('text', { nullable: true })
legalCopyPublished: string; // JSON: which templates are published (for audit)
```

### Order (Extension)
Add fields to track subscription tier used, re-order status, and processor.

```typescript
// Add to Order entity:

@Column('varchar', { length: 50 })
sellerSubscriptionTierAtTime: 'free' | 'pro' | 'business'; // Snapshot for audit

@Column('varchar', { length: 50 })
paymentProcessor: 'manual' | 'stripe' | 'razorpay'; // Which processor processed (Phase 2: manual or stripe)

@Column('boolean', { default: false })
isReorder: boolean; // Is this a re-order by returning customer

@ManyToOne(() => Order, { nullable: true })
reorderedFrom: Order; // If isReorder=true, link to original order

@Column('varchar', { length: 50 })
stripePaymentIntentId: string; // Stripe payment intent ID (if Stripe payment)

@Column('varchar', { length: 50 })
stripeChargeId: string; // Stripe charge ID (if payment succeeded)

@Column('timestamp', { nullable: true })
paidAt: Date; // When payment was confirmed (useful for financial reconciliation)
```

---

## Phase 3 New Entities (Preview)

### ReviewRating
Customer reviews for seller (Phase 3).

```typescript
export class ReviewRating {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order)
  order: Order; // One review per order (to ensure authenticity)

  @ManyToOne(() => Business)
  seller: Business; // Seller being reviewed

  @Column('varchar', { length: 200 })
  customerName: string; // From order

  @Column('integer')
  rating: number; // 1–5 stars

  @Column('text')
  reviewText: string; // Optional customer review (max 500 chars)

  @Column('simple-array', { nullable: true })
  imageUrls: string[]; // Up to 3 review images (S3 URLs)

  @Column('varchar', { length: 50 })
  status: 'pending' | 'approved' | 'rejected' | 'flagged_for_moderation';

  @Column('timestamp')
  publishedAt: Date; // When review became public

  @Column('text', { nullable: true })
  sellerResponse: string; // Seller's public response

  @Column('timestamp', { nullable: true })
  sellerResponseAt: Date;

  @Column('boolean', { default: false })
  isComplaint: boolean; // Flagged if rating < 3

  @Column('timestamp')
  createdAt: Date;

  @Column('timestamp', { onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
```

### Promotion
Seller-created coupons and discounts (Phase 3).

```typescript
export class Promotion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Business)
  business: Business;

  @Column('varchar', { length: 100 })
  code: string; // Coupon code (e.g., "FEST10")

  @Column('varchar', { length: 50 })
  type: 'fixed_amount' | 'percentage' | 'free_delivery' | 'automatic';

  @Column('integer', { nullable: true })
  discountValue: number; // In cents (e.g., 5000 = Rs. 50) or percentage (e.g., 10)

  @Column('integer', { nullable: true })
  minOrderValue: number; // Minimum order to apply (in cents)

  @Column('timestamp')
  validFrom: Date;

  @Column('timestamp')
  validUntil: Date;

  @Column('integer', { default: 0 })
  usageLimit: number; // 0 = unlimited

  @Column('integer', { default: 0 })
  usedCount: number; // Times used so far

  @Column('boolean', { default: true })
  isActive: boolean;

  @Column('timestamp')
  createdAt: Date;
}
```

### POSIntegration
Track POS system connections (Phase 3).

```typescript
export class POSIntegration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Business)
  business: Business;

  @Column('varchar', { length: 50 })
  posProvider: 'square' | 'dine' | 'zoho'; // Phase 3: which POS

  @Column('text')
  apiKeyEncrypted: string; // Encrypted OAuth token

  @Column('varchar', { length: 100 })
  outletId: string; // POS outlet/location ID

  @Column('boolean', { default: true })
  isActive: boolean;

  @Column('timestamp', { nullable: true })
  lastSyncAt: Date; // Last time orders synced

  @Column('integer', { default: 0 })
  failedSyncCount: number; // Retry tracking

  @Column('timestamp')
  createdAt: Date;
}
```

---

## Database Migration Path (Phase 2)

```sql
-- Migration: Add Phase 2 tables
-- Run: npm run typeorm migration:generate AddPhase2Entities

CREATE TABLE payment_processor (
  id UUID PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES business(id),
  provider VARCHAR(50) NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  webhook_signing_key_encrypted TEXT,
  settlement_frequency VARCHAR(50) DEFAULT 'daily',
  min_payout_threshold_cents INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_successful_sync TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE subscription (
  id UUID PRIMARY KEY,
  business_id UUID NOT NULL UNIQUE REFERENCES business(id),
  tier VARCHAR(50) NOT NULL DEFAULT 'free',
  billing_cycle VARCHAR(50) NOT NULL DEFAULT 'monthly',
  price_per_cycle_cents INTEGER NOT NULL,
  current_period_start TIMESTAMP NOT NULL,
  current_period_end TIMESTAMP NOT NULL,
  trial_end_date TIMESTAMP,
  in_trial BOOLEAN DEFAULT FALSE,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  stripe_subscription_id TEXT,
  failed_payment_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_preferences (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES "user"(id),
  language VARCHAR(10) DEFAULT 'en',
  timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
  receive_email_notifications BOOLEAN DEFAULT TRUE,
  receive_whatsapp_notifications BOOLEAN DEFAULT FALSE,
  receive_order_reminders BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add columns to existing tables
ALTER TABLE business ADD COLUMN whatsapp_business_account_id VARCHAR(20);
ALTER TABLE business ADD COLUMN whatsapp_notifications_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE business ADD COLUMN legal_copy_published TEXT;

ALTER TABLE "order" ADD COLUMN seller_subscription_tier_at_time VARCHAR(50);
ALTER TABLE "order" ADD COLUMN payment_processor VARCHAR(50) DEFAULT 'manual';
ALTER TABLE "order" ADD COLUMN is_reorder BOOLEAN DEFAULT FALSE;
ALTER TABLE "order" ADD COLUMN reordered_from_id UUID REFERENCES "order"(id);
ALTER TABLE "order" ADD COLUMN stripe_payment_intent_id VARCHAR(50);
ALTER TABLE "order" ADD COLUMN stripe_charge_id VARCHAR(50);
ALTER TABLE "order" ADD COLUMN paid_at TIMESTAMP;

-- Indexes for performance
CREATE INDEX idx_payment_processor_business ON payment_processor(business_id);
CREATE INDEX idx_subscription_business ON subscription(business_id);
CREATE INDEX idx_order_payment_processor ON "order"(payment_processor);
CREATE INDEX idx_order_is_reorder ON "order"(is_reorder);
CREATE INDEX idx_order_paid_at ON "order"(paid_at);
```

---

## Data Model Validation & Constraints

### Subscription Tier Limits
Enforce feature limits based on tier:

```typescript
// Service: SubscriptionService
export async function canAddDish(business: Business, currentDishCount: number): Promise<boolean> {
  const subscription = await getSubscription(business.id);
  const limits = {
    free: 5,
    pro: 50,
    business: 999, // Effectively unlimited
  };
  return currentDishCount < limits[subscription.tier];
}

// Applied in dish creation endpoint
if (!(await SubscriptionService.canAddDish(business, business.dishes.length))) {
  throw new Error('Upgrade to Pro to add more dishes');
}
```

### Payment Processor Constraints
Ensure at least one processor active:

```typescript
// Validation: Business must have at least 1 active processor
// (if creating orders with payments)
// Can be 'manual' or integrated processor
```

### Trial Period Enforcement
Auto-downgrade when trial expires:

```typescript
// Cron job (runs daily):
const expiredTrials = await Subscription.find({
  where: { inTrial: true, trialEndDate: LessThan(new Date()) },
});

for (const sub of expiredTrials) {
  sub.inTrial = false;
  sub.tier = 'free';
  sub.status = 'active';
  await sub.save();
  // Email seller: "Your trial expired, downgraded to free"
}
```

---

## Migration Order (Phase 2 Implementation)

1. **Week 1**: Create `payment_processor`, `subscription` tables + Stripe webhook integration
2. **Week 2**: Create `user_preferences`, `template`, `ocr_import_log` tables
3. **Week 3**: Add columns to `business` and `order` tables
4. **Week 4**: Create indexes; optimize queries; test performance under load

---

## Next Steps

1. ✅ Phase 2 data model spec (this document)
2. → **Create Phase 3 data model** (review, marketplace, POS, promotions entities)
3. → **Generate Phase 2 API contracts** (phase-2-api.openapi.yaml with payment endpoints, subscription management, etc.)
4. → **Create database migration scripts** (TypeORM migrations for each feature)
5. → **Implement schema validation** (Zod schemas for all input validation)

