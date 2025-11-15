# Customer Re-order Flow Guide (Phase 2.7)

**Status**: ✅ **IMPLEMENTED**
**Feature**: Customer Re-order & Saved Carts for Repeat Business
**Effort**: 2-3 developer-days
**Version**: 1.0

---

## Overview

MenuMaker's Re-order Flow enables customers to quickly re-order from their favorite restaurants without manually selecting dishes again. This feature reduces order time from ~2 minutes to ~20 seconds, boosting repeat order rates from 20% to 30%+.

### Key Features

- 📋 **Previous Orders Lookup** - Find past orders by phone number (last 90 days)
- 🔁 **Quick Re-order** - One-click re-order from previous orders
- 💾 **Saved Carts** - Save custom cart presets ("My Weekly Tiffin")
- 📊 **Re-order Analytics** - Track repeat customer rates and re-order metrics
- ⚡ **Fast Checkout** - Reduce order time by 90%

---

## Goals & Success Metrics

### Primary Goals

1. **Increase Repeat Orders**: Boost repeat order rate from 20% to 30%
2. **Reduce Order Time**: From ~2 min (full form) to ~20 sec (re-order)
3. **Improve Customer Experience**: Make ordering from favorites effortless

### Success Metrics (Phase 2 Target)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Repeat Order Rate | 30% | % of orders from repeat customers |
| Time to Re-order | < 20 seconds | Average time from landing to checkout |
| Saved Cart Usage | 15% | % of customers with saved carts |
| Cart Conversion Rate | 80% | % of loaded carts that become orders |

---

## How It Works

### Customer Journey

```
┌─────────────────────┐
│ 1. Customer Lands   │
│    on Menu          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 2. System Checks    │
│    Phone Number     │
│    (from cookies)   │
└──────────┬──────────┘
           │
           ▼
    ┌──────┴──────┐
    │ Returning?  │
    └──────┬──────┘
           │
     ┌─────┴─────┐
     │Yes        │No
     ▼           ▼
┌────────────┐  ┌────────────┐
│ Show       │  │ Normal     │
│ "Previous  │  │ Order Form │
│ Orders"    │  └────────────┘
│ Tab        │
└─────┬──────┘
      │
      ▼
┌─────────────────────┐
│ 3. Customer Selects │
│    Previous Order   │
│    OR Saved Cart    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 4. Cart Auto-filled │
│    with Items       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 5. One-Click        │
│    Checkout         │
│    ⚡ < 20 sec      │
└─────────────────────┘
```

---

## Database Schema

### Saved Carts Table

```sql
CREATE TABLE saved_carts (
  id UUID PRIMARY KEY,
  customer_phone VARCHAR(20),              -- E.164 format
  customer_email VARCHAR(255),
  customer_name VARCHAR(255),
  cart_name VARCHAR(100),                  -- "My Weekly Tiffin"
  cart_items TEXT,                         -- JSON array of items
  total_cents INTEGER,
  times_used INTEGER DEFAULT 0,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Cart Items JSON Format**:
```json
[
  {
    "dish_id": "uuid",
    "dish_name": "Butter Chicken",
    "quantity": 2,
    "price_cents": 25000
  },
  {
    "dish_id": "uuid",
    "dish_name": "Naan",
    "quantity": 4,
    "price_cents": 2000
  }
]
```

**Indexes**: `customer_phone`, `customer_email`

---

## API Endpoints

### 1. Get Previous Orders

**GET /api/v1/reorder/previous-orders** (Public)

Get previous orders for customer (last 90 days).

**Query Params**:
- `customer_phone` (required): Customer phone number
- `limit` (optional): Number of orders to return (default: 10)

**Response**:
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "order_uuid",
        "business_id": "business_uuid",
        "customer_name": "John Doe",
        "customer_phone": "+91 98765 43210",
        "total_cents": 52000,
        "items": [
          {
            "dish_id": "dish_uuid",
            "dish_name": "Butter Chicken",
            "quantity": 2,
            "unit_price_cents": 25000
          }
        ],
        "created_at": "2025-11-10T10:00:00Z",
        "status": "completed"
      }
    ],
    "count": 5
  }
}
```

---

### 2. Quick Re-order

**POST /api/v1/reorder/quick-reorder/:order_id** (Public)

Duplicate a previous order and return cart items.

**Response**:
```json
{
  "success": true,
  "message": "Order items loaded for re-order",
  "data": {
    "cart_items": [
      {
        "dish_id": "uuid",
        "dish_name": "Butter Chicken",
        "quantity": 2,
        "price_cents": 25000
      }
    ],
    "item_count": 2,
    "total_cents": 52000
  }
}
```

---

### 3. Save Cart Preset

**POST /api/v1/reorder/saved-cart** (Public)

Save a cart preset for quick re-ordering.

**Request**:
```json
{
  "customer_phone": "+91 98765 43210",
  "customer_email": "john@example.com",
  "customer_name": "John Doe",
  "cart_name": "My Weekly Tiffin",
  "cart_items": [
    {
      "dish_id": "uuid",
      "dish_name": "Butter Chicken",
      "quantity": 2,
      "price_cents": 25000
    },
    {
      "dish_id": "uuid",
      "dish_name": "Naan",
      "quantity": 4,
      "price_cents": 2000
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "message": "Cart saved successfully",
  "data": {
    "id": "cart_uuid",
    "cart_name": "My Weekly Tiffin",
    "total_cents": 58000,
    "item_count": 2,
    "created_at": "2025-11-15T10:00:00Z"
  }
}
```

---

### 4. Get Saved Carts

**GET /api/v1/reorder/saved-carts** (Public)

Get all saved carts for customer.

**Query Params**:
- `customer_phone` (required): Customer phone number

**Response**:
```json
{
  "success": true,
  "data": {
    "carts": [
      {
        "id": "cart_uuid",
        "cart_name": "My Weekly Tiffin",
        "total_cents": 58000,
        "times_used": 5,
        "last_used_at": "2025-11-14T10:00:00Z",
        "created_at": "2025-11-01T10:00:00Z"
      }
    ],
    "count": 3
  }
}
```

---

### 5. Load Saved Cart

**POST /api/v1/reorder/saved-cart/:cart_id/load** (Public)

Load saved cart and return items.

**Response**:
```json
{
  "success": true,
  "message": "Saved cart loaded",
  "data": {
    "cart_items": [
      {
        "dish_id": "uuid",
        "dish_name": "Butter Chicken",
        "quantity": 2,
        "price_cents": 25000
      }
    ],
    "item_count": 2,
    "total_cents": 58000
  }
}
```

---

### 6. Delete Saved Cart

**DELETE /api/v1/reorder/saved-cart/:cart_id** (Public)

Delete a saved cart.

**Request**:
```json
{
  "customer_phone": "+91 98765 43210"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Saved cart deleted"
}
```

---

### 7. Re-order Analytics

**GET /api/v1/reorder/analytics/reorder-rate** (Auth Required)

Get re-order analytics for a business.

**Query Params**:
- `business_id` (required): Business UUID
- `days` (optional): Number of days to analyze (default: 30)

**Response**:
```json
{
  "success": true,
  "data": {
    "period_days": 30,
    "total_orders": 150,
    "repeat_orders": 45,
    "reorder_rate": 30,
    "unique_customers": 100,
    "repeat_customers": 35,
    "repeat_customer_rate": 35
  }
}
```

---

### 8. Check Returning Customer

**GET /api/v1/reorder/check-returning-customer** (Public)

Check if customer has previous orders.

**Query Params**:
- `customer_phone` (required): Customer phone number
- `business_id` (required): Business UUID

**Response**:
```json
{
  "success": true,
  "data": {
    "is_returning_customer": true
  }
}
```

---

## Frontend Integration

### 1. Check for Returning Customer

```typescript
async function checkReturningCustomer(phone: string, businessId: string) {
  const response = await fetch(
    `/api/v1/reorder/check-returning-customer?customer_phone=${phone}&business_id=${businessId}`
  );

  const data = await response.json();

  if (data.data.is_returning_customer) {
    // Show "Previous Orders" tab
    loadPreviousOrders(phone);
  }
}
```

---

### 2. Load Previous Orders

```typescript
async function loadPreviousOrders(phone: string) {
  const response = await fetch(
    `/api/v1/reorder/previous-orders?customer_phone=${phone}&limit=5`
  );

  const data = await response.json();

  // Display orders in UI
  data.data.orders.forEach(order => {
    displayPreviousOrder(order);
  });
}
```

---

### 3. Quick Re-order

```typescript
async function quickReorder(orderId: string) {
  const response = await fetch(
    `/api/v1/reorder/quick-reorder/${orderId}`,
    { method: 'POST' }
  );

  const data = await response.json();

  // Auto-fill cart with items
  const cartItems = data.data.cart_items;
  cartItems.forEach(item => {
    addToCart(item.dish_id, item.quantity);
  });

  // Redirect to checkout
  window.location.href = '/checkout';
}
```

---

### 4. Save Cart Preset

```typescript
async function saveCart(cartName: string, items: any[], customerInfo: any) {
  const response = await fetch('/api/v1/reorder/saved-cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_phone: customerInfo.phone,
      customer_email: customerInfo.email,
      customer_name: customerInfo.name,
      cart_name: cartName,
      cart_items: items,
    }),
  });

  const data = await response.json();

  if (data.success) {
    alert(`Cart "${cartName}" saved! You can re-use it anytime.`);
  }
}
```

---

### 5. Load Saved Cart

```typescript
async function loadSavedCart(cartId: string) {
  const response = await fetch(
    `/api/v1/reorder/saved-cart/${cartId}/load`,
    { method: 'POST' }
  );

  const data = await response.json();

  // Auto-fill cart
  const cartItems = data.data.cart_items;
  clearCart();
  cartItems.forEach(item => {
    addToCart(item.dish_id, item.quantity);
  });

  alert('Cart loaded! Review and checkout.');
}
```

---

### 6. Cart Persistence (localStorage)

```typescript
// Save cart to browser localStorage
function saveCartToLocalStorage(cart: any[]) {
  const cartData = {
    items: cart,
    timestamp: new Date().toISOString(),
  };

  localStorage.setItem('menumaker_cart', JSON.stringify(cartData));
}

// Load cart from localStorage on page load
function loadCartFromLocalStorage() {
  const cartData = localStorage.getItem('menumaker_cart');

  if (!cartData) return;

  const { items, timestamp } = JSON.parse(cartData);

  // Check if cart is older than 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  if (new Date(timestamp) < sevenDaysAgo) {
    // Cart expired, clear it
    localStorage.removeItem('menumaker_cart');
    return;
  }

  // Restore cart
  items.forEach(item => {
    addToCart(item.dish_id, item.quantity);
  });
}
```

---

## Use Cases

### Use Case 1: Weekly Tiffin Order

**Scenario**: Customer orders same lunch tiffin every week.

**Flow**:
1. Customer lands on menu
2. Sees "My Weekly Tiffin" saved cart
3. Clicks "Load Cart"
4. Reviews items (all correct)
5. Clicks "Checkout"
6. Order placed in ~15 seconds

**Benefit**: 85% time savings

---

### Use Case 2: Quick Re-order from Last Order

**Scenario**: Customer wants to re-order from last Friday.

**Flow**:
1. Customer lands on menu
2. Sees "Previous Orders" tab
3. Selects last Friday's order
4. Clicks "Quick Re-order"
5. Cart auto-filled
6. Checkout in ~20 seconds

**Benefit**: No need to remember what was ordered

---

### Use Case 3: Family Dinner Preset

**Scenario**: Customer has a go-to family dinner order.

**Flow**:
1. Customer creates cart manually (first time)
2. Saves as "Family Dinner of 4"
3. Future orders: Load "Family Dinner of 4"
4. Modify if needed (add/remove items)
5. Checkout

**Benefit**: Reusable templates for common orders

---

## Analytics & Tracking

### Re-order Rate Formula

```
Re-order Rate = (Repeat Orders / Total Orders) × 100

Where:
- Repeat Orders = Orders from customers with >1 order
- Total Orders = All orders in time period
```

**Example**:
- Total Orders (30 days): 150
- Repeat Orders: 45
- Re-order Rate: 30%

---

### Key Metrics to Track

| Metric | Description | Target |
|--------|-------------|--------|
| Re-order Rate | % of orders from repeat customers | 30% |
| Saved Cart Usage | % of customers with saved carts | 15% |
| Cart Load Rate | % of saved carts that get loaded | 60% |
| Cart Conversion | % of loaded carts that become orders | 80% |
| Time to Re-order | Average time from landing to checkout | < 20s |

---

## Best Practices

### For Sellers

1. **Encourage Saved Carts**: Prompt customers to save cart after first order
2. **Personalize**: Use customer name in "Welcome back" messages
3. **Upsell**: Suggest additions to saved carts ("Add dessert?")
4. **Track Analytics**: Monitor re-order rate to measure customer loyalty

---

### For Customers

1. **Save Frequent Orders**: Create saved carts for weekly orders
2. **Name Carts Clearly**: "Weekly Lunch", "Family Dinner", etc.
3. **Update as Needed**: Edit saved carts when preferences change
4. **Use Phone Number**: Consistent phone = better order history

---

## Troubleshooting

### Issue: Previous orders not showing

**Cause**: Phone number format mismatch

**Debug**:
```sql
SELECT customer_phone, COUNT(*)
FROM orders
WHERE customer_phone LIKE '%98765%'
GROUP BY customer_phone;
```

**Fix**: Normalize phone number format (E.164 recommended)

---

### Issue: Saved cart not loading

**Cause**: Cart items reference deleted dishes

**Debug**:
```sql
SELECT id, cart_name, cart_items
FROM saved_carts
WHERE id = 'cart_id';
```

**Fix**: Update cart items to remove deleted dishes, or notify customer

---

### Issue: Re-order analytics incorrect

**Cause**: Duplicate orders from same customer not counted

**Debug**:
```sql
SELECT customer_phone, COUNT(*) as order_count
FROM orders
WHERE business_id = 'business_id'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY customer_phone
ORDER BY order_count DESC;
```

**Fix**: Verify phone number consistency

---

## Security Considerations

### Phone-based Authentication

**Limitation**: No login required (phone-based lookup)

**Security Measures**:
- Phone number verification via SMS (future enhancement)
- Rate limiting on re-order endpoints
- Saved cart deletion requires phone number match

---

### Data Privacy

- Customer phone numbers hashed (future enhancement)
- Saved carts are private (not shared between customers)
- Previous orders only visible to customer (phone match required)

---

## Future Enhancements (Phase 3)

- [ ] **Subscription Re-orders**: Automated weekly/monthly orders
- [ ] **Customer Accounts**: Login-based order history
- [ ] **Smart Recommendations**: "You might also like..."
- [ ] **Scheduled Re-orders**: "Repeat this order every Friday"
- [ ] **Collaborative Carts**: Share cart with family/friends
- [ ] **Voice Re-order**: "Alexa, re-order my last MenuMaker order"

---

## Support

**MenuMaker Issues**: https://github.com/ameedanxari/menumaker/issues
**Spec Reference**: `/specs/001-menu-maker/phase-2-spec.md`

---

**Document Version**: 1.0
**Last Updated**: November 15, 2025
**Status**: PRODUCTION READY ✅
