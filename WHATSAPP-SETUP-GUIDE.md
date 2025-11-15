# WhatsApp Notifications Setup Guide (Phase 2.3)

**Status**: ✅ **IMPLEMENTED**
**Feature**: WhatsApp Business API integration via Twilio
**Effort**: 8 developer-days
**Version**: 1.0

---

## Overview

MenuMaker now supports WhatsApp notifications for sellers and customers via Twilio's WhatsApp Business API. Sellers receive instant order notifications, and customers get order status updates via WhatsApp.

### Key Features

- 🔔 **New Order Notifications** - Sellers receive WhatsApp messages when orders are placed
- 💰 **Payment Confirmation** - Sellers get notified when payments succeed
- 📦 **Order Status Updates** - Customers receive status updates (confirmed, ready, delivered)
- ⚙️ **Opt-in/Opt-out** - Sellers control which notifications they receive
- 🔄 **Retry Logic** - Automatic retry with exponential backoff (3 attempts)
- 📊 **Analytics** - Track delivery rates and message stats

---

## Prerequisites

### 1. Twilio Account Setup

1. **Sign up for Twilio**: https://www.twilio.com/try-twilio
2. **Upgrade to paid account** (WhatsApp requires paid account)
3. **Enable WhatsApp**:
   - Go to Messaging → Try it out → Send a WhatsApp message
   - Or use Twilio's WhatsApp Sandbox for testing

### 2. WhatsApp Business API Access

#### Option A: Twilio WhatsApp Sandbox (Testing)
- Free for testing
- Use Twilio's shared number: `whatsapp:+14155238886`
- Recipients must join sandbox by sending "join <your-sandbox-keyword>" to the number
- **Limitations**: Not for production, limited to 100 recipients

#### Option B: Twilio WhatsApp Business (Production)
- Requires approval from Meta/WhatsApp
- Your own dedicated phone number
- Full API access, no recipient limits
- Cost: ~$0.004 - $0.012 per message (varies by country)

**Setup Steps**:
1. Go to Twilio Console → Messaging → Senders → WhatsApp senders
2. Click "Request Access"
3. Submit Facebook Business Manager info
4. Wait for approval (3-7 days)
5. Configure message templates

### 3. Get API Credentials

From Twilio Console:
1. **Account SID**: Dashboard → Account Info → Account SID
2. **Auth Token**: Dashboard → Account Info → Auth Token
3. **WhatsApp Number**: Messaging → Senders → WhatsApp senders

---

## Installation

### 1. Install Dependencies

```bash
cd backend
npm install twilio
```

### 2. Configure Environment Variables

Add to `.env`:

```bash
# WhatsApp Notifications (Twilio)
WHATSAPP_ENABLED=true
TWILIO_ACCOUNT_SID=AC...your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886  # Or your approved number
```

**For Sandbox Testing**:
```bash
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886  # Twilio sandbox number
```

**For Production**:
```bash
TWILIO_WHATSAPP_NUMBER=whatsapp:+15551234567  # Your approved WhatsApp number
```

### 3. Run Database Migration

```bash
cd backend
npm run migrate
```

This creates the WhatsApp settings columns in `business_settings` table.

---

## API Endpoints

### 1. Get WhatsApp Settings

**GET** `/api/v1/whatsapp/settings`

**Auth**: Required (Bearer token)

**Response**:
```json
{
  "whatsapp_enabled": true,
  "whatsapp_phone_number": "+918888888888",
  "whatsapp_notify_new_order": true,
  "whatsapp_notify_order_update": true,
  "whatsapp_notify_payment": true,
  "whatsapp_customer_notifications": false
}
```

### 2. Update WhatsApp Settings

**PATCH** `/api/v1/whatsapp/settings`

**Auth**: Required

**Body**:
```json
{
  "whatsapp_enabled": true,
  "whatsapp_phone_number": "+918888888888",
  "whatsapp_notify_new_order": true,
  "whatsapp_notify_order_update": true,
  "whatsapp_notify_payment": true,
  "whatsapp_customer_notifications": false
}
```

**Response**:
```json
{
  "message": "WhatsApp settings updated successfully",
  "settings": { ... }
}
```

### 3. Test WhatsApp Connection

**POST** `/api/v1/whatsapp/test`

**Auth**: Required

**Body**:
```json
{
  "phone_number": "+918888888888"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Test message sent successfully! Check your WhatsApp.",
  "message_id": "SM..."
}
```

### 4. Get Delivery Statistics

**GET** `/api/v1/whatsapp/stats`

**Auth**: Required

**Response**:
```json
{
  "total_messages": 150,
  "messages_sent": 145,
  "messages_failed": 5,
  "delivery_rate": "96.67%"
}
```

---

## Message Templates

### 1. New Order (Seller)

```
🔔 *New Order #12345678*

From: Rajesh Kumar
Phone: +919876543210

Items: Samosa × 2, Chai × 1
Total: Rs. 50.00

View order: https://menumaker.app/dashboard/orders/12345678
```

### 2. Order Status (Customer)

```
✅ Your order has been confirmed!

Order #12345678
From: Priya's Kitchen

Track order: https://menumaker.app/orders/12345678
```

### 3. Payment Received (Seller)

```
💰 *Payment Received*

Order #12345678
Amount: Rs. 50.00
Customer: Rajesh Kumar

Thank you for using MenuMaker!
```

---

## Usage

### For Sellers

#### 1. Enable WhatsApp Notifications

```typescript
// Frontend example
const enableWhatsApp = async () => {
  const response = await fetch('/api/v1/whatsapp/settings', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      whatsapp_enabled: true,
      whatsapp_phone_number: '+918888888888', // E.164 format
      whatsapp_notify_new_order: true,
      whatsapp_notify_payment: true,
    }),
  });

  const data = await response.json();
  console.log('WhatsApp enabled:', data);
};
```

#### 2. Test Connection

```typescript
const testWhatsApp = async () => {
  const response = await fetch('/api/v1/whatsapp/test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      phone_number: '+918888888888',
    }),
  });

  const data = await response.json();
  if (data.success) {
    alert('Test message sent! Check your WhatsApp.');
  }
};
```

---

## Testing

### 1. Sandbox Testing (Development)

**Prerequisites**:
- Recipients must join Twilio Sandbox
- Send "join <sandbox-keyword>" to `+14155238886` on WhatsApp

**Test Flow**:
1. Enable WhatsApp in business settings
2. Create a test order
3. Check WhatsApp for notification
4. Verify message content and formatting

### 2. Production Testing

**Prerequisites**:
- Approved WhatsApp Business account
- Template messages approved by Meta

**Test Checklist**:
- [ ] New order notification received
- [ ] Payment confirmation received
- [ ] Message format correct
- [ ] Links working
- [ ] Opt-out respected
- [ ] Retry logic working (simulate failure)
- [ ] Analytics tracking accurate

---

## Cost Estimation

### WhatsApp Message Pricing (via Twilio)

| Region | Cost per Message |
|--------|------------------|
| India | $0.004 - $0.008 |
| US | $0.008 - $0.012 |
| UK | $0.010 - $0.015 |

### Monthly Cost Examples

**Small Business (50 orders/month)**:
- Orders: 50
- Notifications: 50 (new order) + 50 (payment) = 100 messages
- Cost: 100 × $0.006 = **$0.60/month** (~Rs. 50)

**Medium Business (500 orders/month)**:
- Orders: 500
- Notifications: 500 × 2 = 1,000 messages
- Cost: 1,000 × $0.006 = **$6.00/month** (~Rs. 500)

**Large Business (2,000 orders/month)**:
- Orders: 2,000
- Notifications: 2,000 × 2 = 4,000 messages
- Cost: 4,000 × $0.006 = **$24.00/month** (~Rs. 2,000)

---

## Troubleshooting

### Issue: Messages not sending

**Check**:
1. `WHATSAPP_ENABLED=true` in `.env`
2. Valid Twilio credentials
3. Correct phone number format (E.164: +919876543210)
4. Recipient joined sandbox (if testing)
5. Check Twilio console for errors

**Debug**:
```bash
# Check backend logs
tail -f backend/logs/app.log | grep -i whatsapp

# Test Twilio credentials
curl -X GET \
  'https://api.twilio.com/2010-04-01/Accounts/AC.../Messages.json' \
  -u 'AC...:your_auth_token'
```

### Issue: Delivery failures

**Possible Causes**:
- Invalid phone number
- WhatsApp not registered on recipient's number
- Recipient blocked sender
- Rate limits exceeded

**Solution**:
- Check `order_notifications` table for `error_message`
- Verify phone number format
- Check Twilio console logs

### Issue: Template rejection (Production)

**Meta/WhatsApp Requirements**:
- No promotional content
- Clear opt-out instructions
- Personalized (use customer/order data)
- No spammy language

**Fix**:
1. Review template content
2. Remove promotional words
3. Resubmit for approval

---

## Security Best Practices

1. **Never expose Twilio credentials** in frontend code
2. **Validate phone numbers** before sending (E.164 format)
3. **Respect opt-outs** - Check `whatsapp_enabled` before sending
4. **Rate limiting** - Don't spam customers with status updates
5. **Audit trail** - All messages logged in `order_notifications` table
6. **PII handling** - Customer phone numbers are sensitive data

---

## Monitoring

### Key Metrics

1. **Delivery Rate**: Target > 95%
   - Check: `GET /api/v1/whatsapp/stats`
2. **Response Time**: Messages sent within 10 seconds
3. **Retry Success**: < 5% require retries
4. **Opt-out Rate**: < 2% of sellers disable WhatsApp

### Database Queries

```sql
-- Delivery rate last 30 days
SELECT
  COUNT(*) FILTER (WHERE status = 'sent') AS sent,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'sent') / COUNT(*), 2) AS delivery_rate
FROM order_notifications
WHERE notification_type = 'whatsapp'
  AND created_at > NOW() - INTERVAL '30 days';

-- Top error reasons
SELECT
  error_message,
  COUNT(*) AS count
FROM order_notifications
WHERE notification_type = 'whatsapp'
  AND status = 'failed'
GROUP BY error_message
ORDER BY count DESC
LIMIT 10;
```

---

## Future Enhancements (Phase 3+)

- [ ] Two-way chat (customer replies handled)
- [ ] Rich media (images, location sharing)
- [ ] WhatsApp Business catalog integration
- [ ] Automated responses (order status queries)
- [ ] Multi-language support
- [ ] Scheduled messages (order reminders)

---

## Support

**Twilio Support**: https://support.twilio.com
**WhatsApp Business API**: https://developers.facebook.com/docs/whatsapp
**MenuMaker Issues**: https://github.com/ameedanxari/menumaker/issues

---

**Document Version**: 1.0
**Last Updated**: November 14, 2025
**Status**: PRODUCTION READY ✅
