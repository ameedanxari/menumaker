# MenuMaker Enhanced Referral & Viral Features Guide

**Phase 3: Enhanced Referral & Viral Features (US3.11)**
**Version**: 1.0.0
**Last Updated**: 2025-11-15

---

## Overview

MenuMaker's enhanced referral system extends the Phase 2 referral program with customer referrals, monthly leaderboards with prizes, an influencer affiliate program, and viral achievement badges to drive platform growth.

### Key Features

✅ **Customer Referrals**: Customers refer friends for mutual rewards
✅ **Referral Leaderboard**: Monthly competition with Rs. 10,000 in prizes
✅ **Affiliate Program**: Influencers earn commission on referrals
✅ **Social Sharing**: Instagram & WhatsApp integration with templates
✅ **Viral Badges**: Achievement badges for top referrers
✅ **Analytics**: Comprehensive tracking and conversion metrics

---

## Customer Referrals

### 1. Create Customer Referral Code

**Endpoint**: `POST /api/v1/customers/referrals/create`

**Authentication**: Required (customer)

**Use Case**: Customer wants to refer friends to a specific business

**Request**:
```json
{
  "business_id": "business-uuid"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "referral": {
      "id": "referral-uuid",
      "referral_code": "CUST_RAHUL123456",
      "business_id": "business-uuid",
      "share_url": "https://menumaker.app?ref=CUST_RAHUL123456"
    }
  },
  "message": "Customer referral code created successfully"
}
```

### 2. Referral Flow

**Step 1: Customer Creates Referral**
- Customer A orders from Business X
- Customer A generates referral code: `CUST_RAHUL123456`
- Gets shareable link: `https://menumaker.app?ref=CUST_RAHUL123456`

**Step 2: Share with Friends**
- Customer A shares link via WhatsApp/Instagram
- Friend clicks link (tracked)

**Step 3: Friend Orders**
- Friend (Customer B) orders from Business X using referral code
- Order tracked to Customer A's referral

**Step 4: Rewards Claimed**
- Both Customer A and Customer B get Rs. 100 discount on next order
- Discount applied automatically as coupon

### 3. Get Customer Referral Stats

**Endpoint**: `GET /api/v1/customers/referrals/stats`

**Authentication**: Required (customer)

**Response**:
```json
{
  "success": true,
  "data": {
    "stats": {
      "total_referrals": 15,
      "successful_referrals": 12,
      "total_rewards_earned": 1200
    }
  }
}
```

**Metrics**:
- **total_referrals**: Total friends referred
- **successful_referrals**: Friends who placed orders
- **total_rewards_earned**: Total discount earned (Rs.)

---

## Referral Leaderboard

### Monthly Competition

**Prizes**:
- 🥇 **#1**: Rs. 5,000 account credit
- 🥈 **#2**: Rs. 3,000 account credit
- 🥉 **#3**: Rs. 2,000 account credit

**Reset**: Leaderboard resets on 1st of each month

### 4. Get Referral Leaderboard (Public)

**Endpoint**: `GET /api/v1/referrals/leaderboard`

**Authentication**: Not required (public)

**Query Parameters**:
- `limit` (optional): Number of top referrers (default: 10, max: 100)

**Response**:
```json
{
  "success": true,
  "data": {
    "leaderboard": [
      {
        "rank": 1,
        "user": {
          "id": "user-uuid-1",
          "name": "Priya Sharma",
          "avatar": "https://cdn.menumaker.app/avatars/priya.jpg"
        },
        "successful_referrals": 45,
        "prize_amount": 5000
      },
      {
        "rank": 2,
        "user": {
          "id": "user-uuid-2",
          "name": "Rahul Kumar",
          "avatar": "https://cdn.menumaker.app/avatars/rahul.jpg"
        },
        "successful_referrals": 38,
        "prize_amount": 3000
      },
      {
        "rank": 3,
        "user": {
          "id": "user-uuid-3",
          "name": "Anita Desai",
          "avatar": "https://cdn.menumaker.app/avatars/anita.jpg"
        },
        "successful_referrals": 32,
        "prize_amount": 2000
      }
    ]
  }
}
```

### 5. Get My Leaderboard Position

**Endpoint**: `GET /api/v1/referrals/leaderboard/me`

**Authentication**: Required (seller)

**Response**:
```json
{
  "success": true,
  "data": {
    "position": {
      "rank": 12,
      "successful_referrals": 18,
      "total_participants": 1247
    }
  }
}
```

**Metrics**:
- **rank**: Current position (null if not on leaderboard)
- **successful_referrals**: Referrals this month
- **total_participants**: Total sellers competing

### Prize Distribution (Automated)

**Cron Job**: Runs on 1st of each month at midnight

**Process**:
1. Get top 3 referrers from previous month
2. Calculate prize amounts (Rs. 5K, 3K, 2K)
3. Add account credit to winners
4. Send congratulatory email
5. Reset leaderboard for new month

---

## Affiliate Program

### Influencer Affiliate Program

**Who Can Apply**: Influencers, food bloggers, content creators

**Commission Structure**:
- **Sellers**: 5% of GMV for first 6 months
- **Customers**: 2% of GMV for first 3 months
- **Minimum Payout**: Rs. 1,000

### 6. Apply for Affiliate Program

**Endpoint**: `POST /api/v1/affiliates/apply`

**Authentication**: Required

**Request**:
```json
{
  "application_message": "I'm a food blogger with 50K Instagram followers. I create daily food content and would love to promote MenuMaker to my audience.",
  "instagram_handle": "@foodie_priya",
  "instagram_followers": 50000,
  "youtube_channel": "Priya's Kitchen",
  "youtube_subscribers": 25000
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "affiliate": {
      "id": "affiliate-uuid",
      "affiliate_code": "FOODIEPRIYA_654321",
      "status": "pending",
      "created_at": "2025-11-15T10:00:00Z"
    }
  },
  "message": "Affiliate application submitted successfully"
}
```

**Approval Process**:
1. Influencer submits application
2. Admin reviews application (checks social media presence)
3. Manual approval or rejection
4. Approved affiliates get unique code and marketing materials

### 7. Get Affiliate Dashboard

**Endpoint**: `GET /api/v1/affiliates/dashboard`

**Authentication**: Required (affiliate)

**Response**:
```json
{
  "success": true,
  "data": {
    "affiliate": {
      "id": "affiliate-uuid",
      "affiliate_code": "FOODIEPRIYA_654321",
      "status": "approved",
      "affiliate_type": "influencer",
      "qr_code_data": "https://menumaker.app/ref/FOODIEPRIYA_654321",
      "social_media_templates": [
        "https://cdn.menumaker.app/templates/affiliate-instagram-story.png",
        "https://cdn.menumaker.app/templates/affiliate-post.png"
      ]
    },
    "stats": {
      "total_clicks": 1547,
      "total_signups": 152,
      "total_conversions": 98,
      "conversion_rate": 6.34,
      "total_gmv": 450000,
      "total_commission_earned": 22500,
      "total_commission_paid": 15000,
      "pending_commission": 7500
    },
    "recent_clicks": [
      {
        "id": "click-uuid-1",
        "ip_address": "192.168.1.1",
        "utm_source": "instagram",
        "converted": true,
        "created_at": "2025-11-15T14:30:00Z"
      }
    ],
    "recent_payouts": [
      {
        "id": "payout-uuid-1",
        "payout_month": "2025-10",
        "payout_amount": 15000,
        "status": "paid",
        "paid_at": "2025-11-01T00:00:00Z"
      }
    ]
  }
}
```

**Dashboard Metrics**:
- **total_clicks**: Affiliate link clicks
- **total_signups**: Users who signed up
- **total_conversions**: Users who completed onboarding
- **conversion_rate**: (conversions / clicks) * 100
- **total_gmv**: Gross merchandise value generated (Rs.)
- **total_commission_earned**: Total commission earned (Rs.)
- **total_commission_paid**: Commission already paid (Rs.)
- **pending_commission**: Commission pending payout (Rs.)

### 8. Track Affiliate Click

**Endpoint**: `POST /api/v1/affiliates/track/:affiliateCode`

**Authentication**: Not required (public)

**Use Case**: Track when someone clicks affiliate link

**Response**:
```json
{
  "success": true,
  "data": {
    "click": {
      "id": "click-uuid",
      "created_at": "2025-11-15T14:30:00Z"
    }
  }
}
```

**Tracking Flow**:
1. User clicks affiliate link: `https://menumaker.app?ref=FOODIEPRIYA_654321`
2. Frontend calls tracking endpoint
3. Click recorded with IP, user agent, UTM params
4. Cookie stored for attribution window (30 days)
5. If user signs up within 30 days, conversion tracked

### Commission Calculation

**Seller Referrals**:
- Affiliate refers Seller A
- Seller A generates Rs. 100,000 GMV in first 6 months
- **Commission**: Rs. 100,000 * 5% = Rs. 5,000

**Customer Referrals**:
- Affiliate refers Customer B
- Customer B orders Rs. 50,000 worth in first 3 months
- **Commission**: Rs. 50,000 * 2% = Rs. 1,000

**Monthly Payout**:
- Minimum threshold: Rs. 1,000
- If pending_commission >= Rs. 1,000, payout initiated
- Paid on 1st of next month via bank transfer/UPI

---

## Social Sharing

### 9. Generate Instagram Story Share

**Endpoint**: `POST /api/v1/referrals/share/instagram`

**Authentication**: Required

**Request**:
```json
{
  "referral_code": "PRIYA2024",
  "business_name": "Priya's Kitchen",
  "menu_preview_url": "https://cdn.menumaker.app/menus/priya-menu-preview.jpg"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "share_data": {
      "story_url": "instagram://story-camera",
      "story_template": {
        "background_image": "https://cdn.menumaker.app/menus/priya-menu-preview.jpg",
        "text": "Join me on MenuMaker! Use code PRIYA2024 for Rs. 100 off 🎉",
        "link": "https://menumaker.app?ref=PRIYA2024"
      }
    }
  },
  "message": "Instagram story share generated"
}
```

**Instagram Deep Linking**:
```javascript
// Frontend implementation
const shareToInstagram = (storyTemplate) => {
  if (window.location.href.includes('instagram.com')) {
    // Use Instagram Web API
    window.location.href = storyTemplate.story_url;
  } else {
    // Fallback: Download template as image and prompt user
    downloadTemplate(storyTemplate);
  }
};
```

### 10. Generate WhatsApp Share

**Endpoint**: `POST /api/v1/referrals/share/whatsapp`

**Authentication**: Required

**Request**:
```json
{
  "referral_code": "PRIYA2024",
  "business_name": "Priya's Kitchen"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "share_data": {
      "message": "🍽️ I'm using MenuMaker for my food business!\n\nJoin me and get Rs. 500 off: https://menumaker.app?ref=PRIYA2024\n\nUse code: PRIYA2024",
      "share_url": "https://wa.me/?text=%F0%9F%8D%BD%EF%B8%8F%20I'm%20using%20MenuMaker%20for%20my%20food%20business!%0A%0AJoin%20me%20and%20get%20Rs.%20500%20off%3A%20https%3A%2F%2Fmenumaker.app%3Fref%3DPRIYA2024%0A%0AUse%20code%3A%20PRIYA2024"
    }
  },
  "message": "WhatsApp share message generated"
}
```

**WhatsApp Share Button** (Frontend):
```html
<a href="https://wa.me/?text=..." target="_blank">
  Share on WhatsApp
</a>
```

**QR Code Sharing**:
- Generate QR code for referral link
- Print on flyers, receipts, table tents
- Customers scan → Auto-apply referral code

---

## Viral Badges

### Achievement Badges

**Badge Tiers**:

1. **Superstar Seller** (10+ referrals)
   - Badge icon displayed on profile
   - Benefits: Priority support, Advanced analytics

2. **Mega Influencer** (50+ referrals)
   - Higher tier badge
   - Benefits: Priority support, Advanced analytics, Custom branding

3. **Viral King** (100+ referrals)
   - Highest tier badge
   - Benefits: Priority support, Advanced analytics, Custom branding, Personal account manager

### 11. Get My Viral Badges

**Endpoint**: `GET /api/v1/badges/me`

**Authentication**: Required

**Response**:
```json
{
  "success": true,
  "data": {
    "badges": [
      {
        "id": "badge-uuid",
        "badge_type": "superstar",
        "tier": 1,
        "display_name": "Superstar Seller",
        "description": "Referred 10+ sellers to MenuMaker",
        "icon_url": "https://cdn.menumaker.app/badges/superstar.png",
        "referrals_required": 10,
        "referrals_achieved": 15,
        "benefits": ["priority_support", "advanced_analytics"],
        "awarded_at": "2025-10-15T10:00:00Z"
      }
    ]
  }
}
```

### 12. Check and Award New Badges

**Endpoint**: `POST /api/v1/badges/check`

**Authentication**: Required

**Use Case**: Check if user has earned new badges

**Response**:
```json
{
  "success": true,
  "data": {
    "new_badges": [
      {
        "badge_type": "superstar",
        "display_name": "Superstar Seller",
        "tier": 1,
        "benefits": ["priority_support", "advanced_analytics"]
      }
    ]
  },
  "message": "Congratulations! You earned 1 new badge(s)!"
}
```

**Badge Display**:
- Show badge icon on user profile
- Display benefits unlocked
- Showcase in leaderboard
- Use in marketing (e.g., "Viral King Seller")

---

## API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/customers/referrals/create` | POST | Create customer referral code |
| `/customers/referrals/stats` | GET | Get customer referral stats |
| `/referrals/leaderboard` | GET | Get top referrers (public) |
| `/referrals/leaderboard/me` | GET | Get my leaderboard position |
| `/affiliates/apply` | POST | Apply for affiliate program |
| `/affiliates/dashboard` | GET | Get affiliate dashboard |
| `/affiliates/track/:affiliateCode` | POST | Track affiliate click |
| `/referrals/share/instagram` | POST | Generate Instagram share |
| `/referrals/share/whatsapp` | POST | Generate WhatsApp share |
| `/badges/me` | GET | Get my viral badges |
| `/badges/check` | POST | Check and award new badges |

---

## Best Practices

### For Sellers

1. **Share Actively**
   - Share referral link on Instagram stories weekly
   - Post on WhatsApp status daily
   - Print QR codes on receipts and flyers
   - Add referral link to Instagram bio

2. **Track Performance**
   - Monitor leaderboard position daily
   - Check referral stats weekly
   - Aim for top 3 to win monthly prizes

3. **Maximize Conversions**
   - Personalize share messages
   - Explain benefits clearly (Rs. 500 off)
   - Follow up with referred friends
   - Use visual content (menu previews)

### For Affiliates

1. **Content Strategy**
   - Create engaging food content
   - Highlight MenuMaker benefits
   - Share success stories
   - Use affiliate templates

2. **Conversion Optimization**
   - Include clear call-to-action
   - Use swipe-up links in Instagram stories
   - Pin referral link in bio
   - Track UTM parameters for campaign analysis

3. **Payout Management**
   - Set up bank transfer/UPI details
   - Track pending commission
   - Ensure minimum threshold (Rs. 1,000)
   - Review payout reports monthly

### For Developers

1. **Attribution Window**
   - Cookie-based tracking (30 days)
   - Handle multiple clicks (first-touch vs. last-touch)
   - Fraud detection (same IP, device fingerprint)

2. **Analytics**
   - Track click-through rate
   - Monitor conversion funnel
   - Calculate ROI per channel
   - A/B test share templates

3. **Cron Jobs**
   - Leaderboard prize distribution: 1st of month
   - Affiliate payouts: 1st of month
   - Badge checks: Daily
   - Commission calculations: End of month

---

## Viral Mechanics

### Gamification

**Referral Milestones**:
- 1 referral: "Getting Started" badge
- 5 referrals: "Rising Star" badge
- 10 referrals: "Superstar Seller" badge
- 25 referrals: "Champion Referrer" badge
- 50 referrals: "Mega Influencer" badge
- 100 referrals: "Viral King" badge

**Progress Tracking**:
```json
{
  "current_referrals": 15,
  "next_badge": "Champion Referrer",
  "referrals_needed": 10,
  "progress_percentage": 60
}
```

**Social Proof**:
- Display badge on profile
- Show in search results
- Feature on homepage: "Top Referrers This Month"
- Embed widget: "Viral King Seller"

### Viral Loop

**1. Customer Orders → 2. Gets Referral Code → 3. Shares with Friends → 4. Friends Order → 5. Both Get Rewards → 6. Repeat**

**Growth Metrics**:
- **Viral Coefficient** (k): Avg referrals per user
  - k = 1.5 (each user refers 1.5 users on average)
  - k > 1 = exponential growth
- **Conversion Rate**: 40% of referrals complete signup
- **Time to Referral**: Avg 7 days from signup to first referral

---

## Success Metrics

**Target Impact**:
- 📈 **Signups**: 40% of new signups via referrals
- 🏆 **Leaderboard Engagement**: 60% of sellers check monthly
- 💰 **Affiliate GMV**: Rs. 2L+ monthly from 50+ affiliates
- ⭐ **Viral Coefficient**: k = 1.5 (sustainable growth)
- 📊 **Conversion Rate**: 40% of referrals convert
- 🎯 **Average Referrals**: 5 successful referrals per active seller

---

## Troubleshooting

**"Referral code not found"**
- Solution: Check code spelling
- Or: Generate new referral code

**"Conversion not tracking"**
- Solution: Check cookie is set correctly
- Or: Verify attribution window (30 days)

**"Minimum payout not reached"**
- Solution: Wait until pending >= Rs. 1,000
- Or: Continue referring more users

**"Badge not awarded"**
- Solution: Call `/badges/check` endpoint
- Or: Check referral count threshold

---

## Integration Example

### Full Referral Flow (Frontend)

```typescript
// 1. Create referral code
const createReferralCode = async (businessId: string) => {
  const response = await fetch('/api/v1/customers/referrals/create', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ business_id: businessId }),
  });

  const data = await response.json();
  return data.data.referral;
};

// 2. Share on WhatsApp
const shareOnWhatsApp = async (referralCode: string) => {
  const response = await fetch('/api/v1/referrals/share/whatsapp', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      referral_code: referralCode,
      business_name: 'My Restaurant',
    }),
  });

  const data = await response.json();
  window.open(data.data.share_data.share_url, '_blank');
};

// 3. Check leaderboard position
const getMyPosition = async () => {
  const response = await fetch('/api/v1/referrals/leaderboard/me', {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  const data = await response.json();
  console.log(`Your rank: #${data.data.position.rank}`);
};

// 4. Check for new badges
const checkBadges = async () => {
  const response = await fetch('/api/v1/badges/check', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
  });

  const data = await response.json();
  if (data.data.new_badges.length > 0) {
    showBadgeNotification(data.data.new_badges);
  }
};
```

---

**Status**: ✅ Phase 3 - US3.11 Complete
**Features**: Customer Referrals, Monthly Leaderboard, Affiliate Program, Social Sharing, Viral Badges
**Prizes**: Rs. 10,000 monthly (Rs. 5K, 3K, 2K)
**Commission**: 5% sellers (6 months), 2% customers (3 months)
**Badges**: Superstar (10), Mega Influencer (50), Viral King (100)
**Viral Mechanics**: Gamification, Social proof, Automated rewards
