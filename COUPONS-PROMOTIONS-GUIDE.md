# MenuMaker Coupons & Promotions Guide

**Phase 3: Promotions, Coupons & Discounts (US3.9)**
**Version**: 1.0.0
**Last Updated**: 2025-11-15

---

## Overview

MenuMaker enables sellers to create discount coupons, seasonal promotions, and automatic discounts to attract customers and increase order volume.

### Key Features

✅ **Flexible Coupons**: Fixed amount or percentage discounts with rules
✅ **Usage Limits**: Per customer, per month, total limit, or unlimited
✅ **Minimum Order Value**: Set threshold for coupon application
✅ **Dish-Specific Coupons**: Apply to all dishes or specific items only
✅ **QR Code Generation**: Shareable coupons via QR codes (WhatsApp/Instagram)
✅ **Automatic Promotions**: Rule-based promotions (e.g., free delivery on orders > Rs. 500)
✅ **Public Menu Display**: Show eligible coupons on public menu
✅ **Comprehensive Analytics**: Redemption rate, discount given, order uplift
✅ **Auto-Expiration**: Expired coupons automatically archived

---

## Coupon Creation

### 1. Create Coupon

**Endpoint**: `POST /api/v1/coupons`

**Authentication**: Required (seller must own business)

**Request**:
```json
{
  "business_id": "business-uuid",
  "code": "FEST10",
  "name": "Festival Sale 10% Off",
  "description": "Celebrate with 10% off on all orders!",
  "discount_type": "percentage",
  "discount_value": 10,
  "max_discount_cents": 10000,
  "min_order_value_cents": 20000,
  "valid_from": "2025-10-01T00:00:00Z",
  "valid_until": "2025-10-31T23:59:59Z",
  "usage_limit_type": "per_customer",
  "usage_limit_per_customer": 3,
  "applicable_to": "all_dishes",
  "is_public": true
}
```

**Discount Types**:

1. **Fixed Amount** (`discount_type: "fixed"`):
   - `discount_value`: Amount in cents (e.g., 5000 = Rs. 50 off)
   - Example: Rs. 50 off on all orders

2. **Percentage** (`discount_type: "percentage"`):
   - `discount_value`: Percentage (e.g., 10 = 10% off)
   - `max_discount_cents` (optional): Cap maximum discount (e.g., 10000 = max Rs. 100 off)
   - Example: 10% off, max Rs. 100 discount

**Usage Limit Types**:

1. **Unlimited** (`usage_limit_type: "unlimited"`):
   - No usage restrictions
   - Anyone can use anytime during validity period

2. **Per Customer** (`usage_limit_type: "per_customer"`):
   - `usage_limit_per_customer`: Max times per customer (e.g., 3)
   - Example: Each customer can use 3 times

3. **Per Month** (`usage_limit_type: "per_month"`):
   - `usage_limit_per_month`: Max times per customer per month (e.g., 1)
   - Example: Each customer can use once per month

4. **Total Limit** (`usage_limit_type: "total_limit"`):
   - `total_usage_limit`: Total redemptions across all customers (e.g., 100)
   - Example: First 100 customers only

**Applicable To**:

1. **All Dishes** (`applicable_to: "all_dishes"`):
   - Coupon applies to entire order

2. **Specific Dishes** (`applicable_to: "specific_dishes"`):
   - `dish_ids`: Array of dish UUIDs
   - Coupon applies only if order contains these dishes
   - Example: Only on Biryani and Paneer dishes

**Response**:
```json
{
  "success": true,
  "data": {
    "coupon": {
      "id": "coupon-uuid",
      "business_id": "business-uuid",
      "code": "FEST10",
      "name": "Festival Sale 10% Off",
      "description": "Celebrate with 10% off on all orders!",
      "discount_type": "percentage",
      "discount_value": 10,
      "max_discount_cents": 10000,
      "min_order_value_cents": 20000,
      "valid_from": "2025-10-01T00:00:00Z",
      "valid_until": "2025-10-31T23:59:59Z",
      "usage_limit_type": "per_customer",
      "usage_limit_per_customer": 3,
      "applicable_to": "all_dishes",
      "status": "active",
      "is_public": true,
      "qr_code_data": "https://menumaker.app/coupon/FEST10",
      "created_at": "2025-09-15T10:00:00Z"
    }
  },
  "message": "Coupon created successfully"
}
```

---

## Coupon Validation

### 2. Validate Coupon

**Endpoint**: `POST /api/v1/coupons/validate`

**Authentication**: Required (customer)

**Use Case**: Customer enters coupon code during checkout → Validate before applying

**Request**:
```json
{
  "coupon_code": "FEST10",
  "business_id": "business-uuid",
  "order_subtotal_cents": 30000,
  "dish_ids": ["dish-uuid-1", "dish-uuid-2"]
}
```

**Validation Checks**:

1. ✅ **Coupon Exists**: Code exists and belongs to business
2. ✅ **Active Status**: Coupon status = `active`
3. ✅ **Date Validity**: Current date between `valid_from` and `valid_until`
4. ✅ **Minimum Order Value**: Order subtotal >= `min_order_value_cents`
5. ✅ **Dish Applicability**: If specific dishes, order contains applicable dishes
6. ✅ **Usage Limits**: Customer hasn't exceeded usage limit

**Response (Valid)**:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "discount_amount_cents": 3000,
    "discount_amount": 30,
    "coupon": {
      "id": "coupon-uuid",
      "business_id": "business-uuid",
      "code": "FEST10",
      "name": "Festival Sale 10% Off",
      "description": "Celebrate with 10% off on all orders!",
      "discount_type": "percentage",
      "discount_value": 10,
      "max_discount_cents": 10000,
      "min_order_value_cents": 20000,
      "valid_until": "2025-10-31T23:59:59Z",
      "usage_limit_type": "per_customer",
      "total_usage_limit": null,
      "is_active": true
    }
  },
  "message": "Coupon is valid"
}
```

**Discount Calculation Example**:
- Order subtotal: Rs. 300 (30000 cents)
- Discount: 10%
- Discount amount: Rs. 30 (3000 cents)
- **Final total**: Rs. 270 (27000 cents)

**Response (Invalid)**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_COUPON",
    "message": "Minimum order value of Rs. 200 required"
  }
}
```

**Common Error Messages**:
- "Coupon not found"
- "Coupon is not active"
- "Coupon is not yet valid"
- "Coupon has expired"
- "Minimum order value of Rs. X required"
- "Coupon not applicable to items in cart"
- "You have already used this coupon"
- "Coupon usage limit reached"
- "Monthly usage limit for this coupon reached"

---

## Coupon Management

### 3. Get Business Coupons

**Endpoint**: `GET /api/v1/coupons/business/:businessId`

**Authentication**: Required (seller must own business)

**Query Parameters**:
- `status` (optional): Filter by status (`active`, `expired`, `archived`)
- `is_public` (optional): Filter by visibility (`true` or `false`)

**Response**:
```json
{
  "success": true,
  "data": {
    "coupons": [
      {
        "id": "coupon-uuid-1",
        "code": "FEST10",
        "name": "Festival Sale 10% Off",
        "discount_type": "percentage",
        "discount_value": 10,
        "status": "active",
        "total_usage_count": 45,
        "total_discount_given_cents": 135000,
        "created_at": "2025-09-15T10:00:00Z"
      },
      {
        "id": "coupon-uuid-2",
        "code": "SAVE50",
        "name": "Rs. 50 Off",
        "discount_type": "fixed",
        "discount_value": 5000,
        "status": "active",
        "total_usage_count": 23,
        "total_discount_given_cents": 115000,
        "created_at": "2025-08-01T10:00:00Z"
      }
    ]
  }
}
```

### 4. Get Public Coupons (Menu Display)

**Endpoint**: `GET /api/v1/coupons/public/:businessId`

**Authentication**: Not required (public)

**Use Case**: Show eligible coupons on public menu for customers

**Response**:
```json
{
  "success": true,
  "data": {
    "coupons": [
      {
        "code": "FEST10",
        "name": "Festival Sale 10% Off",
        "description": "Celebrate with 10% off on all orders!",
        "discount_type": "percentage",
        "discount_value": 10,
        "min_order_value_cents": 20000,
        "valid_until": "2025-10-31T23:59:59Z",
        "qr_code_data": "https://menumaker.app/coupon/FEST10"
      }
    ]
  }
}
```

**Display on Menu**:
- Show coupon badge: "10% OFF - Use code FEST10"
- Show minimum order: "Min order: Rs. 200"
- Show QR code for easy sharing
- Show expiry date: "Valid until Oct 31"

### 5. Update Coupon

**Endpoint**: `PUT /api/v1/coupons/:id`

**Authentication**: Required (seller must own business)

**Updatable Fields**:
- `name`: Display name
- `description`: Description text
- `min_order_value_cents`: Minimum order value
- `valid_until`: Expiry date (can extend, not reduce)
- `is_public`: Visibility on menu
- `status`: `active`, `expired`, `archived`

**Request**:
```json
{
  "name": "Diwali Sale 10% Off",
  "valid_until": "2025-11-15T23:59:59Z",
  "is_public": false
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "coupon": {
      "id": "coupon-uuid",
      "name": "Diwali Sale 10% Off",
      "valid_until": "2025-11-15T23:59:59Z",
      "is_public": false,
      "updated_at": "2025-10-20T10:00:00Z"
    }
  },
  "message": "Coupon updated successfully"
}
```

### 6. Archive Coupon

**Endpoint**: `DELETE /api/v1/coupons/:id`

**Authentication**: Required (seller must own business)

**Effect**:
- Sets `status = 'archived'`
- Coupon no longer visible or applicable
- Usage history retained for analytics

**Response**:
```json
{
  "success": true,
  "message": "Coupon archived successfully"
}
```

---

## Coupon Analytics

### 7. Get Coupon Analytics

**Endpoint**: `GET /api/v1/coupons/:id/analytics`

**Authentication**: Required (seller must own business)

**Response**:
```json
{
  "success": true,
  "data": {
    "analytics": {
      "coupon": {
        "code": "FEST10",
        "name": "Festival Sale 10% Off",
        "discount_type": "percentage",
        "discount_value": 10
      },
      "total_usages": 45,
      "total_discount_given": 1350,
      "total_revenue_generated": 12150,
      "redemption_rate": 45.0,
      "avg_order_value": 270.0,
      "recent_usages": [
        {
          "id": "usage-uuid-1",
          "order_id": "order-uuid-1",
          "customer_id": "customer-uuid-1",
          "discount_amount_cents": 3000,
          "order_subtotal_cents": 30000,
          "order_total_cents": 27000,
          "created_at": "2025-10-15T14:30:00Z"
        }
      ]
    }
  }
}
```

**Metrics Explained**:
- **total_usages**: Total times coupon was redeemed
- **total_discount_given**: Total discount amount given (in rupees)
- **total_revenue_generated**: Total order value after discount (in rupees)
- **redemption_rate**: (usages / limit) * 100 (for total_limit type)
- **avg_order_value**: Average order value with coupon (in rupees)

### 8. Get Business Coupon Stats

**Endpoint**: `GET /api/v1/coupons/stats/:businessId`

**Authentication**: Required (seller must own business)

**Response**:
```json
{
  "success": true,
  "data": {
    "stats": {
      "total_coupons": 10,
      "active_coupons": 7,
      "total_redemptions": 234,
      "total_discount_given": 11700,
      "total_revenue_generated": 105300
    }
  }
}
```

**Dashboard Display**:
- Total coupons created
- Active coupons count
- Total redemptions across all coupons
- Total discount given (cost to seller)
- Total revenue generated (order value after discount)
- **ROI**: (revenue - discount) / discount * 100

---

## QR Code Sharing

### QR Code Generation

**Automatic**: QR code URL automatically generated on coupon creation

**QR Code Data**:
```
https://menumaker.app/coupon/FEST10
```

**Use Cases**:
1. **WhatsApp Share**: Seller shares QR code on WhatsApp status
2. **Instagram Story**: Post QR code on Instagram story
3. **Physical Poster**: Print QR code on restaurant poster
4. **Digital Menu**: Display QR code on digital menu

**Customer Flow**:
1. Customer scans QR code with phone camera
2. Opens MenuMaker coupon page
3. Code auto-applied or copied to clipboard
4. Customer places order with discount

**Implementation** (Stub):
```typescript
// Generate QR code with library like qrcode
import QRCode from 'qrcode';

const qrCodeUrl = `https://menumaker.app/coupon/${couponCode}`;
const qrCodeImage = await QRCode.toDataURL(qrCodeUrl);

// Store qrCodeImage as base64 in database
coupon.qr_code_data = qrCodeImage;
```

---

## Automatic Promotions

### 9. Create Automatic Promotion

**Endpoint**: `POST /api/v1/coupons/promotions`

**Authentication**: Required (seller must own business)

**Promotion Types**:

1. **Free Delivery** (`type: "free_delivery"`):
   - Free delivery on orders above threshold
   - Example: Free delivery on orders > Rs. 500

2. **Discount** (`type: "discount"`):
   - Automatic discount on orders above threshold
   - Example: Rs. 50 off on orders > Rs. 300

3. **Free Item** (`type: "free_item"`):
   - Free dish on orders above threshold
   - Example: Free drink on orders > Rs. 400

**Request (Free Delivery)**:
```json
{
  "business_id": "business-uuid",
  "name": "Free Delivery on Rs. 500+",
  "description": "Order above Rs. 500 and get free delivery!",
  "type": "free_delivery",
  "min_order_value_cents": 50000,
  "valid_from": "2025-10-01T00:00:00Z",
  "valid_until": "2025-10-31T23:59:59Z",
  "is_public": true
}
```

**Request (Discount)**:
```json
{
  "business_id": "business-uuid",
  "name": "Rs. 50 Off on Rs. 300+",
  "description": "Spend Rs. 300 and get Rs. 50 off!",
  "type": "discount",
  "min_order_value_cents": 30000,
  "discount_type": "fixed",
  "discount_value": 5000,
  "valid_from": "2025-10-01T00:00:00Z",
  "valid_until": "2025-10-31T23:59:59Z",
  "is_public": true
}
```

**Request (Free Item)**:
```json
{
  "business_id": "business-uuid",
  "name": "Free Drink on Rs. 400+",
  "description": "Order above Rs. 400 and get a free soft drink!",
  "type": "free_item",
  "min_order_value_cents": 40000,
  "free_dish_id": "dish-uuid-cola",
  "valid_from": "2025-10-01T00:00:00Z",
  "valid_until": "2025-10-31T23:59:59Z",
  "is_public": true
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "promotion": {
      "id": "promotion-uuid",
      "business_id": "business-uuid",
      "name": "Free Delivery on Rs. 500+",
      "type": "free_delivery",
      "min_order_value_cents": 50000,
      "is_active": true,
      "is_public": true,
      "created_at": "2025-09-15T10:00:00Z"
    }
  },
  "message": "Automatic promotion created successfully"
}
```

### 10. Check Applicable Promotions

**Endpoint**: `POST /api/v1/coupons/promotions/check`

**Authentication**: Not required (public)

**Use Case**: Customer adds items to cart → Check applicable promotions

**Request**:
```json
{
  "business_id": "business-uuid",
  "order_value_cents": 55000
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "promotions": [
      {
        "id": "promotion-uuid-1",
        "name": "Free Delivery on Rs. 500+",
        "description": "Order above Rs. 500 and get free delivery!",
        "type": "free_delivery"
      },
      {
        "id": "promotion-uuid-2",
        "name": "Rs. 50 Off on Rs. 300+",
        "description": "Spend Rs. 300 and get Rs. 50 off!",
        "type": "discount",
        "discount_type": "fixed",
        "discount_value": 5000
      }
    ]
  }
}
```

**Display to Customer**:
- "🎉 Free delivery applied!"
- "🎉 Rs. 50 off applied automatically!"
- "🎁 Free Coke added to your order!"

### 11. Get Business Promotions

**Endpoint**: `GET /api/v1/coupons/promotions/business/:businessId`

**Authentication**: Required (seller must own business)

**Response**:
```json
{
  "success": true,
  "data": {
    "promotions": [
      {
        "id": "promotion-uuid-1",
        "name": "Free Delivery on Rs. 500+",
        "type": "free_delivery",
        "min_order_value_cents": 50000,
        "is_active": true,
        "total_applications": 78,
        "total_discount_given_cents": 312000,
        "created_at": "2025-09-15T10:00:00Z"
      }
    ]
  }
}
```

### 12. Update Promotion

**Endpoint**: `PUT /api/v1/coupons/promotions/:id`

**Authentication**: Required (seller must own business)

**Updatable Fields**:
- `name`, `description`
- `min_order_value_cents`
- `valid_until`
- `is_active`, `is_public`

**Request**:
```json
{
  "min_order_value_cents": 40000,
  "is_active": false
}
```

---

## Auto-Expiration

### Cron Job: Expire Coupons

**Schedule**: Daily at midnight

**Implementation**:
```typescript
import { CouponService } from './services/CouponService';
import cron from 'node-cron';

const couponService = new CouponService();

// Run daily at midnight
cron.schedule('0 0 * * *', async () => {
  const count = await couponService.expireCoupons();
  console.log(`Expired ${count} coupons`);
});
```

**Logic**:
1. Find coupons with `valid_until < NOW()` and `status = 'active'`
2. Update `status = 'expired'`
3. Log count of expired coupons

**Effect**:
- Expired coupons no longer applicable
- Still visible to seller for analytics
- Customer sees "Coupon has expired" on validation

---

## API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/coupons` | POST | Create coupon |
| `/coupons/business/:businessId` | GET | Get business coupons |
| `/coupons/public/:businessId` | GET | Get public coupons (menu) |
| `/coupons/validate` | POST | Validate coupon |
| `/coupons/:id` | PUT | Update coupon |
| `/coupons/:id` | DELETE | Archive coupon |
| `/coupons/:id/analytics` | GET | Get coupon analytics |
| `/coupons/stats/:businessId` | GET | Get coupon stats |
| `/coupons/promotions` | POST | Create automatic promotion |
| `/coupons/promotions/business/:businessId` | GET | Get business promotions |
| `/coupons/promotions/check` | POST | Check applicable promotions |
| `/coupons/promotions/:id` | PUT | Update promotion |

---

## Best Practices

### For Sellers

1. **Coupon Naming**
   - Use clear, memorable codes (e.g., "FEST10", "SAVE50")
   - Avoid ambiguous codes (e.g., "ABC123")
   - Keep codes short (4-10 characters)

2. **Discount Strategy**
   - Start with percentage discounts (easier to understand)
   - Use fixed discounts for high-value items
   - Set reasonable minimum order values

3. **Usage Limits**
   - Use per_customer limits to prevent abuse
   - Use total_limit for flash sales
   - Use per_month for recurring campaigns

4. **Promotion Timing**
   - Align with festivals/events (Diwali, Holi, etc.)
   - Weekend promotions (Friday-Sunday)
   - Off-peak promotions (2-5 PM)

5. **QR Code Sharing**
   - Share on WhatsApp status regularly
   - Post on Instagram stories
   - Print on table tents/posters
   - Include in delivery packaging

6. **Analytics Monitoring**
   - Track redemption rate (target: >20%)
   - Monitor average order value uplift
   - Analyze revenue vs. discount cost
   - Pause low-performing coupons

### For Developers

1. **Validation**
   - Always validate coupon server-side (not client-side)
   - Check all validation rules before applying
   - Return clear error messages

2. **Discount Calculation**
   - Apply discount to subtotal (before taxes/fees)
   - Never allow discount > order subtotal
   - Round discount to nearest cent

3. **Concurrent Usage**
   - Handle race conditions (multiple simultaneous uses)
   - Use database transactions for coupon application
   - Lock coupon record during validation

4. **Performance**
   - Index frequently queried fields (code, business_id, status)
   - Cache public coupons for menu display
   - Paginate coupon lists for large datasets

5. **Security**
   - Generate unique coupon codes
   - Prevent brute-force coupon guessing
   - Rate-limit validation endpoint

---

## Use Case Examples

### Example 1: Festival Sale

**Scenario**: Seller wants to offer 10% off during Diwali

**Configuration**:
```json
{
  "code": "DIWALI10",
  "name": "Diwali Sale 10% Off",
  "discount_type": "percentage",
  "discount_value": 10,
  "max_discount_cents": 15000,
  "min_order_value_cents": 25000,
  "valid_from": "2025-10-20T00:00:00Z",
  "valid_until": "2025-11-05T23:59:59Z",
  "usage_limit_type": "per_customer",
  "usage_limit_per_customer": 2,
  "is_public": true
}
```

**Result**:
- 10% off, max Rs. 150 discount
- Min order Rs. 250
- Each customer can use twice
- Valid during Diwali period
- Visible on public menu

### Example 2: First Order Discount

**Scenario**: Attract new customers with Rs. 100 off

**Configuration**:
```json
{
  "code": "FIRST100",
  "name": "First Order - Rs. 100 Off",
  "discount_type": "fixed",
  "discount_value": 10000,
  "min_order_value_cents": 30000,
  "valid_from": "2025-09-01T00:00:00Z",
  "valid_until": "2025-12-31T23:59:59Z",
  "usage_limit_type": "per_customer",
  "usage_limit_per_customer": 1,
  "is_public": true
}
```

**Result**:
- Rs. 100 off flat
- Min order Rs. 300
- One-time use per customer
- Valid for 4 months
- Promote for customer acquisition

### Example 3: Flash Sale

**Scenario**: Limited-time offer for first 50 customers

**Configuration**:
```json
{
  "code": "FLASH50",
  "name": "Flash Sale - First 50 Customers",
  "discount_type": "percentage",
  "discount_value": 20,
  "max_discount_cents": 20000,
  "min_order_value_cents": 20000,
  "valid_from": "2025-10-15T12:00:00Z",
  "valid_until": "2025-10-15T18:00:00Z",
  "usage_limit_type": "total_limit",
  "total_usage_limit": 50,
  "is_public": true
}
```

**Result**:
- 20% off, max Rs. 200 discount
- Min order Rs. 200
- First 50 customers only
- Valid for 6 hours (lunch + dinner)
- Creates urgency

### Example 4: Free Delivery Promotion

**Scenario**: Free delivery on orders above Rs. 500

**Configuration**:
```json
{
  "name": "Free Delivery on Rs. 500+",
  "type": "free_delivery",
  "min_order_value_cents": 50000,
  "valid_from": "2025-10-01T00:00:00Z",
  "valid_until": "2025-10-31T23:59:59Z",
  "is_public": true
}
```

**Result**:
- Automatic application
- No coupon code needed
- Shown on menu: "Free delivery on orders > Rs. 500"
- Increases average order value

---

## Coupon Lifecycle

**1. Creation**
- Seller creates coupon with rules
- QR code generated automatically
- Status set to `active`

**2. Publication**
- If `is_public = true`, shown on menu
- Customer sees coupon details
- Seller shares QR code on social media

**3. Usage**
- Customer enters code at checkout
- System validates coupon
- Discount calculated and applied
- Usage recorded in `coupon_usages`

**4. Analytics**
- Seller monitors redemption rate
- Tracks total discount given
- Analyzes order value uplift
- Adjusts coupon strategy

**5. Expiration**
- Coupon expires on `valid_until` date
- Cron job auto-expires at midnight
- Status changed to `expired`
- No longer applicable

**6. Archival**
- Seller archives unsuccessful coupons
- Status changed to `archived`
- Usage history retained for records

---

## Success Metrics

**Target Impact**:
- 📈 **Order Volume**: 30% increase in orders with coupons
- 💰 **Average Order Value**: 20% higher with coupons
- ♻️ **Repeat Orders**: 40% customers reuse coupons
- 📊 **Redemption Rate**: >20% for successful campaigns
- 🎯 **ROI**: (Revenue - Discount) / Discount > 5x

---

## Troubleshooting

**"Minimum order value required"**
- Solution: Increase cart value to meet minimum
- Or: Reduce `min_order_value_cents` in coupon settings

**"Coupon has expired"**
- Solution: Check `valid_until` date
- Or: Extend expiry date if needed

**"You have already used this coupon"**
- Solution: Customer reached per_customer limit
- Or: Increase `usage_limit_per_customer`

**"Coupon usage limit reached"**
- Solution: Total limit reached (for total_limit type)
- Or: Increase `total_usage_limit` or make unlimited

**"Coupon not applicable to items in cart"**
- Solution: Add applicable dishes to cart
- Or: Change coupon to `applicable_to: "all_dishes"`

---

**Status**: ✅ Phase 3 - US3.9 Complete
**Features**: Coupons, Automatic Promotions, QR Codes, Analytics
**Discount Types**: Fixed amount, Percentage
**Usage Limits**: Per customer, Per month, Total limit, Unlimited
**Promotions**: Free delivery, Automatic discounts, Free items
**Analytics**: Redemption rate, Revenue uplift, Average order value
**Auto-Expiration**: Daily cron job expires outdated coupons
