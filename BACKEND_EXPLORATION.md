# MenuMaker Backend - Comprehensive Implementation Analysis

## 1. Backend Framework & Architecture

### Technology Stack
- **Web Framework:** Fastify 4.25.2 (Node.js)
- **ORM:** TypeORM 0.3.19
- **Database:** PostgreSQL
- **Authentication:** JWT (jsonwebtoken)
- **API Documentation:** Swagger/OpenAPI 3.0
- **Security:** Helmet, CORS, Rate Limiting
- **Language:** TypeScript 5.3

### Project Structure
```
backend/src/
├── config/          # Database and configuration
├── middleware/      # Auth, error handling, subscription limits, admin auth
├── models/          # 35+ TypeORM entities (database models)
├── routes/          # 25+ API route modules
├── services/        # Business logic services
├── types/           # TypeScript type definitions
└── utils/           # JWT, validation, logging, password hashing
```

### Key Features
- REST API on `/api/v1/`
- OpenAPI/Swagger documentation at `/api/docs`
- Health check endpoint at `/health`
- Request logging with unique request IDs
- Transaction support for critical operations
- Rate limiting (100 requests per 15 minutes default)

---

## 2. Database Models & Structure

### Core Entities (13 tables)
1. **User** - Customer/seller accounts with referral codes, suspension/ban fields
2. **Business** - Restaurant/seller profiles with settings and orders
3. **BusinessSettings** - Delivery, payment, i18n, and tax configuration
4. **Dish** - Menu items with pricing and categories
5. **DishCategory** - Categorization for dishes
6. **CommonDish** - Shared/template dishes
7. **Menu** - Business menus containing dishes
8. **MenuItem** - Menu-to-Dish mapping
9. **Order** - Customer orders with payment and fulfillment status
10. **OrderItem** - Individual items in orders
11. **OrderNotification** - Notification tracking for orders
12. **SavedCart** - Cart history for reorder functionality
13. **Referral** - Legacy referral tracking

### Payment & Subscription (6 tables)
1. **Payment** - Multi-processor support (Stripe, Razorpay, PhonePe, Paytm)
   - Processor-agnostic fields
   - Backwards compatible with Stripe-only implementations
2. **PaymentProcessor** - Payment processor configuration
3. **Payout** - Seller payouts with fees and reconciliation
4. **PayoutSchedule** - Payout frequency settings
5. **Subscription** - Business subscription tiers and limits
6. **TaxInvoice** - Invoice generation and tracking

### Review & Ratings (2 tables)
1. **Review** - Customer reviews with moderation workflow
   - 24-hour seller review window
   - Complaint handling for low ratings
2. **ReviewResponse** - Seller responses to reviews

### Marketplace & Sales (5 tables)
1. **Coupon** - Discount coupons with usage limits
2. **CouponUsage** - Coupon redemption tracking
3. **AutomaticPromotion** - Auto-applied promotions (free delivery, etc.)
4. **Marketplace** - Seller discovery settings and analytics
5. **CustomerFavorite** - Bookmarked restaurants

### Enhanced Referral System (6 tables)
1. **CustomerReferral** - Customer-to-customer referrals with rewards
2. **ReferralLeaderboard** - Monthly leaderboards
3. **Affiliate** - Affiliate program management
4. **AffiliateClick** - Link click tracking
5. **AffiliatePayout** - Affiliate commissions
6. **ViralBadge** - Viral achievement badges

### Integration & Compliance (5 tables)
1. **POSIntegration** - POS system integration (Square, Toast, etc.)
2. **POSSyncLog** - POS sync history
3. **DeliveryIntegration** - Delivery partner APIs (Dunzo, Porter, etc.)
4. **DeliveryTracking** - Order tracking with real-time updates
5. **DeliveryRating** - Driver ratings

### Admin & Moderation (5 tables)
1. **AdminUser** - Admin account management with 2FA and IP whitelist
2. **AuditLog** - Action logging for compliance
3. **FeatureFlag** - Feature toggle system
4. **ContentFlag** - Content moderation flags
5. **SupportTicket** - Customer support tickets

### GDPR & Privacy (4 tables)
1. **CookieConsent** - Cookie consent tracking
2. **LegalTemplate** - Terms, privacy policy templates
3. **DeletionRequest** - User data deletion requests
4. **AuditLog** - Compliance audit trails

---

## 3. API Routes & Endpoints

### Authentication (`/api/v1/auth`)
- `POST /signup` - Create account with optional referral code
- `POST /login` - Login and get tokens
- `GET /me` - Get current user (authenticated)

### Businesses (`/api/v1/businesses`)
- CRUD operations for seller profiles
- Publish/unpublish business listings
- Business settings management

### Orders (`/api/v1/orders`)
- `POST /` - Create order (no auth, public)
- `GET /:id` - Get order details (public)
- `GET /` - Get business orders (authenticated, owner only)
- `PUT /:id` - Update order status
- `GET /summary` - Order analytics and statistics

### Payments (`/api/v1/payments`)
**Multi-Processor Support:**
- `POST /create-intent-multi` - Create payment with processor selection
- `POST /webhook-multi` - Unified webhook handler
- `POST /:id/refund-multi` - Refund with automatic processor routing

**Legacy Stripe (backwards compatible):**
- `POST /create-intent` - Stripe payment intent
- `POST /webhook` - Stripe webhook
- `POST /:id/refund` - Stripe refund
- `GET /business/:businessId/stats` - Payment statistics

### Reviews (`/api/v1/reviews`)
- `POST /` - Submit review (authenticated)
- `GET /:id` - Get review details
- `GET /business/:businessId` - Get business reviews (public)
- `GET /pending/business/:businessId` - Get pending reviews (seller only)
- `PUT /:id/moderate` - Approve/reject review (seller)
- `POST /:id/response` - Add seller response
- `PUT /:id/complaint` - Update complaint resolution status
- `GET /metrics/business/:businessId` - Review analytics
- `GET /trends/business/:businessId` - Review trends
- `GET /order/:orderId/can-review` - Check if customer can review

### Coupons (`/api/v1/coupons`)
- `POST /` - Create coupon (seller)
- `GET /business/:businessId` - Get seller coupons
- `GET /public/:businessId` - Get public coupons (menu display)
- `POST /validate` - Validate coupon for order (customer)
- `PUT /:id` - Update coupon
- `DELETE /:id` - Archive coupon
- `GET /:id/analytics` - Coupon performance metrics
- `GET /stats/:businessId` - Business coupon statistics

**Automatic Promotions:**
- `POST /promotions` - Create automatic promotion
- `GET /promotions/business/:businessId` - List promotions
- `POST /promotions/check` - Check applicable promotions
- `PUT /promotions/:id` - Update promotion

### Enhanced Referrals (`/api/v1`)
- `POST /customers/referrals/create` - Create customer referral code
- `GET /customers/referrals/stats` - Get referral statistics
- `POST /referrals/leaderboard` - Get leaderboard
- `POST /affiliates/register` - Register as affiliate
- `GET /affiliates/stats` - Affiliate statistics
- `POST /viral/badges/track` - Track viral badges

### Payouts (`/api/v1/payouts`)
- `GET /` - List payouts (seller)
- `GET /:id` - Get payout details
- `PUT /:id` - Hold/unhold payout
- `GET /business/:businessId/stats` - Payout analytics

### Subscriptions (`/api/v1/subscriptions`)
- `GET /business/:businessId` - Get subscription tier
- `POST /business/:businessId/upgrade` - Upgrade plan
- `GET /features` - List available features by tier

### Reports & Analytics (`/api/v1/reports`)
- Revenue, order, and customer analytics
- Date range filtering
- Business-specific statistics

### Media (`/api/v1/media`)
- `POST /` - Upload images (multipart)
- `DELETE /:id` - Delete images

### POS Integration (`/api/v1/pos`)
- Configure and sync with POS systems
- Inventory and menu synchronization

### Delivery Integration (`/api/v1/delivery`)
- Partner configuration (Dunzo, Porter, etc.)
- Real-time tracking
- Driver ratings

### Marketplace (`/api/v1/marketplace`)
- Search and discover sellers
- Business analytics
- Customer favorites

### Tax & Compliance (`/api/v1/tax`)
- Invoice generation
- GST calculation and reporting
- TDS compliance

### Multi-Language (`/api/v1/i18n`)
- Translation management (English, Hindi, Tamil, Arabic)
- Locale-specific formatting

### GDPR (`/api/v1/gdpr`)
- Cookie consent management
- Data deletion requests
- Legal template management

### OCR (`/api/v1/ocr`)
- Menu digitization from images
- Dish extraction and categorization

### Reorder (`/api/v1/reorder`)
- Previous order retrieval
- Quick reorder functionality

### WhatsApp (`/api/v1/whatsapp`)
- Send order notifications
- Verify phone numbers
- Webhook for incoming messages

### Admin Backend (`/api/v1/admin`)
- User moderation (suspend/ban)
- Business listing management
- Review moderation
- Analytics dashboard
- Audit logs

---

## 4. Authentication & Authorization

### JWT-Based Authentication
```typescript
interface JWTPayload {
  userId: string;
  email: string;
  businessId?: string;  // Optional, for sellers
}
```

### Token Management
- **Access Token Expiry:** 15 minutes (default)
- **Refresh Token Expiry:** 7 days (default)
- **Secret Requirements:** Minimum 32 characters
- **Bearer Token Format:** `Authorization: Bearer <token>`

### Middleware
1. **authenticate** - Verify JWT, require token
2. **optionalAuth** - Verify JWT if present, don't require
3. **authenticateAdmin** - Admin-specific with:
   - 2FA requirement
   - IP whitelist checking
   - Active status verification
   - Last login tracking

### Admin Authorization (RBAC)
- **super_admin** - Full access to all features
- **moderator** - Content moderation, analytics, user viewing (no ban/suspend)
- **support_agent** - Support tickets, user viewing (limited)

### Subscription-Based Access Control
- `checkSubscriptionLimits` - Enforce order limits per tier
- `requireFeature` - Check feature availability in subscription
- `requireActiveSubscription` - Verify subscription is active

---

## 5. Business Logic Implementation

### Order Management
1. **Order Creation**
   - Validates menu exists and is published
   - Calculates delivery fees (flat, distance-based, or free)
   - Supports pickup and delivery modes
   - Atomic transaction for consistency
   - WhatsApp notification to seller

2. **Order Status Workflow**
   - pending → confirmed → ready → fulfilled → (optional: cancelled)
   - Payment status tracking: unpaid → paid → failed

3. **Delivery Fee Calculation**
   - Distance-based: base fee + per-km fee with rounding options
   - Flat fee model
   - Free delivery option
   - Min order threshold for free delivery

4. **Order Notifications**
   - Real-time status updates
   - WhatsApp integration
   - Customer and seller notifications

### Payment Processing (Multi-Processor)
1. **Supported Processors**
   - Stripe (primary, backwards compatible)
   - Razorpay (Indian market)
   - PhonePe (emerging)
   - Paytm (legacy support)

2. **Payment Flow**
   - Create payment intent via `/create-intent-multi`
   - Processor-specific redirect/modal
   - Webhook handling from processor
   - Idempotent payment creation (prevent double charges)
   - Automatic fallback to secondary processor if primary fails

3. **Fee Management**
   - Per-processor fee calculation
   - Net amount calculation: gross - processor_fee - platform_fee
   - Settlement tracking

4. **Refunds**
   - Initiated by seller
   - Routed to original processor
   - Partial and full refunds supported
   - Reason tracking

### Review & Complaint System
1. **Review Submission**
   - Only for fulfilled orders
   - Customer can review own orders only
   - 1-5 star ratings
   - Up to 500 characters + 3 photos max
   - Spam prevention

2. **Moderation Workflow**
   - Auto-pending status
   - 24-hour seller review window
   - Seller can approve or request removal
   - Auto-approve after 24 hours if no action
   - Admin-only removal option

3. **Complaint Handling**
   - Triggered by rating < 3
   - Status: open → in_progress → resolved → escalated
   - Seller notification and response capability
   - Escalation to admin for disputes

4. **Seller Responses**
   - Public response to reviews
   - Per-review response
   - Responder name tracking

### Coupon & Promotion System
1. **Coupon Creation**
   - Unique code per coupon
   - Fixed amount or percentage discounts
   - Usage limits (per customer, per month, total)
   - Min order thresholds
   - Applicable to all dishes or specific dishes
   - QR code generation

2. **Coupon Validation**
   - Code validity check
   - Date range validation
   - Min order value check
   - Usage limit enforcement
   - Dish applicability verification
   - Customer eligibility check

3. **Automatic Promotions**
   - Free delivery on min order
   - Auto-applied discounts
   - Free item offers
   - Time-based triggers

4. **Analytics**
   - Usage tracking
   - Discount given (total impact)
   - Revenue generated
   - Customer analytics

### Referral System (Two Implementations)

**Basic Referral (Phase 2.5):**
- User referral codes (e.g., "PRIYA2024")
- Account credit rewards (cents-based)
- Pro tier gifting with expiration
- Referral code tracking on user signup

**Enhanced Referral (Phase 3):**
- Customer-to-customer referrals
- Affiliate program with commission tracking
- Monthly leaderboards with rewards
- Viral badges for top referrers
- Click tracking for analytics
- Affiliate payouts

### Payout System
1. **Payout Calculation**
   - Gross amount from succeeded payments
   - Processor fees deduction
   - Platform subscription fee deduction
   - Volume discount (>Rs. 1L monthly GMV = 0.5% discount)
   - Net amount = gross - fees + discounts

2. **Payout Frequency**
   - Daily, weekly, or monthly cycles
   - Period-based calculation (start_date to end_date)

3. **Payout Processing**
   - Status: pending → processing → completed/failed
   - Retry mechanism (max 3 retries)
   - Processor transaction ID tracking

4. **Reconciliation**
   - Bank statement matching
   - Mismatch detection and reporting
   - TDS deduction tracking (India compliance)
   - Tax invoicing integration

5. **Seller Dashboard**
   - Real-time payout status
   - Historical payout records
   - Net vs gross breakdown
   - Fee transparency

### Subscription Tier System
1. **Tiers**
   - Free tier
   - Pro tier
   - Business tier
   - Enterprise tier (custom)

2. **Limits**
   - Order limits per tier
   - Feature availability
   - Priority support

3. **Enforcement**
   - Order creation blocked at limit
   - Feature access gated
   - Upgrade prompts

---

## 6. Security & Compliance Implementation

### Authentication Security
- JWT with minimum 32-character secret
- Password hashing with bcrypt (5 rounds)
- No password hash returned in API responses
- Token expiration (15 min access, 7 day refresh)

### Authorization
- User ownership verification for resources
- Business ownership checks
- Admin role-based access control (RBAC)
- 2FA mandatory for admin users
- IP whitelist support for admin access

### Request Security
- Helmet.js for HTTP security headers
- CORS configuration
- Rate limiting (100 req/15 min default)
- Request ID tracking for tracing
- Content Security Policy

### Data Privacy
- GDPR compliance module
- Soft deletes for user accounts
- Data anonymization options
- Cookie consent tracking
- Deletion request processing
- Audit logging

### Payment Security
- PCI DSS compliance (delegates to processors)
- Webhook signature verification
- No raw payment data in logs
- Encrypted payment details storage
- Processor-specific security headers

### Admin Security
- 2FA requirement
- IP whitelisting
- Last login tracking
- Admin action audit logs
- Role-based access control

---

## 7. Missing or Incomplete Features for iOS

### 1. Missing Endpoints

**Authentication:**
- ❌ Token refresh endpoint (mentioned as "coming in Phase 2")
- ❌ Password reset functionality
- ❌ Email verification endpoint

**User Management:**
- ❌ Profile update endpoint (name, avatar, etc.)
- ❌ Phone number verification (for SMS features)
- ❌ Account settings/preferences

**Marketplace Discovery:**
- ❌ Search businesses endpoint
- ❌ Filter by cuisine/category
- ❌ Business recommendations
- ❌ Sorting (by rating, distance, etc.)
- ❌ Business details with hours/ratings

**Reorder Features:**
- ⚠️ Reorder exists but needs:
  - Recent orders listing
  - Favorite dishes
  - Order history with filters

**Cart Management:**
- ⚠️ SavedCart model exists but no cart API
  - Missing: POST /cart, GET /cart, PUT /cart/:id, DELETE /cart/:id
  - Missing: Add/remove items from cart
  - Missing: Cart totals calculation endpoint

**Order Tracking:**
- ⚠️ Delivery tracking exists but needs:
  - Real-time order status via WebSocket (not REST)
  - Driver location updates
  - ETA calculation

**Notifications:**
- ⚠️ WhatsApp implemented but missing:
  - Push notifications (Firebase Cloud Messaging)
  - In-app notification preferences
  - Notification history

**User Preferences:**
- ❌ Dietary preferences/restrictions
- ❌ Saved addresses
- ❌ Payment method preferences
- ❌ Notification settings

**Favorites/Wishlist:**
- ⚠️ CustomerFavorite model exists but no endpoints

**Account Management:**
- ❌ Edit profile endpoint
- ❌ Change password endpoint
- ❌ Account deletion endpoint (GDPR exists but not user-facing)

### 2. Required Fixes/Enhancements

**Payment Flow:**
- ❌ Missing `/payments/:id/verify` endpoint for payment verification
- ❌ Missing local payment methods (e.g., cash on delivery callback verification)
- ❌ Card tokenization for saved cards

**Orders:**
- ⚠️ Missing batch status updates for order history
- ❌ Missing order cancellation endpoint
- ⚠️ Missing delivery address validation

**Reviews:**
- ⚠️ Issue: Reviews require authentication but use `order_id` parameter
  - The parameter order is inconsistent: route suggests `/reviews/:id/submit` but code shows `/reviews`

**Error Handling:**
- ⚠️ Error responses not standardized across all endpoints
- ⚠️ Some endpoints return different error structures

**Validation:**
- ⚠️ Input validation inconsistent between endpoints
- ❌ Phone number validation for Indian numbers

**Pagination:**
- ⚠️ Limited pagination support (only some endpoints)
- ❌ Standardized pagination format missing

### 3. Data Model Gaps

**User Tier/Status:**
- ⚠️ User model has suspension/ban fields but no active status field
- ❌ Missing user verification status (email verified, phone verified)

**Order Status:**
- ✅ Good: pending, confirmed, ready, fulfilled, cancelled
- ⚠️ Missing: payment verification step between pending and confirmed

**Address Data:**
- ❌ No delivery address entity (stored as string on order)
- ❌ No saved addresses table for quick address selection

**Business Hours:**
- ❌ No business hours configuration in BusinessSettings
- ❌ No timezone-aware order scheduling

### 4. Missing Features from Requirements

**Real-Time Features:**
- ❌ WebSocket for live order tracking
- ❌ Real-time delivery partner location
- ❌ Live chat for customer support

**Analytics/Dashboard:**
- ⚠️ Basic analytics exist but incomplete:
  - ❌ Customer acquisition funnels
  - ❌ Food preference analytics
  - ⚠️ Missing detailed dashboard endpoints

**Content Management:**
- ❌ Business photos/gallery endpoint
- ❌ Bulk menu import from external sources (OCR partial)

**Marketplace Features:**
- ⚠️ Marketplace model exists but endpoints minimal
- ❌ Recommendation engine
- ❌ Trending/popular dishes

---

## 8. Deployment & Configuration

### Environment Variables Required
```bash
DATABASE_URL=postgresql://user:pass@host:port/menumaker
JWT_SECRET=<min-32-chars>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3001
PORT=3001
HOST=0.0.0.0
NODE_ENV=development|production
LOG_LEVEL=info
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000
STRIPE_API_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
RAZORPAY_KEY_ID=rzp_...
RAZORPAY_KEY_SECRET=...
```

### Database Migrations
- Migrations are supported but not yet in use
- Currently using `synchronize: true` for development
- Must migrate to migrations for production

### Deployment Checklist
- ✅ Fastify configured and optimized
- ✅ Database connections pooled
- ✅ Error handling middleware
- ✅ Security headers configured
- ✅ Rate limiting enabled
- ❌ CORS needs environment-based configuration
- ⚠️ Logging needs centralization (e.g., ELK, DataDog)

---

## 9. Testing & Quality

### Test Coverage
- Unit tests: Jest configured
- Integration tests: supertest available
- Missing: End-to-end tests
- Missing: Test fixtures and factories

### Code Quality
- ✅ ESLint configured
- ✅ TypeScript strict mode
- ⚠️ Error handling incomplete in some services
- ⚠️ Input validation inconsistent

---

## 10. Summary: Backend Readiness for iOS

### ✅ Well-Implemented Areas
1. **Order Management** - Complete CRUD with status tracking
2. **Payment Processing** - Multi-processor support with fallback
3. **Authentication** - JWT-based with admin RBAC
4. **Review System** - Comprehensive with moderation workflow
5. **Coupon & Promotions** - Full suite with validation
6. **Subscription Management** - Tier-based access control
7. **Payout System** - Detailed with fee calculations
8. **Data Models** - 35+ well-designed entities

### ⚠️ Partially Implemented
1. **Marketplace Discovery** - Models exist, endpoints missing
2. **Cart Management** - Model exists, API missing
3. **Reorder** - Basic implementation, needs enhancement
4. **Analytics** - Exists but incomplete

### ❌ Critical Gaps for iOS
1. **Token Refresh** - No refresh endpoint
2. **User Profile Management** - Missing endpoints
3. **Push Notifications** - Only WhatsApp, no push
4. **Cart API** - Model exists, endpoints don't
5. **Address Management** - No saved addresses
6. **Search/Marketplace** - No search/filter endpoints
7. **Real-Time Updates** - No WebSocket support

### Recommended Implementation Order
1. **High Priority (Blocking):**
   - Token refresh endpoint
   - User profile endpoints
   - Cart API (CRUD)
   - Search/filter endpoints for businesses
   - Push notifications integration

2. **Medium Priority (MVP+):**
   - Saved addresses
   - Payment verification endpoint
   - Order cancellation
   - Real-time order tracking (WebSocket)
   - Profile preferences

3. **Low Priority (Nice-to-have):**
   - Wishlist/favorites endpoints
   - Business photos/gallery
   - Advanced analytics
   - Live chat
   - Recommendation engine

---

## File Locations Summary

**Key Backend Files:**
- Entry point: `/home/user/menumaker/backend/src/main.ts`
- Database config: `/home/user/menumaker/backend/src/config/database.ts`
- Auth middleware: `/home/user/menumaker/backend/src/middleware/auth.ts`
- Models: `/home/user/menumaker/backend/src/models/*.ts` (35 files)
- Routes: `/home/user/menumaker/backend/src/routes/*.ts` (25 files)
- Services: `/home/user/menumaker/backend/src/services/*.ts` (27 files)
- Utils: `/home/user/menumaker/backend/src/utils/*.ts` (JWT, validation, logging)

