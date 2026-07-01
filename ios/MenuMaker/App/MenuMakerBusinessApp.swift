import SwiftUI

@main
struct MenuMakerBusinessApp: App {
    @StateObject private var appCoordinator = AppCoordinator()
    @StateObject private var authViewModel = AuthViewModel()
    @StateObject private var sellerViewModel = SellerViewModel()
    @StateObject private var marketplaceViewModel = MarketplaceViewModel()

    var body: some Scene {
        WindowGroup {
            NavigationView {
                BusinessRootView()
            }
            .environmentObject(appCoordinator)
            .environmentObject(authViewModel)
            .environmentObject(sellerViewModel)
            .environmentObject(marketplaceViewModel)
            .preferredColorScheme(appCoordinator.colorScheme)
            .onAppear {
                Task {
                    await authViewModel.checkAuthentication()
                }
            }
        }
    }
}

private struct BusinessRootView: View {
    @EnvironmentObject private var authViewModel: AuthViewModel

    var body: some View {
        Group {
            if authViewModel.isAuthenticated {
                BusinessMainTabView()
            } else {
                LoginView()
            }
        }
    }
}

private struct BusinessMainTabView: View {
    var body: some View {
        TabView {
            NavigationView {
                SellerDashboardView()
            }
            .tabItem {
                Label("Dashboard", systemImage: "square.grid.2x2")
            }

            NavigationView {
                OrdersListView()
            }
            .tabItem {
                Label("Orders", systemImage: "bag")
            }

            NavigationView {
                MenuEditorView()
            }
            .tabItem {
                Label("Menu", systemImage: "fork.knife")
            }

            NavigationView {
                MoreView()
            }
            .tabItem {
                Label("More", systemImage: "ellipsis.circle")
            }
        }
        .accessibilityIdentifier("business-main-tab-view")
    }
}
