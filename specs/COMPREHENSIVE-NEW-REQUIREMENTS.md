# MenuMaker: Comprehensive New Requirements Summary

**Date**: 2025-11-11
**Status**: Architecture & Specifications Complete
**Phase Coverage**: Phase 2-3 enhancements

---

## Executive Summary

This document consolidates all new requirements identified during the product review, providing comprehensive specifications for:

1. **Content Moderation & Safety** (Phase 3)
2. **GDPR Compliance & Privacy** (Phase 2-3)
3. **Reviews & Testimonials** (Phase 3)
4. **Design System & Theming** (Phase 3)
5. **Mobile App Store Review Prompts** (Phase 3.5)

**Combined Impact**:
- Timeline: +9 weeks total across all phases
- Budget: +Rs. 48-73L
- New user stories: 4 major features
- Technical debt addressed: Security, compliance, UX consistency

---

## 1. Content Moderation & Safety Policy

### Overview
Community safety system enabling users to report offensive content, with admin moderation queue and automated safety rules.

### User Stories

**US3.5A: Report Offensive Content**

**As a** user (seller or customer)
**I want to** report inappropriate content (reviews, dishes, images)
**So that** the platform remains safe and trustworthy

### Key Features

#### 1.1 Report Button
- Visible on: Reviews, Dish listings, Seller profiles, Images
- Report categories:
  - Spam or misleading
  - Offensive language
  - Inappropriate content
  - Harassment or bullying
  - Fraud or scam
  - Other (with description)

#### 1.2 Auto-Moderation Rules
```typescript
const AUTO_MODERATION_RULES = {
  AUTO_HIDE_THRESHOLD: 3, // Hide after 3 flags
  AUTO_BAN_THRESHOLD: 5,  // Ban user after 5 rejected flags
  PROFANITY_FILTER: true,
  SPAM_DETECTION: true
};
```

#### 1.3 Content Flag Entity
```typescript
@Entity('content_flags')
export class ContentFlag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  flag_type: string; // 'review', 'dish', 'image', 'profile'

  @Column({ type: 'uuid' })
  target_id: string; // ID of flagged content

  @Column({ type: 'varchar', length: 50 })
  reason: string; // 'spam', 'offensive', 'inappropriate', etc.

  @Column({ type: 'text', nullable: true })
  description: string; // User-provided explanation

  @ManyToOne(() => User) // User who flagged
  reporter: User;

  @Column({ type: 'uuid' })
  reporter_id: string;

  @Column({ type: 'varchar', default: 'pending' })
  status: string; // 'pending', 'approved', 'rejected'

  @Column({ type: 'boolean', default: false })
  auto_hidden: boolean; // True if auto-hidden by threshold

  @ManyToOne(() => AdminUser, { nullable: true })
  reviewed_by: AdminUser;

  @Column({ type: 'uuid', nullable: true })
  reviewed_by_id: string;

  @Column({ type: 'timestamp', nullable: true })
  reviewed_at: Date;

  @Column({ type: 'text', nullable: true })
  moderator_notes: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
```

### API Endpoints

```yaml
POST /api/v1/flags:
  description: Report content
  request:
    flag_type: review
    target_id: review_123
    reason: offensive
    description: "Contains profanity"

GET /api/v1/admin/flags:
  description: List all flags (admin only)
  query: ?status=pending&type=review

PATCH /api/v1/admin/flags/{id}/approve:
  description: Approve flag, restore content

PATCH /api/v1/admin/flags/{id}/reject:
  description: Reject flag, delete content permanently
```

### App Store Compliance

**Apple App Store Guidelines**:
- Section 1.2: User Generated Content - Must have reporting mechanism
- Section 5.1: Privacy - Must handle offensive content reports

**Google Play Policy**:
- User Generated Content - Require in-app reporting system
- Hate Speech - Must moderate flagged content within reasonable time

### Success Metrics
- Flag response time: <2 hours (business hours)
- False positive rate: <10%
- User satisfaction: 85%+ feel safe reporting

---

## 2. GDPR Compliance & Privacy

### Overview
Two-phase approach to GDPR compliance:
- **Phase 2**: Foundation (cookie consent, account deletion, data retention)
- **Phase 3**: Full compliance (data portability, consent management, audit trail)

### Phase 2: GDPR Foundation (US2.3 Enhancement)

#### 2.1 Cookie Consent Banner

**Implementation**: Cookiebot or custom solution

```typescript
interface CookieConsent {
  necessary: boolean;      // Always true (cannot opt-out)
  analytics: boolean;      // Firebase Analytics
  marketing: boolean;      // Future: Ad tracking
  preferences: boolean;    // UI preferences, language
}
```

**UI**:
```
┌────────────────────────────────────────────────────┐
│  🍪 We use cookies                                 │
│  We use cookies to improve your experience.        │
│                                                    │
│  [Necessary ✓] [Analytics ○] [Marketing ○]        │
│                                                    │
│  [Accept All] [Reject All] [Customize]            │
│  [Privacy Policy]                                  │
└────────────────────────────────────────────────────┘
```

#### 2.2 Account Deletion Workflow

```
User Settings → Delete Account
    ↓
Confirmation Modal (re-enter password)
    ↓
Email verification link sent
    ↓
User clicks link
    ↓
Scheduled deletion (7-day grace period)
    ↓
Data purged (except legal retention: orders, payments)
```

**Data Retention After Deletion** (GDPR-Compliant):

**Immediate Actions** (upon deletion request):
- User profile: Soft-deleted (30-day recovery grace period)
- All orders: **PII anonymized immediately** (cannot be reversed)
  - `customer_name` → `"DELETED USER"`
  - `customer_email` → `"deleted+{orderId}@menumaker.app"` (unique per order for accounting)
  - `customer_phone` → `"DELETED"`
  - `delivery_address` → `"DELETED"`
  - `notes` → `"DELETED"`
- Business profile: Hidden from public view
- Dishes/Menus: Unpublished (not deleted, allows recovery if user returns within 30 days)
- Analytics: Anonymized (no reverse-lookup possible)

**After 30-Day Grace Period** (hard deletion):
- User profile: Permanently deleted
- Business profile: Permanently deleted
- Dishes/Menus: Permanently deleted
- **Orders**: Retained for **3 years** (already anonymized) for:
  - Tax compliance (GST filing requirements)
  - Financial audits
  - Fraud investigation (if flagged before deletion)
- Payment records: Retained for **7 years** (legal requirement in India)
  - Already anonymized (linked to order_id, not user_id)

**Critical**: All PII is anonymized **immediately** upon deletion request. The 3-year order retention applies ONLY to anonymized records required for legal/tax compliance. Users cannot be re-identified from these records.

**Implementation**:
```typescript
async function handleAccountDeletion(userId: string) {
  // Step 1: Anonymize all orders immediately
  await db.query(`
    UPDATE orders
    SET
      customer_name = 'DELETED USER',
      customer_email = CONCAT('deleted+', id, '@menumaker.app'),
      customer_phone = 'DELETED',
      delivery_address = 'DELETED',
      notes = 'DELETED',
      anonymized_at = NOW()
    WHERE business_id IN (
      SELECT id FROM businesses WHERE owner_id = $1
    )
  `, [userId]);

  // Step 2: Soft-delete user (30-day recovery)
  await User.update({ id: userId }, {
    deleted_at: new Date(),
    deletion_scheduled_for: addDays(new Date(), 30)
  });

  // Step 3: Send confirmation email
  await sendEmail({
    to: user.email,
    subject: 'Account Deletion Scheduled',
    body: `Your account will be permanently deleted on ${deletion_scheduled_for}.
           To cancel, log in before this date.`
  });
}
```

#### 2.3 Privacy Policy Generator

Auto-generate privacy policy based on:
- Data collected (email, phone, location, etc.)
- Third-party services used (Firebase, Razorpay, etc.)
- User rights (access, delete, port)

**Template Variables**:
```javascript
const privacyPolicy = generatePrivacyPolicy({
  businessName: 'MenuMaker',
  dataCollected: ['email', 'phone', 'location', 'orders'],
  thirdParties: ['Firebase', 'Razorpay', 'Twilio'],
  dataRetention: '3 years for orders, immediate deletion for profiles',
  userRights: ['access', 'delete', 'port', 'object']
});
```

### Phase 3: GDPR Full Compliance

#### 2.4 Data Portability

**Export User Data** (JSON/CSV):

```yaml
GET /api/v1/users/me/export-data:
  response:
    format: json | csv
    includes:
      - profile (name, email, phone, address)
      - business (name, description, logo)
      - dishes (all dishes created)
      - menus (all menus)
      - orders (all orders received)
      - reviews (all reviews received)
      - referrals (referral stats)
```

**Sample Export**:
```json
{
  "profile": {
    "email": "priya@example.com",
    "full_name": "Priya Sharma",
    "phone": "+91 98765 43210",
    "created_at": "2025-11-10T10:00:00Z"
  },
  "business": {
    "name": "Spice Kitchen",
    "description": "Authentic North Indian cuisine",
    "total_orders": 45,
    "total_gmv_cents": 4500000
  },
  "dishes": [
    {
      "name": "Butter Chicken",
      "price_cents": 18000,
      "allergens": ["dairy"],
      "created_at": "2025-11-11T14:00:00Z"
    }
  ]
}
```

#### 2.5 Consent Management

**UserConsent Entity**:
```typescript
@Entity('user_consents')
export class UserConsent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  user: User;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar', length: 50 })
  consent_type: string; // 'analytics', 'marketing', 'third_party_sharing'

  @Column({ type: 'boolean' })
  granted: boolean;

  @Column({ type: 'varchar', nullable: true })
  consent_version: string; // Version of privacy policy at time of consent

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  granted_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  withdrawn_at: Date;
}
```

**Consent Tracking**:
- Log when user grants/withdraws consent
- Version privacy policy (v1.0, v1.1, etc.)
- Re-prompt on policy updates

#### 2.6 Right to Be Forgotten

**Complete Data Deletion**:
```typescript
async function deleteUserData(userId: string) {
  // 1. Anonymize orders (keep for accounting, remove PII)
  await Order.update(
    { userId },
    {
      customer_name: 'DELETED USER',
      customer_email: 'deleted@example.com',
      customer_phone: '0000000000',
      delivery_address: 'DELETED'
    }
  );

  // 2. Delete user-generated content
  await Dish.delete({ businessId: user.businessId });
  await Menu.delete({ businessId: user.businessId });
  await Review.delete({ userId });

  // 3. Delete profile
  await Business.delete({ id: user.businessId });
  await User.delete({ id: userId });

  // 4. Log deletion in audit trail
  await AuditLog.create({
    action: 'user_deleted',
    target_id: userId,
    notes: 'GDPR right to be forgotten'
  });
}
```

### GDPR Checklist

| Requirement | Phase 2 | Phase 3 | Implementation |
|-------------|---------|---------|----------------|
| Cookie consent | ✅ | ✅ | Cookiebot banner |
| Privacy policy | ✅ | ✅ | Auto-generated template |
| Account deletion | ✅ | ✅ | 7-day grace period |
| Data portability | ❌ | ✅ | Export JSON/CSV |
| Consent management | ❌ | ✅ | Consent tracking entity |
| Right to be forgotten | ❌ | ✅ | Complete data purge |
| Data retention policy | ✅ | ✅ | 3 years orders, immediate deletion |
| DPO appointment | ❌ | ✅ | Required if >5000 users |

### API Endpoints

```yaml
# Phase 2
POST /api/v1/users/me/delete-account:
  description: Schedule account deletion

POST /api/v1/cookie-consent:
  request:
    analytics: true
    marketing: false

# Phase 3
GET /api/v1/users/me/export-data:
  query: ?format=json

GET /api/v1/users/me/consents:
  response: List of all consents granted/withdrawn

POST /api/v1/users/me/consents/withdraw:
  request:
    consent_type: analytics
```

---

## 3. Reviews & Testimonials System

### Overview
Customer review system enabling star ratings, written reviews, and testimonial collection for business marketing.

### User Story (US3.5B - Extension)

**As a** customer
**I want to** leave a review for a seller after ordering
**So that** I can share my experience and help others

**As a** seller
**I want to** showcase positive testimonials on my menu page
**So that** I can build trust with new customers

### Features

#### 3.1 Review Entity

```typescript
@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Business)
  business: Business;

  @Column({ type: 'uuid' })
  business_id: string;

  @ManyToOne(() => Order) // Must have ordered to review
  order: Order;

  @Column({ type: 'uuid' })
  order_id: string;

  @Column({ type: 'varchar', length: 255 })
  reviewer_name: string; // Customer name

  @Column({ type: 'varchar', length: 255, nullable: true })
  reviewer_email: string; // Optional

  @Column({ type: 'integer' })
  rating: number; // 1-5 stars

  @Column({ type: 'text', nullable: true })
  comment: string; // Written review (optional)

  @Column({ type: 'boolean', default: false })
  is_verified_purchase: boolean; // True if customer actually ordered

  @Column({ type: 'boolean', default: true })
  is_visible: boolean; // False if flagged/hidden

  @Column({ type: 'boolean', default: false })
  is_featured: boolean; // Seller can feature positive reviews

  @Column({ type: 'varchar', nullable: true })
  seller_response: string; // Seller can reply to reviews

  @Column({ type: 'timestamp', nullable: true })
  seller_responded_at: Date;

  @Column({ type: 'integer', default: 0 })
  helpful_count: number; // "Was this helpful?" votes

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @OneToMany(() => ContentFlag, flag => flag.target_id)
  flags: ContentFlag[]; // Track flags on this review
}
```

#### 3.2 Review Submission Flow

**Trigger**: 24 hours after order marked "Fulfilled"

```
Order Fulfilled
    ↓ (24 hours later)
Email: "How was your order from Spice Kitchen?"
[Leave a Review]
    ↓
Review Form:
  - Star rating (1-5)
  - Written review (optional)
  - Upload photos (optional, Phase 4)
    ↓
[Submit Review]
    ↓
Review posted publicly on seller's menu page
```

#### 3.3 Review Display

**Seller Menu Page**:
```
┌────────────────────────────────────────────────────┐
│  Spice Kitchen                                     │
│  ⭐⭐⭐⭐⭐ 4.8 (45 reviews)                          │
├────────────────────────────────────────────────────┤
│  Featured Reviews:                                 │
│                                                    │
│  ⭐⭐⭐⭐⭐ "Amazing food!"                            │
│  Priya K. • Verified Purchase • Nov 15, 2025      │
│  "Best butter chicken I've ever had. Highly        │
│   recommend!"                                      │
│  👍 12 people found this helpful                   │
│                                                    │
│  Seller Response:                                  │
│  "Thank you so much for your kind words! 🙏"       │
│                                                    │
│  [View All Reviews]                                │
└────────────────────────────────────────────────────┘
```

#### 3.4 Review Incentives

**Encourage Reviews**:
- Email reminder 24h after order
- "Review & earn Rs. 50 credit" promotion (Phase 3)
- Badge: "Top Reviewer" for active reviewers
- Raffle: Monthly prize for reviewers

**Spam Prevention**:
- Must have completed order to review (verified purchase)
- Max 1 review per order
- Rate limiting: Max 5 reviews per day per user
- Profanity filter on comments
- Flag button for inappropriate reviews

#### 3.5 Testimonials for Marketing

**Seller Dashboard**:
```
Marketing Tools → Testimonials

Select your best reviews to feature:
☑ "Amazing food!" - Priya K. (⭐⭐⭐⭐⭐)
☐ "Delicious!" - Raj M. (⭐⭐⭐⭐⭐)
☑ "Great service" - Amit P. (⭐⭐⭐⭐⭐)

[Generate Testimonial Image] → Download as JPG for social media
```

**Auto-Generated Testimonial Card**:
```
┌────────────────────────────────────┐
│  "Amazing food!"                   │
│                                    │
│  ⭐⭐⭐⭐⭐                             │
│                                    │
│  - Priya K., Verified Customer    │
│                                    │
│  [Spice Kitchen Logo]              │
│  menumaker.com/spice-kitchen       │
└────────────────────────────────────┘
```

### API Endpoints

```yaml
POST /api/v1/reviews:
  request:
    business_id: biz_123
    order_id: ord_456
    rating: 5
    comment: "Amazing food!"

GET /api/v1/businesses/{id}/reviews:
  query: ?sort=rating&limit=20
  response:
    data: [array of reviews]
    stats:
      average_rating: 4.8
      total_reviews: 45
      rating_distribution:
        5: 30
        4: 10
        3: 3
        2: 1
        1: 1

PATCH /api/v1/reviews/{id}/respond:
  request:
    seller_response: "Thank you for your feedback!"

POST /api/v1/reviews/{id}/helpful:
  description: Mark review as helpful (upvote)
```

### Success Metrics
- Review submission rate: 30% of completed orders
- Average rating: >4.5 stars
- Seller response rate: >70%
- Review influence on orders: +20% conversion for 4.5+ rated sellers

---

## 4. Design System & Theming Guidelines

### Overview
Comprehensive design system ensuring consistent, accessible, and aesthetically pleasing UI across web, iOS, and Android platforms.

### Goals
1. **Consistency**: Unified look/feel across all platforms
2. **Accessibility**: WCAG 2.1 AA compliance
3. **Efficiency**: Reduce design-to-code time by 50%
4. **Scalability**: Easy to maintain and extend
5. **User-Friendly**: Clean, minimalistic, visible for non-tech-savvy users

### 4.1 Design Tokens

**Colors** (JSON format for cross-platform use):

```json
{
  "colors": {
    "primary": {
      "50": "#FFF3E0",
      "100": "#FFE0B2",
      "500": "#FF9800",
      "600": "#FB8C00",
      "700": "#F57C00"
    },
    "neutral": {
      "0": "#FFFFFF",
      "50": "#FAFAFA",
      "100": "#F5F5F5",
      "900": "#212121",
      "950": "#0D0D0D"
    },
    "success": "#4CAF50",
    "warning": "#FFC107",
    "error": "#F44336",
    "info": "#2196F3"
  }
}
```

**Why Orange (#FF9800)?**
- Warm, inviting (food industry)
- High contrast for readability
- Accessible (WCAG AA compliant)

**Typography**:

```json
{
  "typography": {
    "fontFamily": {
      "sans": "Inter, system-ui, sans-serif",
      "mono": "JetBrains Mono, monospace"
    },
    "fontSize": {
      "xs": "12px",
      "sm": "14px",
      "base": "16px",
      "lg": "18px",
      "xl": "20px",
      "2xl": "24px",
      "3xl": "30px",
      "4xl": "36px"
    },
    "fontWeight": {
      "normal": 400,
      "medium": 500,
      "semibold": 600,
      "bold": 700
    },
    "lineHeight": {
      "tight": 1.25,
      "normal": 1.5,
      "relaxed": 1.75
    }
  }
}
```

**Spacing** (8px base unit):

```json
{
  "spacing": {
    "0": "0px",
    "1": "4px",
    "2": "8px",
    "3": "12px",
    "4": "16px",
    "6": "24px",
    "8": "32px",
    "12": "48px",
    "16": "64px"
  }
}
```

**Shadows**:

```json
{
  "shadows": {
    "sm": "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    "base": "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
    "md": "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
    "lg": "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
    "xl": "0 20px 25px -5px rgba(0, 0, 0, 0.1)"
  }
}
```

### 4.2 Component Library

**Tools**: Storybook (React) + Figma (design handoff)

**Core Components**:

1. **Button**
   - Variants: primary, secondary, outline, ghost
   - Sizes: sm, md, lg
   - States: default, hover, active, disabled, loading

2. **Input**
   - Types: text, email, phone, number, textarea
   - States: default, focus, error, disabled
   - Features: label, helper text, error message, icon

3. **Card**
   - Variants: default, elevated, outlined
   - Sections: header, body, footer
   - Interactive: clickable, hoverable

4. **Modal/Dialog**
   - Sizes: sm, md, lg, fullscreen
   - Types: confirmation, form, info
   - Features: backdrop, close button, footer actions

5. **Table**
   - Features: sorting, filtering, pagination
   - Responsive: scroll on mobile
   - Actions: row selection, bulk actions

6. **Form**
   - Validation: real-time, on submit
   - Error handling: inline errors, summary
   - Accessibility: ARIA labels, keyboard navigation

**Example: Button Component (React)**

```tsx
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'outline' | 'ghost';
  size: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}

export function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  children,
  onClick
}: ButtonProps) {
  const baseClasses = 'font-medium rounded-lg transition-colors';

  const variantClasses = {
    primary: 'bg-primary-500 text-white hover:bg-primary-600',
    secondary: 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200',
    outline: 'border border-primary-500 text-primary-500 hover:bg-primary-50',
    ghost: 'text-primary-500 hover:bg-primary-50'
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  return (
    <button
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
}
```

### 4.3 Accessibility Patterns

**WCAG 2.1 AA Compliance**:

1. **Color Contrast**
   - Text: 4.5:1 ratio minimum
   - Large text (18pt+): 3:1 ratio
   - UI elements: 3:1 ratio

2. **Keyboard Navigation**
   - All interactive elements focusable
   - Visual focus indicator (2px outline)
   - Logical tab order
   - Keyboard shortcuts (where applicable)

3. **Screen Reader Support**
   - Semantic HTML (nav, main, article, etc.)
   - ARIA labels for icon buttons
   - ARIA live regions for dynamic content
   - Alt text for all images

4. **Form Accessibility**
   - Labels for all inputs
   - Error messages announced
   - Required fields indicated
   - Help text for complex fields

**Example: Accessible Form**

```tsx
<form>
  <label htmlFor="email">
    Email <span aria-label="required">*</span>
  </label>
  <input
    id="email"
    type="email"
    aria-required="true"
    aria-describedby="email-error email-help"
    aria-invalid={hasError}
  />
  <p id="email-help" className="text-sm text-neutral-600">
    We'll never share your email.
  </p>
  {hasError && (
    <p id="email-error" role="alert" className="text-error">
      Please enter a valid email address.
    </p>
  )}
</form>
```

### 4.4 Dark Mode Strategy

**Approach**: System preference detection + manual toggle

**Implementation**:

```typescript
// Detect system preference
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

// User override in localStorage
const userPreference = localStorage.getItem('theme'); // 'light' | 'dark' | 'auto'

const theme = userPreference === 'auto'
  ? (prefersDark ? 'dark' : 'light')
  : userPreference;

// Apply theme
document.documentElement.classList.add(theme);
```

**Dark Mode Colors**:

```json
{
  "dark": {
    "background": "#121212",
    "surface": "#1E1E1E",
    "primary": "#FF9800",
    "text": {
      "primary": "#FFFFFF",
      "secondary": "#B0B0B0"
    }
  }
}
```

### 4.5 Responsive Breakpoints

```json
{
  "breakpoints": {
    "mobile": "320px - 767px",
    "tablet": "768px - 1023px",
    "desktop": "1024px - 1439px",
    "wide": "1440px+"
  }
}
```

**Mobile-First Approach**:

```css
/* Mobile (default) */
.container {
  padding: 16px;
}

/* Tablet */
@media (min-width: 768px) {
  .container {
    padding: 24px;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .container {
    padding: 32px;
    max-width: 1200px;
    margin: 0 auto;
  }
}
```

### 4.6 Platform-Specific Theming

**iOS (SwiftUI)**:

```swift
struct MenuMakerTheme {
    static let primary = Color(hex: "#FF9800")
    static let background = Color(UIColor.systemBackground)
    static let surface = Color(UIColor.secondarySystemBackground)

    static let cornerRadius: CGFloat = 12
    static let spacing: CGFloat = 16
}

// Usage
Button("Sign Up") {
    // action
}
.buttonStyle(.borderedProminent)
.tint(MenuMakerTheme.primary)
```

**Android (Jetpack Compose + Material You)**:

```kotlin
val MenuMakerColors = lightColorScheme(
    primary = Color(0xFFFF9800),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFFFE0B2),
    background = Color.White,
    surface = Color(0xFFFAFAFA)
)

@Composable
fun MenuMakerTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = MenuMakerColors,
        typography = MenuMakerTypography,
        content = content
    )
}
```

### 4.7 Brand Guidelines

**Logo**:
- Primary: Full color on white/light backgrounds
- Secondary: White on dark backgrounds
- Minimum size: 32px height
- Clear space: 16px on all sides

**Voice & Tone**:
- Friendly, approachable, helpful
- Clear and concise (avoid jargon)
- Encouraging (e.g., "You're doing great!" vs "Error")
- Respectful of diverse backgrounds

**Imagery**:
- High-quality food photography
- Bright, natural lighting
- Authentic, not stock photos
- Diverse representation

### Success Metrics
- Design-to-code time: <2 days per screen (vs 5+ days)
- Component reuse: 80%+ across platforms
- Accessibility score: 100/100 on Lighthouse
- User feedback: 90%+ positive on UI/UX

---

## 5. Mobile App Store Review Prompts

### Overview
Native in-app review prompts to encourage positive ratings on App Store and Google Play Store, driving organic app discovery and downloads.

### User Story (Mobile-Specific)

**As a** product manager
**I want to** prompt satisfied users to rate our app
**So that** we increase app store visibility and downloads

### 5.1 Timing Strategy

**When to Ask**:
- **Sellers**: After 3rd successful order fulfilled
- **Customers**: After 2nd order placed
- **Never**: If user previously left review, or within 90 days of last prompt

**Why These Triggers?**:
- Users have experienced value (not too early)
- Positive emotional state (successful transaction)
- Sufficient sample size (reduces outlier ratings)

### 5.2 Implementation

#### iOS (StoreKit 2)

```swift
import StoreKit

class ReviewManager {
    static let shared = ReviewManager()

    func requestReviewIfAppropriate() {
        // Check eligibility
        guard shouldPromptForReview() else { return }

        // Request review
        if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene {
            SKStoreReviewController.requestReview(in: scene)
        }

        // Update last prompted date
        UserDefaults.standard.set(Date(), forKey: "lastReviewPromptDate")
    }

    private func shouldPromptForReview() -> Bool {
        let orderCount = UserDefaults.standard.integer(forKey: "orderCount")
        let lastPromptDate = UserDefaults.standard.object(forKey: "lastReviewPromptDate") as? Date

        // Must have 3+ orders
        guard orderCount >= 3 else { return false }

        // Must be 90+ days since last prompt
        if let lastPrompt = lastPromptDate {
            let daysSincePrompt = Calendar.current.dateComponents([.day], from: lastPrompt, to: Date()).day ?? 0
            guard daysSincePrompt >= 90 else { return false }
        }

        return true
    }
}

// Trigger after order fulfilled
func onOrderFulfilled() {
    let orderCount = UserDefaults.standard.integer(forKey: "orderCount") + 1
    UserDefaults.standard.set(orderCount, forKey: "orderCount")

    ReviewManager.shared.requestReviewIfAppropriate()
}
```

#### Android (In-App Review API)

```kotlin
import com.google.android.play.core.review.ReviewManagerFactory

class ReviewManager(private val activity: Activity) {

    fun requestReviewIfAppropriate() {
        if (!shouldPromptForReview()) return

        val manager = ReviewManagerFactory.create(activity)
        val request = manager.requestReviewFlow()

        request.addOnCompleteListener { task ->
            if (task.isSuccessful) {
                val reviewInfo = task.result
                manager.launchReviewFlow(activity, reviewInfo).addOnCompleteListener {
                    // Update last prompted date
                    PreferencesManager.setLastReviewPromptDate(Date())
                }
            }
        }
    }

    private fun shouldPromptForReview(): Boolean {
        val orderCount = PreferencesManager.getOrderCount()
        val lastPromptDate = PreferencesManager.getLastReviewPromptDate()

        // Must have 3+ orders
        if (orderCount < 3) return false

        // Must be 90+ days since last prompt
        lastPromptDate?.let {
            val daysSincePrompt = ChronoUnit.DAYS.between(it, LocalDate.now())
            if (daysSincePrompt < 90) return false
        }

        return true
    }
}

// Trigger after order fulfilled
fun onOrderFulfilled() {
    val orderCount = PreferencesManager.getOrderCount() + 1
    PreferencesManager.setOrderCount(orderCount)

    ReviewManager(this).requestReviewIfAppropriate()
}
```

### 5.3 Analytics Tracking

**Events**:

```typescript
// Review prompt shown
trackEvent('review_prompt_shown', {
  user_type: 'seller',
  order_count: 5,
  days_since_signup: 30
});

// User left review (estimated, not directly trackable)
trackEvent('review_prompt_completed', {
  user_type: 'seller',
  assumed_positive: true // If they didn't dismiss
});

// User dismissed prompt
trackEvent('review_prompt_dismissed', {
  user_type: 'seller'
});
```

**Success Metrics**:
- Prompt acceptance rate: >50% (don't dismiss)
- App Store rating: >4.5 stars
- Total reviews: 500+ (Phase 3 target)
- Organic installs: +30% (driven by ratings)

### 5.4 A/B Testing (Phase 4+)

Test different prompts:
- **Timing**: After 2nd vs 3rd order
- **Message**: "Enjoying MenuMaker?" vs "Help us grow!"
- **Frequency**: 90 days vs 120 days

### 5.5 Handling Negative Feedback

**If user is unhappy** (before prompting for review):

```
"How would you rate your experience?"
⭐⭐⭐⭐⭐

If 1-3 stars selected:
  → "Sorry to hear that! Can you tell us what went wrong?"
  → [Send Feedback] → Opens support ticket

If 4-5 stars selected:
  → "Glad you're enjoying MenuMaker! Would you mind leaving a review?"
  → [Rate on App Store]
```

---

## Implementation Roadmap

### Phase 2 (Months 2-6) - +1 Week

**New Features**:
1. Referral System (US2.7) - 4-5 days
2. GDPR Foundation (US2.3 enhancement) - 3-4 days
   - Cookie consent
   - Account deletion
   - Privacy policy generator

**Total**: 7-9 days

### Phase 3 (Months 6-12) - +8 Weeks

**Week 1-4**: Admin Backend (US3.10) - 20-25 days
**Week 1-3** (parallel): Design System - 12-15 days
**Week 5-7**: GDPR Full Compliance - 10-12 days
**Week 7-9**: Reviews & Testimonials - 8-10 days
**Week 9-11**: Content Moderation - 6-8 days
**Week 11-13**: Polish & Integration - 5 days

**Total**: ~65 days

### Phase 3.5 (Months 12-18)

**Mobile Features**:
- App review prompts - 2-3 days
- Deep linking for referrals - 3-4 days
- Social sharing optimization - 2-3 days

**Total**: 7-10 days

---

## Success Metrics Summary

| Feature | Key Metric | Phase 2 Target | Phase 3 Target |
|---------|-----------|----------------|----------------|
| Referral System | Signup via referrals | 30% | 40% |
| GDPR Compliance | Deletion requests handled | <24 hours | <12 hours |
| Reviews | Submission rate | - | 30% of orders |
| Content Moderation | Flag response time | - | <2 hours |
| Design System | Component reuse | - | 80% |
| App Reviews | App Store rating | - | >4.5 stars |

---

**Status**: ✅ Comprehensive Specifications Complete
**Total Effort**: ~80 days across Phase 2-3.5
**Budget Impact**: +Rs. 48-73L
**Timeline Impact**: +9 weeks total

All specifications ready for implementation planning and development kickoff.
