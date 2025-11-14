# MenuMaker iOS App Specification

**Branch**: `004-mobile-ios` | **Date**: 2025-11-10 | **Priority**: P2 (Post-MVP Phase 3.5+)  
**Timeline**: Phase 3.5 (Month 12–18) | **Deployment**: Apple App Store

---

## Executive Summary

MenuMaker iOS app provides a **native iOS experience** for both sellers and customers, building on the web PWA foundation established in Phase 1–3. The app prioritizes:
- **Seller Experience**: Quick menu updates, WhatsApp/real-time notifications, offline-capable order management
- **Customer Experience**: Discovery feed, saved favorites, one-tap re-order, Apple Pay integration
- **Platform Integration**: Siri Shortcuts, HomeKit (future), iMessage (future), Apple Watch (future)

The iOS app shares API contracts with the web backend (same OpenAPI spec) but uses native iOS frameworks for superior UX, performance, and platform integration.

**Technology**: SwiftUI + Combine, iOS 14+, native HTTP (URLSession), async/await

---

## Target Users & Use Cases

### Seller Use Cases
1. **Receive orders on the go** → Push notification, mark fulfilled in 5 seconds
2. **Quick menu edit** → Update prices/availability without opening laptop
3. **Offline order entry** → Seller at farmer's market, orders sync when online
4. **Real-time WhatsApp** → See customer messages in app, reply directly

### Customer Use Cases
1. **Browse sellers near me** → Map view, sorted by distance/rating
2. **Save favorite sellers** → Widget shows trending menus
3. **One-tap re-order** → Biometric authentication, Apple Pay ready
4. **Get notified of new menus** → Weekly reminder, push notification

---

## Feature Parity with Web PWA

### Core Features (100% Parity)
- ✅ Seller onboarding (email/password signup)
- ✅ Menu creation & editing (drag-drop dish reordering)
- ✅ Order capture (customer checkout flow)
- ✅ Order management (status updates, notes)
- ✅ Basic reporting (orders list, daily sales)
- ✅ Payment processor integration (Stripe webhooks)
- ✅ Subscription tier enforcement (free/pro/business)
- ✅ Delivery rules configuration
- ✅ Public menu viewing (non-authenticated customers)

### Phase 2 Features (100% Parity)
- ✅ WhatsApp notifications (push to iOS, tap to reply in WhatsApp)
- ✅ Tiered subscriptions (in-app purchase for trials, renewal)
- ✅ Re-order feature (stored locally, quick re-tap)
- ✅ OCR menu import (camera integration, image picker)
- ✅ Templated legal copy (browsable, download as PDF)

### Phase 3 Features (100% Parity)
- ✅ Multi-language (localized strings, RTL if Arabic)
- ✅ Advanced reporting (tax invoices downloadable as PDF)
- ✅ Reviews & ratings (view seller reviews, leave review with camera photos)
- ✅ Marketplace search (filtered search, saved searches)
- ✅ Promotions & coupons (coupon scanner QR code)

### Native-First Features (iOS Exclusive)
- 🍎 Siri Shortcuts (e.g., "Hey Siri, check my MenuMaker sales")
- 🍎 App Clips (instant app for sharing menus via QR code)
- 🍎 Widgets (home screen quick-order widget for customers)
- 🍎 iMessage (share menu via iMessage; future Phase 3.5+)
- 🍎 Apple Watch (quick status check, mark orders fulfilled; future Phase 3.5+)
- 🍎 Notification Groups (bundle multiple order notifications)

---

## iOS App Architecture

### Technology Stack
- **Language**: Swift 5.9+
- **UI Framework**: SwiftUI (declarative, modern)
- **Reactive Framework**: Combine (async, property-based)
- **HTTP Client**: URLSession (native, async/await)
- **Local Storage**: SwiftData (native persistence, CoreData replacement)
- **Authentication**: Keychain (secure token storage)
- **Image Processing**: CoreImage, Vision (on-device image resizing, OCR)
- **Camera**: AVFoundation (photo capture for menu import, review photos)
- **Notifications**: UserNotifications (local + remote push)
- **Payment**: StoreKit 2 (App Store In-App Purchases for subscriptions)
- **Analytics**: Firebase Analytics (optional; default: internal tracking)
- **Push Notifications**: Apple Push Notification (APNs)
- **Maps**: MapKit (seller discovery by location)
- **QR Code**: Vision framework (scan coupons, social preview codes)

### Project Structure
```
menumaker-ios/
├── MenuMaker.xcodeproj
├── Sources/
│   ├── App/
│   │   ├── MenuMakerApp.swift          # Entry point
│   │   ├── ContentView.swift           # Root view
│   │   └── Coordinator.swift           # Navigation logic
│   ├── Screens/
│   │   ├── Auth/
│   │   │   ├── SignupView.swift
│   │   │   ├── LoginView.swift
│   │   │   └── PasswordResetView.swift
│   │   ├── Seller/
│   │   │   ├── DashboardView.swift
│   │   │   ├── MenuEditorView.swift
│   │   │   ├── OrderListView.swift
│   │   │   ├── OrderDetailView.swift
│   │   │   └── ReportingView.swift
│   │   ├── Customer/
│   │   │   ├── MarketplaceView.swift
│   │   │   ├── SellerDetailView.swift
│   │   │   ├── CheckoutView.swift
│   │   │   ├── OrderHistoryView.swift
│   │   │   └── FavoritesView.swift
│   │   └── Shared/
│   │       ├── SettingsView.swift
│   │       ├── ProfileView.swift
│   │       └── NotificationsView.swift
│   ├── ViewModels/
│   │   ├── AuthViewModel.swift
│   │   ├── MenuViewModel.swift
│   │   ├── OrderViewModel.swift
│   │   ├── MarketplaceViewModel.swift
│   │   └── UserViewModel.swift
│   ├── Models/
│   │   ├── User.swift
│   │   ├── Business.swift
│   │   ├── Menu.swift
│   │   ├── Order.swift
│   │   ├── Dish.swift
│   │   └── (shared with backend via SpecKit)
│   ├── Services/
│   │   ├── APIService.swift            # HTTP client wrapper
│   │   ├── AuthService.swift           # Token management, Keychain
│   │   ├── NotificationService.swift   # Push notifications
│   │   ├── ImageService.swift          # Camera, image compression
│   │   ├── OCRService.swift            # Vision framework OCR
│   │   ├── LocationService.swift       # Core Location (marketplace)
│   │   ├── StorageService.swift        # SwiftData persistence
│   │   └── AnalyticsService.swift      # Tracking events
│   ├── Utilities/
│   │   ├── Constants.swift
│   │   ├── DateFormatter+Extensions.swift
│   │   ├── String+Extensions.swift
│   │   ├── Image+Extensions.swift
│   │   └── Error+Localization.swift
│   └── Resources/
│       ├── Localizable.strings         # English strings
│       ├── Localizable-hi.strings      # Hindi strings
│       ├── Localizable-ta.strings      # Tamil strings
│       ├── Assets.xcassets
│       │   ├── Colors/
│       │   ├── Icons/
│       │   └── Images/
│       └── Colors.xcassets             # Dynamic colors (dark mode)
├── Tests/
│   ├── Unit/
│   │   ├── AuthViewModelTests.swift
│   │   ├── MenuViewModelTests.swift
│   │   ├── OrderViewModelTests.swift
│   │   └── APIServiceTests.swift
│   ├── Integration/
│   │   ├── SignupFlowTests.swift
│   │   ├── OrderFlowTests.swift
│   │   └── MenuImportTests.swift
│   └── UI/
│       ├── SignupUITests.swift
│       ├── MenuEditorUITests.swift
│       └── CheckoutUITests.swift
├── Widgets/
│   ├── MenuMakerWidgets.swift          # Home screen widgets
│   ├── QuickOrderWidget.swift          # Re-order widget
│   └── MenuMakerWidgetsBundle.swift
├── AppClips/
│   ├── AppClip.swift                   # Instant app for sharing
│   └── MenuClipView.swift
├── Intents/
│   ├── MenuMakerIntents.swift          # Siri Shortcuts
│   └── OrderIntents.swift
├── Package.swift                       # Swift Package Manager (if using modules)
└── README.md

# Build Configuration
Xcode/
├── Build Settings
│   ├── iOS 14+ minimum deployment target
│   ├── Supported interface orientations (portrait + landscape)
│   └── Requires ARKit (optional; AR menu view future feature)
└── Provisioning Profiles
    ├── Development profile
    └── Distribution profile (App Store)
```

### Networking & Data Flow
```
┌──────────────────────────┐
│ SwiftUI View (State)     │
└──────────────┬───────────┘
               │
               ▼
┌──────────────────────────┐
│ ViewModel (Combine)      │ ObservableObject, @Published
│ - Fetches data           │ - Transforms API response
│ - Handles errors         │ - Pagination
└──────────────┬───────────┘
               │
               ▼
┌──────────────────────────┐
│ APIService               │
│ - HTTP (URLSession)      │
│ - Auth headers (JWT)     │
│ - Retry logic            │
└──────────────┬───────────┘
               │ HTTPS
               ▼
┌──────────────────────────┐
│ Backend API              │
│ (Node/Fastify)           │
│ /api/v1/orders, etc.     │
└──────────────────────────┘
```

---

## Key iOS-Specific Features

### 1. Seller Order Notifications
- **Push Notification**: Apple Push Notification (APNs)
  - Sent from backend when new order arrives
  - Includes order summary (dishes, total, customer name)
  - Sound + badge on app icon
- **Notification Actions**: Tap → app opens to OrderDetailView
- **Notification Groups**: Bundle multiple orders (e.g., "3 new orders")
- **In-App Notification**: Also shows banner if app is open

**Implementation**:
```swift
// Request user permission
UNUserNotificationCenter.current()
  .requestAuthorization(options: [.alert, .sound, .badge])

// Handle received notification
func userNotificationCenter(
  _ center: UNUserNotificationCenter,
  didReceive response: UNNotificationResponse,
  withCompletionHandler completionHandler: @escaping () -> Void
) {
  let orderId = response.notification.request.content.userInfo["orderId"]
  navigate(to: .orderDetail(id: orderId))
}
```

### 2. Biometric Authentication
- **Face ID / Touch ID**: Optional login (faster than password)
- **Keychain Storage**: JWT token stored securely
- **LocalAuthentication**: Use `canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics)`
- **Fallback**: Password login always available

**Implementation**:
```swift
let context = LAContext()
var error: NSError?

if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) {
  context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, 
                         localizedReason: "Sign in to MenuMaker") { success, _ in
    if success {
      // Retrieve JWT from Keychain, authenticated
    }
  }
}
```

### 3. Apple Pay Integration
- **In-App Purchase (IAP)**: Subscription renewal through App Store billing
- **Apple Pay**: Customer checkout with saved card (Phase 2+)
- **StoreKit 2**: Apple's modern in-app purchase framework
- **Transaction Verification**: Server-side verification of Apple receipts

**Implementation**:
```swift
import StoreKit

let products = try await Product.products(for: ["com.menumaker.pro", "com.menumaker.business"])
let result = try await purchase(product)

if case .success(let verification) = result {
  let transaction = try checkVerified(verification)
  // Update subscription on backend
  apiService.updateSubscription(tier: "pro", appleTransactionId: transaction.id)
}
```

### 4. Marketplace with MapKit
- **Map View**: Show sellers near customer location
- **Filtering**: Tap map pin → seller profile + menu
- **Clustering**: If many sellers close together, show cluster count
- **Saved Favorites**: Star icon to save seller locally
- **Location Permission**: Ask on first open ("Allow MenuMaker to access your location?")

**Implementation**:
```swift
@State var region = MKCoordinateRegion(
  center: CLLocationCoordinate2D(latitude: 19.0760, longitude: 72.8777), // Mumbai default
  span: MKCoordinateSpan(latitudeDelta: 0.05, longitudeDelta: 0.05)
)

Map(position: .constant(.region(region))) {
  ForEach(sellers) { seller in
    Marker(seller.name, coordinate: seller.coordinates)
      .onTapGesture {
        navigate(to: .sellerDetail(id: seller.id))
      }
  }
}
```

### 5. Camera Integration
- **Menu Import OCR**: Open camera → capture menu photo → OCR preview
- **Review Photos**: Customer taking photos of food for review
- **Avatar Upload**: Seller/customer profile photos
- **QR Code Scanning**: Scan coupon/social preview QR codes

**Implementation**:
```swift
struct CameraView: UIViewControllerRepresentable {
  func makeUIViewController(context: Context) -> UIImagePickerController {
    let picker = UIImagePickerController()
    picker.sourceType = .camera
    picker.delegate = context.coordinator
    return picker
  }
}

// OCR on captured image
let request = VNRecognizeTextRequest { request, _ in
  let observations = request.results as? [VNRecognizedTextObservation]
  let text = observations?.compactMap { $0.topCandidates(1).first?.string }.joined()
  // Send to backend for AI parsing
}
```

### 6. Home Screen Widgets
- **Quick Order Widget** (Medium): Show favorite seller + one-tap re-order
- **Sales Summary Widget** (Small): Today's orders count + revenue (seller)
- **Trending Menus Widget** (Large): Swipeable carousel of popular sellers

**Implementation** (WidgetKit):
```swift
struct MenuMakerWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(
      kind: "com.menumaker.quickorder",
      provider: Provider(),
      content: { entry in
        QuickOrderWidgetView(entry: entry)
      }
    )
    .configurationDisplayName("Quick Re-order")
    .description("One-tap re-order from your favorite seller")
    .supportedFamilies([.systemMedium])
  }
}
```

### 7. Siri Shortcuts
- **"Check my sales"** → Seller dashboard summary (today's orders, revenue)
- **"Place order with [seller name]"** → Open menu, start checkout
- **"Show my favorite menus"** → List saved sellers
- **"Create a menu"** → Launch menu editor

**Implementation** (App Intents):
```swift
struct CheckSalesIntent: AppIntent {
  static var title: LocalizedStringResource = "Check my sales"
  
  func perform() async throws -> some IntentResult {
    let orders = try await apiService.fetchTodaysOrders()
    let totalRevenue = orders.reduce(0) { $0 + $1.total }
    return .result(value: "You have \(orders.count) orders, Rs. \(totalRevenue)")
  }
}
```

---

## Performance Targets (iOS)

### Load Times
- **Cold start**: < 2 seconds (app launch to login screen)
- **Menu load**: < 1 second (5 dishes)
- **Order submission**: < 500ms (over 4G LTE)
- **Image compression**: < 200ms (camera to upload)

### Memory & Battery
- **Memory footprint**: < 150 MB (typical usage)
- **Battery drain**: < 5% per hour (active use)
- **Background sync**: Can run every 15 min without draining battery

### Network
- **Offline support**: 80% of screens viewable offline (seller: orders list, menu; customer: saved searches)
- **Sync**: Automatic when network restored
- **Data usage**: < 5 MB per month for typical seller (excl. images)

---

## Accessibility & Localization

### Accessibility (WCAG 2.1 Level A)
- **VoiceOver**: All UI elements labeled with accessibility identifiers
- **Dynamic Type**: Support for accessibility text sizes (Small → XXL)
- **Contrast**: 4.5:1 minimum for text; UI elements testable with Accessibility Inspector
- **Motion**: Respects `prefersReducedMotion` for animations

### Localization
- **Languages**: English (primary), Hindi, Tamil, Arabic (Phase 3+)
- **RTL Support**: Automatic mirroring for Arabic/Hebrew (via SwiftUI)
- **Date/Time Format**: Locale-specific (12-hour vs. 24-hour, date order)
- **Currency**: Locale-specific (Rs., $, €, etc.)

---

## Security

### Data Protection
- **Keychain**: JWT tokens stored with Data Protection (accessible when unlocked)
- **TLS 1.3**: All HTTPS connections use TLS 1.3 minimum
- **Certificate Pinning**: Optional (pin backend certificate for extra security)
- **Biometric Auth**: Touch ID/Face ID required to access sensitive data

### App Review Compliance
- **Privacy Policy**: Required in App Store listing (link to web version)
- **Terms & Conditions**: Required
- **Parental Controls**: Optional (restrict age-inappropriate content)
- **App Tracking Transparency**: If using analytics (Firebase), ask permission

---

## Testing Strategy

### Unit Tests
- API service error handling (network timeout, invalid response)
- ViewModel state transitions (loading → success → error)
- Date/currency formatting (locale-specific)

### Integration Tests
- SignUp → Menu creation → Order → Reporting flow
- OCR image capture → parsing → preview → import
- Payment processor webhook handling (order marked paid)

### UI Tests (XCUITest)
- Seller dashboard layout (responsive, landscape mode)
- Customer checkout (form validation, button interactions)
- Map view (pin placement, filtering)

### Performance Tests
- Cold start time (profiling with Xcode Instruments)
- Image loading performance (network throttling simulation)
- Memory leaks (Debug → Memory Graph)

---

## Beta Testing & App Store Submission

### TestFlight (Beta)
- Internal testers (team): 24 hours
- External testers (50–100 sellers): 2 weeks
- Feedback collection: In-app rating prompt + email survey

### App Store Submission
- **Build Number**: Incremented per submission
- **Version String**: Follows semantic versioning (1.0.0, 1.0.1, 1.1.0)
- **Screenshots**: 6–8 per device family (5.5" + 6.5" iPhones shown in US English)
- **App Description**: Marketing copy (max 4,000 chars)
- **Release Notes**: What's new in this version (max 4,000 chars)
- **Keywords**: 100 chars total (e.g., "food, menu, order, delivery")
- **Support URL**: Link to help docs
- **Privacy Policy URL**: Required

### Review Checklist
- ✅ No crashes (Xcode testing)
- ✅ No hardcoded API URLs (use config)
- ✅ All in-app purchase descriptions clear
- ✅ Privacy policy compliant with data collection
- ✅ Age rating appropriate
- ✅ Screenshots accurate to actual app
- ✅ No placeholder or test data visible

---

## Success Metrics (iOS App)

- ✅ 1,000 iOS downloads by Month 2 (Phase 3.5+2)
- ✅ 4.5+ star rating (min 100 reviews)
- ✅ 20% monthly active user (MAU) rate
- ✅ 5% daily active user (DAU) rate
- ✅ Crash-free users: 99%+ (no critical crashes)
- ✅ Push notification opt-in rate: > 70%
- ✅ In-app subscription conversion: > 3% of free users

---

## Out of Scope (Phase 3.5+)

- Apple Watch app (Phase 4)
- iMessage app extension (Phase 4)
- Augmented Reality menu preview (Phase 4+)
- HomeKit integration (future)
- SiriKit for complex workflows (future)

---

## Next Steps

1. **Design phase**: Figma mockups (high-fidelity) for all 10 screens
2. **Setup Xcode project**: Create repo, pods (CocoaPods or SPM), CI/CD (GitHub Actions)
3. **Implement core screens**: Auth → Seller Dashboard → Order Management
4. **Beta testing**: 50 internal sellers (2 weeks)
5. **App Store submission**: Submit for review (1–3 weeks review time)

---

**Ready for**: Design → Development → Beta → App Store submission

