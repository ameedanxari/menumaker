# Analytics & Instrumentation Strategy

## Overview

MenuMaker uses **Firebase** as the unified analytics and monitoring platform across web portal, backend APIs, and mobile applications (iOS/Android). This provides crash reporting, performance monitoring, and product analytics while remaining cost-effective during MVP phase.

## Goals

1. **Track Product Metrics**: Measure key business outcomes (signups, orders, retention)
2. **Monitor Crash-Free Rates**: Achieve 99%+ crash-free user sessions on mobile
3. **Measure Performance**: Track API latency, cold start times, and page load speeds
4. **Inform Product Decisions**: Understand user behavior through funnel analysis
5. **Cost-Effective**: Leverage Firebase free tier (unlimited events, unlimited users)

## Firebase Platform Components

### 1. Firebase Analytics (Product Metrics)

**Coverage**: Web + iOS + Android

**Why Firebase Analytics?**
- ✅ Free unlimited events and users
- ✅ Native mobile SDKs (iOS/Android)
- ✅ Web SDK for React
- ✅ Automatic screen/page view tracking
- ✅ User properties and segmentation
- ✅ Integration with BigQuery for custom analysis (future)

**Alternatives Considered**:
| Provider | Free Tier | Why Not Chosen |
|----------|-----------|----------------|
| Mixpanel | 100K events/month | Event limits too restrictive for scaling |
| Amplitude | 10M events/month | Complexity overkill for MVP |
| PostHog | 1M events/month | Self-hosting adds operational burden |

### 2. Firebase Crashlytics (Crash Reporting)

**Coverage**: iOS + Android

**Why Crashlytics?**
- ✅ Real-time crash alerts
- ✅ Symbolication for stack traces
- ✅ Crash-free rate tracking (target: 99%+)
- ✅ Integration with Firebase Analytics (correlate crashes with events)

### 3. Firebase Performance Monitoring

**Coverage**: iOS + Android + Web

**Tracks**:
- Cold start time (target: <2s for mobile)
- API request latency (target: p95 <500ms)
- Screen rendering time
- Custom traces for critical flows

### 4. Sentry (Backend Error Tracking)

**Coverage**: Node.js backend

**Why Sentry for Backend?**
- ✅ Better Node.js integration than Firebase
- ✅ Free tier: 5,000 errors/month
- ✅ Release tracking and source maps
- ✅ Detailed stack traces with context

**Integration**: Logs at `error` level automatically sent to Sentry (see logging-strategy.md)

## Event Taxonomy

### Naming Convention

**Format**: `<noun>_<verb_past_tense>`

**Examples**:
- ✅ `seller_signed_up`
- ✅ `menu_published`
- ✅ `order_placed`
- ❌ `signup` (missing noun)
- ❌ `create_dish` (not past tense)

### Seller Journey Events

#### 1. Authentication & Onboarding

| Event Name | Description | Properties | Trigger Point |
|------------|-------------|------------|---------------|
| `seller_signed_up` | New seller account created | `signup_source`: 'web' \| 'ios' \| 'android'<br>`signup_method`: 'phone' \| 'email' | After OTP verification |
| `business_created` | Seller created first business profile | `business_type`: 'homeKitchen' \| 'cloudKitchen' \| 'restaurant' \| 'catering'<br>`location_set`: boolean | After business form submitted |
| `onboarding_completed` | Seller completed full onboarding flow | `time_to_complete_minutes`: number<br>`steps_completed`: number | After first menu published |

#### 2. Menu Management

| Event Name | Description | Properties | Trigger Point |
|------------|-------------|------------|---------------|
| `dish_created` | New dish added to menu | `has_image`: boolean<br>`allergens_count`: number<br>`from_template`: boolean<br>`category_set`: boolean | After dish saved |
| `dish_category_created` | Seller created custom dish category | `category_name`: string<br>`is_default`: boolean | After category saved |
| `dish_imported_from_template` | Dish created from common template | `common_dish_id`: string<br>`common_dish_name`: string | After template selected |
| `menu_published` | Menu made live for customers | `dish_count`: number<br>`has_delivery_options`: boolean<br>`time_from_signup_hours`: number | After "Publish" clicked |
| `menu_updated` | Changes made to published menu | `dishes_added`: number<br>`dishes_removed`: number<br>`prices_changed`: number | After update saved |

#### 3. Order Management

| Event Name | Description | Properties | Trigger Point |
|------------|-------------|------------|---------------|
| `order_received` | New order arrived for seller | `order_value_cents`: number<br>`item_count`: number<br>`delivery_type`: 'pickup' \| 'delivery'<br>`payment_method`: 'cash' \| 'online' | When order created |
| `order_confirmed` | Seller accepted order | `time_to_confirm_minutes`: number | After "Confirm" clicked |
| `order_rejected` | Seller declined order | `rejection_reason`: string | After "Reject" clicked |
| `order_completed` | Order marked as fulfilled | `time_to_complete_minutes`: number | After "Complete" clicked |

### Customer Journey Events

#### 4. Menu Discovery & Ordering

| Event Name | Description | Properties | Trigger Point |
|------------|-------------|------------|---------------|
| `menu_viewed` | Customer opened menu page | `business_id`: string<br>`source`: 'qr_code' \| 'link' \| 'direct' | Page load |
| `dish_viewed` | Customer viewed dish details | `dish_id`: string<br>`price_cents`: number | Dish clicked |
| `cart_item_added` | Item added to cart | `dish_id`: string<br>`quantity`: number | "Add to Cart" clicked |
| `order_placed` | Customer submitted order | `order_value_cents`: number<br>`item_count`: number<br>`delivery_type`: string<br>`payment_method`: string | After order submitted |
| `order_paid` | Payment completed successfully | `order_id`: string<br>`payment_method`: string<br>`amount_cents`: number | After payment confirmation |
| `reorder_clicked` | Customer re-ordered from history | `original_order_id`: string<br>`days_since_last_order`: number | "Reorder" button clicked |

### System Performance Events

#### 5. Technical Metrics

| Event Name | Description | Properties | Trigger Point |
|------------|-------------|------------|---------------|
| `api_request_slow` | API endpoint exceeded latency threshold | `endpoint`: string<br>`duration_ms`: number<br>`threshold_ms`: number | When p95 > 500ms |
| `image_upload_failed` | Image upload encountered error | `error_code`: string<br>`file_size_kb`: number | Upload error |
| `payment_failed` | Payment processing failed | `payment_method`: string<br>`error_code`: string<br>`retry_count`: number | Payment error |

## Custom Metrics (Aggregated)

These are computed metrics tracked daily/weekly for reporting:

| Metric Name | Calculation | Target (Phase 1) | Target (Phase 2) |
|-------------|-------------|------------------|------------------|
| `time_to_first_listing` | Hours from signup to first menu published | <24 hours | <12 hours |
| `sellers_onboarded_weekly` | Count of `business_created` events per week | 10/week | 50/week |
| `orders_per_seller_weekly` | Avg orders per active seller per week | 5/week | 20/week |
| `repeat_order_rate_7d` | % customers who order 2+ times in 7 days | 15% | 25% |
| `repeat_order_rate_30d` | % customers who order 2+ times in 30 days | 30% | 50% |
| `crash_free_rate_mobile` | % sessions without crashes (mobile) | 99% | 99.5% |
| `api_p95_latency` | 95th percentile API response time | <500ms | <300ms |

## User Properties (Segmentation)

Track these properties for each user to enable segmentation in Firebase Analytics:

### Seller Properties

```typescript
{
  user_id: string,           // Unique seller ID
  business_type: string,      // 'homeKitchen', 'cloudKitchen', etc.
  signup_date: string,        // ISO8601 date
  location_city: string,      // 'Bangalore', 'Mumbai', etc.
  total_dishes: number,       // Current dish count
  total_orders: number,       // Lifetime orders received
  subscription_tier: string,  // 'free', 'pro', 'enterprise' (future)
  last_active_date: string    // ISO8601 date
}
```

### Customer Properties

```typescript
{
  user_id: string,           // Anonymous or authenticated ID
  first_order_date: string,  // ISO8601 date
  total_orders: number,      // Lifetime orders placed
  total_spent_cents: number, // Lifetime order value
  favorite_business_id: string, // Most frequently ordered from
  last_order_date: string    // ISO8601 date
}
```

## Implementation

### Backend (Node.js)

**Firebase Admin SDK** for server-side event tracking:

```typescript
import admin from 'firebase-admin';

// Initialize (once at startup)
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  })
});

// Track event
export function trackEvent(userId: string, eventName: string, properties: object) {
  // Log to Analytics via Measurement Protocol
  // (Firebase Admin SDK doesn't have direct Analytics API, use HTTP)

  // Also log to Winston for debugging
  logger.info('Analytics event', {
    context: {
      event_name: eventName,
      user_id: userId,
      properties
    }
  });
}

// Example: Track order placed
trackEvent(seller.id, 'order_received', {
  order_value_cents: order.totalCents,
  item_count: order.items.length,
  delivery_type: order.deliveryType,
  payment_method: order.paymentMethod
});
```

**Alternative: Direct HTTP to Firebase Measurement Protocol**

```typescript
import axios from 'axios';

async function trackFirebaseEvent(
  userId: string,
  eventName: string,
  properties: object
) {
  await axios.post(
    `https://www.google-analytics.com/mp/collect?firebase_app_id=${process.env.FIREBASE_APP_ID}&api_secret=${process.env.FIREBASE_API_SECRET}`,
    {
      app_instance_id: userId,
      events: [{
        name: eventName,
        params: properties
      }]
    }
  );
}
```

### Web (React)

**Firebase Web SDK**:

```typescript
import { initializeApp } from 'firebase/app';
import { getAnalytics, logEvent } from 'firebase/analytics';

// Initialize (once at app startup)
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Track event
export function trackEvent(eventName: string, properties?: object) {
  logEvent(analytics, eventName, properties);
}

// Example: Track dish created
trackEvent('dish_created', {
  has_image: !!dish.imageUrl,
  allergens_count: dish.allergens.length,
  from_template: !!dish.commonDishId,
  category_set: !!dish.categoryId
});
```

**Automatic Page View Tracking**:

```typescript
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { logEvent } from 'firebase/analytics';

function usePageTracking() {
  const location = useLocation();

  useEffect(() => {
    logEvent(analytics, 'page_view', {
      page_path: location.pathname,
      page_title: document.title
    });
  }, [location]);
}

// Use in App.tsx
function App() {
  usePageTracking();
  return <Router>...</Router>;
}
```

### Mobile (React Native)

**React Native Firebase**:

```bash
npm install @react-native-firebase/app
npm install @react-native-firebase/analytics
npm install @react-native-firebase/crashlytics
npm install @react-native-firebase/perf
```

**Configuration**:

```typescript
import analytics from '@react-native-firebase/analytics';
import crashlytics from '@react-native-firebase/crashlytics';
import perf from '@react-native-firebase/perf';

// Track event
export async function trackEvent(eventName: string, properties?: object) {
  await analytics().logEvent(eventName, properties);
}

// Track screen view (automatic via React Navigation)
import { useNavigationContainerRef } from '@react-navigation/native';

const navigationRef = useNavigationContainerRef();
const routeNameRef = useRef<string>();

<NavigationContainer
  ref={navigationRef}
  onReady={() => {
    routeNameRef.current = navigationRef.getCurrentRoute()?.name;
  }}
  onStateChange={async () => {
    const previousRouteName = routeNameRef.current;
    const currentRouteName = navigationRef.getCurrentRoute()?.name;

    if (previousRouteName !== currentRouteName) {
      await analytics().logScreenView({
        screen_name: currentRouteName,
        screen_class: currentRouteName
      });
    }

    routeNameRef.current = currentRouteName;
  }}
>
  {/* app routes */}
</NavigationContainer>

// Set user properties
await analytics().setUserProperty('business_type', 'homeKitchen');
await analytics().setUserId(user.id);

// Log crash
crashlytics().recordError(error);

// Performance monitoring
const trace = await perf().startTrace('dish_image_upload');
await uploadImage(file);
await trace.stop();
```

## Crash Reporting Setup

### iOS (Crashlytics)

**Automatic crash collection** enabled by default after Firebase setup.

**Configuration** (ios/Podfile):
```ruby
pod 'Firebase/Crashlytics'
```

**Manual error logging**:
```typescript
import crashlytics from '@react-native-firebase/crashlytics';

try {
  await riskyOperation();
} catch (error) {
  crashlytics().recordError(error);
  throw error;
}

// Add custom keys for context
crashlytics().log('User attempted to upload large image');
crashlytics().setAttribute('image_size_mb', String(fileSizeMB));
```

### Android (Crashlytics)

**Automatic crash collection** enabled by default.

**Configuration** (android/app/build.gradle):
```gradle
apply plugin: 'com.google.firebase.crashlytics'
```

### Web (Sentry)

Firebase Crashlytics doesn't support web, so use **Sentry** for frontend error tracking:

```typescript
import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

Sentry.init({
  dsn: process.env.REACT_APP_SENTRY_DSN,
  integrations: [new BrowserTracing()],
  tracesSampleRate: 0.1, // 10% performance traces
  environment: process.env.NODE_ENV
});

// Errors automatically captured
// Manual capture:
Sentry.captureException(error);
```

### Backend (Sentry)

```typescript
import * as Sentry from '@sentry/node';
import * as Tracing from '@sentry/tracing';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1, // 10% performance traces
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Tracing.Integrations.Express({ app })
  ]
});

// Express middleware (must be first)
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());

// Routes...

// Error handler (must be last)
app.use(Sentry.Handlers.errorHandler());
```

## Performance Monitoring Targets

### Mobile Cold Start Time

**Target**: <2 seconds (iOS/Android)

**Measurement**:
```typescript
import perf from '@react-native-firebase/perf';

// Automatically tracked by Firebase Performance Monitoring
// View in Firebase Console → Performance → App start
```

### API Latency

**Target**: p95 <500ms

**Measurement**:
```typescript
// Custom trace in backend
import * as Sentry from '@sentry/node';

app.use((req, res, next) => {
  const transaction = Sentry.startTransaction({
    op: 'http.server',
    name: `${req.method} ${req.path}`
  });

  res.on('finish', () => {
    transaction.setHttpStatus(res.statusCode);
    transaction.finish();
  });

  next();
});
```

### Web Page Load Time

**Target**: Lighthouse score >90

**Measurement**: Firebase Performance Monitoring automatically tracks:
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Cumulative Layout Shift (CLS)

## Alerting Rules

### Critical Alerts (PagerDuty/Slack)

1. **Crash-Free Rate Drops Below 99%** (Mobile)
   - Trigger: Hourly crash-free rate <99%
   - Action: Immediate Slack alert to eng team

2. **Payment Failures Spike** (Backend)
   - Trigger: >10 `payment_failed` events in 10 minutes
   - Action: Page on-call engineer

3. **API Error Rate Spike** (Backend)
   - Trigger: >5% of requests return 5xx in 5 minutes
   - Action: Immediate PagerDuty alert

### Warning Alerts (Email)

4. **Slow API Endpoints**
   - Trigger: p95 latency >1s for any endpoint
   - Action: Daily email summary to eng team

5. **Onboarding Drop-Off**
   - Trigger: <50% of signups complete onboarding in 24h
   - Action: Daily email to product team

## Privacy & Compliance

### Data Collection Policy

**What We Track**:
- ✅ User actions (clicks, page views, orders)
- ✅ Device info (OS version, device model, screen size)
- ✅ Performance metrics (latency, crashes, errors)
- ✅ Business metrics (order values, dish counts)

**What We DON'T Track**:
- ❌ Full request/response bodies
- ❌ Unmasked PII (see logging-strategy.md for masking rules)
- ❌ Payment card details
- ❌ Raw passwords or auth tokens

### GDPR Compliance

**User Data Deletion**:
```typescript
// When user requests data deletion
await analytics().resetAnalyticsData(); // Mobile
await admin.auth().deleteUser(userId);  // Backend
```

**Data Retention**:
- Firebase Analytics: 60 days (configurable)
- Crashlytics: 90 days
- Sentry: 30 days (free tier)

## Reporting & Dashboards

### Firebase Analytics Console

Access: [https://console.firebase.google.com/project/menumaker/analytics](https://console.firebase.google.com/project/menumaker/analytics)

**Pre-built Reports**:
1. **Events** → Track all custom events (seller_signed_up, order_placed, etc.)
2. **Conversions** → Set up funnels:
   - Signup → Business Created → Menu Published
   - Menu Viewed → Cart Item Added → Order Placed
3. **User Properties** → Segment by business_type, location_city, etc.
4. **Retention** → 7-day, 30-day cohort retention

### Custom BigQuery Export (Phase 2+)

For advanced analysis, export Firebase Analytics to BigQuery:

```sql
-- Example: Calculate time-to-first-listing
SELECT
  user_pseudo_id,
  TIMESTAMP_DIFF(
    MAX(IF(event_name = 'menu_published', event_timestamp, NULL)),
    MIN(IF(event_name = 'seller_signed_up', event_timestamp, NULL)),
    HOUR
  ) AS hours_to_first_listing
FROM `menumaker.analytics_123456789.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20250101' AND '20250131'
GROUP BY user_pseudo_id
HAVING hours_to_first_listing IS NOT NULL;
```

## Testing & Validation

### Debug View (Development)

Enable Firebase Analytics Debug View to see events in real-time:

**Web**:
```bash
# Install Chrome extension: Firebase Analytics Debugger
# Enable debug mode in console:
window.gtag('set', 'debug_mode', true);
```

**Mobile**:
```bash
# iOS
adb shell setprop debug.firebase.analytics.app com.menumaker.app

# Android
adb shell setprop debug.firebase.analytics.app com.menumaker.app
```

### Event Validation

**Unit tests** to ensure events are tracked correctly:

```typescript
import { trackEvent } from './analytics';

jest.mock('firebase/analytics');

test('tracks dish_created event with correct properties', () => {
  const dish = { id: '123', imageUrl: 'https://...', allergens: ['dairy'], categoryId: 'cat1' };

  trackEvent('dish_created', {
    has_image: true,
    allergens_count: 1,
    from_template: false,
    category_set: true
  });

  expect(logEvent).toHaveBeenCalledWith(
    expect.anything(),
    'dish_created',
    expect.objectContaining({ has_image: true })
  );
});
```

## Cost Estimates

| Service | Tier | Volume (MVP) | Volume (Phase 2) | Cost |
|---------|------|--------------|------------------|------|
| Firebase Analytics | Free | Unlimited events | Unlimited events | $0 |
| Firebase Crashlytics | Free | Unlimited crashes | Unlimited crashes | $0 |
| Firebase Performance | Free | Unlimited traces | Unlimited traces | $0 |
| Sentry (Backend/Web) | Free | 5K errors/month | 50K errors/month | $0 → $26/month |
| **Total** | | | | **$0 → $26/month** |

## Migration Path (If Needed)

If Firebase becomes insufficient (unlikely for MVP/Phase 2), migration path:

1. **Phase 3+**: Add Amplitude for advanced product analytics
   - Keep Firebase for crash reporting
   - Dual-track events to both platforms during migration
   - Cost: ~$2,000/year for 50M events

2. **Phase 3+**: Add Datadog for APM
   - Keep Sentry for error tracking
   - Distributed tracing for microservices
   - Cost: ~$15/host/month

## Future Enhancements (Phase 2+)

- **A/B Testing**: Firebase Remote Config for feature flags
- **Session Recording**: Integrate LogRocket or Hotjar (web only)
- **User Feedback**: In-app surveys via Firebase In-App Messaging
- **Predictive Analytics**: ML models to predict churn, recommend pricing

## References

- [Firebase Analytics Documentation](https://firebase.google.com/docs/analytics)
- [Firebase Crashlytics Documentation](https://firebase.google.com/docs/crashlytics)
- [Sentry Node.js Documentation](https://docs.sentry.io/platforms/node/)
- [React Native Firebase](https://rnfirebase.io/)

---

**Status**: ✅ Ready for Implementation (Phase 1)
**Owner**: Full-Stack Team (Web + Mobile + Backend)
**Dependencies**: Firebase project setup, Sentry account creation
