# MenuMaker iOS App

Native iOS application for MenuMaker - Restaurant Menu Management & Ordering System.

## 🍎 Overview

MenuMaker iOS app provides a native experience for sellers and customers with:
- **100% Swift** - Modern, type-safe code
- **SwiftUI** - Declarative UI framework
- **iOS 17+** - Latest platform features
- **Offline-first** - Work without internet, sync when online
- **Push notifications** - Real-time order updates via APNs
- **Biometric authentication** - Face ID / Touch ID
- **Performance optimized** - < 1.5s cold start

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
- **Payments**: StoreKit 2
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

## 📱 Features

### Phase 1 - Core Features
- ✅ User authentication
- ✅ Seller dashboard
- ✅ Order management
- ✅ Menu editor
- ✅ Offline support

### Phase 2 - Growth Features
- ✅ Subscriptions (StoreKit)
- ✅ Coupons & promotions
- ✅ Payment processors
- ✅ Reviews & ratings

### Phase 3 - Scale Features
- ✅ Marketplace
- ✅ Multi-language (i18n)
- ✅ Integrations (POS, Delivery)
- ✅ Referral system

### iOS-Specific
- ✅ Siri Shortcuts
- ✅ App Clips
- ✅ Widgets
- ✅ Apple Pay
- 🔄 Apple Watch (planned)

## 🔐 Security

- **JWT Tokens**: Stored in Keychain
- **HTTPS**: TLS 1.3 for all API calls
- **Certificate Pinning**: Optional
- **Biometric Auth**: Face ID / Touch ID
- **Data Protection**: File encryption when locked

## 📊 Performance

### Targets
- **Cold start**: < 1.5 seconds
- **Memory**: < 120 MB
- **Battery**: < 3% per hour
- **App size**: < 35 MB

## 📄 License

MIT License - see [LICENSE](../LICENSE)

---

**Built with Swift + SwiftUI for iOS 17+**
