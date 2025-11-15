# MenuMaker Automated Payouts Guide

**Phase 3: Automated Tiered Payouts (US3.2)**
**Version**: 1.0.0
**Last Updated**: 2025-11-15

---

## Overview

MenuMaker automatically processes payouts to sellers based on configurable schedules. The system handles fee calculations, volume discounts, subscription deductions, and bank reconciliation.

### Key Features

✅ **Automated Scheduling**: Daily, weekly, or monthly payouts
✅ **Threshold-Based**: Hold payouts until minimum amount reached
✅ **Volume Discounts**: 0.5% fee reduction when monthly GMV > Rs. 1L
✅ **Fee Transparency**: Detailed breakdown of all fees and deductions
✅ **Retry Logic**: Automatic retry for failed payouts (up to 3 attempts)
✅ **Bank Reconciliation**: Automatic matching with bank statements

---

## Payout Calculation

```typescript
Net Payout = Gross Amount
            - Processor Fees (Razorpay/PhonePe/etc.)
            - Subscription Fee (Pro/Business tier)
            - Platform Fee (if applicable)
            + Volume Discount (0.5% if GMV > Rs. 1L)
```

### Example Calculation

```
Gross Amount:        Rs. 10,000.00
Processor Fee (2%):  -Rs.    200.00  (Razorpay)
Subscription Fee:    -Rs.    199.00  (Pro tier, monthly prorated)
Volume Discount:     +Rs.     50.00  (GMV > Rs. 1L this month)
-------------------------------------------
Net Payout:          Rs.  9,651.00
```

---

## Payout Frequencies

### Daily (Next Business Day)
- **Schedule**: Every business day (Mon-Fri)
- **Best For**: High-volume sellers needing quick cash flow
- **Example**: Orders from Monday paid out on Tuesday

### Weekly (Every Monday)
- **Schedule**: Every Monday (configurable to other days)
- **Best For**: Most sellers (default)
- **Example**: Orders from Nov 1-7 paid out on Nov 11 (Monday)

### Monthly (1st of Month)
- **Schedule**: Specified day of month (1-28)
- **Best For**: Low-volume sellers or accounting preference
- **Example**: Orders from November paid out on Dec 1

---

## Volume Discount (0.5% Fee Reduction)

Sellers automatically receive a **0.5% fee reduction** when monthly GMV exceeds **Rs. 1,00,000** (1 Lakh).

### How It Works

1. **Monthly GMV Tracking**: System tracks gross sales per month
2. **Threshold Check**: When GMV crosses Rs. 1L, discount activates
3. **Automatic Application**: Discount applied to all subsequent payouts that month
4. **Reset**: Resets to 0 on 1st of each month

### Example

```
Month: November 2025
--------------------------------------------------
Week 1:  GMV = Rs.  30,000  → No discount
Week 2:  GMV = Rs.  60,000  → No discount (total: Rs. 90,000)
Week 3:  GMV = Rs.  50,000  → DISCOUNT APPLIED! (total: Rs. 1,40,000)
         Volume Discount = Rs. 50,000 × 0.5% = Rs. 250

Week 4:  GMV = Rs.  40,000  → Discount continues
         Volume Discount = Rs. 40,000 × 0.5% = Rs. 200
```

---

## Payout Configuration

### Configure Payout Schedule

**API**: `PUT /api/v1/payouts/schedule`

**Request**:
```json
{
  "scheduleId": "schedule-uuid",
  "frequency": "weekly",  // "daily", "weekly", "monthly"
  "weekly_day_of_week": 1,  // 0=Sunday, 1=Monday, ..., 6=Saturday
  "monthly_day_of_month": 1,  // 1-28
  "min_payout_threshold_cents": 50000,  // Rs. 500
  "max_hold_period_days": 7,  // Max days to hold
  "email_notifications_enabled": true,
  "notification_email": "seller@example.com"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "schedule": {
      "id": "schedule-uuid",
      "frequency": "weekly",
      "next_payout_date": "2025-11-18",
      "current_balance_cents": 75000,  // Rs. 750
      "volume_discount_eligible": true
    }
  }
}
```

---

## Minimum Payout Threshold

Payouts are held until balance exceeds the minimum threshold (default: Rs. 500).

### Threshold Rules

1. **Below Threshold**: Payout held until threshold exceeded
2. **Max Hold Period**: Even if below threshold, payout triggered after max hold period (default: 7 days)
3. **Seller Control**: Threshold and max hold period configurable

### Example

```
Threshold: Rs. 500
Max Hold Period: 7 days

Day 1:  Balance = Rs. 300  → Hold (below threshold)
Day 2:  Balance = Rs. 450  → Hold (below threshold)
Day 3:  Balance = Rs. 600  → PAYOUT TRIGGERED! (threshold exceeded)
```

**Edge Case**:
```
Day 1:  Balance = Rs. 300  → Hold
Day 7:  Balance = Rs. 400  → PAYOUT TRIGGERED! (max hold period reached)
```

---

## Manual Hold (For Reconciliation)

Sellers can manually hold payouts for accounting reconciliation.

**API**: `POST /api/v1/payouts/schedule/hold`

**Request**:
```json
{
  "scheduleId": "schedule-uuid",
  "hold": true,
  "reason": "Reconciling with bank statements"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Payouts held successfully"
}
```

**Resume Payouts**:
```json
{
  "scheduleId": "schedule-uuid",
  "hold": false
}
```

---

## Payout History

**API**: `GET /api/v1/payouts?businessId=xxx&limit=20`

**Response**:
```json
{
  "success": true,
  "data": {
    "payouts": [
      {
        "id": "payout-uuid",
        "period_start": "2025-11-01",
        "period_end": "2025-11-07",
        "scheduled_payout_date": "2025-11-11",
        "frequency": "weekly",
        "gross_amount_cents": 1000000,  // Rs. 10,000
        "processor_fee_cents": 20000,   // Rs. 200
        "subscription_fee_cents": 19900, // Rs. 199
        "volume_discount_cents": 5000,   // Rs. 50
        "net_amount_cents": 965100,      // Rs. 9,651
        "payment_count": 42,
        "status": "completed",
        "processor_payout_id": "payout_xyz123",
        "bank_transaction_id": "UTR123456789",
        "completed_at": "2025-11-11T10:30:00Z",
        "reconciliation_status": "reconciled"
      }
    ],
    "total": 15
  }
}
```

---

## Failed Payouts & Retries

If a payout fails (bank rejection, insufficient balance, etc.), the system automatically retries.

### Retry Logic

1. **Retry Count**: Max 3 retries
2. **Retry Delay**: 1 day between retries
3. **Notification**: Seller notified via email on each failure
4. **Manual Retry**: Seller can manually trigger retry via API

### Retry Example

```
Day 1:  Payout fails → Retry scheduled for Day 2
Day 2:  Retry attempt 1 fails → Retry scheduled for Day 3
Day 3:  Retry attempt 2 fails → Retry scheduled for Day 4
Day 4:  Retry attempt 3 succeeds ✅
```

**Manual Retry**:
```
POST /api/v1/payouts/:id/retry
```

---

## Subscription Fee Deduction

Subscription fees (Pro/Business tier) are automatically deducted from payouts.

### Fee Structure

- **Free Tier**: Rs. 0/month
- **Pro Tier**: Rs. 199/month
- **Business Tier**: Rs. 499/month

### Prorated Deduction

Fees are prorated based on payout period:

```
Weekly Payout:
Subscription Fee = (Rs. 199 / 30 days) × 7 days ≈ Rs. 46

Monthly Payout:
Subscription Fee = Rs. 199 (full month)
```

---

## Bank Reconciliation

System automatically reconciles payouts with bank statements.

### Reconciliation Statuses

- **pending**: Not yet reconciled
- **reconciled**: Matched with bank statement ✅
- **exception**: Mismatch detected ⚠️

### Exception Handling

If amounts don't match:
1. System flags as "exception"
2. Admin alerted
3. Manual review required
4. Seller notified if needed

---

## API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/payouts` | GET | List payout history |
| `/payouts/:id` | GET | Get payout details |
| `/payouts/schedule` | GET | Get payout configuration |
| `/payouts/schedule` | PUT | Update payout configuration |
| `/payouts/schedule/hold` | POST | Hold/unhold payouts |
| `/payouts/:id/retry` | POST | Manually retry failed payout |

---

## Cron Jobs (Backend)

### Generate Payouts (Daily 12:00 AM)
```typescript
// Runs daily to generate pending payouts based on schedules
await payoutService.generateScheduledPayouts();
```

### Process Payouts (Daily 6:00 AM)
```typescript
// Processes pending payouts (calls processor APIs)
await payoutService.processPendingPayouts();
```

---

## Success Metrics

**Target Impact**:
- ⚡ **Faster Cash Flow**: 70% of sellers receive payouts within 24-48 hours
- 📉 **Reduced Reconciliation Time**: 70% reduction in manual reconciliation
- 💰 **Volume Discount Uptake**: 30% of sellers qualify for discount monthly
- ✅ **Payout Success Rate**: 98% first-attempt success rate

---

## Support

**For Payout Issues**:
- Check payout status: `GET /api/v1/payouts/:id`
- Manual retry: `POST /api/v1/payouts/:id/retry`
- Hold payouts: `POST /api/v1/payouts/schedule/hold`

**For Configuration Help**:
- Update schedule: `PUT /api/v1/payouts/schedule`
- View current config: `GET /api/v1/payouts/schedule`

---

**Status**: ✅ Phase 3 - US3.2 Complete
**Automation**: Daily/Weekly/Monthly schedules
**Volume Discount**: 0.5% reduction at Rs. 1L+ GMV
**Retry Logic**: Up to 3 automatic retries
**Bank Reconciliation**: Automated matching
