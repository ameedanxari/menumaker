# MenuMaker Marketplace & Seller Discovery Guide

**Phase 3: Marketplace & Seller Discovery (US3.6)**
**Version**: 1.0.0
**Last Updated**: 2025-11-15

---

## Overview

MenuMaker Marketplace enables customers to discover new sellers without direct referrals through advanced search, filtering, and seller profiles.

### Key Features

✅ **Seller Discovery**: Search and filter sellers by cuisine, rating, location
✅ **Seller Opt-In**: Sellers control marketplace visibility
✅ **Featured Sellers**: Editorial/admin featured seller placement
✅ **Customer Favorites**: Save favorite sellers for quick access
✅ **Marketplace Analytics**: Track impressions, clicks, conversions
✅ **Privacy Controls**: City-level or exact location display

---

## Seller Onboarding

### 1. Enable Marketplace Discovery

**Endpoint**: `PUT /api/v1/marketplace/settings/:businessId`

**Authentication**: Required (seller must own business)

**Request**:
```json
{
  "is_discoverable": true,
  "cuisine_types": ["Indian", "North Indian", "Vegetarian"],
  "city": "Bangalore",
  "state": "Karnataka",
  "show_exact_location": false,
  "latitude": 12.9716,
  "longitude": 77.5946,
  "short_description": "Authentic North Indian cuisine with home-style cooking",
  "business_hours": {
    "monday": { "open": "10:00", "close": "22:00" },
    "tuesday": { "open": "10:00", "close": "22:00" },
    "wednesday": { "open": "10:00", "close": "22:00" },
    "thursday": { "open": "10:00", "close": "22:00" },
    "friday": { "open": "10:00", "close": "22:00" },
    "saturday": { "open": "10:00", "close": "23:00" },
    "sunday": { "open": "10:00", "close": "23:00" }
  },
  "contact_phone": "+91-9876543210",
  "contact_email": "orders@restaurant.com",
  "tags": ["biryani", "tandoor", "halal", "family-friendly"]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "settings": {
      "id": "settings-uuid",
      "business_id": "business-uuid",
      "is_discoverable": true,
      "cuisine_types": ["Indian", "North Indian", "Vegetarian"],
      "city": "Bangalore",
      "state": "Karnataka",
      "short_description": "Authentic North Indian cuisine..."
    }
  },
  "message": "Marketplace settings updated successfully"
}
```

**Key Settings**:
- **is_discoverable**: `true` to appear in marketplace, `false` to opt-out
- **cuisine_types**: Array of cuisine categories for filtering
- **city/state**: Location for filtering (city-level privacy by default)
- **show_exact_location**: `true` to show exact address, `false` for city-level only
- **latitude/longitude**: For distance calculations (optional)
- **short_description**: Max 200 characters for marketplace listing
- **tags**: Search tags (e.g., "biryani", "vegan", "quick-service")

---

## Customer Discovery

### 2. Search Marketplace

**Endpoint**: `GET /api/v1/marketplace/search`

**Authentication**: Not required (public)

**Query Parameters**:
- `cuisine_types` (optional): Comma-separated cuisine types
- `min_rating` (optional): Minimum average rating (1-5)
- `city` (optional): Filter by city
- `state` (optional): Filter by state
- `search_query` (optional): Text search (name, description, tags)
- `is_featured` (optional): Show only featured sellers
- `sort_by` (optional): `rating`, `newest`, `popular`
- `limit` (optional): Number of results (default: 20)
- `offset` (optional): Pagination offset (default: 0)

**Example**: Search for Indian restaurants in Bangalore with min 4-star rating

```
GET /api/v1/marketplace/search?cuisine_types=Indian&city=Bangalore&min_rating=4&sort_by=rating
```

**Response**:
```json
{
  "success": true,
  "data": {
    "sellers": [
      {
        "business_id": "business-uuid",
        "business_name": "Spice Garden",
        "slug": "spice-garden",
        "logo_url": "https://...",
        "short_description": "Authentic North Indian cuisine",
        "cuisine_types": ["Indian", "North Indian"],
        "average_rating": 4.5,
        "review_count": 120,
        "is_featured": true,
        "city": "Bangalore",
        "state": "Karnataka",
        "top_dishes": [
          {
            "id": "dish-uuid",
            "name": "Paneer Butter Masala",
            "price_cents": 30000,
            "image_url": "https://..."
          }
        ]
      }
    ],
    "total": 45
  }
}
```

### 3. Get Featured Sellers

**Endpoint**: `GET /api/v1/marketplace/featured?limit=10`

**Response**:
```json
{
  "success": true,
  "data": {
    "sellers": [
      // Array of seller cards (same structure as search)
    ]
  }
}
```

### 4. Get Available Cuisines

**Endpoint**: `GET /api/v1/marketplace/cuisines`

**Response**:
```json
{
  "success": true,
  "data": {
    "cuisines": [
      "Bakery",
      "Chinese",
      "Fast Food",
      "Indian",
      "Italian",
      "North Indian",
      "South Indian",
      "Vegetarian"
    ]
  }
}
```

### 5. Get Available Locations

**Endpoint**: `GET /api/v1/marketplace/locations`

**Response**:
```json
{
  "success": true,
  "data": {
    "cities": [
      {
        "city": "Bangalore",
        "state": "Karnataka",
        "count": 45
      },
      {
        "city": "Mumbai",
        "state": "Maharashtra",
        "count": 32
      }
    ]
  }
}
```

---

## Seller Profiles

### 6. Get Seller Profile

**Endpoint**: `GET /api/v1/marketplace/seller/:businessId`

**Response**:
```json
{
  "success": true,
  "data": {
    "business": {
      "id": "business-uuid",
      "name": "Spice Garden",
      "slug": "spice-garden",
      "logo_url": "https://...",
      "description": "Full description...",
      "created_at": "2024-01-01T00:00:00Z"
    },
    "settings": {
      "cuisine_types": ["Indian", "North Indian"],
      "city": "Bangalore",
      "state": "Karnataka",
      "business_hours": {...},
      "contact_phone": "+91-9876543210",
      "short_description": "Authentic North Indian cuisine"
    },
    "metrics": {
      "average_rating": 4.5,
      "review_count": 120,
      "total_orders": 1500
    }
  }
}
```

**Note**: Viewing a seller profile automatically tracks an **impression** (profile view) for analytics.

---

## Customer Favorites

### 7. Add to Favorites

**Endpoint**: `POST /api/v1/marketplace/favorites/:businessId`

**Authentication**: Required (customer)

**Request** (optional):
```json
{
  "notes": "Great biryani!"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "favorite": {
      "id": "favorite-uuid",
      "customer_id": "customer-uuid",
      "business_id": "business-uuid",
      "notes": "Great biryani!",
      "order_count": 5,
      "last_order_at": "2025-11-10T14:30:00Z",
      "created_at": "2025-11-15T10:00:00Z"
    }
  },
  "message": "Business added to favorites"
}
```

### 8. Remove from Favorites

**Endpoint**: `DELETE /api/v1/marketplace/favorites/:businessId`

**Authentication**: Required (customer)

**Response**:
```json
{
  "success": true,
  "message": "Business removed from favorites"
}
```

### 9. Get My Favorites

**Endpoint**: `GET /api/v1/marketplace/favorites`

**Authentication**: Required (customer)

**Response**:
```json
{
  "success": true,
  "data": {
    "favorites": [
      {
        "id": "favorite-uuid",
        "business_id": "business-uuid",
        "notes": "Great biryani!",
        "order_count": 5,
        "last_order_at": "2025-11-10T14:30:00Z",
        "business": {
          "id": "business-uuid",
          "name": "Spice Garden",
          "slug": "spice-garden",
          "logo_url": "https://..."
        }
      }
    ]
  }
}
```

---

## Marketplace Analytics

### 10. Get Analytics (Seller)

**Endpoint**: `GET /api/v1/marketplace/analytics/:businessId`

**Authentication**: Required (seller must own business)

**Query Parameters**:
- `startDate` (required): ISO date (e.g., `2025-11-01`)
- `endDate` (required): ISO date (e.g., `2025-11-30`)

**Response**:
```json
{
  "success": true,
  "data": {
    "analytics": [
      {
        "id": "analytics-uuid",
        "business_id": "business-uuid",
        "date": "2025-11-15",
        "profile_views": 150,
        "menu_clicks": 80,
        "marketplace_orders": 25,
        "conversion_rate": 16.67,
        "search_appearances": 500,
        "favorites_added": 10
      }
    ]
  }
}
```

**Metrics Explained**:
- **profile_views**: Number of times seller profile was viewed
- **menu_clicks**: Number of times menu was clicked from marketplace
- **marketplace_orders**: Number of orders from marketplace
- **conversion_rate**: (marketplace_orders / profile_views) * 100
- **search_appearances**: Times appeared in search results
- **favorites_added**: Times added to customer favorites

---

## Analytics Tracking

### 11. Track Impression

**Endpoint**: `POST /api/v1/marketplace/track/impression/:businessId`

**Use Case**: Called when customer views seller profile

**Response**:
```json
{
  "success": true,
  "message": "Impression tracked"
}
```

**Note**: Automatically tracked when using `GET /marketplace/seller/:businessId`

### 12. Track Menu Click

**Endpoint**: `POST /api/v1/marketplace/track/click/:businessId`

**Use Case**: Called when customer clicks "View Menu" from marketplace

**Response**:
```json
{
  "success": true,
  "message": "Click tracked"
}
```

---

## Featured Sellers

### Admin/Platform Control

**Setting**: Controlled via database or admin panel

**Fields**:
- `is_featured`: `true` or `false`
- `featured_priority`: Lower number = higher priority

**Example** (direct database update):
```sql
UPDATE marketplace_settings
SET is_featured = true, featured_priority = 1
WHERE business_id = 'business-uuid';
```

**Featured Seller Benefits**:
- Appear in "Featured Sellers" section
- Higher visibility in search results
- Priority placement in marketplace homepage

---

## Privacy Controls

### Location Privacy

**City-Level (Default)**:
```json
{
  "city": "Bangalore",
  "state": "Karnataka",
  "show_exact_location": false
}
```
- Shows only "Bangalore, Karnataka" to customers
- Protects exact address

**Exact Location (Opt-In)**:
```json
{
  "city": "Bangalore",
  "state": "Karnataka",
  "show_exact_location": true,
  "latitude": 12.9716,
  "longitude": 77.5946
}
```
- Shows exact address and map pin
- Enables distance calculations
- Only if seller opts in

---

## Search & Filtering

### Supported Filters

1. **Cuisine Types**: Filter by one or more cuisines
   - Example: `cuisine_types=Indian,Chinese`

2. **Minimum Rating**: Filter by minimum average rating
   - Example: `min_rating=4`

3. **Location**: Filter by city and/or state
   - Example: `city=Bangalore&state=Karnataka`

4. **Text Search**: Search by name, description, or tags
   - Example: `search_query=biryani`

5. **Featured Only**: Show only featured sellers
   - Example: `is_featured=true`

### Supported Sorting

1. **By Rating**: `sort_by=rating` (highest first)
2. **By Newest**: `sort_by=newest` (newest first)
3. **By Popular**: `sort_by=popular` (most orders first)
4. **By Featured Priority**: Automatic when filtering by `is_featured=true`

---

## API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/marketplace/search` | GET | Search sellers |
| `/marketplace/featured` | GET | Get featured sellers |
| `/marketplace/cuisines` | GET | Get available cuisines |
| `/marketplace/locations` | GET | Get available locations |
| `/marketplace/seller/:businessId` | GET | Get seller profile |
| `/marketplace/settings/:businessId` | GET | Get settings (seller) |
| `/marketplace/settings/:businessId` | PUT | Update settings (seller) |
| `/marketplace/analytics/:businessId` | GET | Get analytics (seller) |
| `/marketplace/favorites/:businessId` | POST | Add to favorites |
| `/marketplace/favorites/:businessId` | DELETE | Remove from favorites |
| `/marketplace/favorites` | GET | Get favorites |
| `/marketplace/track/impression/:businessId` | POST | Track impression |
| `/marketplace/track/click/:businessId` | POST | Track click |

---

## Best Practices

### For Sellers

1. **Complete Your Profile**
   - Add short description (max 200 chars)
   - Upload high-quality logo
   - Add accurate cuisine types
   - Set business hours

2. **Optimize for Search**
   - Use relevant tags (e.g., "biryani", "vegan")
   - Include popular dishes in menu
   - Maintain high ratings (aim for 4.5+)

3. **Monitor Analytics**
   - Track conversion rate (target: >10%)
   - Identify peak impression days
   - Optimize based on customer behavior

4. **Privacy Considerations**
   - Start with city-level location
   - Only enable exact location if needed for delivery

### For Customers

1. **Use Filters Effectively**
   - Combine cuisine + location + rating filters
   - Try text search for specific dishes

2. **Save Favorites**
   - Add notes to remember what you liked
   - Track repeat orders automatically

3. **Explore Featured Sellers**
   - Featured sellers are curated for quality
   - Try new featured sellers each week

---

## Success Metrics

**Target Impact**:
- 📊 **Discovery Rate**: 60% of new customers via marketplace
- ⭐ **Average Rating**: 4.5+ stars for discoverable sellers
- 💰 **Conversion Rate**: >10% (profile views → orders)
- ❤️ **Favorite Rate**: 20% of customers save favorites

---

## Support

**For Sellers**:
- Enable discovery: `PUT /api/v1/marketplace/settings/:businessId`
- View analytics: `GET /api/v1/marketplace/analytics/:businessId`

**For Customers**:
- Search sellers: `GET /api/v1/marketplace/search`
- Add favorites: `POST /api/v1/marketplace/favorites/:businessId`

---

**Status**: ✅ Phase 3 - US3.6 Complete
**Seller Discovery**: Search by cuisine, rating, location
**Featured Sellers**: Editorial placement
**Customer Favorites**: Save preferred sellers
**Analytics**: Impressions, clicks, conversions
**Privacy**: City-level or exact location control
