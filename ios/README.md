# MenuMaker iOS App

Native iOS application for MenuMaker - Restaurant Menu Management & Ordering System.

## 🍎 Overview

**Status**: launch-scope local implementation evidence exists; public production readiness is governed by [../docs/product/status.md](../docs/product/status.md).

MenuMaker iOS app provides a complete native experience for sellers and customers with:
- **100% Swift 5.9+** - Modern, type-safe code
- **SwiftUI** - Declarative UI framework (iOS 17+)
- **Offline-first** - Work without internet, sync when online
- **Push notifications** - Real-time order updates via APNs
- **Biometric authentication** - Face ID / Touch ID
- **Multi-language** - English, Hindi, Tamil
- **Performance optimized** - < 1.5s cold start
- **Feature parity with Android** - All features implemented

## 🏗️ Architecture

### Technology Stack

- **Language**: Swift 5.9+
- **UI**: SwiftUI
- **Architecture**: MVVM (Model-View-ViewModel)
- **Reactive**: Combine + async/await
- **Networking**: URLSession (native)
- **Local Storage**: SwiftData
- **Secure Storage**: Keychain Services
- **Maps**: MapKit
- **Payments**: provider-tokenized payment flows; paid subscription/StoreKit flows are launch-gated
- **Push**: UserNotifications + APNs
- **Testing**: XCTest + XCUITest

### Project Structure

```
ios/
├── MenuMaker/
│   ├── App/                    # App entry point
│   ├── Core/                   # Core infrastructure
│   │   ├── Networking/         # API Client
│   │   ├── Storage/            # Keychain, SwiftData
│   │   └── Services/           # Location, Notifications
│   ├── Features/               # Feature modules
│   │   ├── Auth/               # Authentication
│   │   ├── Seller/             # Seller features
│   │   └── Customer/           # Customer features
│   ├── Shared/                 # Shared components
│   │   ├── Models/             # Data models
│   │   ├── Components/         # Reusable views
│   │   ├── Theme/              # Design system
│   │   └── Constants/          # App constants
│   └── Resources/              # Assets, Localization
├── MenuMakerTests/             # Unit tests
├── MenuMakerUITests/           # UI tests
└── Widgets/                    # Home screen widgets
```

## 🚀 Getting Started

### Prerequisites

- Xcode 15+ (macOS)
- iOS 17+ device or simulator
- Apple Developer account (for device testing)

### Setup

1. **Open in Xcode**
   ```bash
   cd ios
   open MenuMaker.xcodeproj
   ```

2. **Configure backend API**
   - Edit scheme → Run → Arguments → Environment Variables
   - Add: `API_BASE_URL = http://localhost:3001/api/v1`

3. **Build & Run**
   - Select simulator or device
   - Press ⌘R to run

## 🧪 Testing

### Unit Tests
```bash
xcodebuild test -scheme MenuMaker -destination 'platform=iOS Simulator,name=iPhone 15'
```

### UI Tests
```bash
xcodebuild test -scheme MenuMakerUITests -destination 'platform=iOS Simulator,name=iPhone 15'
```

## 📦 Building

### Debug Build
```bash
xcodebuild -scheme MenuMaker -configuration Debug
```

### Release Build
```bash
xcodebuild -scheme MenuMaker -configuration Release archive
```

## 🎨 Design

### Design System
- **Colors**: Orange primary, dynamic system colors
- **Typography**: SF Pro (system font)
- **Spacing**: 8pt grid system
- **Corner radius**: 12pt default
- **Icons**: SF Symbols

### Dark Mode
- Fully supported
- Auto-switches with system preference
- Custom dark color palette

## 📱 Feature posture

Current iOS release posture is governed by [../docs/product/status.md](../docs/product/status.md) and [../docs/product/capability-index.md](../docs/product/capability-index.md), not by historical phase labels.

### Launch-scope iOS features
- ✅ User authentication (email/password + biometric)
- ✅ Seller dashboard with real-time stats
- ✅ Order management (list, detail, status updates)
- ✅ Menu and dish editor (CRUD operations)
- ✅ Offline support with SwiftData
- ✅ Real-time synchronization
- ✅ Coupons & promotions
- ✅ Payment processors (Razorpay, Stripe, Paytm, PhonePe)
- ✅ Reviews & ratings system
- ✅ Re-order functionality
- ✅ WhatsApp notifications
- ✅ Marketplace discovery with MapKit
- ✅ Multi-language (English, Hindi, Tamil, Urdu, Arabic with RTL)
- ✅ Basic referral-code sharing without reward, leaderboard, or affiliate claims
- ✅ Advanced analytics
- ✅ Shopping cart and checkout
- ✅ Business management

### Disabled until separately enabled and evidenced

- ⛔ Subscriptions, paid-plan upgrades, trials, and billing portal flows
- ⛔ OCR menu import with camera
- ⛔ POS sync and third-party delivery partner integrations
- ⛔ Enhanced referral rewards, leaderboards, affiliate payouts, and prize campaigns
- ⛔ Tax reporting / GST invoice generation

### iOS-Specific
- ✅ Face ID / Touch ID authentication
- ✅ Apple Pay ready integration
- ✅ MapKit for location services
- ⛔ Vision Framework OCR flows are launch-gated until OCR is enabled with privacy/provider evidence
- ✅ UserNotifications for APNs
- 🔄 Siri Shortcuts (structure ready)
- 🔄 App Clips (structure ready)
- 🔄 Widgets (structure ready)
- 🔄 Apple Watch (planned Phase 4)

## 🔐 Security

- **JWT Tokens**: Stored in Keychain
- **HTTPS**: TLS 1.3 for all API calls
- **Certificate Pinning**: Optional
- **Biometric Auth**: Face ID / Touch ID
- **Data Protection**: File encryption when locked

## 📊 Performance

### Targets
- **Cold start**: < 1.5 seconds
- **Memory**: < 120 MB (typical usage)
- **Battery**: < 3% per hour (active use)
- **App size**: < 35 MB (estimated)

### Optimization
- Async/await for efficient networking
- Lazy loading with SwiftUI
- Image caching and compression
- SwiftData for local persistence
- Combine for reactive updates

## 📊 Implementation Status

**Current Status**: local launch-scope implementation evidence exists, but public production readiness is governed by [../docs/product/status.md](../docs/product/status.md).

- **Total Swift Files**: 60
- **Total Lines of Code**: ~10,000+
- **Architecture**: Clean Architecture + MVVM
- **Screens**: 10 (Authentication, Seller, Customer, Settings)
- **Repositories**: 12 (Full API integration)
- **ViewModels**: 11 (Complete business logic)
- **Services**: 9 (Core infrastructure)
- **Localization**: English, Hindi, Tamil (510 strings)
- **Utilities**: Comprehensive formatters, validators, extensions

### Core Layer (9 Services)
- ✅ APIClient - URLSession with token refresh
- ✅ KeychainManager - Secure credential storage
- ✅ LocationService - CoreLocation integration
- ✅ NotificationService - Push and local notifications
- ✅ AnalyticsService - Event tracking
- ✅ BiometricService - Face ID / Touch ID
- ✅ ImageService - Loading, caching, upload
- ✅ CameraService - Photo capture
- ⛔ OCRService - present for future Vision framework integration; launch-gated until OCR is enabled

### Data Layer (12 Repositories + 10 Models)
- ✅ Complete CRUD operations for all entities
- ✅ Offline-first architecture
- ✅ Error handling and retry logic
- ✅ Type-safe models with Codable

### View Layer (10 Screens)
- ✅ SwiftUI declarative UI
- ✅ Responsive layouts
- ✅ Dark mode support
- ✅ Accessibility support
- ✅ Localized strings

### Shared Components
- ✅ Reusable UI components
- ✅ Custom button styles
- ✅ Form fields and validation
- ✅ Loading and error states
- ✅ Navigation wrappers

## 🎯 Future Enhancements

- [ ] Siri Shortcuts implementation
- [ ] Home screen widgets
- [ ] App Clips for menu sharing
- [ ] Apple Watch companion app
- [ ] iMessage extension
- [ ] Advanced offline sync strategies

## 📄 License

MIT License - see [LICENSE](../LICENSE)

---

**Built with Swift 5.9+ + SwiftUI for iOS 17+**
**Status**: See [../docs/product/status.md](../docs/product/status.md) | **Version**: 1.0.0
