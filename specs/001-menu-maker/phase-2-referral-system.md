# Phase 2: Referral System (US2.7)

## Overview

The Referral System is a growth engine that enables viral seller acquisition through incentivized word-of-mouth marketing. Sellers can share unique referral codes with friends/family who run food businesses, earning rewards when referrals sign up and publish their first menu.

## Goals

1. **Viral Growth**: Achieve 30% of new seller signups via referrals by end of Phase 2
2. **Low CAC**: Reduce customer acquisition cost from Rs. 500 (paid ads) to Rs. 150 (referral rewards)
3. **Network Effects**: Build seller community through personal recommendations
4. **Data-Driven**: Track full referral funnel (share → click → signup → publish → reward)

## User Story (US2.7)

**As a** seller who loves MenuMaker
**I want to** refer other food business owners and earn rewards
**So that** I can help friends discover the platform while benefiting from incentives

### Acceptance Criteria

✅ **AC1**: Seller sees unique referral code on dashboard (e.g., `PRIYA2024`)
✅ **AC2**: Seller can share referral link via WhatsApp, SMS, Email, or copy to clipboard
✅ **AC3**: When referred friend signs up using code, both parties notified
✅ **AC4**: Referrer earns reward after referee publishes first menu
✅ **AC5**: Referral stats visible on dashboard (clicks, signups, pending/earned rewards)
✅ **AC6**: Rewards automatically applied (1 month free Pro tier OR Rs. 500 account credit)

## User Experience

### Seller Journey: Referring a Friend

```
1. Login to seller dashboard
2. See "Refer & Earn" banner with call-to-action
3. Click "Invite Friends" → Modal opens
4. View unique referral code: "PRIYA2024"
5. View shareable link: menumaker.com/signup?ref=PRIYA2024
6. Click "Share via WhatsApp" → Pre-filled message opens:
   "Hey! I've been using MenuMaker to manage my food business orders.
    You should try it too! Use my code PRIYA2024 to sign up:
    https://menumaker.com/signup?ref=PRIYA2024"
7. Send to 5 friends → Track "5 shares sent"
8. Dashboard shows:
   - 5 links clicked
   - 2 signups
   - 1 published (reward earned!)
   - 1 pending (signed up but not published yet)
```

### Referee Journey: Signing Up via Referral

```
1. Receive WhatsApp message with referral link
2. Click link → Lands on signup page with banner:
   "Priya invited you! Sign up to get started with MenuMaker"
3. Complete signup (referral code auto-applied)
4. See notification: "You were referred by Priya! Publish your first menu
   and you'll both get 1 month of Pro free 🎉"
5. Complete onboarding → Publish first menu
6. Both parties receive notification:
   - Referrer: "Congrats! Your friend Raj published their menu.
     You've earned 1 month of Pro free!"
   - Referee: "Welcome bonus unlocked! Enjoy 1 month of Pro features free"
```

## Features

### 1. Referral Code Generation

**Algorithm**: Generate unique, memorable codes

```typescript
function generateReferralCode(sellerName: string, userId: string): string {
  // Format: FIRSTNAME + 4 digits
  // Example: PRIYA2024, RAJESH5678

  const firstName = sellerName.split(' ')[0].toUpperCase();
  const uniqueId = userId.substring(0, 4).toUpperCase();

  return `${firstName}${uniqueId}`;
}
```

**Constraints**:
- Unique per seller
- 6-12 characters (alphanumeric)
- Case-insensitive matching
- Cannot be changed once generated

### 2. Referral Link Sharing

**Shareable Link Format**:
```
https://menumaker.com/signup?ref=PRIYA2024
```

**Share Channels**:
1. **WhatsApp** (Primary) - Pre-filled message
2. **SMS** - Pre-filled text
3. **Email** - Pre-composed email with subject
4. **Copy to Clipboard** - For pasting anywhere
5. **QR Code** - Print and display (future: Phase 3)

**Pre-filled Message Template**:
```
Hey! I've been using MenuMaker to manage my [business type] orders.
It's super easy - I published my menu in 10 minutes!

You should try it too. Use my code {REFERRAL_CODE} to sign up:
{REFERRAL_LINK}

Let me know what you think! 😊
```

### 3. Referral Tracking

**Attribution Model**: Last-click attribution

**Tracking Mechanism**:
```typescript
// When user clicks referral link
1. Read `ref` query parameter from URL
2. Store in cookie: `menumaker_ref_code` (expires in 30 days)
3. Store in localStorage: `referral_source` (backup)

// When user signs up
1. Read referral code from cookie/localStorage
2. Create Referral record linking referrer → referee
3. Send notification to referrer: "Your friend started signing up!"

// When referee publishes first menu
1. Check if referral exists for this user
2. Mark referral as "completed"
3. Credit rewards to both parties
4. Send congratulations notifications
```

**Funnel Stages**:
- **Link Clicked**: User clicked referral link
- **Signup Started**: User began signup process
- **Signup Completed**: User verified email/phone
- **First Menu Published**: User published first menu (REWARD TRIGGERED)

### 4. Reward Types

**Option 1: Free Pro Tier (1 Month)**
- Upgrade both referrer and referee to Pro tier
- Unlocks: unlimited dishes, WhatsApp notifications, priority support
- Value: Rs. 299/month
- Duration: 30 days from reward date

**Option 2: Account Credit (Rs. 500)**
- Add Rs. 500 credit to both accounts
- Can be used for: Pro subscription, payment processing fees, ads (future)
- Never expires
- Shows as balance on dashboard

**Default Reward**: Free Pro tier (higher perceived value)

**Seller Choice**: Allow seller to choose preferred reward type in settings

### 5. Referral Dashboard

**Location**: Seller dashboard → "Refer & Earn" tab

**Widgets**:

1. **Your Referral Code** (Top banner)
   ```
   Your Code: PRIYA2024
   Share with friends to earn rewards!
   [Copy Code] [Share Now]
   ```

2. **Quick Stats** (Cards)
   ```
   Total Shares: 12
   Signups: 5
   Published: 2
   Total Earned: Rs. 598 value (2 Pro months)
   ```

3. **Referral Funnel** (Visualization)
   ```
   12 Shares → 8 Clicks → 5 Signups → 2 Published
   Conversion: 25% (click-to-publish)
   ```

4. **Referral List** (Table)
   ```
   | Name     | Status         | Date       | Reward      |
   |----------|----------------|------------|-------------|
   | Raj K    | Published ✓    | Nov 10     | 1 mo Pro ✓  |
   | Amit S   | Pending...     | Nov 12     | -           |
   | Deepa M  | Signup only    | Nov 8      | -           |
   ```

5. **Share Again** (CTA)
   ```
   [Invite More Friends] → Opens share modal
   ```

### 6. Notifications

**Referrer Notifications**:

```typescript
// When referee clicks link
"🔗 Your referral link was clicked!"

// When referee signs up
"🎉 Great news! Your friend started signing up using your code."

// When referee publishes first menu
"💰 Reward earned! Your friend Raj published their menu.
 You've unlocked 1 month of Pro free! Check your dashboard."
```

**Referee Notifications**:

```typescript
// On signup page
"👋 Priya invited you! Sign up to get started."

// After signup
"🎁 You're one step away from your welcome bonus!
 Publish your first menu and both you and Priya get 1 month Pro free."

// After first menu published
"✅ Welcome bonus unlocked! Enjoy 1 month of Pro features free.
 Thanks for joining MenuMaker!"
```

**Channels**:
- In-app banner (high priority)
- Email (backup)
- SMS (if enabled)
- WhatsApp (Phase 2: if opted in)

## Data Model

### Referral Entity

```typescript
@Entity('referrals')
export class Referral {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 12, unique: true })
  referral_code: string; // e.g., "PRIYA2024"

  @ManyToOne(() => User) // Referrer (person who shared code)
  referrer: User;

  @Column({ type: 'uuid' })
  referrer_id: string;

  @ManyToOne(() => User, { nullable: true }) // Referee (person who signed up)
  referee: User;

  @Column({ type: 'uuid', nullable: true })
  referee_id: string; // Null until signup completed

  @Column({ type: 'varchar', default: 'link_clicked' })
  // 'link_clicked' → 'signup_started' → 'signup_completed' → 'first_menu_published'
  status: string;

  @Column({ type: 'varchar', nullable: true })
  referee_email: string; // Captured at signup

  @Column({ type: 'varchar', nullable: true })
  referee_phone: string;

  @Column({ type: 'varchar', default: 'free_pro_month' }) // 'free_pro_month' | 'account_credit'
  reward_type: string;

  @Column({ type: 'integer', default: 0 })
  reward_value_cents: number; // Rs. 299 for Pro, Rs. 500 for credit

  @Column({ type: 'boolean', default: false })
  reward_claimed: boolean; // True when reward applied

  @Column({ type: 'timestamp', nullable: true })
  reward_claimed_at: Date;

  @Column({ type: 'varchar', nullable: true })
  source: string; // 'whatsapp', 'sms', 'email', 'direct_link'

  @Column({ type: 'varchar', nullable: true })
  utm_source: string; // Track campaign source

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date; // When link first clicked

  @Column({ type: 'timestamp', nullable: true })
  signup_completed_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  first_menu_published_at: Date;
}
```

**Indexes**:
- (referral_code) - unique
- (referrer_id, status) - dashboard queries
- (referee_id) - lookup on signup
- (created_at) - analytics

### User Entity Updates

```typescript
// Add to existing User entity
@Column({ type: 'varchar', length: 12, unique: true, nullable: true })
referral_code: string; // Generated on first access to referral dashboard

@Column({ type: 'integer', default: 0 })
account_credit_cents: number; // Rs. balance for account credit rewards

@Column({ type: 'timestamp', nullable: true })
pro_tier_expires_at: Date; // If gifted Pro via referral

@Column({ type: 'varchar', nullable: true })
referred_by_code: string; // Track who referred this user
```

## API Endpoints

### 1. Get Referral Code (GET /api/v1/users/me/referral-code)

**Description**: Retrieve or generate seller's referral code

**Response**:
```json
{
  "referral_code": "PRIYA2024",
  "referral_link": "https://menumaker.com/signup?ref=PRIYA2024",
  "share_message": "Hey! I've been using MenuMaker to manage..."
}
```

### 2. Get Referral Stats (GET /api/v1/users/me/referrals/stats)

**Description**: Dashboard analytics

**Response**:
```json
{
  "total_shares": 12,
  "total_clicks": 8,
  "total_signups": 5,
  "total_published": 2,
  "total_rewards_earned_cents": 59800,
  "funnel": {
    "link_clicked": 8,
    "signup_started": 6,
    "signup_completed": 5,
    "first_menu_published": 2
  },
  "conversion_rate": 0.25
}
```

### 3. List Referrals (GET /api/v1/users/me/referrals)

**Description**: Table of all referrals

**Query Params**: `?status=first_menu_published&limit=20&offset=0`

**Response**:
```json
{
  "data": [
    {
      "id": "ref_123",
      "referee_name": "Raj Kumar",
      "referee_email": "raj@example.com",
      "status": "first_menu_published",
      "reward_claimed": true,
      "reward_type": "free_pro_month",
      "created_at": "2025-11-10T10:00:00Z",
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

### 5. Apply Referral on Signup (POST /api/v1/auth/signup)

**Enhancement**: Add `referral_code` field to existing signup endpoint

**Request**:
```json
{
  "email": "newuser@example.com",
  "password": "SecurePass123",
  "phone": "+91 98765 43210",
  "referral_code": "PRIYA2024"  // ← NEW FIELD
}
```

**Logic**:
```typescript
// On signup
if (referral_code) {
  const referral = await Referral.findOne({ referral_code, status: 'link_clicked' });
  if (referral) {
    referral.referee_id = newUser.id;
    referral.status = 'signup_completed';
    referral.signup_completed_at = new Date();
    await referral.save();

    // Notify referrer
    await notify(referral.referrer_id, 'Your friend started signing up!');
  }
}
```

### 6. Trigger Reward (Internal Event)

**Event**: `menu.published` (when user publishes first menu)

**Logic**:
```typescript
// Check if user was referred
const referral = await Referral.findOne({
  referee_id: userId,
  status: 'signup_completed'
});

if (referral) {
  // Update referral status
  referral.status = 'first_menu_published';
  referral.first_menu_published_at = new Date();
  referral.reward_claimed = true;
  referral.reward_claimed_at = new Date();
  await referral.save();

  // Apply rewards
  if (referral.reward_type === 'free_pro_month') {
    // Upgrade both to Pro for 1 month
    await upgradeToPro(referral.referrer_id, 30 * 24 * 60 * 60 * 1000); // 30 days
    await upgradeToPro(referral.referee_id, 30 * 24 * 60 * 60 * 1000);
  } else if (referral.reward_type === 'account_credit') {
    // Add Rs. 500 to both accounts
    await addCredit(referral.referrer_id, 50000); // Rs. 500 = 50000 cents
    await addCredit(referral.referee_id, 50000);
  }

  // Notify both parties
  await notify(referral.referrer_id, 'Reward earned! Your friend published their menu.');
  await notify(referral.referee_id, 'Welcome bonus unlocked! Enjoy Pro features.');
}
```

## Analytics & Tracking

### Events to Track (Firebase Analytics)

```typescript
// Referrer events
trackEvent('referral_code_generated', { user_id, referral_code });
trackEvent('referral_link_shared', { user_id, referral_code, channel: 'whatsapp' });
trackEvent('referral_dashboard_viewed', { user_id });

// Referee events
trackEvent('referral_link_clicked', { referral_code, source: 'whatsapp' });
trackEvent('referral_signup_completed', { referral_code, referee_id });
trackEvent('referral_first_menu_published', { referral_code, referee_id });

// Reward events
trackEvent('referral_reward_earned', {
  referrer_id,
  referee_id,
  reward_type: 'free_pro_month',
  reward_value_cents: 29900
});
```

### Key Metrics (Dashboard)

| Metric | Formula | Target (Phase 2) |
|--------|---------|------------------|
| Referral Signup Rate | (Signups via referral / Total signups) × 100 | 30% |
| Referral Conversion Rate | (Published / Clicks) × 100 | 20% |
| Average Referrals per Seller | Total referrals / Active sellers | 2.5 |
| Referral CAC | Total reward value / New sellers from referrals | Rs. 150 |
| Viral Coefficient | (Referrals per user) × (Conversion rate) | 0.5 (target: 1.0 in Phase 3) |

## UI/UX Wireframes

### Dashboard: Referral Widget

```
┌──────────────────────────────────────────────────┐
│  🎁 Refer & Earn                                 │
│                                                  │
│  Your Referral Code: PRIYA2024                   │
│  [Copy Code]  [Share Now]                        │
│                                                  │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐        │
│  │  12  │  │  5   │  │  2   │  │ ₹598 │        │
│  │Shared│  │Signed│  │Earned│  │Value │        │
│  └──────┘  └──────┘  └──────┘  └──────┘        │
│                                                  │
│  Recent Referrals:                               │
│  • Raj K - Published ✓ (1 Pro mo earned)         │
│  • Amit S - Pending... (signed up 2 days ago)   │
│                                                  │
│  [View All Referrals]                            │
└──────────────────────────────────────────────────┘
```

### Share Modal

```
┌──────────────────────────────────────────────────┐
│  Invite Friends to MenuMaker                     │
│                                                  │
│  Your Code: PRIYA2024                            │
│  Link: menumaker.com/signup?ref=PRIYA2024        │
│  [Copy Link]                                     │
│                                                  │
│  Share via:                                      │
│  [📱 WhatsApp]  [✉️ Email]  [💬 SMS]            │
│                                                  │
│  Preview Message:                                │
│  ┌──────────────────────────────────────────┐   │
│  │ Hey! I've been using MenuMaker to        │   │
│  │ manage my food business orders. You      │   │
│  │ should try it too! Use code PRIYA2024    │   │
│  │ https://menumaker.com/signup?ref=...     │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  [Send Invites]  [Cancel]                        │
└──────────────────────────────────────────────────┘
```

### Signup Page (Referred User)

```
┌──────────────────────────────────────────────────┐
│                                                  │
│  👋 Priya invited you to MenuMaker!              │
│                                                  │
│  Sign up to get started with your food business │
│                                                  │
│  ┌─────────────────────────────────────────┐    │
│  │ Email: [________________]              │    │
│  │ Password: [________________]           │    │
│  │ Phone: [________________]              │    │
│  │                                         │    │
│  │ Referral Code: PRIYA2024 ✓              │    │
│  │ (You'll both get 1 month Pro free!)    │    │
│  │                                         │    │
│  │ [Sign Up]                               │    │
│  └─────────────────────────────────────────┘    │
│                                                  │
└──────────────────────────────────────────────────┘
```

## Testing

### Unit Tests

```typescript
describe('Referral Code Generation', () => {
  it('generates unique code from user name', () => {
    const code = generateReferralCode('Priya Sharma', 'user_1234');
    expect(code).toBe('PRIYA1234');
  });

  it('handles single-word names', () => {
    const code = generateReferralCode('Madonna', 'user_5678');
    expect(code).toBe('MADONNA5678');
  });
});

describe('Referral Attribution', () => {
  it('attributes signup to referrer', async () => {
    const referral = await createReferral('PRIYA2024');
    const newUser = await signupWithReferral('raj@example.com', 'PRIYA2024');

    const updated = await Referral.findOne({ id: referral.id });
    expect(updated.referee_id).toBe(newUser.id);
    expect(updated.status).toBe('signup_completed');
  });
});

describe('Reward Distribution', () => {
  it('awards Pro tier to both parties after first menu published', async () => {
    const referral = await Referral.create({
      referrer_id: 'user_1',
      referee_id: 'user_2',
      status: 'signup_completed'
    });

    await publishFirstMenu('user_2');

    const referrer = await User.findOne({ id: 'user_1' });
    const referee = await User.findOne({ id: 'user_2' });

    expect(referrer.pro_tier_expires_at).toBeDefined();
    expect(referee.pro_tier_expires_at).toBeDefined();
  });
});
```

### Integration Tests

```typescript
describe('Referral Flow E2E', () => {
  it('completes full referral lifecycle', async () => {
    // 1. Referrer generates code
    const { referral_code } = await request(app)
      .get('/api/v1/users/me/referral-code')
      .set('Authorization', 'Bearer referrer_token')
      .expect(200);

    // 2. Referee clicks link (tracked)
    await request(app)
      .post('/api/v1/referrals/track-click')
      .send({ referral_code, source: 'whatsapp' })
      .expect(200);

    // 3. Referee signs up
    const signupRes = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        email: 'referee@example.com',
        password: 'SecurePass123',
        referral_code
      })
      .expect(201);

    // 4. Referee publishes first menu
    await request(app)
      .post('/api/v1/menus')
      .set('Authorization', `Bearer ${signupRes.body.token}`)
      .send({ /* menu data */ })
      .expect(201);

    // 5. Verify rewards distributed
    const referrerStats = await request(app)
      .get('/api/v1/users/me/referrals/stats')
      .set('Authorization', 'Bearer referrer_token')
      .expect(200);

    expect(referrerStats.body.total_published).toBe(1);
    expect(referrerStats.body.total_rewards_earned_cents).toBeGreaterThan(0);
  });
});
```

## Security Considerations

### Fraud Prevention

1. **Rate Limiting**: Max 10 referral code generations per user per day
2. **Duplicate Detection**: Prevent same email/phone from multiple referral claims
3. **Velocity Checks**: Flag users with >20 referrals in 24 hours (manual review)
4. **Device Fingerprinting**: Detect self-referrals from same device

### Abuse Scenarios

| Abuse Type | Detection | Mitigation |
|------------|-----------|------------|
| Self-referral (same user, multiple accounts) | Same device fingerprint, IP address | Block reward, ban account |
| Fake signups (never publish menu) | Low publish rate (<10%) | Reward only after publish |
| Referral farms (automated signups) | High velocity, similar patterns | Manual review queue |
| Referral code sharing on public forums | Unusual spike in clicks from single code | Cap rewards at 50 per code |

## Future Enhancements (Phase 3)

### US3.11: Enhanced Referral & Viral Features

1. **Customer Referrals**
   - Customers refer friends to order from their favorite sellers
   - Both get discount coupon on next order

2. **Leaderboards**
   - Top 10 referrers displayed monthly
   - Winner gets Rs. 5,000 cash prize + feature in newsletter

3. **Affiliate Program**
   - Influencers get custom tracking codes
   - Earn 10% commission on referee subscriptions (recurring)

4. **Social Proof**
   - "1,234 sellers joined via referrals this month" banner
   - Success stories from top referrers

5. **Gamification**
   - Badges: "5 Referrals", "10 Referrals", "50 Referrals"
   - Unlock tiers: Bronze → Silver → Gold (increasing rewards)

## Success Metrics (Phase 2 Target)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Referral Signup Rate | 30% of new sellers | Firebase Analytics |
| Referral Conversion (Click → Publish) | 20% | Referral funnel |
| Average Referrals per Active Seller | 2.5 | Database query |
| Viral Coefficient | 0.5 | (Referrals × Conversion rate) |
| Referral CAC | Rs. 150 | Reward value / New sellers |
| Time to First Referral | <7 days after signup | Database query |

**Target by End of Phase 2**:
- 150 sellers acquired via referrals (30% of 500 total)
- Rs. 22,500 saved on acquisition costs (vs Rs. 75,000 paid ads)
- 50% of active sellers have shared referral code

---

**Status**: ✅ Ready for Implementation (Phase 2 - Month 3)
**Owner**: Growth Team + Backend Team
**Effort**: 4-5 days
**Dependencies**: Phase 1 analytics instrumentation, notification system
