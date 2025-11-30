import SwiftUI

@main
struct MenuMakerApp: App {
    @StateObject private var appCoordinator = AppCoordinator()
    @StateObject private var authViewModel = AuthViewModel()
    @Environment(\.scenePhase) private var scenePhase

    init() {
        // Reset state for UI testing
        if CommandLine.arguments.contains("UI-Testing") {
            resetAppStateForTesting()
        }

        setupAppearance()
        setupNotifications()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appCoordinator)
                .environmentObject(authViewModel)
                .onAppear {
                    Task {
                        await authViewModel.checkAuthentication()
                    }
                }
                .onChange(of: scenePhase) { newPhase in
                    handleScenePhaseChange(to: newPhase)
                }
        }
    }

    private func setupAppearance() {
        // Configure global appearance
        let appearance = UINavigationBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = UIColor(Color.theme.background)
        appearance.titleTextAttributes = [.foregroundColor: UIColor(Color.theme.text)]

        UINavigationBar.appearance().standardAppearance = appearance
        UINavigationBar.appearance().scrollEdgeAppearance = appearance

        // Tab bar appearance
        let tabAppearance = UITabBarAppearance()
        tabAppearance.configureWithOpaqueBackground()
        tabAppearance.backgroundColor = UIColor(Color.theme.surface)

        UITabBar.appearance().standardAppearance = tabAppearance
        UITabBar.appearance().scrollEdgeAppearance = tabAppearance
    }

    private func setupNotifications() {
        UNUserNotificationCenter.current().delegate = NotificationDelegate.shared
        NotificationService.shared.requestAuthorization()
    }

    /*
    # Task: Debug Coupon Test Failures

    ## Phase 1: Initial Analysis
    - [x] Identified test failures <!-- id: 1 -->
    - [x] Analyzed Page Object expectations <!-- id: 2 -->

    ## Phase 2: Accessibility Identifier Fixes
    - [x] Fixed `CouponBrowseView` accessibility identifier (AvailableCoupon) <!-- id: 3 -->
    - [x] Fixed `MarketplaceView` identifier conflict <!-- id: 4 -->
    - [x] Fixed `CouponCard` identifier (CouponItem) <!-- id: 5 -->
    - [x] Added accessibility label to Coupons link in MoreView <!-- id: 6 -->

    ## Phase 3: Mock Data Seeding
    - [x] Seeded default coupons in `APIClient.mockCoupons` <!-- id: 7 -->

    ## Phase 4: Business ID Storage Fix
    - [x] Added `businessId` to `User` model (optional, for sellers) <!-- id: 8 -->
    - [x] Updated `AuthRepository` to save business ID to Keychain <!-- id: 9 -->
    - [x] Fixed all User initializations in code and tests <!-- id: 10 -->

    ## Phase 5: Customer UI Implementation
    - [x] Created `CustomerTabView` with Marketplace, Cart, Orders, Profile tabs <!-- id: 11 -->
    - [x] Updated `MenuMakerApp` for role-based UI switching <!-- id: 12 -->
    - [x] Added accessibility identifiers for customer tabs <!-- id: 13 -->

    ## Phase 6: Testing & Verification
    - [x] ✅ testSellerCouponScreenDisplays PASSED! <!-- id: 14 -->
    - [/] Running full CouponFlowTests suite to verify customer flow <!-- id: 15 -->
    - [ ] Analyze remaining failures and apply fixes <!-- id: 16 -->
    */
    private func handleScenePhaseChange(to newPhase: ScenePhase) {
        switch newPhase {
        case .active:
            // App became active
            if authViewModel.isAuthenticated {
                // Refresh data
                Task {
                    await authViewModel.refreshSession()
                }
            }
        case .background:
            // App moved to background
            // Save any pending changes
            break
        case .inactive:
            // App became inactive
            break
        @unknown default:
            break
        }
    }

    private func resetAppStateForTesting() {
        // Clear keychain synchronously
        KeychainManager.shared.deleteAllSync()

        // Clear UserDefaults
        if let domain = Bundle.main.bundleIdentifier {
            UserDefaults.standard.removePersistentDomain(forName: domain)
            UserDefaults.standard.synchronize()
        }

        // Clear any cached data
        URLCache.shared.removeAllCachedResponses()
        
        // Reset mock data storage
        APIClient.resetMockData()

        print("🧪 App state reset for UI testing")
    }
}

// MARK: - Content View
struct ContentView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @EnvironmentObject var appCoordinator: AppCoordinator

    var body: some View {
        Group {
            if authViewModel.isAuthenticated {
                // Show different UI based on user role
                if authViewModel.currentUser?.isSeller == true {
                    MainTabView()  // Seller UI: Dashboard, Orders, Menu, More
                } else {
                    CustomerTabView()  // Customer UI: Marketplace, Cart, Orders, Profile
                }
            } else {
                NavigationView {
                    LoginView()
                }
            }
        }
        .preferredColorScheme(appCoordinator.colorScheme)
    }
}

// MARK: - Main Tab View
struct MainTabView: View {
    @StateObject private var sellerViewModel = SellerViewModel()
    @StateObject private var marketplaceViewModel = MarketplaceViewModel()
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            // Seller Dashboard
            NavigationView {
                SellerDashboardView()
            }
            .tabItem {
                Label("Dashboard", systemImage: "square.grid.2x2")
            }
            .tag(0)

            // Orders
            NavigationView {
                OrdersListView()
            }
            .tabItem {
                Label("Orders", systemImage: "bag")
            }
            .tag(1)

            // Menu
            NavigationView {
                MenuEditorView()
            }
            .tabItem {
                Label("Menu", systemImage: "fork.knife")
            }
            .tag(2)

            // More
            NavigationView {
                MoreView()
            }
            .tabItem {
                Label("More", systemImage: "ellipsis.circle")
            }
            .tag(3)
        }
        .accessibilityIdentifier("main-tab-view")
        .environmentObject(sellerViewModel)
        .environmentObject(marketplaceViewModel)
    }
}

#Preview {
    ContentView()
        .environmentObject(AppCoordinator())
        .environmentObject(AuthViewModel())
}
