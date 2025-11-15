# Referral System Setup Guide (Phase 2.5)

**Status**: ✅ **IMPLEMENTED**
**Feature**: Seller-to-Seller Referral System for Viral Growth
**Effort**: 4-5 developer-days
**Version**: 1.0

---

## Overview

MenuMaker's Referral System enables viral seller acquisition through incentivized word-of-mouth marketing. Sellers can share unique referral codes with friends/family who run food businesses, earning rewards when referrals sign up and publish their first menu.

### Key Features

- 🎁 **Unique Referral Codes** - Each seller gets a memorable code (e.g., "PRIYA2024")
- 📊 **Funnel Tracking** - Track clicks → signups → first menu → rewards
- 💰 **Dual Reward System** - Free Pro month OR Rs. 500 account credit
- 🛡️ **Fraud Prevention** - Self-referral blocking, velocity limits, device fingerprinting
- 📈 **Analytics Dashboard** - Real-time referral stats and conversion metrics
- 🔗 **Multi-Channel Sharing** - WhatsApp, Email, SMS, Copy-to-clipboard

---

## Goals & Success Metrics

### Primary Goals

1. **Viral Growth**: Achieve 30% of new seller signups via referrals
2. **Low CAC**: Reduce customer acquisition cost from Rs. 500 (paid ads) to Rs. 150 (referral rewards)
3. **Network Effects**: Build seller community through personal recommendations

### Success Metrics (Phase 2 Target)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Referral Signup Rate | 30% of new sellers | Firebase Analytics |
| Referral Conversion (Click → Publish) | 20% | Referral funnel |
| Average Referrals per Active Seller | 2.5 | Database query |
| Viral Coefficient | 0.5 | (Referrals × Conversion rate) |
| Referral CAC | Rs. 150 | Reward value / New sellers |

---

## How It Works

### Referral Funnel

```
┌─────────────────┐
│ 1. Referrer     │
│    Shares Code  │
│    (PRIYA2024)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 2. Link Clicked │
│    (tracked)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 3. Signup       │
│    Completed    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 4. First Menu   │
│    Published    │
│    ✨ REWARD!   │
└─────────────────┘
```

### Reward Types

**Option 1: Free Pro Tier (Default)**
- **Value**: Rs. 299/month
- **Duration**: 30 days from reward date
- **Benefit**: Unlimited dishes, WhatsApp notifications, priority support
- **Applied to**: Both referrer AND referee

**Option 2: Account Credit**
- **Value**: Rs. 500
- **Duration**: Never expires
- **Usage**: Pro subscription, payment processing fees, future features
- **Applied to**: Both referrer AND referee

---

## Installation & Setup

### 1. Environment Variables

No additional environment variables required. The referral system is enabled by default.

Optional configuration in `.env`:

```bash
# Referral System (Phase 2.5)
REFERRAL_ENABLED=true  # Default: true
FRONTEND_URL=http://localhost:3000  # For referral link generation
```

### 2. Database Migration

Run the migration to create the `referrals` table and update `users` table:

```bash
cd backend
npm run migrate
```

This creates:
- `referrals` table (tracking referral funnel)
- `users` columns: `referral_code`, `account_credit_cents`, `pro_tier_expires_at`, `referred_by_code`

### 3. Verify Installation

Test that referral routes are accessible:

```bash
# Get referral code (requires auth)
curl -X GET http://localhost:3001/api/v1/referrals/users/me/referral-code \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Expected response:
```json
{
  "success": true,
  "data": {
    "referral_code": "PRIYA2024",
    "referral_link": "http://localhost:3000/signup?ref=PRIYA2024",
    "share_message": "Hey! I've been using MenuMaker to manage my food business orders..."
  }
}
```

---

## API Endpoints

### 1. Get Referral Code (GET /api/v1/referrals/users/me/referral-code)

**Description**: Retrieve or generate seller's referral code

**Auth**: Required (Bearer token)

**Response**:
```json
{
  "success": true,
  "data": {
    "referral_code": "PRIYA2024",
    "referral_link": "https://menumaker.com/signup?ref=PRIYA2024",
    "share_message": "Hey! I've been using MenuMaker to manage my food business orders. You should try it too! Use my code PRIYA2024 to sign up: https://menumaker.com/signup?ref=PRIYA2024"
  }
}
```

### 2. Get Referral Stats (GET /api/v1/referrals/users/me/referrals/stats)

**Description**: Dashboard analytics for referrals

**Auth**: Required

**Response**:
```json
{
  "success": true,
  "data": {
    "total_referrals": 12,
    "total_clicks": 8,
    "total_signups": 5,
    "total_published": 2,
    "total_rewards_earned_cents": 59800,
    "funnel": {
      "link_clicked": 8,
      "signup_completed": 5,
      "first_menu_published": 2
    },
    "conversion_rate": 0.25
  }
}
```

### 3. List Referrals (GET /api/v1/referrals/users/me/referrals)

**Description**: Table of all referrals made

**Auth**: Required

**Query Params**: `?limit=20&offset=0`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "ref_123",
      "referee_name": "raj",
      "referee_email": "raj@example.com",
      "status": "first_menu_published",
      "reward_claimed": true,
      "reward_type": "free_pro_month",
      "reward_value_cents": 29900,
      "created_at": "2025-11-10T10:00:00Z",
      "signup_completed_at": "2025-11-10T10:05:00Z",
      "first_menu_published_at": "2025-11-12T14:30:00Z"
    }
  ],
  "meta": {
    "total": 5,
    "limit": 20,
    "offset": 0
  }
}
```

### 4. Track Referral Click (POST /api/v1/referrals/track-click)

**Description**: Server-side click tracking (called by frontend)

**Auth**: NOT required (public)

**Request**:
```json
{
  "referral_code": "PRIYA2024",
  "source": "whatsapp",
  "utm_source": "referral_campaign"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Referral click tracked"
}
```

### 5. Validate Referral Code (POST /api/v1/referrals/validate)

**Description**: Check if referral code exists

**Auth**: NOT required

**Request**:
```json
{
  "referral_code": "PRIYA2024"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "referrer_email": "priya@example.com"
  }
}
```

### 6. Apply Referral on Signup (POST /api/v1/auth/signup)

**Enhancement**: Add optional `referral_code` field to existing signup endpoint

**Request**:
```json
{
  "email": "newuser@example.com",
  "password": "SecurePass123",
  "referral_code": "PRIYA2024"
}
```

**Logic**:
- If `referral_code` provided, link referee to referrer
- Update referral status to `signup_completed`
- Non-blocking: signup succeeds even if referral fails

---

## Usage Examples

### Frontend Integration

#### 1. Get Referral Code on Dashboard

```typescript
async function loadReferralCode() {
  const response = await fetch('/api/v1/referrals/users/me/referral-code', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();
  const { referral_code, referral_link, share_message } = data.data;

  // Display to user
  console.log('Your Code:', referral_code);
  console.log('Share Link:', referral_link);
}
```

#### 2. Track Referral Click

```typescript
// On signup page load, check for ?ref= parameter
const urlParams = new URLSearchParams(window.location.search);
const referralCode = urlParams.get('ref');

if (referralCode) {
  // Store in cookie for 30-day attribution window
  document.cookie = `menumaker_ref_code=${referralCode}; max-age=2592000; path=/`;

  // Track click server-side
  await fetch('/api/v1/referrals/track-click', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      referral_code: referralCode,
      source: urlParams.get('utm_source') || 'direct_link',
    }),
  });
}
```

#### 3. Apply Referral on Signup

```typescript
async function signup(email: string, password: string) {
  // Read referral code from cookie
  const cookies = document.cookie.split(';');
  const referralCookie = cookies.find(c => c.trim().startsWith('menumaker_ref_code='));
  const referralCode = referralCookie?.split('=')[1];

  const response = await fetch('/api/v1/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      ...(referralCode && { referral_code: referralCode }),
    }),
  });

  const data = await response.json();
  console.log('Signup complete:', data);
}
```

#### 4. Share Referral Link

```typescript
async function shareViaWhatsApp(referralLink: string, message: string) {
  const encoded = encodeURIComponent(message);
  window.open(`https://wa.me/?text=${encoded}`, '_blank');
}

async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
  alert('Referral link copied!');
}
```

---

## Referral Code Generation

### Algorithm

**Format**: FIRSTNAME + 4 random alphanumeric characters

**Examples**:
- User: priya@example.com → Code: **PRIYA2A4B**
- User: rajesh.kumar@gmail.com → Code: **RAJESH8C1D**

**Constraints**:
- Unique per seller
- 6-12 characters (alphanumeric)
- Case-insensitive matching
- Cannot be changed once generated
- Auto-generated on first access to referral dashboard

### Collision Handling

If code already exists, retry with new random suffix (up to 5 attempts).

---

## Fraud Prevention

### Mechanisms

1. **Self-Referral Blocking**
   - Same email check (referrer ≠ referee)
   - Device fingerprint (hash of user-agent + IP)
   - Blocks reward if same device used

2. **Velocity Limits**
   - Max 50 successful referrals per month per seller
   - Flags suspicious patterns for manual review

3. **Attribution Window**
   - Referee must sign up within 30 days of clicking link
   - Expired referrals marked as `expired`

4. **Device Fingerprinting**
   - SHA256 hash of (user-agent + IP)
   - Stored in `referrals.device_fingerprint`

### Fraud Scenarios & Mitigations

| Abuse Type | Detection | Mitigation |
|------------|-----------|------------|
| Self-referral (same user, multiple accounts) | Same device fingerprint, IP address | Block reward, log warning |
| Fake signups (never publish menu) | Low publish rate (<10%) | Reward only after publish |
| Referral farms (automated signups) | High velocity, similar patterns | Manual review queue |
| Expired links | > 30 days since click | Mark as `expired`, no reward |

---

## Analytics & Tracking

### Funnel Metrics

```typescript
// Referral Funnel Stages
const funnelStages = {
  link_clicked: 100,       // Baseline
  signup_completed: 40,    // 40% click-to-signup
  first_menu_published: 20 // 20% overall conversion
};
```

### Key Performance Indicators (KPIs)

| Metric | Formula | Target |
|--------|---------|--------|
| Click-to-Signup Rate | (Signups / Clicks) × 100 | 40% |
| Signup-to-Publish Rate | (Published / Signups) × 100 | 50% |
| Overall Conversion | (Published / Clicks) × 100 | 20% |
| Avg Referrals per Seller | Total referrals / Active sellers | 2.5 |
| Viral Coefficient (k) | (Avg referrals) × (Conversion rate) | 0.5 |

### Event Tracking (Firebase Analytics)

```typescript
// Recommended events to track
trackEvent('referral_code_generated', { user_id, referral_code });
trackEvent('referral_link_shared', { user_id, referral_code, channel: 'whatsapp' });
trackEvent('referral_link_clicked', { referral_code, source: 'whatsapp' });
trackEvent('referral_signup_completed', { referral_code, referee_id });
trackEvent('referral_first_menu_published', { referral_code, referee_id });
trackEvent('referral_reward_earned', {
  referrer_id,
  referee_id,
  reward_type: 'free_pro_month',
  reward_value_cents: 29900
});
```

---

## Troubleshooting

### Issue: Referral code not generating

**Causes**:
- User already has a code (check `users.referral_code`)
- Collision after 5 attempts (rare)

**Debug**:
```bash
# Check if user has code
SELECT email, referral_code FROM users WHERE id = 'user_id';

# Check for collisions
SELECT COUNT(*) FROM users WHERE referral_code IS NOT NULL;
```

**Fix**:
- Code is auto-generated on first access to `/referrals/users/me/referral-code`
- If collision persists, manually assign unique code

### Issue: Referral not applying on signup

**Causes**:
- Invalid referral code
- Referral link expired (> 30 days)
- Self-referral blocked

**Debug**:
```bash
# Check if referral exists
SELECT * FROM referrals WHERE referral_code = 'PRIYA2024' ORDER BY created_at DESC;

# Check user's referred_by_code
SELECT email, referred_by_code FROM users WHERE email = 'referee@example.com';
```

**Fix**:
- Ensure referral code is valid (check `users.referral_code`)
- Check logs for fraud prevention warnings
- Verify attribution window (< 30 days)

### Issue: Reward not triggered after publishing menu

**Causes**:
- User wasn't referred (no referral record)
- Reward already claimed
- Menu publish event not fired

**Debug**:
```bash
# Check referral status
SELECT * FROM referrals WHERE referee_id = 'user_id';

# Check reward claim status
SELECT reward_claimed, reward_claimed_at, status FROM referrals WHERE referee_id = 'user_id';
```

**Fix**:
- Trigger reward manually if needed (see Admin Operations below)
- Verify menu publish endpoint is calling `ReferralService.triggerRewardOnFirstMenu()`

---

## Admin Operations

### Manually Trigger Reward

```typescript
import { ReferralService } from './services/ReferralService';

// Manually trigger reward for a user
await ReferralService.triggerRewardOnFirstMenu('user_id');
```

### View All Referrals

```sql
-- All referrals with status breakdown
SELECT
  status,
  COUNT(*) as count,
  SUM(CASE WHEN reward_claimed THEN reward_value_cents ELSE 0 END) / 100.0 as total_rewards_rs
FROM referrals
GROUP BY status;

-- Top referrers
SELECT
  u.email,
  COUNT(r.id) as total_referrals,
  SUM(CASE WHEN r.status = 'first_menu_published' THEN 1 ELSE 0 END) as successful_referrals
FROM users u
JOIN referrals r ON u.id = r.referrer_id
GROUP BY u.id
ORDER BY successful_referrals DESC
LIMIT 10;
```

### Adjust Reward Amount

```sql
-- Update reward type for a specific referral
UPDATE referrals
SET reward_type = 'account_credit', reward_value_cents = 50000
WHERE id = 'referral_id';
```

---

## Cost-Benefit Analysis

### Costs

**Per Referral**:
- Free Pro month: Rs. 299 × 2 (referrer + referee) = **Rs. 598**
- Account credit: Rs. 500 × 2 = **Rs. 1,000**

**Monthly Budget (100 referrals)**:
- Free Pro: Rs. 59,800
- Account credit: Rs. 100,000

### Benefits

**Compared to Paid Ads**:
- Paid ads CAC: Rs. 500-800 per seller
- Referral CAC: Rs. 299-500 per seller (2 sellers for 1 reward)
- **Savings**: 40-70% reduction in CAC

**Network Effects**:
- Higher quality leads (referred by friends)
- Better retention (social proof)
- Viral coefficient (k) target: 0.5-0.8

---

## Future Enhancements (Phase 3)

- [ ] **Leaderboards**: Top 10 referrers displayed monthly with prizes
- [ ] **Customer Referrals**: Customers refer friends to order from sellers
- [ ] **Affiliate Program**: Influencers earn 10% commission on subscriptions
- [ ] **Gamification**: Badges for 5/10/50 referrals, tier system (Bronze/Silver/Gold)
- [ ] **Social Proof**: "1,234 sellers joined via referrals" banner on homepage

---

## Support

**MenuMaker Issues**: https://github.com/ameedanxari/menumaker/issues
**Spec Reference**: `/specs/001-menu-maker/phase-2-referral-system.md`

---

**Document Version**: 1.0
**Last Updated**: November 14, 2025
**Status**: PRODUCTION READY ✅
