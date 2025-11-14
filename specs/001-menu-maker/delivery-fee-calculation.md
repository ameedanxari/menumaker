# Delivery Fee Calculation Specification

**Version**: 1.0
**Phase**: Phase 1 (MVP)
**Last Updated**: 2025-11-12

---

## Overview

MenuMaker supports three delivery fee models:
1. **Flat Fee**: Fixed delivery charge regardless of distance
2. **Distance-Based**: Base fee + per-kilometer rate with optional rounding
3. **Free Delivery**: No delivery charge

This specification defines the calculation logic, geocoding requirements, and implementation details.

---

## Delivery Fee Models

### 1. Flat Fee Delivery

**Business Settings:**
```typescript
{
  delivery_type: 'flat',
  delivery_fee_cents: 5000  // Rs. 50.00
}
```

**Calculation:**
```typescript
function calculateFlatFee(businessSettings: BusinessSettings): number {
  return businessSettings.delivery_fee_cents;
}
```

**Example:**
- Business charges Rs. 50 flat delivery fee
- Order from 1 km away: Rs. 50
- Order from 10 km away: Rs. 50

---

### 2. Distance-Based Delivery

**Business Settings:**
```typescript
{
  delivery_type: 'distance',
  delivery_base_fee_cents: 2000,       // Rs. 20.00 base
  delivery_fee_per_km_cents: 500,      // Rs. 5.00 per km
  delivery_rounding_rule: 'up_to_10'   // Round up to nearest Rs. 10
}
```

**Calculation Steps:**

1. **Calculate Distance**: Geocode business address and delivery address, compute straight-line distance
2. **Apply Formula**: `base_fee + (distance_km × per_km_rate)`
3. **Apply Rounding**: Round according to business rule
4. **Return Result**: Delivery fee in cents

**Implementation:**
```typescript
// src/services/delivery-fee.service.ts
import { Client as GoogleMapsClient } from '@googlemaps/google-maps-services-js';

export class DeliveryFeeService {
  private mapsClient: GoogleMapsClient;

  constructor() {
    this.mapsClient = new GoogleMapsClient({});
  }

  async calculateDistanceBasedFee(
    businessAddress: string,
    deliveryAddress: string,
    businessSettings: BusinessSettings
  ): Promise<{
    fee_cents: number;
    distance_km: number;
    breakdown: FeeBreakdown;
  }> {
    // 1. Geocode addresses
    const [businessCoords, deliveryCoords] = await Promise.all([
      this.geocodeAddress(businessAddress),
      this.geocodeAddress(deliveryAddress)
    ]);

    // 2. Calculate distance (Haversine formula for straight-line distance)
    const distanceKm = this.calculateDistance(
      businessCoords.lat,
      businessCoords.lng,
      deliveryCoords.lat,
      deliveryCoords.lng
    );

    // 3. Apply fee formula
    const baseFee = businessSettings.delivery_base_fee_cents;
    const distanceFee = Math.round(distanceKm * businessSettings.delivery_fee_per_km_cents);
    const totalBeforeRounding = baseFee + distanceFee;

    // 4. Apply rounding rule
    const roundedFee = this.applyRounding(
      totalBeforeRounding,
      businessSettings.delivery_rounding_rule
    );

    return {
      fee_cents: roundedFee,
      distance_km: distanceKm,
      breakdown: {
        base_fee_cents: baseFee,
        distance_fee_cents: distanceFee,
        total_before_rounding: totalBeforeRounding,
        rounding_applied: roundedFee - totalBeforeRounding,
        rounding_rule: businessSettings.delivery_rounding_rule
      }
    };
  }

  private async geocodeAddress(address: string): Promise<{ lat: number; lng: number }> {
    try {
      const response = await this.mapsClient.geocode({
        params: {
          address: address,
          key: process.env.GOOGLE_MAPS_API_KEY!
        }
      });

      if (response.data.results.length === 0) {
        throw new Error('Address not found');
      }

      const location = response.data.results[0].geometry.location;
      return { lat: location.lat, lng: location.lng };
    } catch (error) {
      console.error('Geocoding error:', error);
      throw new Error('Failed to geocode address');
    }
  }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    // Haversine formula for straight-line distance
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return Math.round(distance * 10) / 10; // Round to 1 decimal place
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private applyRounding(
    amountCents: number,
    roundingRule: 'none' | 'up_to_10' | 'up_to_50'
  ): number {
    switch (roundingRule) {
      case 'none':
        return amountCents;

      case 'up_to_10':
        // Round up to nearest Rs. 10 (1000 paisa)
        return Math.ceil(amountCents / 1000) * 1000;

      case 'up_to_50':
        // Round up to nearest Rs. 50 (5000 paisa)
        return Math.ceil(amountCents / 5000) * 5000;

      default:
        return amountCents;
    }
  }
}
```

**Example Calculation:**

Business settings:
- Base fee: Rs. 20 (2000 paisa)
- Per-km rate: Rs. 5 (500 paisa)
- Rounding: Up to Rs. 10

Order from 4.2 km away:
1. Distance fee: 4.2 × 500 = 2100 paisa
2. Total before rounding: 2000 + 2100 = 4100 paisa (Rs. 41)
3. Round up to Rs. 50: 5000 paisa
4. **Final delivery fee: Rs. 50**

---

### 3. Free Delivery

**Business Settings:**
```typescript
{
  delivery_type: 'free',
  delivery_fee_cents: 0
}
```

**Calculation:**
```typescript
function calculateFreeFee(): number {
  return 0;
}
```

---

## Rounding Rules

### None (no rounding)

Return exact calculated amount.

**Example:**
- Rs. 41.00 → Rs. 41.00
- Rs. 47.50 → Rs. 47.50

### Up to Rs. 10 (up_to_10)

Round up to nearest Rs. 10.

**Examples:**
- Rs. 41.00 → Rs. 50.00
- Rs. 50.00 → Rs. 50.00
- Rs. 51.00 → Rs. 60.00

**Implementation:**
```typescript
Math.ceil(amountCents / 1000) * 1000
```

### Up to Rs. 50 (up_to_50)

Round up to nearest Rs. 50.

**Examples:**
- Rs. 41.00 → Rs. 50.00
- Rs. 50.00 → Rs. 50.00
- Rs. 51.00 → Rs. 100.00
- Rs. 99.00 → Rs. 100.00

**Implementation:**
```typescript
Math.ceil(amountCents / 5000) * 5000
```

---

## Geocoding Strategy

### MVP (Phase 1): Google Maps Geocoding API

**Why Google Maps:**
- Excellent coverage in India
- 28,500 free geocode requests/month
- Reliable for Indian addresses with PIN codes

**API Setup:**
```bash
# Environment variable
GOOGLE_MAPS_API_KEY=AIzaSy...

# Enable API in Google Cloud Console:
# 1. Go to Google Cloud Console
# 2. Enable "Geocoding API"
# 3. Restrict API key to geocoding only
# 4. Set application restriction (HTTP referrer or IP address)
```

**Rate Limits:**
- Free tier: 28,500 requests/month
- Additional: $5.00 per 1,000 requests
- Max: 50 requests/second

**Cost Estimation (1,000 sellers, 100 orders/month each):**
- Distance-based sellers: ~30% = 300 sellers
- Orders needing geocoding: 300 × 100 = 30,000/month
- Free tier covers: 28,500
- Overage: 1,500 × $0.005 = **$7.50/month**

### Future Optimization (Phase 2): Geocoding Cache

Store geocoded addresses to reduce API calls:

```typescript
@Entity()
export class GeocodedAddress {
  @PrimaryColumn('varchar')
  address_hash: string; // SHA256 hash of normalized address

  @Column('decimal', { precision: 10, scale: 7 })
  latitude: number;

  @Column('decimal', { precision: 10, scale: 7 })
  longitude: number;

  @Column({ type: 'timestamp' })
  cached_at: Date;

  @Column({ type: 'integer', default: 0 })
  hit_count: number; // Track cache effectiveness
}
```

**Cache Strategy:**
- Hash address (normalized: lowercase, trim whitespace)
- Check cache first (< 1ms database lookup)
- If miss, call Google Maps API and cache result
- TTL: 90 days (addresses rarely change)

**Expected Cache Hit Rate:**
- Repeat customers: ~40% hit rate
- Popular delivery areas: ~60% hit rate
- **Reduces API calls by 40-60%**

---

## Database Schema Updates

Add distance-based fields to `business_settings` table:

```sql
-- Migration: add-delivery-distance-fields
ALTER TABLE business_settings
ADD COLUMN delivery_base_fee_cents INTEGER DEFAULT 0,
ADD COLUMN delivery_fee_per_km_cents INTEGER DEFAULT 0,
ADD COLUMN delivery_rounding_rule VARCHAR(20) DEFAULT 'none'
  CHECK (delivery_rounding_rule IN ('none', 'up_to_10', 'up_to_50'));

-- Update existing businesses to use flat fee by default
UPDATE business_settings
SET delivery_rounding_rule = 'none'
WHERE delivery_rounding_rule IS NULL;
```

**Updated BusinessSettings Entity:**
```typescript
@Entity()
export class BusinessSettings {
  // ... existing fields ...

  @Column({ type: 'varchar' })
  delivery_type: 'flat' | 'distance' | 'free';

  @Column({ type: 'integer', default: 0 })
  delivery_fee_cents: number; // Used for flat fee

  // Distance-based fields (nullable for flat/free businesses)
  @Column({ type: 'integer', nullable: true })
  delivery_base_fee_cents: number;

  @Column({ type: 'integer', nullable: true })
  delivery_fee_per_km_cents: number;

  @Column({ type: 'varchar', default: 'none' })
  delivery_rounding_rule: 'none' | 'up_to_10' | 'up_to_50';
}
```

---

## API Endpoint Implementation

### POST /orders/calculate-delivery

**Controller:**
```typescript
// src/controllers/orders.controller.ts
export class OrdersController {
  private deliveryFeeService: DeliveryFeeService;

  async calculateDeliveryFee(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { business_id, delivery_type, delivery_address } = request.body;

      // 1. Validate pickup orders (no delivery fee)
      if (delivery_type === 'pickup') {
        return reply.send({
          delivery_fee_cents: 0,
          currency: 'INR',
          delivery_type: 'pickup',
          distance_km: null,
          breakdown: null
        });
      }

      // 2. Validate delivery address
      if (!delivery_address) {
        return reply.code(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'delivery_address is required for delivery orders'
          }
        });
      }

      // 3. Load business and settings
      const business = await Business.findOne({
        where: { id: business_id },
        relations: ['settings']
      });

      if (!business) {
        return reply.code(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Business not found'
          }
        });
      }

      const settings = business.settings;

      // 4. Calculate fee based on delivery type
      let result;

      switch (settings.delivery_type) {
        case 'flat':
          result = {
            delivery_fee_cents: settings.delivery_fee_cents,
            currency: settings.currency,
            delivery_type: 'flat',
            distance_km: null,
            breakdown: null
          };
          break;

        case 'distance':
          const distanceResult = await this.deliveryFeeService.calculateDistanceBasedFee(
            business.address,
            delivery_address,
            settings
          );

          result = {
            delivery_fee_cents: distanceResult.fee_cents,
            currency: settings.currency,
            delivery_type: 'distance',
            distance_km: distanceResult.distance_km,
            breakdown: distanceResult.breakdown
          };
          break;

        case 'free':
          result = {
            delivery_fee_cents: 0,
            currency: settings.currency,
            delivery_type: 'free',
            distance_km: null,
            breakdown: null
          };
          break;

        default:
          throw new Error('Invalid delivery type');
      }

      return reply.send(result);

    } catch (error) {
      console.error('Delivery fee calculation error:', error);

      return reply.code(500).send({
        error: {
          code: 'CALCULATION_FAILED',
          message: 'Failed to calculate delivery fee'
        }
      });
    }
  }
}
```

---

## Error Handling

### Geocoding Failures

**Scenarios:**
1. Invalid address format
2. Address not found by Google Maps
3. API quota exceeded
4. Network timeout

**Fallback Strategy:**
```typescript
async geocodeWithFallback(address: string): Promise<Coordinates> {
  try {
    return await this.geocodeAddress(address);
  } catch (error) {
    // Log error for monitoring
    console.error('Geocoding failed:', error);

    // Fallback: Use business flat fee
    throw new Error('GEOCODING_FAILED');
  }
}
```

**User-Facing Error:**
```json
{
  "error": {
    "code": "ADDRESS_INVALID",
    "message": "Unable to calculate delivery fee. Please check your address or contact seller directly."
  }
}
```

### Distance Calculation Edge Cases

1. **Business and delivery address are the same:**
   - Distance = 0 km
   - Fee = base_fee only (no distance charge)

2. **Very short distances (< 1 km):**
   - Use actual distance (e.g., 0.3 km)
   - Fee = base_fee + (0.3 × per_km_rate)

3. **Very long distances (> 50 km):**
   - Log warning (unusual for home-based food business)
   - Allow calculation but consider max distance limit in Phase 2

---

## Testing Checklist

### Unit Tests
- [ ] Flat fee calculation
- [ ] Distance-based fee calculation (various distances)
- [ ] Free delivery calculation
- [ ] Rounding rules (none, up_to_10, up_to_50)
- [ ] Haversine distance formula accuracy
- [ ] Geocoding error handling

### Integration Tests
- [ ] Calculate delivery for pickup order (returns 0)
- [ ] Calculate delivery for flat fee business
- [ ] Calculate delivery for distance-based business
- [ ] Calculate delivery for free delivery business
- [ ] Validate missing delivery_address (400 error)
- [ ] Validate non-existent business (404 error)
- [ ] Verify breakdown structure for distance-based

### E2E Tests
- [ ] Frontend calls API before order submission
- [ ] Displays correct delivery fee to customer
- [ ] Order total includes calculated delivery fee
- [ ] Handles geocoding errors gracefully

---

## Environment Variables

```bash
# Google Maps Geocoding API
GOOGLE_MAPS_API_KEY=AIzaSy...

# Delivery Calculation Settings
DELIVERY_MAX_DISTANCE_KM=50         # Max distance for delivery (optional)
GEOCODING_TIMEOUT_MS=5000           # Geocoding API timeout
GEOCODING_CACHE_ENABLED=true        # Enable address caching (Phase 2)
GEOCODING_CACHE_TTL_DAYS=90         # Cache TTL in days
```

---

## Performance Considerations

### API Response Time Targets

| Delivery Type | Target Response Time | Notes |
|---------------|---------------------|-------|
| Pickup | < 10ms | Database query only |
| Flat Fee | < 50ms | Database query + simple calculation |
| Distance-Based | < 1.5s | Includes 2 geocoding API calls (< 500ms each) |
| Distance-Based (cached) | < 200ms | Cache hit avoids geocoding |

### Optimization Strategies

1. **Parallel Geocoding** (Phase 1):
   - Geocode business and delivery addresses concurrently
   - Reduces latency by ~40%

2. **Business Address Caching** (Phase 1):
   - Cache business coordinates in memory (rarely change)
   - Eliminates 1 geocoding call per request

3. **Address Normalization** (Phase 2):
   - Normalize addresses before caching (lowercase, trim, remove extra spaces)
   - Increases cache hit rate by 15-20%

4. **Geocoding Cache** (Phase 2):
   - Database cache for frequently used delivery addresses
   - 40-60% reduction in Google Maps API calls

---

## Cost Analysis

### Monthly Cost (1,000 Sellers)

**Assumptions:**
- 30% use distance-based delivery (300 sellers)
- 100 orders/month per seller
- 40% cache hit rate (Phase 2)

**Google Maps API:**
- Orders needing geocoding: 300 × 100 = 30,000/month
- Cache hit (Phase 2): 30,000 × 40% = 12,000 (free)
- Cache miss: 18,000 geocoding requests
- Free tier: 28,500 covers all requests
- **Cost: $0/month (within free tier)**

**Phase 1 (no cache):**
- 30,000 - 28,500 = 1,500 overage
- Cost: 1,500 × $0.005 = **$7.50/month**

**Scaling to 10,000 Sellers:**
- Distance-based orders: 300,000/month
- Cache hit (60%): 180,000 (free)
- Cache miss: 120,000
- Overage: 120,000 - 28,500 = 91,500
- Cost: 91,500 × $0.005 = **$457.50/month**

---

## Alternative: OpenStreetMap Nominatim (Free)

**Pros:**
- Completely free (no rate limits if self-hosted)
- Good coverage in major Indian cities

**Cons:**
- Less accurate than Google Maps for Indian addresses
- Requires self-hosting for production use
- Higher maintenance burden

**Recommendation:**
- **Phase 1**: Use Google Maps (reliable, low cost)
- **Phase 3**: Consider Nominatim if API costs become significant (> $500/month)

---

**Document Status**: ✅ Complete
**Implementation Estimate**: 2-3 days (1 developer)
**Dependencies**: Google Maps Geocoding API, PostgreSQL
**Next**: Implement delivery fee service → Add API endpoint → Test with various addresses
