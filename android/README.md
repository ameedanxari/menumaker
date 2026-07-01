# MenuMaker Android App

Native Android application for MenuMaker - Restaurant Menu Management & Ordering System.

## 📱 Overview

MenuMaker Android app provides a native mobile experience for sellers and customers with:
- **Offline-first architecture** - Work without internet, sync when online
- **Material Design 3** - Modern UI with dynamic theming
- **Push notifications** - Real-time order updates via FCM
- **Biometric authentication** - Face/fingerprint unlock
- **100% Kotlin** - Modern, type-safe code
- **Jetpack Compose** - Declarative UI framework

## 🏗️ Architecture

### Technology Stack

- **Language**: Kotlin 1.9+
- **UI**: Jetpack Compose + Material Design 3
- **Architecture**: MVVM (Model-View-ViewModel)
- **Dependency Injection**: Hilt
- **Networking**: Retrofit + OkHttp
- **Local Database**: Room
- **Async**: Kotlin Coroutines + Flow
- **Navigation**: Jetpack Navigation Compose
- **Image Loading**: Coil
- **Notifications**: Firebase Cloud Messaging
- **Background Work**: WorkManager

### Project Structure

```
android/
├── app/
│   ├── src/
│   │   ├── main/
│   │   │   ├── kotlin/com/menumaker/
│   │   │   │   ├── di/                  # Dependency Injection
│   │   │   │   │   ├── NetworkModule.kt
│   │   │   │   │   ├── DatabaseModule.kt
│   │   │   │   │   └── RepositoryModule.kt
│   │   │   │   ├── ui/
│   │   │   │   │   ├── theme/           # Material 3 Theme
│   │   │   │   │   ├── screens/         # Compose Screens
│   │   │   │   │   │   ├── auth/        # Login, Signup
│   │   │   │   │   │   ├── seller/      # Dashboard, Orders
│   │   │   │   │   │   └── customer/    # Marketplace
│   │   │   │   │   ├── components/      # Reusable UI
│   │   │   │   │   └── navigation/      # Nav Graph
│   │   │   │   ├── data/
│   │   │   │   │   ├── remote/          # API Service
│   │   │   │   │   │   ├── api/
│   │   │   │   │   │   └── models/
│   │   │   │   │   ├── local/           # Room Database
│   │   │   │   │   │   ├── db/
│   │   │   │   │   │   ├── entities/
│   │   │   │   │   │   └── datastore/
│   │   │   │   │   └── repository/      # Repositories
│   │   │   │   ├── viewmodel/           # ViewModels
│   │   │   │   ├── services/            # FCM, Background
│   │   │   │   ├── workers/             # WorkManager
│   │   │   │   └── utils/               # Helpers
│   │   │   └── res/                     # Resources
│   │   ├── test/                        # Unit Tests
│   │   └── androidTest/                 # Instrumentation Tests
│   ├── build.gradle.kts
│   └── proguard-rules.pro
├── build.gradle.kts
├── settings.gradle.kts
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Android Studio Hedgehog (2023.1.1) or later
- JDK 17
- Android SDK 34
- Minimum Android 11 (API 30)

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/ameedanxari/menumaker.git
   cd menumaker/android
   ```

2. **Configure Firebase**
   - **For Testing/CI**: A dummy `google-services.json` is included for running tests
   - **For Production**: Download real `google-services.json` from Firebase Console
   - Place production file in `android/app/` (it will override the dummy)
   - Update project configuration with your Firebase project
   - **Note**: The included file uses dummy credentials and won't work with real Firebase services

3. **Configure backend API**
   - Edit `local.properties` or set environment variable:
     ```
     API_BASE_URL=http://10.0.2.2:3001/api/v1
     ```
   - For physical device, use your machine's IP address

4. **Build & Run**
   ```bash
   ./gradlew assembleDebug
   ./gradlew installDebug
   ```

   Or use Android Studio:
   - Open `android/` folder
   - Click Run ▶️

## 🧪 Testing

### Unit Tests
```bash
./gradlew test
```

### Instrumentation Tests
```bash
./gradlew connectedAndroidTest
```

### Code Coverage
```bash
./gradlew testDebugUnitTestCoverage
```

## 📦 Building

### Debug Build
```bash
./gradlew assembleDebug
```

### Release Build
```bash
./gradlew assembleRelease
```

Output: `app/build/outputs/apk/release/app-release.apk`

### Bundle for Play Store
```bash
./gradlew bundleRelease
```

Output: `app/build/outputs/bundle/release/app-release.aab`

## 🔐 Security

- **JWT Tokens**: Stored in encrypted DataStore
- **HTTPS**: All API calls use TLS 1.3
- **ProGuard**: Code obfuscation in release builds
- **Certificate Pinning**: Optional (configure in NetworkModule)
- **Biometric Auth**: Android Keystore for secure storage

## 📱 Feature posture

Current Android release posture is governed by [../docs/product/status.md](../docs/product/status.md) and [../docs/product/capability-index.md](../docs/product/capability-index.md), not by historical phase labels.

### Launch-scope Android features
- ✅ User authentication (email/password + biometric)
- ✅ Seller dashboard with real-time stats
- ✅ Order management (list, detail, status updates)
- ✅ Menu and dish management (CRUD operations)
- ✅ Offline-first with Room caching
- ✅ WhatsApp order notifications
- ✅ Re-order functionality
- ✅ Coupons and promotions
- ✅ Multi-language support (English, Hindi, Tamil, Urdu, Arabic with RTL)
- ✅ Payment processor integration (Razorpay, Stripe, Paytm, PhonePe)
- ✅ Marketplace discovery with location
- ✅ Reviews and ratings system
- ✅ Basic referral-code sharing without reward, leaderboard, or affiliate claims
- ✅ Advanced analytics

### Disabled until separately enabled and evidenced

- ⛔ OCR menu import with camera
- ⛔ Subscription management, paid-plan upgrades, trials, and billing portal flows
- ⛔ Enhanced referral rewards, leaderboards, affiliate payouts, and prize campaigns
- ⛔ POS sync and third-party delivery partner integrations
- ⛔ Tax reporting / GST invoice generation

### Android-Specific ✅
- ✅ Material You dynamic theming
- ✅ Firebase Cloud Messaging (push notifications)
- ✅ Background sync with WorkManager
- ✅ Biometric authentication (fingerprint/face)
- ✅ Image processing and compression
- 🔄 Home screen widgets (planned)
- 🔄 Google Assistant shortcuts (planned)

## 🎨 Design

### Material Design 3
- Dynamic color from system wallpaper (Android 12+)
- Dark mode support
- Consistent spacing (4dp grid)
- Typography scales
- Elevation and shadows

### Theme Colors
- Primary: Orange (#FF9800)
- Secondary: Blue (#2196F3)
- Error: Red (#F44336)
- Success: Green (#4CAF50)

## 🔧 Configuration

### Build Variants
- **debug**: Development build with logging
- **release**: Production build with ProGuard

### Environment Variables
Set in `local.properties`:
```properties
API_BASE_URL=https://api.menumaker.app/api/v1
FIREBASE_PROJECT_ID=menumaker-prod
```

## 📊 Performance

### Targets
- **Cold start**: < 2.5 seconds
- **Memory**: < 180 MB (typical usage)
- **APK size**: < 50 MB
- **Battery**: < 6% per hour (active use)

### Optimization
- Lazy loading with Jetpack Navigation
- Image caching with Coil
- Database queries optimized with indices
- Background work batched via WorkManager

## 🐛 Debugging

### Enable Debug Logging
```kotlin
// In NetworkModule.kt
level = HttpLoggingInterceptor.Level.BODY
```

### View Database
Use Android Studio Database Inspector:
- Tools → Database Inspector
- Select running app
- View Room database tables

### Network Traffic
Use Android Studio Network Profiler:
- View → Tool Windows → Profiler
- Select app
- Click Network tab

## 📝 CI/CD

### GitHub Actions
Workflow: `.github/workflows/android-ci.yml`

- Runs on push to `claude/android-*` branches
- Builds debug APK
- Runs unit tests
- Uploads build artifacts

## 📄 License

MIT License - see [LICENSE](../LICENSE)

## 🙏 Support

- **Issues**: [GitHub Issues](https://github.com/ameedanxari/menumaker/issues)
- **Documentation**: See parent [README](../README.md)
- **Backend API**: See [backend documentation](../backend/README.md)

## 📊 Implementation Status

**Current Status**: launch-scope local implementation evidence exists; public production readiness is governed by [../docs/product/status.md](../docs/product/status.md).

- **Total Kotlin Files**: 76
- **Total Lines of Code**: ~15,000+
- **Architecture**: MVVM + Clean Architecture
- **Screens**: 9 (Authentication, Seller, Customer)
- **Repositories**: 12
- **ViewModels**: 10
- **Services**: 5 (Analytics, Biometric, Image, Location, FCM)
- **Multi-language**: English, Hindi, Tamil

## 🎯 Future Enhancements

- [ ] Home screen widgets
- [ ] Google Assistant shortcuts
- [ ] Wear OS companion app
- [ ] Android Auto integration
- [ ] Advanced offline sync strategies

---

**Built with Kotlin + Jetpack Compose for Android 11+**
**Status**: See [../docs/product/status.md](../docs/product/status.md) | **Version**: 1.0.0
