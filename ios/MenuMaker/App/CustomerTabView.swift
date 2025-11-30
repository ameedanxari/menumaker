import SwiftUI

/// Customer-facing tab view with Marketplace, Cart, Orders, and Profile
struct CustomerTabView: View {
    @StateObject private var marketplaceViewModel = MarketplaceViewModel()
    @StateObject private var cartViewModel = CartViewModel()
    @State private var selectedTab = 0
    
    var body: some View {
        TabView(selection: $selectedTab) {
            // Marketplace
            NavigationView {
                MarketplaceView()
            }
            .tabItem {
                Label("Marketplace", systemImage: "storefront")
            }
            .tag(0)
            .accessibilityLabel("Marketplace")
            
            // Cart
            NavigationView {
                CartView()
            }
            .tabItem {
                Label("Cart", systemImage: "cart")
            }
            .tag(1)
            .accessibilityLabel("Cart")
            
            // Orders
            NavigationView {
                MyOrdersView()
            }
            .tabItem {
                Label("Orders", systemImage: "bag")
            }
            .tag(2)
            .accessibilityLabel("Orders")
            
            // Profile
            NavigationView {
                ProfileView()
            }
            .tabItem {
                Label("Profile", systemImage: "person")
            }
            .tag(3)
            .accessibilityLabel("Profile")
        }
        .accessibilityIdentifier("customer-tab-view")
        .environmentObject(marketplaceViewModel)
        .environmentObject(cartViewModel)
    }
}

#Preview {
    CustomerTabView()
        .environmentObject(AuthViewModel())
}
