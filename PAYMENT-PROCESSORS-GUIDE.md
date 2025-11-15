# MenuMaker Payment Processors Guide

**Phase 3: Multiple Payment Processors (US3.1)**
**Version**: 1.0.0
**Last Updated**: 2025-11-15

---

## Overview

MenuMaker supports multiple payment processors simultaneously, allowing sellers to choose the best processor for their market and reduce transaction fees. The platform automatically handles processor routing, fallback, and reconciliation.

### Supported Processors

✅ **Stripe** - Global payments (cards, wallets, bank transfers)
✅ **Razorpay** - India's leading payment gateway (UPI, cards, wallets)
✅ **PhonePe** - Low-cost Indian UPI and digital payments
✅ **Paytm** - Popular Indian payment platform (UPI, cards, wallets)

### Key Features

- ✅ **Multiple Processors**: Connect 2+ processors simultaneously
- ✅ **Automatic Routing**: Highest priority processor selected automatically
- ✅ **Fallback Logic**: If primary fails, automatically tries next processor
- ✅ **Cost Transparency**: Fees displayed per processor
- ✅ **Settlement Reports**: Monthly reconciliation with fee breakdown
- ✅ **Refund Routing**: Refunds routed to original processor

---

## Processor Comparison

| Processor | Fee | Settlement | Best For |
|-----------|-----|------------|----------|
| **Stripe** | 2.9% + ₹2 | Daily | International cards, global reach |
| **Razorpay** | 2% (1.75% with volume) | Daily/Weekly | UPI, Indian cards, wallets |
| **PhonePe** | 1% + GST (1.18% total) | Weekly | UPI-focused, lowest fees |
| **Paytm** | 2% + GST (2.36% total) | Weekly | Wide acceptance, brand trust |

---

## Setup Instructions

### 1. Connect a Payment Processor

**API Endpoint**: `POST /api/v1/payment-processors/connect`

**Request**:
```typescript
{
  "businessId": "business-uuid",
  "processorType": "razorpay", // or "stripe", "phonepe", "paytm"
  "credentials": {
    // Varies by processor (see below)
  },
  "priority": 1, // Lower = higher priority
  "settlement_schedule": "weekly", // "daily", "weekly", "monthly"
  "min_payout_threshold_cents": 50000, // Rs. 500 minimum
  "fee_percentage": 2.0,
  "fixed_fee_cents": 0
}
```

**Credentials by Processor**:

#### Stripe
```json
{
  "secret_key": "sk_live_xxx",
  "publishable_key": "pk_live_xxx",
  "webhook_secret": "whsec_xxx"
}
```

Get from: https://dashboard.stripe.com/apikeys

#### Razorpay
```json
{
  "key_id": "rzp_live_xxx",
  "key_secret": "xxx",
  "webhook_secret": "xxx"
}
```

Get from: https://dashboard.razorpay.com/app/keys

#### PhonePe
```json
{
  "merchant_id": "MERCHANTUAT",
  "salt_key": "xxx",
  "salt_index": "1"
}
```

Get from: PhonePe Business Dashboard (requires KYC verification)

#### Paytm
```json
{
  "merchant_id": "xxx",
  "merchant_key": "xxx",
  "website": "WEBSTAGING",
  "industry_type": "Retail"
}
```

Get from: Paytm Business Portal

**Response**:
```json
{
  "success": true,
  "data": {
    "processor": {
      "id": "processor-uuid",
      "processor_type": "razorpay",
      "status": "active",
      "is_active": true,
      "priority": 1,
      "settlement_schedule": "weekly",
      "verified_at": "2025-11-15T10:00:00Z"
    }
  },
  "message": "razorpay connected successfully"
}
```

---

### 2. List Connected Processors

**API Endpoint**: `GET /api/v1/payment-processors?businessId=xxx`

**Response**:
```json
{
  "success": true,
  "data": {
    "processors": [
      {
        "id": "processor-uuid-1",
        "processor_type": "razorpay",
        "status": "active",
        "is_active": true,
        "priority": 1,
        "fee_percentage": 2.0,
        "settlement_schedule": "weekly",
        "last_transaction_at": "2025-11-15T09:30:00Z"
      },
      {
        "id": "processor-uuid-2",
        "processor_type": "phonepe",
        "status": "active",
        "is_active": true,
        "priority": 2,
        "fee_percentage": 1.18,
        "settlement_schedule": "weekly"
      }
    ]
  }
}
```

---

### 3. Create Payment with Automatic Routing

**API Endpoint**: `POST /api/v1/payments/create-intent-multi`

**Request**:
```json
{
  "orderId": "order-uuid",
  "preferredProcessorId": "processor-uuid" // Optional: skip for automatic selection
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "paymentId": "payment-uuid",
    "processorType": "razorpay",
    "clientSecret": "order_xxx", // For Razorpay
    // OR
    "paymentUrl": "https://phonepe.com/pay/xxx", // For PhonePe/Paytm redirect
    "amount": 50000, // Rs. 500.00
    "currency": "INR",
    "status": "pending",
    "additionalData": {
      // Processor-specific data for frontend initialization
      "key": "rzp_live_xxx", // Razorpay publishable key
      "order_id": "order_xxx"
    }
  }
}
```

**Frontend Integration**:

#### Razorpay Checkout (Embedded)
```javascript
import Razorpay from 'razorpay';

const result = await createPayment(orderId); // Call API

const options = {
  key: result.additionalData.key,
  amount: result.amount,
  currency: result.currency,
  order_id: result.additionalData.order_id,
  name: businessName,
  description: `Order from ${businessName}`,
  prefill: {
    name: customerName,
    contact: customerPhone,
  },
  handler: function (response) {
    // Payment successful
    console.log('Payment ID:', response.razorpay_payment_id);
  },
};

const rzp = new Razorpay(options);
rzp.open();
```

#### PhonePe/Paytm (Redirect)
```javascript
const result = await createPayment(orderId); // Call API

if (result.paymentUrl) {
  // Redirect to payment page
  window.location.href = result.paymentUrl;
}
```

---

### 4. Handle Webhooks

Payment processors send webhooks to confirm payment status. MenuMaker handles this automatically.

**Webhook URL Format**:
```
https://api.menumaker.app/api/v1/payments/webhook-multi?processor=razorpay
```

**Processor-Specific Webhook URLs**:
- Stripe: `?processor=stripe`
- Razorpay: `?processor=razorpay`
- PhonePe: `?processor=phonepe`
- Paytm: `?processor=paytm`

**Configure in Processor Dashboard**:
1. Stripe Dashboard → Webhooks → Add endpoint
2. Razorpay Dashboard → Webhooks → Add webhook
3. PhonePe Dashboard → Callback URL (configured during payment creation)
4. Paytm Dashboard → Callback URL (configured during payment creation)

**Webhook Signature Headers**:
- Stripe: `stripe-signature`
- Razorpay: `x-razorpay-signature`
- PhonePe: `x-verify`
- Paytm: `x-paytm-signature`

---

### 5. Create Refunds

Refunds are automatically routed to the original processor.

**API Endpoint**: `POST /api/v1/payments/:id/refund-multi`

**Request**:
```json
{
  "amount": 25000, // Optional: partial refund (Rs. 250). Omit for full refund.
  "reason": "Customer requested refund"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "refund": {
      "id": "refund-uuid",
      "amount": 25000,
      "status": "succeeded"
    },
    "payment": {
      "id": "payment-uuid",
      "status": "refunded", // or original status if partial refund
      "refund_details": {
        "refund_id": "refund-uuid",
        "refund_amount_cents": 25000,
        "refund_reason": "Customer requested refund",
        "refunded_at": "2025-11-15T10:30:00Z"
      }
    }
  }
}
```

---

### 6. Generate Settlement Report

**API Endpoint**: `GET /api/v1/payment-processors/settlement-report?businessId=xxx&startDate=2025-11-01&endDate=2025-11-30&format=json`

**Response**:
```json
{
  "success": true,
  "data": {
    "report": {
      "summary": {
        "total_orders": 150,
        "total_amount_cents": 7500000, // Rs. 75,000
        "total_fees_cents": 150000,    // Rs. 1,500
        "net_payout_cents": 7350000    // Rs. 73,500
      },
      "by_processor": [
        {
          "processor_type": "razorpay",
          "processor_name": "Razorpay",
          "order_count": 100,
          "gross_amount_cents": 5000000, // Rs. 50,000
          "fee_amount_cents": 100000,    // Rs. 1,000 (2%)
          "net_amount_cents": 4900000,   // Rs. 49,000
          "settlement_schedule": "weekly",
          "average_fee_percentage": 2.0
        },
        {
          "processor_type": "phonepe",
          "processor_name": "PhonePe",
          "order_count": 50,
          "gross_amount_cents": 2500000, // Rs. 25,000
          "fee_amount_cents": 29500,     // Rs. 295 (1.18%)
          "net_amount_cents": 2470500,   // Rs. 24,705
          "settlement_schedule": "weekly",
          "average_fee_percentage": 1.18
        }
      ],
      "payments": [
        {
          "payment_id": "payment-uuid",
          "order_id": "order-uuid",
          "processor_type": "razorpay",
          "amount_cents": 50000,
          "fee_cents": 1000,
          "net_cents": 49000,
          "status": "succeeded",
          "created_at": "2025-11-15T10:00:00Z",
          "settled": true
        }
        // ... more payments
      ]
    }
  }
}
```

**CSV Format** (`?format=csv`):
```csv
Payment ID,Order ID,Processor,Amount (₹),Fee (₹),Net (₹),Status,Date,Settled
payment-uuid,order-uuid,razorpay,500.00,10.00,490.00,succeeded,2025-11-15T10:00:00Z,Yes
```

---

## Automatic Routing & Fallback

MenuMaker automatically selects the best processor based on priority and handles failures gracefully.

### Routing Logic

1. **Priority Selection**: Processors are sorted by priority (1 = highest)
2. **Preferred Processor**: If `preferredProcessorId` is provided, that processor is tried first
3. **Fallback**: If primary processor fails, next processor is tried automatically
4. **Error Tracking**: All failures are logged with reasons

**Example Scenario**:
```
Business has 3 processors:
- Razorpay (priority: 1) ← Primary
- PhonePe (priority: 2) ← Fallback 1
- Paytm (priority: 3)   ← Fallback 2

Payment attempt:
1. Try Razorpay → API error (network timeout)
2. Fallback to PhonePe → Success ✅
```

**Error Handling**:
- Network errors → Retry next processor
- Invalid credentials → Mark processor as failed
- Insufficient balance → Retry next processor
- All processors failed → Return error to customer

---

## Disconnecting a Processor

**API Endpoint**: `POST /api/v1/payment-processors/:id/disconnect`

**Response**:
```json
{
  "success": true,
  "data": {
    "processor": {
      "id": "processor-uuid",
      "is_active": false,
      "status": "inactive"
    }
  },
  "message": "Processor disconnected successfully"
}
```

**Impact**:
- Future orders will not use this processor
- Pending orders will complete normally
- Refunds for existing payments still work

---

## Cost Optimization Tips

### 1. Fee Comparison
- **Lowest fees**: PhonePe (1.18%) for UPI-heavy traffic
- **Best volume discount**: Razorpay (1.75% for Rs. 1L+ GMV/month)
- **International cards**: Stripe (best global coverage)

### 2. Priority Configuration
Set priority based on transaction mix:

**Example 1: UPI-heavy business**
```
1. PhonePe (1.18%) - Priority 1
2. Razorpay (2%) - Priority 2
3. Stripe (2.9%) - Priority 3
```

**Example 2: International customers**
```
1. Stripe (2.9%) - Priority 1
2. Razorpay (2%) - Priority 2
```

### 3. Volume Discounts
- Razorpay: 1.75% fee at Rs. 1L+ GMV/month (contact Razorpay for activation)
- Stripe: Custom pricing at Rs. 10L+ GMV/month

### 4. Settlement Frequency
- **Daily**: Best for cash flow (available with Razorpay, Stripe)
- **Weekly**: Standard (all processors)
- **Monthly**: Set threshold higher (e.g., Rs. 5,000) to reduce transaction count

---

## Troubleshooting

### Problem: Payment creation fails with "No active payment processors"
**Solution**: Verify at least one processor is connected and active:
```bash
GET /api/v1/payment-processors?businessId=xxx
```

### Problem: Webhook signature verification fails
**Solution**:
1. Verify webhook secret is correct in processor credentials
2. Check webhook URL includes `?processor=<type>`
3. Ensure raw body is sent (not parsed JSON)

### Problem: Refund fails
**Solution**:
1. Check payment status is "succeeded"
2. Verify original processor is still active
3. Check processor has sufficient balance (for Razorpay/PhonePe)

### Problem: Settlement report shows missing payments
**Solution**:
1. Verify date range includes payment created_at timestamp
2. Check payment status is "succeeded" or "refunded" (pending payments excluded)

---

## Security Best Practices

### 1. Credential Storage
- **Never** expose processor credentials in frontend
- **Always** store credentials encrypted (AES-256)
- **Rotate** API keys every 90 days

### 2. Webhook Verification
- **Always** verify webhook signatures before processing
- **Never** trust webhook data without signature validation
- **Log** all webhook failures for audit

### 3. Refund Authorization
- **Require** seller authentication for refunds
- **Log** all refund requests with admin ID
- **Limit** refund window (e.g., 30 days post-payment)

### 4. API Rate Limiting
- **Limit** payment creation to 10/minute per IP
- **Block** IPs with 5+ failed payment attempts
- **Alert** on sudden spike in failed payments

---

## API Reference Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/payment-processors` | GET | List all processors |
| `/payment-processors/connect` | POST | Connect new processor |
| `/payment-processors/:id/disconnect` | POST | Disconnect processor |
| `/payment-processors/:id/verify` | POST | Verify credentials |
| `/payment-processors/settlement-report` | GET | Generate settlement report |
| `/payments/create-intent-multi` | POST | Create payment with routing |
| `/payments/webhook-multi` | POST | Handle processor webhooks |
| `/payments/:id/refund-multi` | POST | Create refund |

---

## Environment Variables

Add to `.env`:

```bash
# PhonePe Configuration
PHONEPE_API_URL=https://api.phonepe.com/apis/hermes # Production
# PHONEPE_API_URL=https://api-preprod.phonepe.com/apis/pg-sandbox # Staging

# Paytm Configuration
PAYTM_API_URL=https://securegw.paytm.in # Production
# PAYTM_API_URL=https://securegw-stage.paytm.in # Staging

# Frontend URLs (for redirects)
FRONTEND_URL=https://menumaker.app
BACKEND_URL=https://api.menumaker.app
```

---

## Support

For processor-specific issues:
- **Razorpay**: https://razorpay.com/support/
- **PhonePe**: Business support via dashboard
- **Paytm**: https://business.paytm.com/support

For MenuMaker integration issues:
- **GitHub Issues**: https://github.com/ameedanxari/menumaker/issues

---

**Status**: ✅ Phase 3 - US3.1 Complete
**Processors Supported**: 4 (Stripe, Razorpay, PhonePe, Paytm)
**Automatic Routing**: ✅ Enabled
**Settlement Reports**: ✅ Enabled
**Refund Support**: ✅ All processors
