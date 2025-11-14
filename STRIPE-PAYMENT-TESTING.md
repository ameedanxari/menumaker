# Stripe Payment Integration - Testing Guide

This guide explains how to test the Stripe payment integration in MenuMaker.

## Overview

MenuMaker now supports online payments through Stripe. Customers can pay with credit/debit cards, digital wallets (Apple Pay, Google Pay), and other payment methods supported by Stripe.

## Architecture

### Backend Components

1. **Payment Model** (`backend/src/models/Payment.ts`)
   - Stores payment records in PostgreSQL
   - Tracks payment status, amount, currency, and Stripe IDs
   - Links to orders and businesses

2. **StripeService** (`backend/src/services/StripeService.ts`)
   - Creates payment intents
   - Handles webhook events
   - Processes refunds
   - Generates payment statistics

3. **Payment Routes** (`backend/src/routes/payments.ts`)
   - `POST /payments/create-intent` - Create payment intent for an order
   - `POST /payments/webhook` - Handle Stripe webhook events
   - `GET /payments/:id` - Get payment details
   - `POST /payments/:id/refund` - Create refund
   - `GET /payments/business/:businessId/stats` - Payment statistics

### Frontend Components

1. **StripeProvider** (`frontend/src/components/payments/StripeProvider.tsx`)
   - Wraps app with Stripe Elements context
   - Initializes Stripe with publishable key

2. **PaymentModal** (`frontend/src/components/payments/PaymentModal.tsx`)
   - Complete payment flow UI
   - Creates payment intent
   - Shows loading, error, and success states

3. **CheckoutForm** (`frontend/src/components/payments/CheckoutForm.tsx`)
   - Secure card payment form
   - Uses Stripe PaymentElement
   - Handles payment confirmation

## Setup Instructions

### 1. Get Stripe API Keys

1. Sign up for a Stripe account at https://stripe.com
2. Go to Developers > API keys
3. Copy your **Publishable key** (starts with `pk_test_`)
4. Copy your **Secret key** (starts with `sk_test_`)
5. Go to Developers > Webhooks > Add endpoint
   - Endpoint URL: `https://your-domain.com/api/v1/payments/webhook`
   - Events to listen: `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `charge.refunded`
6. Copy the **Webhook signing secret** (starts with `whsec_`)

### 2. Configure Environment Variables

**Backend** (`backend/.env`):
```bash
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

**Frontend** (`frontend/.env`):
```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
VITE_API_URL=http://localhost:3001/api/v1
```

### 3. Run Database Migration

```bash
cd backend
npm run migration:run
```

This creates the `payments` table with all necessary indexes and foreign keys.

### 4. Start the Application

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

## Testing Payment Flow

### Test Card Numbers

Stripe provides test card numbers for various scenarios:

#### Successful Payments
- **4242 4242 4242 4242** - Standard successful payment
- **4000 0566 5566 5556** - Successful payment with 3D Secure 2
- **5555 5555 5555 4444** - Mastercard successful payment

#### Failed Payments
- **4000 0000 0000 0002** - Card declined
- **4000 0000 0000 9995** - Insufficient funds
- **4000 0000 0000 9987** - Card lost
- **4000 0000 0000 9979** - Card stolen

#### Special Test Cases
- **4000 0027 6000 3184** - Requires authentication (3D Secure)
- **4000 0000 0000 3220** - 3D Secure authentication required
- **4000 0082 6000 0000** - Charge succeeds but later disputed as fraudulent

**For all test cards:**
- Use any future expiry date (e.g., 12/25)
- Use any 3-digit CVC (e.g., 123)
- Use any ZIP code (e.g., 12345)

### Step-by-Step Testing

#### 1. Create a Business and Menu
1. Sign up for an account
2. Create a business profile
3. Add dishes to your menu
4. Publish the menu

#### 2. Place an Order as a Customer
1. Visit the public menu page: `http://localhost:5173/menu/your-business-slug`
2. Add items to cart
3. Click "Checkout"
4. Fill in customer details:
   - Name: Test Customer
   - Phone: 1234567890
   - Email: test@example.com (optional)
5. Select "Pickup" or "Delivery"
6. **Select "Online Payment" as payment method**
7. Click "Place Order"

#### 3. Complete Payment
1. Payment modal should appear
2. Enter test card details:
   - Card number: `4242 4242 4242 4242`
   - Expiry: `12/25`
   - CVC: `123`
   - ZIP: `12345`
3. Click "Pay"
4. Payment should process successfully
5. Order confirmation message appears

#### 4. Verify Payment in Backend
1. Check the `payments` table in PostgreSQL:
   ```sql
   SELECT * FROM payments ORDER BY created_at DESC LIMIT 1;
   ```
2. Payment status should be `succeeded`
3. Order status should be `confirmed`
4. Payment status should be `paid`

#### 5. Test Webhook Events (Optional)
1. Use Stripe CLI to forward webhooks:
   ```bash
   stripe listen --forward-to localhost:3001/api/v1/payments/webhook
   ```
2. Trigger test events:
   ```bash
   stripe trigger payment_intent.succeeded
   stripe trigger payment_intent.payment_failed
   ```
3. Check backend logs for webhook processing

### Testing Refunds

#### Via API (Seller)
1. Log in as the business owner
2. Go to Orders page
3. Find a paid order
4. Click "Refund" (if implemented in UI)
5. Confirm refund
6. Payment status changes to `refunded`

#### Via API Call
```bash
curl -X POST http://localhost:3001/api/v1/payments/{payment_id}/refund \
  -H "Authorization: Bearer {your_token}" \
  -H "Content-Type: application/json" \
  -d '{"reason": "requested_by_customer"}'
```

### Testing Payment Statistics

```bash
curl http://localhost:3001/api/v1/payments/business/{business_id}/stats \
  -H "Authorization: Bearer {your_token}"
```

Expected response:
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalPayments": 10,
      "successfulPayments": 8,
      "failedPayments": 2,
      "totalRevenue": 50000,
      "averageOrderValue": 6250
    }
  }
}
```

## Payment Flow Diagram

```
Customer                Frontend              Backend              Stripe
   |                       |                    |                    |
   |--- Select Online ---->|                    |                    |
   |                       |                    |                    |
   |--- Place Order ------>|                    |                    |
   |                       |--- Create Order -->|                    |
   |                       |<-- Order ID -------|                    |
   |                       |                    |                    |
   |                       |--- Create Intent ->|                    |
   |                       |                    |--- Payment Intent >|
   |                       |                    |<-- Client Secret --|
   |                       |<-- Client Secret --|                    |
   |                       |                    |                    |
   |<-- Payment Modal -----|                    |                    |
   |                       |                    |                    |
   |--- Enter Card ------->|                    |                    |
   |                       |--- Confirm ------->|--- Confirm ------->|
   |                       |                    |                    |
   |                       |                    |<-- Success --------|
   |                       |<-- Success --------|                    |
   |<-- Confirmation ------|                    |                    |
   |                       |                    |                    |
   |                       |                    |<-- Webhook --------|
   |                       |                    |(payment_intent.succeeded)
   |                       |                    |                    |
   |                       |                    |--- Update Order -->|
   |                       |                    |(status: confirmed) |
```

## Security Considerations

### PCI Compliance
- **Card data never touches your servers** - Stripe Elements handles all card input
- **Client secret is single-use** - Each payment intent has a unique secret
- **Webhook signature verification** - All webhooks are verified using signing secret

### Authorization
- Payment creation is public (customer-initiated)
- Payment viewing requires authentication (seller only)
- Refunds require business ownership verification
- Payment stats require authentication

### Data Protection
- Sensitive payment data stored only in Stripe
- Local database stores only Stripe IDs and status
- No card numbers, CVCs, or PINs stored

## Troubleshooting

### "Stripe not initialized" Error
- Check `VITE_STRIPE_PUBLISHABLE_KEY` is set in frontend `.env`
- Verify the key starts with `pk_test_` or `pk_live_`
- Restart frontend dev server after changing `.env`

### "Payment intent creation failed" Error
- Check `STRIPE_SECRET_KEY` is set in backend `.env`
- Verify the key starts with `sk_test_` or `sk_live_`
- Check backend logs for detailed error message

### "Webhook verification failed" Error
- Check `STRIPE_WEBHOOK_SECRET` is set in backend `.env`
- Verify the secret starts with `whsec_`
- For local testing, use Stripe CLI to forward webhooks

### Payment succeeds but order not confirmed
- Check webhook endpoint is configured correctly
- Use Stripe CLI to test webhook delivery
- Check backend logs for webhook processing errors
- Verify webhook signature verification is working

### Network Errors
- Ensure backend is running on port 3001
- Ensure frontend `VITE_API_URL` points to correct backend
- Check CORS configuration if using different domains

## Production Checklist

Before going live:

- [ ] Replace test API keys with live keys (`pk_live_`, `sk_live_`)
- [ ] Configure production webhook endpoint
- [ ] Set up webhook endpoint monitoring
- [ ] Enable Stripe Radar for fraud detection
- [ ] Configure email receipts in Stripe Dashboard
- [ ] Set up dispute handling process
- [ ] Test with real cards in small amounts
- [ ] Monitor payment success rate
- [ ] Set up alerts for failed payments
- [ ] Review refund policy and implement UI
- [ ] Configure statement descriptor (shows on card statements)
- [ ] Set up payment reconciliation process

## Support Resources

- **Stripe Documentation**: https://stripe.com/docs
- **Stripe Dashboard**: https://dashboard.stripe.com
- **API Reference**: https://stripe.com/docs/api
- **Test Cards**: https://stripe.com/docs/testing
- **Webhooks Guide**: https://stripe.com/docs/webhooks

## Next Steps

After completing basic payment integration:

1. **Add payment status to Orders page** - Show payment status badge
2. **Implement refund UI** - Allow sellers to refund from dashboard
3. **Add payment analytics** - Show revenue charts and trends
4. **Send payment receipts** - Email customers on successful payment
5. **Handle failed payments** - Retry logic and customer notifications
6. **Add saved payment methods** - For repeat customers
7. **Implement subscriptions** - For Phase 2.2 (Tiered Subscriptions)

---

**Last Updated**: November 14, 2025
**Status**: Phase 2.1 Complete ✅
