import SwiftUI

@main
struct MenuMakerApp: App {
    @StateObject private var appCoordinator = AppCoordinator()
    @StateObject private var authViewModel = AuthViewModel()
    @Environment(\.scenePhase) private var scenePhase

    init() {
        setupAppearance()
        setupNotifications()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appCoordinator)
                .environmentObject(authViewModel)
                .onAppear {
                    authViewModel.checkAuthentication()
                }
                .onChange(of: scenePhase) { oldPhase, newPhase in
                    handleScenePhaseChange(from: oldPhase, to: newPhase)
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

    private func handleScenePhaseChange(from oldPhase: ScenePhase, to newPhase: ScenePhase) {
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
}

// MARK: - Content View
struct ContentView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @EnvironmentObject var appCoordinator: AppCoordinator

    var body: some View {
        Group {
            if authViewModel.isAuthenticated {
                MainTabView()
            } else {
                NavigationStack {
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
            NavigationStack {
                SellerDashboardView()
            }
            .tabItem {
                Label("Dashboard", systemImage: "square.grid.2x2")
            }
            .tag(0)

            // Orders
            NavigationStack {
                OrdersListView()
            }
            .tabItem {
                Label("Orders", systemImage: "bag")
            }
            .tag(1)

            // Menu
            NavigationStack {
                MenuEditorView()
            }
            .tabItem {
                Label("Menu", systemImage: "fork.knife")
            }
            .tag(2)

            // More
            NavigationStack {
                MoreView()
            }
            .tabItem {
                Label("More", systemImage: "ellipsis.circle")
            }
            .tag(3)
        }
        .environmentObject(sellerViewModel)
        .environmentObject(marketplaceViewModel)
    }
}

#Preview {
    ContentView()
        .environmentObject(AppCoordinator())
        .environmentObject(AuthViewModel())
}
