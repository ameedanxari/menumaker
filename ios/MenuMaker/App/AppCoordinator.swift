import SwiftUI
import Combine

/// App-wide coordinator managing navigation and app state
@MainActor
class AppCoordinator: ObservableObject {
    // MARK: - Published Properties
    @Published var colorScheme: ColorScheme? = nil
    @Published var isLoading: Bool = false
    @Published var errorMessage: String? = nil
    @Published var showError: Bool = false

    // MARK: - Services
    let apiClient: APIClient
    let keychainManager: KeychainManager
    let locationService: LocationService
    let notificationService: NotificationService

    init() {
        self.apiClient = APIClient.shared
        self.keychainManager = KeychainManager.shared
        self.locationService = LocationService.shared
        self.notificationService = NotificationService.shared

        loadColorSchemePreference()
    }

    // MARK: - Theme Management
    func setColorScheme(_ scheme: ColorScheme?) {
        colorScheme = scheme
        UserDefaults.standard.set(scheme == .dark ? "dark" : scheme == .light ? "light" : "system", forKey: "colorScheme")
    }

    private func loadColorSchemePreference() {
        guard let schemeName = UserDefaults.standard.string(forKey: "colorScheme") else {
            colorScheme = nil
            return
        }

        switch schemeName {
        case "dark":
            colorScheme = .dark
        case "light":
            colorScheme = .light
        default:
            colorScheme = nil
        }
    }

    // MARK: - Error Handling
    func showError(_ message: String) {
        errorMessage = message
        showError = true
    }

    func clearError() {
        errorMessage = nil
        showError = false
    }

    // MARK: - Loading State
    func setLoading(_ loading: Bool) {
        isLoading = loading
    }
}
