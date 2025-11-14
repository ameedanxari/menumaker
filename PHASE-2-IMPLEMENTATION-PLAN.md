# Phase 2 Growth - Implementation Plan

**Branch:** `claude/phase-2-implementation-019rMCvGYG3CgRhZLfaaR6KE`
**Start Date:** November 14, 2025
**Target Duration:** 17 weeks (4+ months)
**Goal:** Grow to 500 sellers, Rs. 25L GMV/month with payment integration and growth features

---

## Executive Summary

Phase 2 adds growth-focused features to scale MenuMaker from MVP (100 sellers) to 500+ sellers with monetization through Stripe payments, subscriptions, and viral referrals. Key focus: payment processing, automated onboarding (OCR), customer retention (re-order), seller engagement (WhatsApp), and GDPR compliance foundation.

---

## Features Overview

### Priority Features (P1)
| Feature | Effort | Timeline | Dependencies |
|---------|--------|----------|--------------|
| **US2.4: Stripe Payment Integration** | 12 days | Week 1-2 | None |
| **US2.5: Tiered Subscriptions** | 10 days | Week 3-4 | Stripe |
| **US2.1: WhatsApp Notifications** | 8 days | Week 5 | None |
| **US2.2: OCR Menu Import** | 10 days | Week 6 | None |
| **US2.7: Referral System** | 5 days | Week 7 | None |
| **US2.3: GDPR Foundation + Legal** | 7 days | Week 7 | None |

### Secondary Features (P2)
| Feature | Effort | Timeline | Dependencies |
|---------|--------|----------|--------------|
| **US2.6: Customer Re-Order** | 6 days | Week 8 | None |

**Total Effort:** 58 developer-days
**Parallelizable:** WhatsApp, OCR, Referral can run in parallel after Stripe

---

## Implementation Strategy

### Phase 2.1: Payment Infrastructure (Weeks 1-2)
**Goal:** Enable online payments via Stripe for immediate revenue

**Deliverables:**
1. Stripe SDK integration (backend + frontend)
2. Payment intent creation and confirmation flow
3. Webhook handling for payment events
4. Payment method storage and management
5. Order payment status tracking
6. Seller payout tracking (manual for now)

**Success Criteria:**
- [ ] Customers can pay with card (Stripe Checkout or Elements)
- [ ] Payment success/failure handled gracefully
- [ ] Orders marked as paid/unpaid correctly
- [ ] Webhook events logged and processed
- [ ] Test mode validated with Stripe test cards

---

### Phase 2.2: Subscription Management (Weeks 3-4)
**Goal:** Monetize platform with tiered subscriptions

**Subscription Tiers:**
| Tier | Price | Features |
|------|-------|----------|
| **Free** | Rs. 0/month | 20 orders/month, manual payment only, basic support |
| **Starter** | Rs. 499/month | 100 orders/month, Stripe payments, email support |
| **Pro** | Rs. 999/month | Unlimited orders, all integrations, priority support, WhatsApp |

**Deliverables:**
1. Subscription model and enforcement
2. Stripe Billing integration
3. Customer portal for subscription management
4. Usage tracking and limits
5. Upgrade/downgrade flows
6. Trial period handling (14 days free)

**Success Criteria:**
- [ ] Sellers can subscribe to paid tiers
- [ ] Limits enforced (order count, features)
- [ ] Billing automatic via Stripe
- [ ] Customer portal works (manage subscription)
- [ ] 5% conversion to paid tiers

---

### Phase 2.3: WhatsApp Integration (Week 5)
**Goal:** Keep sellers engaged with order notifications

**Deliverables:**
1. Twilio WhatsApp Business API integration
2. Message templates (new order, order update, payment received)
3. Opt-in/opt-out management
4. Message queueing and retry logic
5. Analytics tracking (delivery rate, open rate)

**Success Criteria:**
- [ ] Sellers receive WhatsApp notifications for new orders
- [ ] Message delivery rate > 95%
- [ ] Opt-out respected
- [ ] No spam reports
- [ ] 10% of sellers using WhatsApp (50 sellers)

---

### Phase 2.4: OCR Menu Import (Week 6)
**Goal:** Reduce menu creation time from 30min to 5min

**Deliverables:**
1. Image upload interface
2. OCR processing (Tesseract.js or Claude Vision)
3. Data extraction (dish name, price, description)
4. Preview and edit before import
5. Bulk import to menu
6. Error handling and retry

**Success Criteria:**
- [ ] 80%+ accuracy on dish extraction
- [ ] Import completes in < 30 seconds
- [ ] Sellers can edit before confirming
- [ ] 30% of sellers use OCR import (150 sellers)
- [ ] Time-to-first-menu < 10 minutes

---

### Phase 2.5: Referral System (Week 7)
**Goal:** Achieve 30% of signups via referrals (viral growth)

**Deliverables:**
1. Referral code generation (unique per seller)
2. Shareable links (WhatsApp, SMS, Email)
3. Referral tracking (click → signup → first menu)
4. Rewards system (1 month Pro OR Rs. 500 credit)
5. Referral dashboard with stats
6. Analytics and funnel tracking

**Success Criteria:**
- [ ] Every seller gets unique referral code
- [ ] Referral attribution working correctly
- [ ] Rewards auto-applied on milestone completion
- [ ] 30% signup rate via referrals
- [ ] CAC drops from Rs. 500 to Rs. 150

---

### Phase 2.6: GDPR Foundation (Week 7)
**Goal:** Basic privacy compliance for EU/UK users

**Deliverables:**
1. Cookie consent banner (necessary, analytics, marketing)
2. Privacy policy generator
3. "Delete my account" workflow (7-day grace period)
4. Data retention policy (3 years orders)
5. Email unsubscribe links
6. Terms of service updates

**Success Criteria:**
- [ ] GDPR consent collected before tracking
- [ ] Account deletion completes in < 24 hours
- [ ] Privacy policy auto-generated
- [ ] No GDPR complaints
- [ ] Audit trail for deletions

---

### Phase 2.7: Re-Order Feature (Week 8)
**Goal:** Increase repeat order rate from 20% to 25%

**Deliverables:**
1. Order history for customers
2. "Re-order" button on past orders
3. Cart pre-fill with previous items
4. Availability check before checkout
5. Price change warnings

**Success Criteria:**
- [ ] Customers can view past orders
- [ ] Re-order adds items to cart
- [ ] Unavailable items flagged
- [ ] 25% repeat order rate
- [ ] < 5% cart abandonment on re-orders

---

## Technical Architecture Changes

### New Components

**Backend:**
- Stripe service (payments, subscriptions, webhooks)
- WhatsApp service (Twilio integration)
- OCR service (image processing)
- Referral service (tracking, rewards)
- Subscription middleware (tier enforcement)
- Job queue (Bull) for async tasks

**Frontend:**
- Payment flow components (Stripe Elements)
- Subscription management UI
- OCR upload and preview interface
- Referral dashboard
- GDPR consent components
- Re-order UI

**Infrastructure:**
- Bull queue (Redis-backed)
- Webhook endpoints
- Stripe webhooks
- Twilio WhatsApp
- OCR API (or local Tesseract)

---

## Database Schema Changes

### New Tables

**subscriptions:**
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  business_id UUID REFERENCES businesses(id),
  tier VARCHAR(20) NOT NULL, -- 'free', 'starter', 'pro'
  status VARCHAR(20) NOT NULL, -- 'active', 'canceled', 'past_due'
  stripe_subscription_id VARCHAR(255),
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**payments:**
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  stripe_payment_intent_id VARCHAR(255),
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'INR',
  status VARCHAR(20) NOT NULL, -- 'pending', 'succeeded', 'failed'
  payment_method VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**referrals:**
```sql
CREATE TABLE referrals (
  id UUID PRIMARY KEY,
  referrer_user_id UUID REFERENCES users(id),
  referee_user_id UUID REFERENCES users(id),
  referral_code VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(20) NOT NULL, -- 'pending', 'completed', 'rewarded'
  reward_type VARCHAR(20), -- 'credit', 'subscription'
  reward_amount_cents INTEGER,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**gdpr_requests:**
```sql
CREATE TABLE gdpr_requests (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  request_type VARCHAR(20) NOT NULL, -- 'deletion', 'export'
  status VARCHAR(20) NOT NULL, -- 'pending', 'processing', 'completed'
  scheduled_for TIMESTAMP, -- deletion grace period
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Environment Variables

### Required for Phase 2

```bash
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Twilio WhatsApp
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# OCR (if using Claude Vision)
ANTHROPIC_API_KEY=sk-ant-...

# Redis (for Bull queue)
REDIS_URL=redis://localhost:6379

# Feature Flags
ENABLE_STRIPE_PAYMENTS=true
ENABLE_WHATSAPP=false  # Start false, enable after testing
ENABLE_OCR=true
ENABLE_REFERRALS=true
```

---

## Testing Strategy

### Unit Tests
- Stripe service methods
- Subscription tier enforcement
- Referral tracking logic
- GDPR deletion workflow
- OCR parsing accuracy

### Integration Tests
- Stripe webhook processing
- Payment flow end-to-end
- Subscription upgrade/downgrade
- WhatsApp message delivery
- Referral attribution

### E2E Tests
- Complete payment checkout
- Subscription purchase flow
- OCR import workflow
- Re-order functionality
- GDPR consent and deletion

---

## Rollout Strategy

### Week 1-2: Stripe Foundation
- [ ] Integrate Stripe SDK
- [ ] Build payment flow UI
- [ ] Set up webhook handling
- [ ] Test with test cards
- [ ] Deploy to staging

### Week 3-4: Subscriptions
- [ ] Define subscription tiers
- [ ] Implement tier enforcement
- [ ] Build subscription UI
- [ ] Test billing cycle
- [ ] Beta test with 5 sellers

### Week 5: WhatsApp
- [ ] Set up Twilio account
- [ ] Implement message templates
- [ ] Test notifications
- [ ] Opt-in/opt-out flow
- [ ] Monitor delivery rates

### Week 6: OCR
- [ ] Choose OCR solution (Tesseract vs Claude)
- [ ] Build upload interface
- [ ] Implement extraction
- [ ] Add preview/edit UI
- [ ] Test accuracy with real menus

### Week 7: Referrals + GDPR
- [ ] Generate referral codes
- [ ] Build sharing UI
- [ ] Implement tracking
- [ ] Cookie consent banner
- [ ] Account deletion workflow

### Week 8: Re-Order + Polish
- [ ] Build order history UI
- [ ] Implement re-order logic
- [ ] Test availability checks
- [ ] Bug fixes
- [ ] Performance optimization

### Week 9-10: Testing & Launch
- [ ] Full QA pass
- [ ] Load testing
- [ ] Security audit
- [ ] Gradual rollout to Phase 1 sellers
- [ ] Monitor metrics

---

## Success Metrics

### Business Metrics
- [ ] 500 sellers onboarded (5× from Phase 1)
- [ ] Rs. 25L GMV/month
- [ ] 5% on paid subscriptions (25 sellers, Rs. 12.5K MRR)
- [ ] 30% signup via referrals
- [ ] 10% using WhatsApp (50 sellers)
- [ ] 30% using OCR (150 sellers)
- [ ] 25% repeat order rate

### Technical Metrics
- [ ] API p95 latency < 250ms
- [ ] Payment success rate > 98%
- [ ] Webhook processing < 5s
- [ ] WhatsApp delivery rate > 95%
- [ ] OCR accuracy > 80%
- [ ] Test coverage > 75%
- [ ] Zero critical bugs

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Stripe integration delays | High | Start early, use test mode extensively |
| WhatsApp API limits | Medium | Monitor quota, have fallback to SMS |
| OCR accuracy low | Medium | Allow manual editing, iterate on accuracy |
| Subscription adoption low | High | Offer 14-day trial, clear value prop |
| Payment disputes | High | Clear refund policy, responsive support |
| GDPR non-compliance | High | Legal review, audit trail for all actions |

---

## Next Steps

**Immediate (Today):**
1. Set up Stripe test account
2. Install Stripe SDK
3. Create payment models and migrations
4. Build basic payment flow

**This Week:**
1. Complete Stripe integration
2. Test payment flow end-to-end
3. Set up webhook handling
4. Deploy to staging

**Next Week:**
1. Define subscription tiers
2. Implement tier enforcement
3. Build subscription management UI
4. Test billing

---

**Document Owner:** Engineering Team
**Last Updated:** November 14, 2025
**Status:** Planning → Implementation Starting
**Branch:** `claude/phase-2-implementation-019rMCvGYG3CgRhZLfaaR6KE`
