import Foundation
import Combine

/// Authentication view model
@MainActor
class AuthViewModel: ObservableObject {
    @Published var isAuthenticated = false
    @Published var currentUser: User?
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let repository = AuthRepository.shared
    private let analyticsService = AnalyticsService.shared
    private let biometricService = BiometricService.shared

    init() {
        Task {
            await checkAuthentication()
        }
    }

    // MARK: - Authentication

    func login(email: String, password: String) async {
        guard !email.isEmpty, !password.isEmpty else {
            errorMessage = "Please enter email and password"
            return
        }

        guard isValidEmail(email) else {
            errorMessage = "Please enter a valid email address"
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            let authData = try await repository.login(email: email, password: password)
            currentUser = authData.user
            isAuthenticated = true

            analyticsService.trackLogin(method: "email")
            analyticsService.setUserId(authData.user.id)

        } catch {
            errorMessage = error.localizedDescription
            isAuthenticated = false
        }

        isLoading = false
    }

    func signup(email: String, password: String, name: String, phone: String?) async {
        guard !email.isEmpty, !password.isEmpty, !name.isEmpty else {
            errorMessage = "Please fill in all required fields"
            return
        }

        guard isValidEmail(email) else {
            errorMessage = "Please enter a valid email address"
            return
        }

        guard password.count >= AppConstants.Validation.minPasswordLength else {
            errorMessage = "Password must be at least \(AppConstants.Validation.minPasswordLength) characters"
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            let authData = try await repository.signup(
                email: email,
                password: password,
                name: name,
                phone: phone
            )
            currentUser = authData.user
            isAuthenticated = true

            analyticsService.trackSignup(method: "email")
            analyticsService.setUserId(authData.user.id)

        } catch {
            errorMessage = error.localizedDescription
            isAuthenticated = false
        }

        isLoading = false
    }

    func logout() async {
        isLoading = true

        do {
            try await repository.logout()
            isAuthenticated = false
            currentUser = nil

            analyticsService.track(.logout)
            analyticsService.resetSession()

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func checkAuthentication() async {
        let authenticated = await repository.isAuthenticated()
        isAuthenticated = authenticated

        if authenticated {
            await loadCurrentUser()
        }
    }

    func refreshSession() async {
        do {
            try await repository.refreshSession()
        } catch {
            // If refresh fails, log out
            isAuthenticated = false
            currentUser = nil
        }
    }

    private func loadCurrentUser() async {
        do {
            let user = try await repository.getCurrentUser()
            currentUser = user
            analyticsService.setUserId(user.id)
        } catch {
            isAuthenticated = false
            currentUser = nil
        }
    }

    // MARK: - Biometric Authentication

    func loginWithBiometrics() async {
        guard biometricService.isAvailable && biometricService.isBiometricEnabled() else {
            errorMessage = "Biometric authentication is not available or not enabled"
            return
        }

        do {
            let success = try await biometricService.authenticate()

            if success {
                // Re-authenticate with stored credentials
                await checkAuthentication()
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func enableBiometricAuth() {
        guard biometricService.isAvailable else {
            errorMessage = "Biometric authentication is not available on this device"
            return
        }

        biometricService.setBiometricEnabled(true)
    }

    func disableBiometricAuth() {
        biometricService.setBiometricEnabled(false)
    }

    // MARK: - Password Reset

    func sendPasswordReset(email: String) async {
        guard !email.isEmpty else {
            errorMessage = "Please enter your email address"
            return
        }

        guard isValidEmail(email) else {
            errorMessage = "Please enter a valid email address"
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            try await repository.sendPasswordReset(email: email)
            analyticsService.track(.passwordResetRequested)
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    // MARK: - Validation

    private func isValidEmail(_ email: String) -> Bool {
        let emailPredicate = NSPredicate(format: "SELF MATCHES %@", AppConstants.Validation.emailRegex)
        return emailPredicate.evaluate(with: email)
    }

    // MARK: - Error Handling

    func clearError() {
        errorMessage = nil
    }
}
