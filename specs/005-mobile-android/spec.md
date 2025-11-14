# MenuMaker Android App Specification

**Branch**: `005-mobile-android` | **Date**: 2025-11-10 | **Priority**: P2 (Post-MVP Phase 3.5+)  
**Timeline**: Phase 3.5 (Month 12–18) | **Deployment**: Google Play Store

---

## Executive Summary

MenuMaker Android app delivers a **native Android experience** for sellers and customers using Material Design 3, following the iOS app specification with platform-specific adaptations. The app prioritizes:
- **Seller Experience**: Quick order management, real-time WhatsApp integration, offline-first design
- **Customer Experience**: Marketplace discovery, saved favorites, instant one-tap re-order, Google Pay integration
- **Platform Integration**: Google Assistant shortcuts, Material You dynamic theming, Android widgets

The Android app shares 90% of API contracts with the iOS app and backend, differing only in UI/UX patterns (Material Design vs. Human Interface Guidelines).

**Technology**: Kotlin + Jetpack Compose, Android 11+, OkHttp, Coroutines, Room DB

---

## Target Users & Use Cases

### Seller Use Cases
1. **Instant order notification** → Push notification from Google Cloud Messaging (GCM)
2. **Quick price update** → Tap dish → change price → auto-save
3. **Offline order entry** → Seller at market, orders cached, synced when online
4. **WhatsApp business integration** → View & reply to customer messages in-app

### Customer Use Cases
1. **Discover nearby sellers** → Map view (Google Maps), sorted by distance/rating/cuisine
2. **Save favorite sellers** → Add to favorites; widget shows trending
3. **Re-order in one tap** → Biometric unlock, Google Pay saved card
4. **Get notified of new menus** → Weekly digest, instant push notification

---

## Feature Parity with iOS & Web PWA

### Core Features (100% Parity)
- ✅ Seller onboarding (email/password signup, SMS optional)
- ✅ Menu creation & editing (drag-drop dish ordering)
- ✅ Order capture (customer checkout flow)
- ✅ Order management (status updates, notes, marking fulfilled)
- ✅ Basic reporting (orders list, daily/weekly sales)
- ✅ Payment processor integration (Stripe, Razorpay, PhonePe webhooks)
- ✅ Subscription tier enforcement (free/pro/business)
- ✅ Delivery rules configuration
- ✅ Public menu viewing (non-authenticated customers)

### Phase 2 Features (100% Parity)
- ✅ WhatsApp Business API (push notification, deep link to WhatsApp)
- ✅ Tiered subscriptions (Google Play In-App Purchases, trials)
- ✅ Re-order feature (cached locally in Room DB)
- ✅ OCR menu import (camera integration, MediaStore access)
- ✅ Templated legal copy (browsable, PDF download)

### Phase 3 Features (100% Parity)
- ✅ Multi-language (English, Hindi, Tamil, Arabic with RTL support)
- ✅ Advanced reporting (tax invoices as PDF via PDF library)
- ✅ Reviews & ratings (view ratings, leave review with photo)
- ✅ Marketplace search (filters, saved searches in Room DB)
- ✅ Promotions & coupons (barcode/QR scanner)

### Android-Specific Features (Native-First)
- 🤖 Google Assistant shortcuts (voice: "Check my MenuMaker sales")
- 🤖 Material You dynamic theming (auto color from wallpaper)
- 🤖 App widgets (home screen quick-order, sales dashboard)
- 🤖 Wear OS support (quick status check; Phase 3.5+)
- 🤖 Android Auto (car display; Phase 3.5+)
- 🤖 Chat bubbles (WhatsApp-style notifications in Android 12+)

---

## Android App Architecture

### Technology Stack
- **Language**: Kotlin 1.9+ (modern, null-safe)
- **UI Framework**: Jetpack Compose (declarative, Material Design 3)
- **Reactive**: Kotlin Coroutines + Flow (async, reactive data)
- **HTTP Client**: OkHttp 4.x with Retrofit (typed HTTP client)
- **Local Storage**: Room Database (SQLite abstraction, type-safe)
- **Dependency Injection**: Hilt (compile-time DI, minimal runtime overhead)
- **Navigation**: Jetpack Navigation Compose (fragment-less)
- **Authentication**: Android Keystore (secure JWT storage)
- **Image Processing**: Coil (async image loading) + ML Kit (OCR)
- **Camera**: CameraX (modern camera API, backwards-compatible)
- **Notifications**: Firebase Cloud Messaging (FCM) + Rich Notification
- **Payment**: Google Play In-App Billing (GPIB v5.x)
- **Maps**: Google Maps SDK
- **QR Code**: ML Kit barcode detection (on-device)
- **Location**: Google Play Services (Fused Location Provider)
- **Analytics**: Firebase Analytics
- **Testing**: JUnit4 + Mockk + Espresso

### Project Structure
```
menumaker-android/
├── app/
│   ├── src/
│   │   ├── main/
│   │   │   ├── AndroidManifest.xml
│   │   │   ├── kotlin/com/menumaker/
│   │   │   │   ├── MenuMakerApplication.kt     # App initialization, Hilt
│   │   │   │   ├── MainActivity.kt             # Single activity, Navigation host
│   │   │   │   ├── di/                         # Dependency Injection
│   │   │   │   │   ├── NetworkModule.kt        # Retrofit, OkHttp
│   │   │   │   │   ├── RepositoryModule.kt     # Room DB bindings
│   │   │   │   │   ├── ServiceModule.kt        # API service bindings
│   │   │   │   │   └── FirebaseModule.kt       # Analytics, FCM
│   │   │   │   ├── ui/
│   │   │   │   │   ├── theme/
│   │   │   │   │   │   ├── Color.kt            # Material You colors
│   │   │   │   │   │   ├── Typography.kt       # Font scales
│   │   │   │   │   │   └── Theme.kt            # Compose theme
│   │   │   │   │   ├── screens/
│   │   │   │   │   │   ├── auth/
│   │   │   │   │   │   │   ├── SignupScreen.kt
│   │   │   │   │   │   │   ├── LoginScreen.kt
│   │   │   │   │   │   │   ├── BiometricAuthScreen.kt
│   │   │   │   │   │   │   └── PasswordResetScreen.kt
│   │   │   │   │   │   ├── seller/
│   │   │   │   │   │   │   ├── DashboardScreen.kt
│   │   │   │   │   │   │   ├── MenuEditorScreen.kt
│   │   │   │   │   │   │   ├── OrderListScreen.kt
│   │   │   │   │   │   │   ├── OrderDetailScreen.kt
│   │   │   │   │   │   │   ├── ReportingScreen.kt
│   │   │   │   │   │   │   └── OCRImportScreen.kt
│   │   │   │   │   │   ├── customer/
│   │   │   │   │   │   │   ├── MarketplaceScreen.kt
│   │   │   │   │   │   │   ├── SellerDetailScreen.kt
│   │   │   │   │   │   │   ├── MenuViewScreen.kt
│   │   │   │   │   │   │   ├── CheckoutScreen.kt
│   │   │   │   │   │   │   ├── OrderHistoryScreen.kt
│   │   │   │   │   │   │   └── ReviewScreen.kt
│   │   │   │   │   │   └── shared/
│   │   │   │   │   │       ├── SettingsScreen.kt
│   │   │   │   │   │       ├── ProfileScreen.kt
│   │   │   │   │   │       └── NotificationPrefsScreen.kt
│   │   │   │   │   ├── components/
│   │   │   │   │   │   ├── DishCard.kt
│   │   │   │   │   │   ├── OrderCard.kt
│   │   │   │   │   │   ├── SellerPin.kt
│   │   │   │   │   │   ├── BottomNavBar.kt
│   │   │   │   │   │   └── ErrorDialog.kt
│   │   │   │   │   └── navigation/
│   │   │   │   │       ├── NavGraph.kt
│   │   │   │   │       └── Destinations.kt
│   │   │   │   ├── viewmodel/
│   │   │   │   │   ├── AuthViewModel.kt
│   │   │   │   │   ├── MenuViewModel.kt
│   │   │   │   │   ├── OrderViewModel.kt
│   │   │   │   │   ├── MarketplaceViewModel.kt
│   │   │   │   │   ├── SellerViewModel.kt
│   │   │   │   │   └── ReviewViewModel.kt
│   │   │   │   ├── data/
│   │   │   │   │   ├── remote/
│   │   │   │   │   │   ├── api/
│   │   │   │   │   │   │   ├── ApiService.kt  # Retrofit interface
│   │   │   │   │   │   │   └── ApiClient.kt   # OkHttp config
│   │   │   │   │   │   └── models/
│   │   │   │   │   │       ├── OrderDto.kt
│   │   │   │   │   │       ├── MenuDto.kt
│   │   │   │   │   │       └── DishDto.kt
│   │   │   │   │   ├── local/
│   │   │   │   │   │   ├── db/
│   │   │   │   │   │   │   ├── MenuMakerDatabase.kt  # Room
│   │   │   │   │   │   │   ├── OrderDao.kt
│   │   │   │   │   │   │   ├── MenuDao.kt
│   │   │   │   │   │   │   └── DishDao.kt
│   │   │   │   │   │   ├── entities/
│   │   │   │   │   │   │   ├── OrderEntity.kt
│   │   │   │   │   │   │   ├── MenuEntity.kt
│   │   │   │   │   │   │   └── DishEntity.kt
│   │   │   │   │   │   └── datastore/
│   │   │   │   │   │       └── PreferencesDataStore.kt
│   │   │   │   │   └── repository/
│   │   │   │   │       ├── OrderRepository.kt
│   │   │   │   │       ├── MenuRepository.kt
│   │   │   │   │       └── UserRepository.kt
│   │   │   │   ├── services/
│   │   │   │   │   ├── AuthService.kt          # Token management
│   │   │   │   │   ├── NotificationService.kt  # FCM handling
│   │   │   │   │   ├── ImageService.kt         # Camera, ML Kit
│   │   │   │   │   ├── LocationService.kt      # Fused location
│   │   │   │   │   ├── AnalyticsService.kt     # Firebase tracking
│   │   │   │   │   └── OfflineSyncService.kt   # Sync when online
│   │   │   │   ├── utils/
│   │   │   │   │   ├── Constants.kt
│   │   │   │   │   ├── DateUtils.kt
│   │   │   │   │   ├── CurrencyUtils.kt
│   │   │   │   │   ├── ImageUtils.kt
│   │   │   │   │   ├── NetworkUtils.kt
│   │   │   │   │   └── LocalizationUtils.kt
│   │   │   │   └── workers/                    # Background work
│   │   │   │       ├── SyncWorker.kt           # WorkManager
│   │   │   │       └── NotificationWorker.kt
│   │   │   └── res/
│   │   │       ├── values/
│   │   │       │   ├── strings.xml             # English
│   │   │       │   ├── colors.xml
│   │   │       │   └── dimens.xml
│   │   │       ├── values-hi/
│   │   │       │   └── strings.xml             # Hindi
│   │   │       ├── values-ta/
│   │   │       │   └── strings.xml             # Tamil
│   │   │       ├── values-ar/
│   │   │       │   ├── strings.xml             # Arabic (RTL)
│   │   │       │   └── bool.xml                # layoutDirection=rtl
│   │   │       ├── drawable/
│   │   │       │   ├── ic_logo.svg
│   │   │       │   ├── ic_menu.svg
│   │   │       │   └── ...
│   │   │       └── layout/                     # Widget layouts
│   │   │           ├── quick_order_widget.xml
│   │   │           └── sales_widget.xml
│   │   ├── test/                               # Unit tests
│   │   │   ├── AuthViewModelTest.kt
│   │   │   ├── MenuViewModelTest.kt
│   │   │   ├── OrderRepositoryTest.kt
│   │   │   └── ApiServiceTest.kt
│   │   └── androidTest/                        # Instrumentation tests (UI)
│   │       ├── SignupScreenTest.kt
│   │       ├── OrderFlowTest.kt
│   │       └── CheckoutScreenTest.kt
│   ├── build.gradle.kts                        # App-level config
│   └── proguard-rules.pro                      # Code obfuscation
├── buildSrc/
│   ├── build.gradle.kts
│   └── src/main/kotlin/Dependencies.kt         # Centralized versions
├── gradle/wrapper/
│   └── gradle-wrapper.properties
├── build.gradle.kts                            # Project-level config
├── settings.gradle.kts
├── README.md
└── .github/workflows/
    ├── build.yml                               # Build on push
    ├── test.yml                                # Unit tests
    └── deploy.yml                              # Play Store deployment

# Key Dependencies (build.gradle.kts)
dependencies {
  // Jetpack
  implementation("androidx.compose.ui:ui:1.6.0")
  implementation("androidx.compose.material3:material3:1.2.0")
  implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.7.0")
  implementation("androidx.navigation:navigation-compose:2.7.0")
  
  // Network
  implementation("com.squareup.retrofit2:retrofit:2.11.0")
  implementation("com.squareup.okhttp3:okhttp:4.12.0")
  implementation("com.squareup.retrofit2:converter-kotlinx-serialization:2.11.0")
  
  // Local Storage
  implementation("androidx.room:room-runtime:2.6.1")
  implementation("androidx.datastore:datastore-preferences:1.1.0")
  
  // DI
  implementation("com.google.dagger:hilt-android:2.48")
  kapt("com.google.dagger:hilt-compiler:2.48")
  
  // Coroutines
  implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
  
  // Image Loading
  implementation("io.coil-kt:coil-compose:2.5.0")
  
  // ML Kit (OCR, barcode)
  implementation("com.google.mlkit:text-recognition:16.0.0")
  implementation("com.google.mlkit:barcode-scanning:17.0.0")
  
  // Firebase
  implementation("com.google.firebase:firebase-analytics:21.5.0")
  implementation("com.google.firebase:firebase-messaging:23.4.1")
  
  // Maps
  implementation("com.google.maps.android:maps-compose:4.3.0")
  implementation("com.google.android.gms:play-services-maps:18.2.0")
  
  // Payment
  implementation("com.android.billingclient:billing:6.1.0")
  
  // Testing
  testImplementation("junit:junit:4.13.2")
  testImplementation("org.mockito.kotlin:mockito-kotlin:5.1.0")
  androidTestImplementation("androidx.compose.ui:ui-test-junit4:1.6.0")
}
```

### Networking & Data Flow
```
┌──────────────────────────┐
│ Compose UI (State)       │
└──────────────┬───────────┘
               │
               ▼
┌──────────────────────────────┐
│ ViewModel (StateFlow)        │ ViewModel scope
│ - Fetches data via Repository│ - Transforms API response
│ - Handles errors             │ - Pagination
└──────────────┬────────────────┘
               │
               ▼
┌──────────────────────────────┐
│ Repository                   │
│ - Room DB queries            │ Local-first architecture
│ - API calls via Retrofit     │ Sync when online
└──────────────┬────────────────┘
               │
      ┌────────┴────────┐
      ▼                 ▼
┌──────────────┐  ┌──────────────┐
│ Room DB      │  │ ApiService   │
│ (SQLite)     │  │ (Retrofit)   │
└──────────────┘  └──────┬───────┘
                         │ HTTPS
                         ▼
                  ┌──────────────────┐
                  │ Backend API      │
                  │ /api/v1/orders   │
                  └──────────────────┘
```

---

## Key Android-Specific Features

### 1. Google Cloud Messaging (FCM) Push Notifications
- **Push Service**: Firebase Cloud Messaging for new orders
- **Notification Channel**: Seller "Orders" channel (high priority, sound)
- **Rich Notification**: Order summary, image preview (dish photo)
- **Actions**: "Mark Fulfilled" button (reply action without opening app)
- **Chat Bubbles** (Android 12+): Notification displayed as bubble if app supports it

**Implementation**:
```kotlin
class MenuMakerFirebaseMessagingService : FirebaseMessagingService() {
  override fun onMessageReceived(message: RemoteMessage) {
    val orderId = message.data["orderId"]
    val total = message.data["total"]
    
    val intent = Intent(this, MainActivity::class.java).apply {
      putExtra("orderId", orderId)
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
    }
    
    val notification = NotificationCompat.Builder(this, "ORDERS_CHANNEL")
      .setSmallIcon(R.drawable.ic_notification)
      .setContentTitle("New Order")
      .setContentText("Rs. $total from ${message.data["customerName"]}")
      .setStyle(NotificationCompat.BigTextStyle())
      .setContentIntent(PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE))
      .setAutoCancel(true)
      .build()
    
    NotificationManagerCompat.from(this).notify(1, notification)
  }
}
```

### 2. Biometric Authentication (BiometricPrompt)
- **Fingerprint / Face Unlock**: Optional (faster than password)
- **Keystore**: JWT token encrypted in Android Keystore
- **Fallback**: Password always available
- **Support**: API 28+ (native BiometricPrompt, no legacy APIs)

**Implementation**:
```kotlin
fun showBiometricPrompt() {
  val biometricPrompt = BiometricPrompt(
    this,
    Executors.newSingleThreadExecutor(),
    object : BiometricPrompt.AuthenticationCallback() {
      override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
        val jwt = keystoreService.retrieveToken()
        authViewModel.setAuthenticated(jwt)
      }
    }
  )
  
  val promptInfo = BiometricPrompt.PromptInfo.Builder()
    .setTitle("Sign in to MenuMaker")
    .setAllowedAuthenticators(BIOMETRIC_STRONG or DEVICE_CREDENTIAL)
    .build()
  
  biometricPrompt.authenticate(promptInfo)
}
```

### 3. Google Play In-App Purchases
- **Subscription Management**: Free → Pro → Business tiers
- **Trial Period**: 30-day free trial (managed by Google Play)
- **Billing Cycle**: Monthly or annual
- **Server-Side Verification**: Receipt validation on backend

**Implementation**:
```kotlin
val billingClient = BillingClient.newBuilder(context)
  .setListener { billingResult, purchases ->
    if (billingResult.responseCode == BillingResponseCode.OK && purchases != null) {
      for (purchase in purchases) {
        if (purchase.purchaseState == Purchase.PurchaseState.PURCHASED) {
          verifyAndConsumeOrAcknowledge(purchase)
        }
      }
    }
  }
  .enablePendingPurchases()
  .build()

billingClient.startConnection(object : BillingClientStateListener {
  override fun onBillingSetupFinished(billingResult: BillingResult) {
    billingClient.queryProductDetailsAsync(
      QueryProductDetailsParams.Builder()
        .setProductList(listOf(
          QueryProductDetailsParams.Product.newBuilder()
            .setProductId("com.menumaker.pro")
            .setProductType(BillingClient.ProductType.SUBS)
            .build()
        ))
        .build()
    ) { billingResult, productDetails ->
      // Display pricing options
    }
  }
})
```

### 4. Google Maps Integration
- **Marketplace Map**: Show sellers near customer location
- **Clustering**: If >10 sellers in area, show cluster count
- **Info Windows**: Tap marker → seller name, rating, cuisine
- **Filtering**: Filter by distance, rating, cuisine type

**Implementation**:
```kotlin
GoogleMapComposable(
  modifier = Modifier.fillMaxSize(),
  cameraPositionState = rememberCameraPositionState {
    position = CameraPosition.fromLatLngZoom(LatLng(19.0760, 72.8777), 15f)
  }
) {
  sellers.forEach { seller ->
    Marker(
      state = MarkerState(position = LatLng(seller.lat, seller.lon)),
      title = seller.name,
      snippet = "${seller.rating}⭐ • ${seller.cuisine}",
      onClick = {
        navigateToSellerDetail(seller.id)
        true
      }
    )
  }
}
```

### 5. Camera Integration (CameraX)
- **Menu Import**: Capture menu image → ML Kit OCR → preview → import
- **Review Photos**: Customer taking food photos
- **QR Code**: Barcode scanning (coupons, social previews)
- **Avatar Upload**: Profile photo capture

**Implementation**:
```kotlin
val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
val cameraProvider = cameraProviderFuture.get()

val preview = Preview.Builder().build()
val imageCapture = ImageCapture.Builder()
  .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
  .build()

val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

try {
  cameraProvider.unbindAll()
  cameraProvider.bindToLifecycle(this, cameraSelector, preview, imageCapture)
} catch (e: Exception) {
  Log.e("CameraX", "Camera binding failed", e)
}

// Capture and process with ML Kit
imageCapture.takePicture(
  ContextCompat.getMainExecutor(context),
  object : ImageCapture.OnImageCapturedCallback() {
    override fun onCaptureSuccess(image: ImageProxy) {
      val bitmap = image.toBitmap()
      performOCR(bitmap)
      image.close()
    }
  }
)
```

### 6. Material You Dynamic Theming
- **Wallpaper Colors**: Extract dominant color from device wallpaper
- **Accent Colors**: Auto-generated Material 3 palette from wallpaper
- **Dark Mode**: Automatic based on system settings
- **Contrast**: High-contrast mode support (accessibility)

**Implementation**:
```kotlin
@Composable
fun MenuMakerTheme(
  darkTheme: Boolean = isSystemInDarkTheme(),
  dynamicColor: Boolean = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S,
  content: @Composable () -> Unit
) {
  val colorScheme = when {
    dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
      val context = LocalContext.current
      if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
    }
    darkTheme -> darkColorScheme()
    else -> lightColorScheme()
  }
  
  MaterialTheme(colorScheme = colorScheme, content = content)
}
```

### 7. Home Screen Widgets
- **Quick Order Widget** (4x4): Favorite seller + one-tap checkout
- **Sales Summary Widget** (2x2): Today's orders count (seller)
- **Trending Menus Widget** (4x2): Carousel of trending sellers

**Implementation** (Glance):
```kotlin
class QuickOrderWidget : GlanceAppWidget() {
  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val seller = repository.getFavoriteSeller()
    val recentOrder = repository.getRecentOrder()
    
    provideContent {
      GlanceTheme {
        Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
          Text(seller.name, style = TextStyle(fontSize = 18.sp))
          Text("${recentOrder.items.size} items • Rs. ${recentOrder.total}")
          Button(text = "Re-order", onClick = {
            // Deep link to checkout
          })
        }
      }
    }
  }
}
```

### 8. Google Assistant Shortcuts
- **"Check my sales"** → Seller gets daily summary
- **"Place order with [seller]"** → Open menu, start checkout
- **"Show my favorites"** → List saved sellers

**Implementation** (App Actions):
```xml
<!-- res/xml/shortcuts.xml -->
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
  <shortcut android:shortcutId="check_sales">
    <intent
      android:action="android.intent.action.VIEW"
      android:targetPackage="com.menumaker"
      android:targetClass="com.menumaker.MainActivity">
      <extra android:name="action" android:value="check_sales" />
    </intent>
    <shortcutLabel>@string/check_sales</shortcutLabel>
    <icon android:resource="@drawable/ic_sales" />
  </shortcut>
</shortcuts>
```

---

## Performance Targets (Android)

### Load Times
- **Cold start**: < 2.5 seconds (app launch to login screen)
- **Menu load**: < 1.2 seconds (5 dishes)
- **Order submission**: < 600ms (over 4G LTE)
- **Image compression**: < 250ms (camera to upload)

### Memory & Battery
- **Memory footprint**: < 180 MB (typical usage, 8 GB RAM device)
- **Battery drain**: < 6% per hour (active use)
- **Background sync**: WorkManager (15-min intervals, 1% battery drain)

### Network
- **Offline support**: 80% of screens cached (seller: orders, menu; customer: searches)
- **Sync**: Automatic when network restored (WorkManager)
- **Data usage**: < 5 MB per month (excl. images)

---

## Accessibility & Localization

### Accessibility (WCAG 2.1 Level A)
- **TalkBack**: All UI elements labeled with content descriptions
- **Dynamic Text**: Support for accessibility text sizes (small → extra-large)
- **Contrast**: 4.5:1 minimum for text; Material 3 default meets requirements
- **Motion**: Respects `prefers-reduced-motion` system setting

### Localization
- **Languages**: English (primary), Hindi, Tamil, Arabic (Phase 3+)
- **RTL Support**: Full RTL mirroring for Arabic (auto via Android framework)
- **Date/Time**: Locale-specific (12-hour vs. 24-hour, date order)
- **Currency**: Locale-specific formatting (Rs., $, €)

---

## Security

### Data Protection
- **Android Keystore**: JWT tokens encrypted at rest
- **TLS 1.3**: All HTTPS connections
- **Certificate Pinning**: Optional (pin backend certificate)
- **Biometric Auth**: BiometricPrompt API (system-managed)

### Google Play Compliance
- **Privacy Policy**: Required in Play Store listing
- **Permissions**: Minimal permissions requested at runtime
- **Age Rating**: Required (typically 4+ for food app)
- **User Data Policy**: Data collection disclosure required

---

## Testing Strategy

### Unit Tests (JUnit4 + Mockk)
- ViewModel state transitions (loading → success → error)
- Repository offline/online sync logic
- Currency/date formatting (locale-specific)
- API error handling (timeout, invalid response)

### Integration Tests
- Order flow (checkout → payment → confirmation)
- OCR import (capture → parse → preview → save)
- Offline sync (queue orders → sync on online)

### UI Tests (Espresso / Compose)
- Seller dashboard layout (portrait & landscape)
- Customer marketplace (map, list, filters)
- Checkout form validation

### Performance Tests
- Cold start profiling (Android Studio Profiler)
- Memory leaks (LeakCanary)
- Battery drain (BatteryHistorian)

---

## Beta Testing & Play Store Submission

### Google Play Internal Testing
- **Internal testers** (10–20 team members): 1 week
- **Closed alpha** (50–100 sellers): 1 week
- **Open beta** (500+ testers): 2 weeks
- **Feedback**: In-app crash reports + Google Play Console ratings

### Play Store Submission
- **App Signing**: Google Play manages app signing (automatic)
- **Build Configuration**: Signed release APK + Bundle (AAB for smaller downloads)
- **Screenshots**: 5–8 per device category (Pixel 6 + 6.7" shown)
- **App Description**: 4,000-char marketing copy
- **Release Notes**: What's new (4,000 chars max)
- **Keywords**: Google Play allows 10 keywords (e.g., "food, menu, order")
- **Support Email**: Help email required
- **Privacy Policy**: URL required

### Review Checklist
- ✅ No crashes (Android Studio testing)
- ✅ No hardcoded URLs (use BuildConfig for environments)
- ✅ In-app purchase descriptions clear
- ✅ Privacy policy compliant
- ✅ Screenshots accurate to app
- ✅ Age rating appropriate
- ✅ No placeholder/test data visible
- ✅ Permissions justified (camera, location, etc.)

---

## Success Metrics (Android App)

- ✅ 1,000 Android downloads by Month 2 (Phase 3.5+2)
- ✅ 4.5+ star rating (min 100 reviews)
- ✅ 20% monthly active user (MAU) rate
- ✅ 5% daily active user (DAU) rate
- ✅ Crash-free users: 99%+ (Google Play Console threshold)
- ✅ Push notification opt-in rate: > 70%
- ✅ In-app subscription conversion: > 3% of free users

---

## Out of Scope (Phase 3.5+)

- Wear OS app (Phase 4)
- Android Auto support (Phase 4)
- Android TV support (Phase 4+)
- App shortcuts (additional; Phase 4)

---

## Next Steps

1. **Design phase**: Figma mockups (Material Design 3) for all 12 screens
2. **Setup Android Studio project**: Gradle, Hilt, Room, Retrofit setup
3. **Implement core screens**: Auth → Seller Dashboard → Order Management
4. **Beta testing**: 50–100 internal sellers (2 weeks)
5. **Play Store submission**: Internal test → Alpha → Beta → Production

---

**Ready for**: Design → Development → Beta → Play Store submission

