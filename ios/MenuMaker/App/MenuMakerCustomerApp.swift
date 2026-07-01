import SwiftUI

@main
struct MenuMakerCustomerApp: App {
    @StateObject private var appCoordinator = AppCoordinator()
    @StateObject private var authViewModel = AuthViewModel()

    var body: some Scene {
        WindowGroup {
            CustomerRootView()
                .environmentObject(appCoordinator)
                .environmentObject(authViewModel)
                .preferredColorScheme(appCoordinator.colorScheme)
                .onAppear {
                    Task {
                        await authViewModel.checkAuthentication()
                    }
                }
        }
    }
}

private struct CustomerRootView: View {
    @EnvironmentObject private var authViewModel: AuthViewModel

    var body: some View {
        Group {
            if authViewModel.isAuthenticated {
                CustomerTabView()
            } else {
                NavigationView {
                    LoginView()
                }
            }
        }
        .accessibilityIdentifier("customer-root-view")
    }
}
