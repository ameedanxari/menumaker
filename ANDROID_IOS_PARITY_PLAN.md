# Android-iOS Parity Plan

**Created:** 2025-11-18
**Last Updated:** 2025-11-18
**Branch:** `claude/review-android-ios-parity-013wwXQVXPcn9meBRv6bfHTZ`

## Executive Summary

iOS implementation is significantly more feature-complete with **22 screens** vs Android's **9 screens**. This plan tracks the implementation of **13 missing screens**, **5 missing ViewModels**, **3 missing Models**, and comprehensive test coverage to achieve full parity.

---

## Parity Status Overview

| Category | iOS | Android | Gap | Status |
|----------|-----|---------|-----|--------|
| **Screens** | 22 | 9 | 13 missing | 🔴 41% |
| **ViewModels** | 15 | 10 | 5 missing | 🟡 67% |
| **Models** | 12 | 9 | 3 missing | 🟡 75% |
| **Services** | 9 | 5 | 4 missing | 🟡 56% |
| **UI Tests** | 15 | 5 | 10 missing | 🔴 33% |
| **Page Objects** | 21 | 12 | 9 missing | 🟡 57% |

**Overall Parity:** 🔴 **~45%** (Android significantly behind iOS)

---

## Phase 1: Core Models & ViewModels (FOUNDATION) ✅ COMPLETED

### 1.1 Missing Models ✅ COMPLETED
- [x] **FavoriteModels.kt** - Data models for favorites functionality
  - Reference: `/ios/MenuMaker/Data/Models/FavoriteModels.swift`
  - Location: `/android/app/src/main/kotlin/com/menumaker/data/remote/models/FavoriteModels.kt`
  - Status: ✅ Created

- [x] **MenuModels.kt** - Menu-specific data structures
  - Reference: `/ios/MenuMaker/Data/Models/MenuModels.swift`
  - Location: `/android/app/src/main/kotlin/com/menumaker/data/remote/models/MenuModels.kt`
  - Status: ✅ Created

- [x] **NotificationModels.kt** - Notification data structures
  - Reference: `/ios/MenuMaker/Data/Models/NotificationModels.swift`
  - Location: `/android/app/src/main/kotlin/com/menumaker/data/remote/models/NotificationModels.kt`
  - Status: ✅ Created

### 1.2 Missing Repositories ✅ COMPLETED
- [x] **FavoriteRepository.kt** - Favorites data management
  - Location: `/android/app/src/main/kotlin/com/menumaker/data/repository/FavoriteRepository.kt`
  - Status: ✅ Created with interface and implementation

- [x] **NotificationRepository.kt** - Notifications data management
  - Location: `/android/app/src/main/kotlin/com/menumaker/data/repository/NotificationRepository.kt`
  - Status: ✅ Created with interface and implementation

- [x] **ApiService Updates** - Added API endpoints for favorites, notifications, menus, and profile
  - Location: `/android/app/src/main/kotlin/com/menumaker/data/remote/api/ApiService.kt`
  - Status: ✅ Updated

- [x] **RepositoryModule Updates** - Added dependency injection for new repositories
  - Location: `/android/app/src/main/kotlin/com/menumaker/di/RepositoryModule.kt`
  - Status: ✅ Updated

### 1.3 Missing ViewModels ✅ COMPLETED
- [x] **NotificationViewModel.kt** - Manages notification state
  - Reference: `/ios/MenuMaker/ViewModels/NotificationViewModel.swift`
  - Location: `/android/app/src/main/kotlin/com/menumaker/viewmodel/NotificationViewModel.kt`
  - Status: ✅ Created with full functionality (150+ lines)

- [x] **ProfileViewModel.kt** - User profile management
  - Reference: `/ios/MenuMaker/ViewModels/ProfileViewModel.swift`
  - Location: `/android/app/src/main/kotlin/com/menumaker/viewmodel/ProfileViewModel.kt`
  - Status: ✅ Created with profile update and password change (130+ lines)

- [x] **FavoriteViewModel.kt** - Favorites management
  - Reference: `/ios/MenuMaker/ViewModels/FavoriteViewModel.swift`
  - Location: `/android/app/src/main/kotlin/com/menumaker/viewmodel/FavoriteViewModel.kt`
  - Status: ✅ Created with search, add, remove functionality (200+ lines)

- [x] **SellerViewModel.kt** - Seller-specific logic
  - Reference: `/ios/MenuMaker/ViewModels/SellerViewModel.swift`
  - Location: `/android/app/src/main/kotlin/com/menumaker/viewmodel/SellerViewModel.kt`
  - Status: ✅ Created with dashboard data and order management (170+ lines)

- [x] **CustomerPaymentViewModel.kt** - Customer payment flows
  - Reference: `/ios/MenuMaker/ViewModels/CustomerPaymentViewModel.swift`
  - Location: `/android/app/src/main/kotlin/com/menumaker/viewmodel/CustomerPaymentViewModel.kt`
  - Status: ✅ Created with card, UPI, and cash payment support (270+ lines)

---

## Phase 2: Authentication Screens (QUICK WIN) ✅ COMPLETED

### 2.1 Auth Screens ✅ COMPLETED
- [x] **ForgotPasswordScreen.kt** - Password recovery flow
  - Reference: `/ios/MenuMaker/Views/Auth/ForgotPasswordView.swift` (114 lines)
  - Location: `/android/app/src/main/kotlin/com/menumaker/ui/screens/auth/ForgotPasswordScreen.kt`
  - Route: Added to `Destinations.kt` as `ForgotPassword`
  - Status: ✅ Created (195 lines) with full functionality
  - Features: Email input, loading state, error handling, success message, auto-dismiss
  - Infrastructure: API endpoint, repository method, ViewModel method all added
  - Navigation: Fully wired up from LoginScreen

---

## Phase 3: Critical Customer Screens (HIGH PRIORITY) ✅ COMPLETED

### 3.1 Order Management ✅ COMPLETED
- [x] **MyOrdersScreen.kt** - Order history view
  - Reference: `/ios/MenuMaker/Views/Customer/MyOrdersView.swift` (366 lines)
  - Location: `/android/app/src/main/kotlin/com/menumaker/ui/screens/customer/MyOrdersScreen.kt`
  - Dependencies: OrderViewModel ✅
  - Status: ✅ Created (280+ lines)
  - Features: Search, tabs (Active/Completed/Cancelled), order cards, status chips

- [x] **OrderTrackingScreen.kt** - Real-time order tracking
  - Reference: `/ios/MenuMaker/Views/Customer/OrderTrackingView.swift` (309 lines)
  - Location: `/android/app/src/main/kotlin/com/menumaker/ui/screens/customer/OrderTrackingScreen.kt`
  - Dependencies: OrderViewModel ✅
  - Status: ✅ Created (220+ lines)
  - Features: Status timeline, order items list, delivery details, visual progress

### 3.2 Payment & Checkout ✅ COMPLETED
- [x] **PaymentScreen.kt** - Checkout and payment processing
  - Reference: `/ios/MenuMaker/Views/Customer/PaymentView.swift` (405 lines)
  - Location: `/android/app/src/main/kotlin/com/menumaker/ui/screens/customer/PaymentScreen.kt`
  - Dependencies: CustomerPaymentViewModel ✅ (created in Phase 1)
  - Status: ✅ Created (300+ lines)
  - Features: Card/UPI/Cash payment, validation, secure payment badge, success/error handling

### 3.3 Seller Menu Viewing ✅ COMPLETED
- [x] **SellerMenuScreen.kt** - View seller's menu as customer
  - Reference: `/ios/MenuMaker/Views/Customer/SellerMenuView.swift` (152 lines)
  - Location: `/android/app/src/main/kotlin/com/menumaker/ui/screens/customer/SellerMenuScreen.kt`
  - Dependencies: DishViewModel ✅, CartViewModel ✅
  - Status: ✅ Created (310+ lines)
  - Features: Category filtering, dish cards, vegetarian indicators, add to cart, empty state

### 3.4 Navigation ✅ COMPLETED
- [x] Added routes: SellerMenu, MyOrders, Payment, OrderTracking to Destinations.kt
- [x] All routes support parameter passing (sellerId, orderId, total amount)

---

## Phase 4: Engagement & Retention Features (MEDIUM PRIORITY) ✅ COMPLETED

### 4.1 Favorites & Reviews ✅ COMPLETED
- [x] **FavoritesScreen.kt** - Saved sellers management
  - Reference: `/ios/MenuMaker/Views/Customer/FavoritesView.swift` (167 lines)
  - Location: `/android/app/src/main/kotlin/com/menumaker/ui/screens/customer/FavoritesScreen.kt`
  - Dependencies: FavoriteViewModel ✅ (created in Phase 1), FavoriteModels ✅ (created in Phase 1)
  - Status: ✅ Created (320+ lines)
  - Features: Search, favorites list, swipe-to-delete, empty state, navigation to seller menu

- [x] **ReviewsScreen.kt** - Write and manage reviews
  - Reference: `/ios/MenuMaker/Views/Customer/ReviewsView.swift` (303 lines)
  - Location: `/android/app/src/main/kotlin/com/menumaker/ui/screens/customer/ReviewsScreen.kt`
  - Dependencies: ReviewViewModel ✅
  - Status: ✅ Created (340+ lines)
  - Features: Rating stars, comment field, photo upload (up to 3), form validation, success handling

- [ ] **SellerReviewsDisplayScreen.kt** - View seller reviews (Deferred to Phase 5+)
  - Reference: `/ios/MenuMaker/Views/Customer/SellerReviewsDisplayView.swift` (413 lines)
  - Location: `/android/app/src/main/kotlin/com/menumaker/ui/screens/customer/SellerReviewsDisplayScreen.kt`
  - Dependencies: ReviewViewModel ✅
  - Complexity: MEDIUM (list, filters, sorting)
  - Note: This is for viewing reviews, less critical than submitting reviews

### 4.2 Notifications & Engagement ✅ COMPLETED
- [x] **NotificationsScreen.kt** - Notification center
  - Reference: `/ios/MenuMaker/Views/Customer/NotificationsView.swift` (184 lines)
  - Location: `/android/app/src/main/kotlin/com/menumaker/ui/screens/NotificationsScreen.kt`
  - Dependencies: NotificationViewModel ✅ (created in Phase 1), NotificationModels ✅ (created in Phase 1)
  - Status: ✅ Created (330+ lines)
  - Features: Notification list, unread indicator, mark as read, notification settings sheet, empty state

- [x] **ReferralsScreen.kt** - Referral program
  - Reference: `/ios/MenuMaker/Views/Customer/ReferralView.swift` (665 lines - LARGEST!)
  - Location: `/android/app/src/main/kotlin/com/menumaker/ui/screens/ReferralsScreen.kt`
  - Route: Already defined in `Destinations.kt` as `Referral`
  - Dependencies: ReferralViewModel ✅
  - Status: ✅ Created (730+ lines - most comprehensive!)
  - Features: Referral code display/share, credits/rewards, stats cards, apply code, history, leaderboard, how it works, terms & conditions

### 4.3 Navigation ✅ COMPLETED
- [x] Added routes: Favorites, Notifications, CustomerReviews to Destinations.kt
- [x] CustomerReviews supports businessId and optional orderId parameters

---

## Phase 5: User Management Screens (MEDIUM PRIORITY)

### 5.1 Profile & Settings 🟡 PRIORITY 2
- [ ] **ProfileScreen.kt** - User profile management
  - Reference: `/ios/MenuMaker/Views/Customer/ProfileView.swift` (468 lines)
  - Location: `/android/app/src/main/kotlin/com/menumaker/ui/screens/customer/ProfileScreen.kt`
  - Route: Already defined in `Destinations.kt` as `Profile`
  - Dependencies: ProfileViewModel ❌
  - Complexity: HIGH (forms, validation, photo upload, preferences)

- [ ] **MoreScreen.kt** / **SettingsScreen.kt** - App settings & options
  - Reference: `/ios/MenuMaker/Views/More/MoreView.swift` (579 lines)
  - Location: `/android/app/src/main/kotlin/com/menumaker/ui/screens/MoreScreen.kt`
  - Route: Already defined in `Destinations.kt` as `Settings`
  - Dependencies: Multiple ViewModels
  - Complexity: HIGH (navigation hub, preferences, account management)

---

## Phase 6: Seller Features (SELLER PRIORITY)

### 6.1 Seller Reviews 🟢 PRIORITY 3
- [ ] **SellerReviewsScreen.kt** - Manage seller reviews
  - Reference: `/ios/MenuMaker/Views/Seller/SellerReviewsView.swift` (456 lines)
  - Location: `/android/app/src/main/kotlin/com/menumaker/ui/screens/seller/SellerReviewsScreen.kt`
  - Dependencies: ReviewViewModel ✅, SellerViewModel ❌
  - Complexity: MEDIUM (list, respond, analytics)

---

## Phase 7: Test Coverage (TEST PRIORITY)

### 7.1 Missing UI Test Files 🔴 CRITICAL
- [ ] **CouponFlowTests.kt**
  - Reference: `/ios/MenuMakerUITests/CouponFlowTests.swift` (17,825 bytes)
  - Location: `/android/app/src/androidTest/kotlin/com/menumaker/CouponFlowTests.kt`

- [ ] **DeliveryTrackingTests.kt**
  - Reference: `/ios/MenuMakerUITests/DeliveryTrackingTests.swift` (16,638 bytes)
  - Location: `/android/app/src/androidTest/kotlin/com/menumaker/DeliveryTrackingTests.kt`

- [ ] **FavoritesAndHistoryTests.kt**
  - Reference: `/ios/MenuMakerUITests/FavoritesAndHistoryTests.swift` (13,564 bytes)
  - Location: `/android/app/src/androidTest/kotlin/com/menumaker/FavoritesAndHistoryTests.kt`

- [ ] **NotificationFlowTests.kt**
  - Reference: `/ios/MenuMakerUITests/NotificationFlowTests.swift` (9,921 bytes)
  - Location: `/android/app/src/androidTest/kotlin/com/menumaker/NotificationFlowTests.kt`

- [ ] **PaymentFlowTests.kt**
  - Reference: `/ios/MenuMakerUITests/PaymentFlowTests.swift` (12,126 bytes)
  - Location: `/android/app/src/androidTest/kotlin/com/menumaker/PaymentFlowTests.kt`

- [ ] **ProfileFlowTests.kt**
  - Reference: `/ios/MenuMakerUITests/ProfileFlowTests.swift` (12,106 bytes)
  - Location: `/android/app/src/androidTest/kotlin/com/menumaker/ProfileFlowTests.kt`

- [ ] **ReferralFlowTests.kt**
  - Reference: `/ios/MenuMakerUITests/ReferralFlowTests.swift` (12,708 bytes)
  - Location: `/android/app/src/androidTest/kotlin/com/menumaker/ReferralFlowTests.kt`

- [ ] **ReviewFlowTests.kt**
  - Reference: `/ios/MenuMakerUITests/ReviewFlowTests.swift` (18,571 bytes - LARGEST!)
  - Location: `/android/app/src/androidTest/kotlin/com/menumaker/ReviewFlowTests.kt`

- [ ] **SellerAnalyticsTests.kt**
  - Reference: `/ios/MenuMakerUITests/SellerAnalyticsTests.swift` (9,967 bytes)
  - Location: `/android/app/src/androidTest/kotlin/com/menumaker/SellerAnalyticsTests.kt`

- [ ] **SettingsFlowTests.kt**
  - Reference: `/ios/MenuMakerUITests/SettingsFlowTests.swift` (11,704 bytes)
  - Location: `/android/app/src/androidTest/kotlin/com/menumaker/SettingsFlowTests.kt`

### 7.2 Missing Page Objects 🟡 MEDIUM
- [ ] **ForgotPasswordPage.kt**
- [ ] **CustomerCouponPage.kt**
- [ ] **FavoritesPage.kt**
- [ ] **NotificationPage.kt**
- [ ] **OrderHistoryPage.kt**
- [ ] **PaymentPage.kt**
- [ ] **SellerAnalyticsPage.kt**
- [ ] **SellerCouponPage.kt**
- [ ] **SellerOrdersPage.kt**

---

## Phase 8: Optional Services (NICE-TO-HAVE)

### 8.1 Advanced Services 🟢 PRIORITY 4
- [ ] **CameraService.kt** - Camera functionality for photo uploads
  - Reference: `/ios/MenuMaker/Core/Services/CameraService.swift`
  - Location: `/android/app/src/main/kotlin/com/menumaker/services/CameraService.kt`
  - Complexity: MEDIUM (CameraX integration)

- [ ] **OCRService.kt** - Menu scanning via OCR
  - Reference: `/ios/MenuMaker/Core/Services/OCRService.swift`
  - Location: `/android/app/src/main/kotlin/com/menumaker/services/OCRService.kt`
  - Complexity: HIGH (ML Kit Text Recognition)

- [ ] **KeychainManager equivalent** - Secure credential storage
  - Reference: `/ios/MenuMaker/Core/Services/KeychainManager.swift`
  - Note: Android already has `TokenDataStore` with encryption
  - Action: Review if additional secure storage needed
  - Complexity: LOW (DataStore already implemented)

---

## Implementation Strategy

### Recommended Order (by Phase):
1. **Phase 1** (Foundation): Models & ViewModels - Build the foundation first
2. **Phase 2** (Auth): ForgotPasswordScreen - Quick win
3. **Phase 3** (Critical): Order tracking, Payment, SellerMenu - Core customer experience
4. **Phase 4** (Engagement): Favorites, Reviews, Notifications, Referrals - Retention features
5. **Phase 5** (User Mgmt): Profile, Settings - User management
6. **Phase 6** (Seller): SellerReviews - Seller experience
7. **Phase 7** (Tests): All test files and page objects - Quality assurance
8. **Phase 8** (Services): Camera, OCR - Nice-to-have enhancements

### Estimated Effort:
- **Phase 1**: ~2-3 hours (8 files)
- **Phase 2**: ~30 minutes (1 screen)
- **Phase 3**: ~6-8 hours (4 complex screens)
- **Phase 4**: ~6-8 hours (4 screens)
- **Phase 5**: ~4-5 hours (2 complex screens)
- **Phase 6**: ~2 hours (1 screen)
- **Phase 7**: ~10-12 hours (19 test files)
- **Phase 8**: ~4-6 hours (3 services)

**Total Estimated Effort**: ~35-45 hours

---

## Navigation Updates Required

### Existing Routes (Already Defined in Destinations.kt):
✅ `ForgotPassword` - Ready for implementation
✅ `Profile` - Ready for implementation
✅ `Referral` - Ready for implementation
✅ `Settings` - Ready for implementation

### New Routes Needed:
- [ ] `MyOrders` - Order history
- [ ] `OrderTracking/{orderId}` - Order tracking with ID param
- [ ] `Payment` - Checkout/payment
- [ ] `SellerMenu/{sellerId}` - Seller menu view
- [ ] `Favorites` - Favorites list
- [ ] `Reviews` - Write review
- [ ] `SellerReviewsDisplay/{sellerId}` - View seller reviews
- [ ] `Notifications` - Notification center
- [ ] `SellerReviews` - Manage seller reviews (seller side)
- [ ] `More` - More/Menu screen (if separate from Settings)

---

## Quality Checklist (Per Screen)

For each screen implementation, ensure:
- [ ] Follows Material Design 3 guidelines
- [ ] Matches iOS functionality (feature parity)
- [ ] Matches iOS UI layout (visual parity)
- [ ] Uses existing ViewModel or creates new one
- [ ] Implements loading states
- [ ] Implements error handling
- [ ] Implements empty states
- [ ] Supports dark mode (theme-aware)
- [ ] Accessible (content descriptions, semantic properties)
- [ ] Added to navigation graph
- [ ] Has corresponding Page Object for testing
- [ ] Has UI test coverage
- [ ] Documented in code comments

---

## Progress Tracking

### Current Session Progress:
- ✅ Comprehensive iOS/Android analysis completed
- ✅ Parity plan document created
- ✅ **Phase 1 COMPLETED** - All foundation models, repositories, and ViewModels created
- ✅ **Phase 2 COMPLETED** - ForgotPasswordScreen fully implemented and wired up
- ✅ **Phase 3 COMPLETED** - 4 critical customer screens fully implemented
- [ ] Ready for Phase 4 (Engagement screens) or Phase 5 (User management)...

### Files Created This Session:
1. `/home/user/menumaker/ANDROID_IOS_PARITY_PLAN.md` - This plan document

**Phase 1 - Models:**
2. `/android/app/src/main/kotlin/com/menumaker/data/remote/models/FavoriteModels.kt`
3. `/android/app/src/main/kotlin/com/menumaker/data/remote/models/MenuModels.kt`
4. `/android/app/src/main/kotlin/com/menumaker/data/remote/models/NotificationModels.kt`

**Phase 1 - Repositories:**
5. `/android/app/src/main/kotlin/com/menumaker/data/repository/FavoriteRepository.kt`
6. `/android/app/src/main/kotlin/com/menumaker/data/repository/NotificationRepository.kt`

**Phase 1 - ViewModels:**
7. `/android/app/src/main/kotlin/com/menumaker/viewmodel/FavoriteViewModel.kt` (200+ lines)
8. `/android/app/src/main/kotlin/com/menumaker/viewmodel/NotificationViewModel.kt` (150+ lines)
9. `/android/app/src/main/kotlin/com/menumaker/viewmodel/ProfileViewModel.kt` (130+ lines)
10. `/android/app/src/main/kotlin/com/menumaker/viewmodel/SellerViewModel.kt` (170+ lines)
11. `/android/app/src/main/kotlin/com/menumaker/viewmodel/CustomerPaymentViewModel.kt` (270+ lines)

**Phase 2 - Screens:**
12. `/android/app/src/main/kotlin/com/menumaker/ui/screens/auth/ForgotPasswordScreen.kt` (195 lines)

**Phase 3 - Critical Customer Screens:**
13. `/android/app/src/main/kotlin/com/menumaker/ui/screens/customer/SellerMenuScreen.kt` (310+ lines)
14. `/android/app/src/main/kotlin/com/menumaker/ui/screens/customer/MyOrdersScreen.kt` (280+ lines)
15. `/android/app/src/main/kotlin/com/menumaker/ui/screens/customer/PaymentScreen.kt` (300+ lines)
16. `/android/app/src/main/kotlin/com/menumaker/ui/screens/customer/OrderTrackingScreen.kt` (220+ lines)

**Total New Files: 16 files, ~2,655 lines of code**

### Files Modified This Session:
1. `/android/app/src/main/kotlin/com/menumaker/data/remote/api/ApiService.kt` - Added endpoints (Phase 1 + Phase 2)
2. `/android/app/src/main/kotlin/com/menumaker/data/repository/AuthRepository.kt` - Added sendPasswordReset method (Phase 2)
3. `/android/app/src/main/kotlin/com/menumaker/viewmodel/AuthViewModel.kt` - Added password reset state and methods (Phase 2)
4. `/android/app/src/main/kotlin/com/menumaker/ui/navigation/Destinations.kt` - Added 5 new routes (Phase 2 + Phase 3)
5. `/android/app/src/main/kotlin/com/menumaker/ui/navigation/NavGraph.kt` - Wired up ForgotPassword screen (Phase 2)
6. `/android/app/src/main/kotlin/com/menumaker/ui/screens/auth/LoginScreen.kt` - Added forgot password navigation (Phase 2)
7. `/android/app/src/main/kotlin/com/menumaker/di/RepositoryModule.kt` - Added DI for new repositories (Phase 1)
8. `/home/user/menumaker/ANDROID_IOS_PARITY_PLAN.md` - Updated progress tracking

### Commits This Session:
- ✅ Phase 1 committed and pushed
- ✅ Phase 2 committed and pushed
- Pending: Phase 3 commit

---

## Next Steps

1. **✅ COMPLETED Phase 1**: All foundation models, repositories, and ViewModels
2. **NEXT: Phase 2**: Implement ForgotPasswordScreen (Quick Win - 30 mins)
3. **Then: Phase 3**: Implement critical customer screens (MyOrders, OrderTracking, Payment, SellerMenu)
4. **Then: Phase 4**: Implement engagement screens (Favorites, Reviews, Notifications, Referrals)
5. **Then: Phase 5**: Implement user management screens (Profile, Settings)
6. **Finally: Phase 7**: Add comprehensive test coverage

**Phase 1 Impact:**
- ✅ 3 new models created (FavoriteModels, MenuModels, NotificationModels)
- ✅ 2 new repositories created (FavoriteRepository, NotificationRepository)
- ✅ 5 new ViewModels created (all missing ViewModels now implemented)
- ✅ API endpoints added for all new features
- ✅ Dependency injection configured
- ✅ **Foundation complete for implementing UI screens**

---

## Notes & Decisions

- **Architecture**: Following Android's existing MVVM + Clean Architecture pattern ✅
- **UI Framework**: Jetpack Compose (matching iOS's SwiftUI approach) ✅
- **Navigation**: Using Compose Navigation (already in place) ✅
- **State Management**: Kotlin StateFlow/SharedFlow (matching iOS's Combine) ✅
- **Dependency Injection**: Hilt (already configured) ✅
- **Database**: Room (already configured, iOS uses in-memory) ✅
- **Testing**: JUnit 4 + Espresso + Compose Testing (matching iOS's XCTest) ⏳

**Design Decisions Made:**
1. All ViewModels follow the same pattern: StateFlow for state, Resource wrapper for API calls
2. Repositories use Flow<Resource<T>> pattern for consistency
3. Payment ViewModel supports Card, UPI, and Cash (India-specific payment methods)
4. Notification settings included in NotificationViewModel (matching iOS)
5. All validation logic included in ViewModels (matching iOS approach)

---

**Last Updated:** 2025-11-18 - Phase 1 completed (Models, Repositories, ViewModels)
