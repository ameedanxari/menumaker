# MenuMaker POS System Integration Guide

**Phase 3: POS System Integration & Order Sync (US3.7)**
**Version**: 1.0.0
**Last Updated**: 2025-11-15

---

## Overview

MenuMaker integrates with popular POS systems to automatically sync orders, eliminating manual data entry and maintaining a single source of truth.

### Supported POS Systems

✅ **Square POS**: Full integration with OAuth 2.0
✅ **Dine POS**: Integration support (requires API credentials)
✅ **Zoho Inventory**: Integration support (requires API credentials)

### Key Features

✅ **Automatic Order Sync**: New orders pushed to POS in real-time (< 10 seconds)
✅ **OAuth Integration**: Secure authentication with OAuth 2.0
✅ **Retry Logic**: Automatic retries every 5 min for 1 hour on failure
✅ **Sync History**: Complete audit trail of all sync attempts
✅ **Customer Data Sync**: Optional customer name/phone sync
✅ **Item Mapping**: Map MenuMaker dishes to POS items
✅ **Error Handling**: Graceful failure with seller notifications

---

## Setup Flow

### 1. Connect POS System

**Endpoint**: `POST /api/v1/pos/connect`

**Authentication**: Required (seller must own business)

**Request**:
```json
{
  "business_id": "business-uuid",
  "provider": "square",
  "access_token": "ACCESS_TOKEN_FROM_OAUTH",
  "refresh_token": "REFRESH_TOKEN_FROM_OAUTH",
  "token_expires_at": "2025-12-31T23:59:59Z",
  "location_id": "square-location-id",
  "merchant_id": "square-merchant-id"
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
      "provider": "square",
      "is_active": true,
      "location_id": "square-location-id",
      "auto_sync_orders": true,
      "sync_customer_info": true,
      "created_at": "2025-11-15T10:00:00Z"
    }
  },
  "message": "square POS integration connected successfully"
}
```

**OAuth Flow**:
1. Seller clicks "Connect Square POS"
2. Redirect to Square OAuth authorization URL
3. Seller authorizes MenuMaker
4. Square redirects back with authorization code
5. Exchange code for access token
6. Call `/pos/connect` with tokens

---

## Order Syncing

### Automatic Sync

When `auto_sync_orders = true`, new orders are automatically synced to POS upon creation.

**Sync Details**:
- Customer name
- Customer phone (if `sync_customer_info = true`)
- Order items with quantities
- Unit prices and totals
- Special instructions (as notes)
- MenuMaker order ID (as reference)

**Square Order Example**:
```json
{
  "idempotency_key": "menumaker-order-uuid",
  "order": {
    "location_id": "square-location-id",
    "line_items": [
      {
        "name": "Paneer Butter Masala",
        "quantity": "2",
        "base_price_money": {
          "amount": 30000,
          "currency": "INR"
        },
        "note": "Extra spicy"
      }
    ],
    "reference_id": "menumaker-order-uuid",
    "metadata": {
      "source": "MenuMaker",
      "menumaker_order_id": "order-uuid"
    }
  }
}
```

### 2. Manual Sync

**Endpoint**: `POST /api/v1/pos/sync/:orderId`

**Authentication**: Required (seller must own order)

**Use Case**: Retry failed sync or sync historical order

**Response**:
```json
{
  "success": true,
  "data": {
    "syncLog": {
      "id": "log-uuid",
      "order_id": "order-uuid",
      "status": "pending",
      "provider": "square",
      "retry_count": 0,
      "created_at": "2025-11-15T14:30:00Z"
    }
  },
  "message": "Order sync initiated"
}
```

---

## Retry Logic

### Automatic Retries

If POS API fails, MenuMaker automatically retries:
- **Interval**: Every 5 minutes
- **Duration**: Up to 1 hour (12 retries)
- **Notification**: Seller notified after 3 failed attempts

**Retry States**:
1. **pending**: Initial state, sync not yet attempted
2. **syncing**: Sync in progress
3. **retry**: Failed, will retry (if retry_count < max_retries)
4. **success**: Successfully synced
5. **failed**: Max retries reached, permanently failed

**Next Retry Calculation**:
```typescript
next_retry_at = current_time + 5 minutes
```

**Cron Job** (runs every 5 minutes):
```typescript
// Process pending retries
const count = await posSyncService.processPendingRetries();
console.log(`Processed ${count} pending retries`);
```

---

## Sync History

### 3. Get Sync History

**Endpoint**: `GET /api/v1/pos/history/:businessId`

**Authentication**: Required (seller must own business)

**Query Parameters**:
- `limit` (optional): Number of logs (default: 50)
- `offset` (optional): Pagination offset (default: 0)
- `status` (optional): Filter by status (`pending`, `success`, `failed`, `retry`)

**Response**:
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "log-uuid",
        "order_id": "order-uuid",
        "status": "success",
        "provider": "square",
        "pos_order_id": "SQ-1234567890",
        "retry_count": 0,
        "duration_ms": 250,
        "completed_at": "2025-11-15T14:30:15Z",
        "created_at": "2025-11-15T14:30:00Z"
      },
      {
        "id": "log-uuid-2",
        "order_id": "order-uuid-2",
        "status": "retry",
        "provider": "square",
        "retry_count": 2,
        "next_retry_at": "2025-11-15T14:40:00Z",
        "error_message": "Connection timeout",
        "created_at": "2025-11-15T14:25:00Z"
      }
    ],
    "total": 150,
    "limit": 50,
    "offset": 0
  }
}
```

---

## Sync Statistics

### 4. Get Sync Stats

**Endpoint**: `GET /api/v1/pos/stats/:businessId`

**Authentication**: Required (seller must own business)

**Response**:
```json
{
  "success": true,
  "data": {
    "stats": {
      "total_syncs": 150,
      "successful_syncs": 145,
      "failed_syncs": 3,
      "pending_retries": 2,
      "success_rate": 96.7
    }
  }
}
```

**Metrics**:
- **total_syncs**: Total sync attempts
- **successful_syncs**: Successfully synced orders
- **failed_syncs**: Permanently failed (max retries reached)
- **pending_retries**: Currently retrying
- **success_rate**: (successful_syncs / total_syncs) * 100

---

## Integration Management

### 5. Get Integration Settings

**Endpoint**: `GET /api/v1/pos/integration/:businessId`

**Authentication**: Required (seller must own business)

**Response**:
```json
{
  "success": true,
  "data": {
    "integration": {
      "id": "integration-uuid",
      "provider": "square",
      "is_active": true,
      "location_id": "square-location-id",
      "merchant_id": "square-merchant-id",
      "auto_sync_orders": true,
      "sync_customer_info": true,
      "last_sync_at": "2025-11-15T14:30:00Z",
      "error_count": 0,
      "last_error": null,
      "created_at": "2025-11-01T00:00:00Z"
    }
  }
}
```

**Note**: Sensitive tokens (access_token, refresh_token) are not returned for security.

### 6. Disconnect Integration

**Endpoint**: `POST /api/v1/pos/disconnect`

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
  "message": "POS integration disconnected successfully"
}
```

**Effect**:
- Sets `is_active = false`
- Stops automatic order syncing
- Retains sync history for audit
- Orders revert to manual entry in POS

---

## Error Handling

### Common Errors

**1. Authentication Errors (401)**
- **Cause**: Expired or invalid OAuth token
- **Solution**: Refresh access token or re-authenticate
- **Auto-Retry**: No (requires manual intervention)

**2. Network Errors (timeout, connection refused)**
- **Cause**: POS API temporarily unavailable
- **Solution**: Automatic retries every 5 min
- **Auto-Retry**: Yes (up to 12 retries)

**3. Validation Errors (400)**
- **Cause**: Invalid order data (missing fields, etc.)
- **Solution**: Check order data and item mapping
- **Auto-Retry**: No (data issue, won't succeed)

**4. Rate Limiting (429)**
- **Cause**: Too many requests to POS API
- **Solution**: Automatic backoff and retry
- **Auto-Retry**: Yes (with exponential backoff)

### Error Notifications

Sellers are notified when:
- 3 consecutive sync failures occur
- Max retries reached (permanent failure)
- OAuth token expired

**Notification Channels**:
- In-app dashboard warning badge
- Email notification
- WhatsApp notification (if enabled)

---

## Item Mapping

### Map Dishes to POS Items

**Use Case**: If POS requires specific item IDs

**Configuration**:
```json
{
  "item_mapping": {
    "menumaker-dish-uuid-1": "square-item-id-1",
    "menumaker-dish-uuid-2": "square-item-id-2"
  }
}
```

**Example**: Update integration with item mapping
```sql
UPDATE pos_integrations
SET item_mapping = '{"dish-uuid": "SQ-ITEM-123"}'::jsonb
WHERE business_id = 'business-uuid';
```

**Sync Behavior**:
- If mapping exists for dish, use mapped POS item ID
- If no mapping, use dish name as item name

---

## API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/pos/connect` | POST | Connect POS system |
| `/pos/disconnect` | POST | Disconnect POS system |
| `/pos/integration/:businessId` | GET | Get integration settings |
| `/pos/sync/:orderId` | POST | Manually sync order |
| `/pos/history/:businessId` | GET | Get sync history |
| `/pos/stats/:businessId` | GET | Get sync statistics |

---

## Best Practices

### For Sellers

1. **Test Integration**
   - Place test order after connecting POS
   - Verify order appears in POS within 10 seconds
   - Check customer data if `sync_customer_info = true`

2. **Monitor Sync Status**
   - Check sync stats weekly (target: >95% success rate)
   - Review failed syncs and address issues
   - Re-authenticate if token expires

3. **Handle Failures**
   - Review error messages in sync history
   - For persistent failures, check POS API status
   - Contact support if issue persists > 24 hours

4. **Item Mapping (Optional)**
   - Map dishes to POS items if required by POS
   - Update mapping when adding new dishes
   - Verify mapping with test orders

### For Developers

1. **OAuth Implementation**
   - Store tokens securely (encrypted)
   - Implement token refresh before expiry
   - Handle OAuth errors gracefully

2. **Retry Logic**
   - Use exponential backoff for rate limiting
   - Don't retry on validation errors (400)
   - Log all retry attempts for debugging

3. **Monitoring**
   - Set up alerts for high error rates
   - Monitor sync latency (target: < 10 sec)
   - Track success rate by provider

---

## Cron Jobs

### Process Pending Retries

**Schedule**: Every 5 minutes

**Implementation**:
```typescript
import { POSSyncService } from './services/POSSyncService';
import cron from 'node-cron';

const posSyncService = new POSSyncService();

// Run every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  const count = await posSyncService.processPendingRetries();
  console.log(`Processed ${count} pending POS sync retries`);
});
```

**Logic**:
1. Find sync logs with `status = 'retry'` and `next_retry_at < NOW()`
2. Attempt sync for each log
3. Update status based on result
4. Schedule next retry if still failing (up to max_retries)

---

## Success Metrics

**Target Impact**:
- ⚡ **Sync Speed**: < 10 seconds for 95% of orders
- ✅ **Success Rate**: > 95% successful syncs
- 🔄 **Auto-Recovery**: > 80% of retries succeed
- 📊 **Audit Trail**: 100% of sync attempts logged

---

## Support

**For Integration Issues**:
- Connect POS: `POST /api/v1/pos/connect`
- Check status: `GET /api/v1/pos/integration/:businessId`
- View history: `GET /api/v1/pos/history/:businessId`

**For Sync Failures**:
- Manual retry: `POST /api/v1/pos/sync/:orderId`
- Check error: Review sync history for error_message
- Escalate: Contact support with sync log ID

---

**Status**: ✅ Phase 3 - US3.7 Complete
**Supported POS**: Square, Dine, Zoho Inventory
**Auto-Sync**: Real-time order push (< 10 sec)
**Retry Logic**: Every 5 min for 1 hour (12 retries)
**Audit Trail**: Complete sync history with errors
**Security**: OAuth 2.0 with encrypted token storage
