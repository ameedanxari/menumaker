# MenuMaker Delivery Partner Integration Guide

**Phase 3: Delivery Partner Integration (US3.8)**
**Version**: 1.0.0
**Last Updated**: 2025-11-15

---

## Overview

MenuMaker integrates with popular delivery partners (Swiggy, Zomato, Dunzo) to enable sellers without their own delivery fleet to offer delivery services to customers.

### Supported Delivery Partners

✅ **Swiggy**: Full integration with delivery API
✅ **Zomato**: Integration support (requires API credentials)
✅ **Dunzo**: Integration support for quick deliveries

### Key Features

✅ **Automatic Delivery Assignment**: Orders automatically assigned to delivery partner
✅ **Real-time Tracking**: Live delivery status updates (picked up, en route, delivered)
✅ **Flexible Cost Handling**: Pass delivery fee to customer or absorb as seller
✅ **Separate Delivery Ratings**: Customers rate delivery separately from food quality
✅ **Delivery Analytics**: Track delivery performance and success rates
✅ **Multi-provider Support**: Switch between delivery partners as needed

---

## Setup Flow

### 1. Connect Delivery Provider

**Endpoint**: `POST /api/v1/delivery/connect`

**Authentication**: Required (seller must own business)

**Request**:
```json
{
  "business_id": "business-uuid",
  "provider": "swiggy",
  "api_key": "SWIGGY_API_KEY",
  "api_secret": "SWIGGY_API_SECRET",
  "partner_account_id": "swiggy-merchant-id",
  "cost_handling": "customer",
  "fixed_delivery_fee_cents": 4000,
  "auto_assign_delivery": true,
  "pickup_instructions": "Use the back entrance for pickup"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "integration": {
      "id": "integration-uuid",
      "business_id": "business-uuid",
      "provider": "swiggy",
      "is_active": true,
      "cost_handling": "customer",
      "fixed_delivery_fee_cents": 4000,
      "auto_assign_delivery": true,
      "pickup_instructions": "Use the back entrance for pickup",
      "created_at": "2025-11-15T10:00:00Z"
    }
  },
  "message": "swiggy delivery integration connected successfully"
}
```

**Configuration Options**:

- **provider**: `swiggy` | `zomato` | `dunzo`
- **cost_handling**:
  - `customer`: Delivery fee charged to customer (default)
  - `seller`: Seller absorbs delivery cost
- **fixed_delivery_fee_cents**: Fixed fee in cents (e.g., 4000 = Rs. 40)
- **auto_assign_delivery**: Automatically create delivery on order acceptance (default: true)
- **pickup_instructions**: Special instructions for delivery partner at pickup

---

## Delivery Workflow

### Automatic Delivery Assignment

When `auto_assign_delivery = true`, delivery is automatically created when seller accepts an order.

**Flow**:
1. Customer places delivery order
2. Seller accepts order
3. MenuMaker automatically creates delivery request with partner
4. Delivery partner assigns delivery person
5. Customer receives tracking link and estimated delivery time

### Manual Delivery Creation

**Endpoint**: `POST /api/v1/delivery/create/:orderId`

**Use Case**: Create delivery manually or retry failed automatic assignment

**Response**:
```json
{
  "success": true,
  "data": {
    "tracking": {
      "id": "tracking-uuid",
      "order_id": "order-uuid",
      "provider": "swiggy",
      "status": "assigned",
      "delivery_partner_id": "SWGY-1731672000123",
      "estimated_pickup_at": "2025-11-15T14:15:00Z",
      "estimated_delivery_at": "2025-11-15T14:45:00Z",
      "delivery_fee_cents": 4000,
      "tracking_url": "https://swiggy.com/track/SWGY-1731672000123",
      "created_at": "2025-11-15T14:00:00Z"
    }
  },
  "message": "Delivery created successfully"
}
```

---

## Delivery Tracking

### 3. Get Delivery Status

**Endpoint**: `GET /api/v1/delivery/track/:orderId`

**Authentication**: Required (customer or seller)

**Response**:
```json
{
  "success": true,
  "data": {
    "tracking": {
      "id": "tracking-uuid",
      "order_id": "order-uuid",
      "provider": "swiggy",
      "status": "en_route",
      "delivery_partner_id": "SWGY-1731672000123",
      "delivery_person_name": "Rajesh Kumar",
      "delivery_person_phone": "9876543210",
      "estimated_pickup_at": "2025-11-15T14:15:00Z",
      "picked_up_at": "2025-11-15T14:12:00Z",
      "estimated_delivery_at": "2025-11-15T14:45:00Z",
      "delivery_fee_cents": 4000,
      "tracking_url": "https://swiggy.com/track/SWGY-1731672000123",
      "delivery_instructions": "Ring doorbell twice",
      "delivery_otp": "1234",
      "status_history": [
        {
          "status": "assigned",
          "timestamp": "2025-11-15T14:00:00Z",
          "message": "Delivery assigned successfully"
        },
        {
          "status": "picked_up",
          "timestamp": "2025-11-15T14:12:00Z",
          "message": "Order picked up"
        },
        {
          "status": "en_route",
          "timestamp": "2025-11-15T14:15:00Z",
          "message": "Delivery person is on the way"
        }
      ],
      "created_at": "2025-11-15T14:00:00Z",
      "updated_at": "2025-11-15T14:15:00Z"
    }
  }
}
```

### Delivery Status Flow

**Status Progression**:
1. **pending**: Delivery request initiated, awaiting assignment
2. **assigned**: Delivery partner assigned delivery person
3. **picked_up**: Delivery person picked up order from restaurant
4. **en_route**: Delivery person is on the way to customer
5. **delivered**: Order successfully delivered to customer
6. **cancelled**: Delivery cancelled (by seller or customer)
7. **failed**: Delivery failed (technical error or partner unavailable)

### Status History

Every status change is logged in `status_history` array with:
- **status**: New status
- **timestamp**: When status changed
- **message**: Optional message describing the change

---

## Delivery Cancellation

### 4. Cancel Delivery

**Endpoint**: `POST /api/v1/delivery/cancel/:trackingId`

**Authentication**: Required (seller must own business)

**Request**:
```json
{
  "reason": "Customer cancelled order"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "tracking": {
      "id": "tracking-uuid",
      "status": "cancelled",
      "cancellation_reason": "Customer cancelled order",
      "updated_at": "2025-11-15T14:20:00Z"
    }
  },
  "message": "Delivery cancelled successfully"
}
```

**Cancellation Rules**:
- Can cancel before delivery is picked up
- Cannot cancel after delivery person is en route (contact delivery partner)
- Cancellation fees may apply (per delivery partner policy)

---

## Delivery Ratings

### 5. Submit Delivery Rating

**Endpoint**: `POST /api/v1/delivery/rating/:trackingId`

**Authentication**: Required (customer must have ordered)

**Request**:
```json
{
  "rating": 5,
  "feedback": "Very fast delivery, arrived hot!",
  "timeliness_rating": 5,
  "courtesy_rating": 5,
  "packaging_rating": 4,
  "issues": []
}
```

**Rating Categories**:
- **rating** (required): Overall delivery rating (1-5)
- **timeliness_rating**: On-time delivery (1-5)
- **courtesy_rating**: Delivery person behavior (1-5)
- **packaging_rating**: Food packaging quality (1-5)
- **issues**: Array of issues (e.g., `["late_delivery", "damaged_packaging", "rude_behavior"]`)

**Response**:
```json
{
  "success": true,
  "data": {
    "rating": {
      "id": "rating-uuid",
      "rating": 5,
      "feedback": "Very fast delivery, arrived hot!",
      "timeliness_rating": 5,
      "courtesy_rating": 5,
      "packaging_rating": 4,
      "issues": [],
      "provider": "swiggy",
      "created_at": "2025-11-15T15:00:00Z"
    }
  },
  "message": "Delivery rating submitted successfully"
}
```

**Rating Rules**:
- One rating per delivery (tracked by tracking ID)
- Only customer who placed order can rate
- Can only rate completed deliveries (status = `delivered`)
- Rating is separate from food/seller rating

---

## Delivery Analytics

### 6. Get Delivery Statistics

**Endpoint**: `GET /api/v1/delivery/stats/:businessId`

**Authentication**: Required (seller must own business)

**Response**:
```json
{
  "success": true,
  "data": {
    "stats": {
      "total_deliveries": 150,
      "successful_deliveries": 145,
      "cancelled_deliveries": 3,
      "failed_deliveries": 2,
      "average_rating": 4.7,
      "success_rate": 96.7
    }
  }
}
```

**Metrics**:
- **total_deliveries**: Total delivery attempts
- **successful_deliveries**: Successfully completed deliveries
- **cancelled_deliveries**: Deliveries cancelled by seller/customer
- **failed_deliveries**: Deliveries that failed (technical issues)
- **average_rating**: Average delivery rating (from customer ratings)
- **success_rate**: (successful_deliveries / total_deliveries) * 100

---

## Integration Management

### 7. Get Integration Settings

**Endpoint**: `GET /api/v1/delivery/integration/:businessId`

**Authentication**: Required (seller must own business)

**Response**:
```json
{
  "success": true,
  "data": {
    "integration": {
      "id": "integration-uuid",
      "provider": "swiggy",
      "is_active": true,
      "cost_handling": "customer",
      "fixed_delivery_fee_cents": 4000,
      "auto_assign_delivery": true,
      "pickup_instructions": "Use the back entrance for pickup",
      "last_delivery_at": "2025-11-15T14:00:00Z",
      "total_deliveries": 150,
      "failure_count": 2,
      "last_error": null,
      "created_at": "2025-11-01T00:00:00Z"
    }
  }
}
```

**Note**: API credentials (api_key, api_secret) are not returned for security.

### 8. Disconnect Integration

**Endpoint**: `POST /api/v1/delivery/disconnect`

**Authentication**: Required (seller must own business)

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
  "message": "Delivery integration disconnected successfully"
}
```

**Effect**:
- Sets `is_active = false`
- Stops automatic delivery assignment
- Retains delivery history for audit
- Orders revert to self-delivery or pickup only

---

## Cost Handling

### Customer Pays (Default)

**Configuration**: `cost_handling: "customer"`

**Flow**:
1. Delivery fee added to order total
2. Customer sees delivery fee during checkout
3. Customer pays total (order + delivery fee)
4. Delivery fee passed to delivery partner

**Example**:
- Order subtotal: Rs. 300
- Delivery fee: Rs. 40
- **Total charged to customer**: Rs. 340

### Seller Absorbs

**Configuration**: `cost_handling: "seller"`

**Flow**:
1. Delivery fee not shown to customer
2. Customer pays order total only
3. Seller pays delivery fee from revenue

**Example**:
- Order subtotal: Rs. 300
- Delivery fee: Rs. 40 (hidden from customer)
- **Total charged to customer**: Rs. 300
- **Seller net revenue**: Rs. 260 (300 - 40)

**Use Case**: Promotional "free delivery" campaigns

---

## Provider-Specific Details

### Swiggy

**Features**:
- Real-time tracking with live location
- Estimated pickup/delivery times
- Delivery person details (name, phone)
- OTP-based delivery verification

**Delivery Estimates**:
- Pickup: 15 minutes from order acceptance
- Delivery: 30-45 minutes total

**Delivery Fee**: Rs. 30-50 (varies by distance)

### Zomato

**Features**:
- Live tracking
- Delivery person details
- Contactless delivery option

**Delivery Estimates**:
- Pickup: 20 minutes
- Delivery: 40-50 minutes total

**Delivery Fee**: Rs. 40-60 (varies by distance)

### Dunzo

**Features**:
- Fast deliveries (< 30 min)
- Real-time tracking
- Same-day delivery support

**Delivery Estimates**:
- Pickup: 10 minutes
- Delivery: 25-35 minutes total

**Delivery Fee**: Rs. 25-45 (varies by distance)

---

## API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/delivery/connect` | POST | Connect delivery provider |
| `/delivery/disconnect` | POST | Disconnect delivery provider |
| `/delivery/integration/:businessId` | GET | Get integration settings |
| `/delivery/create/:orderId` | POST | Create delivery for order |
| `/delivery/track/:orderId` | GET | Get delivery tracking |
| `/delivery/cancel/:trackingId` | POST | Cancel delivery |
| `/delivery/rating/:trackingId` | POST | Submit delivery rating |
| `/delivery/stats/:businessId` | GET | Get delivery statistics |

---

## Best Practices

### For Sellers

1. **Test Integration**
   - Place test order after connecting delivery partner
   - Verify delivery is assigned within 5 minutes
   - Check tracking link works correctly

2. **Monitor Performance**
   - Track delivery success rate (target: >95%)
   - Review delivery ratings weekly
   - Address negative delivery feedback

3. **Optimize Pickup**
   - Provide clear pickup instructions
   - Have order ready before delivery person arrives
   - Reduce delivery person wait time

4. **Handle Issues**
   - Respond to delivery complaints quickly
   - Cancel delivery if food not ready (avoid failed deliveries)
   - Contact delivery partner support for persistent issues

### For Developers

1. **Webhook Integration**
   - Configure webhook URL for real-time status updates
   - Handle webhook retries (delivery partner may retry)
   - Validate webhook signatures for security

2. **Error Handling**
   - Handle delivery partner API downtime gracefully
   - Retry failed delivery creation (max 3 attempts)
   - Notify seller if delivery assignment fails

3. **Monitoring**
   - Set up alerts for high failure rates (>5%)
   - Monitor delivery assignment latency (target: <30 sec)
   - Track delivery partner API response times

---

## Error Handling

### Common Errors

**1. Partner Unavailable**
- **Cause**: Delivery partner API down or no delivery persons available
- **Solution**: Notify customer, offer pickup or self-delivery
- **Auto-Retry**: No (manual intervention required)

**2. Authentication Errors**
- **Cause**: Invalid API credentials
- **Solution**: Re-connect integration with correct credentials
- **Auto-Retry**: No

**3. Address Issues**
- **Cause**: Delivery address incomplete or outside service area
- **Solution**: Customer must update delivery address
- **Auto-Retry**: No

**4. Network Errors**
- **Cause**: Temporary network issue
- **Solution**: Automatic retry (up to 3 attempts)
- **Auto-Retry**: Yes

### Error Notifications

Sellers are notified when:
- Delivery assignment fails
- Delivery partner unavailable
- Delivery cancelled by delivery person
- Delivery marked as failed

**Notification Channels**:
- In-app dashboard alert
- Email notification
- WhatsApp notification (if enabled)

---

## Delivery OTP Verification

**Purpose**: Ensure order delivered to correct customer

**Flow**:
1. Delivery created → MenuMaker generates 4-6 digit OTP
2. OTP sent to customer via SMS/WhatsApp
3. Delivery person asks for OTP before handover
4. Customer provides OTP → Delivery marked as delivered

**Security**:
- OTP valid for single delivery
- OTP expires after delivery or 24 hours
- Failed OTP attempts logged

---

## Success Metrics

**Target Impact**:
- 🚗 **Coverage**: 90%+ sellers with delivery enabled
- ⚡ **Assignment Speed**: <30 seconds for 95% of deliveries
- ✅ **Success Rate**: >95% successful deliveries
- ⭐ **Rating**: Average delivery rating >4.5/5
- 📈 **Order Uplift**: 30% increase in orders with delivery

---

## Support

**For Integration Issues**:
- Connect: `POST /api/v1/delivery/connect`
- Check status: `GET /api/v1/delivery/integration/:businessId`
- View stats: `GET /api/v1/delivery/stats/:businessId`

**For Delivery Failures**:
- Manual create: `POST /api/v1/delivery/create/:orderId`
- Check tracking: `GET /api/v1/delivery/track/:orderId`
- Cancel if needed: `POST /api/v1/delivery/cancel/:trackingId`

**For Delivery Partner Support**:
- **Swiggy**: Call 1800-208-7469 or contact merchant support
- **Zomato**: Email merchant-support@zomato.com
- **Dunzo**: Call merchant support at 080-68179999

---

**Status**: ✅ Phase 3 - US3.8 Complete
**Supported Partners**: Swiggy, Zomato, Dunzo
**Auto-Assignment**: Automatic delivery on order acceptance
**Tracking**: Real-time status updates with live tracking
**Ratings**: Separate delivery ratings (food vs. delivery)
**Cost Handling**: Customer pays or seller absorbs
**Analytics**: Delivery performance metrics and success rate
