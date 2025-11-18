import Foundation
import Combine

/// Authentication repository
@MainActor
class AuthRepository: ObservableObject {
    static let shared = AuthRepository()

    private let apiClient = APIClient.shared
    private let keychainManager = KeychainManager.shared

    private init() {}

    // MARK: - Authentication

    func login(email: String, password: String) async throws -> AuthData {
        let request = LoginRequest(email: email, password: password)

        let response: AuthResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.login,
            method: .post,
            body: request,
            requiresAuth: false
        )

        // Save tokens
        try await keychainManager.saveToken(response.data.accessToken)
        try await keychainManager.saveRefreshToken(response.data.refreshToken)
        try await keychainManager.saveUserId(response.data.user.id)
        try await keychainManager.saveUserEmail(response.data.user.email)

        return response.data
    }

    func signup(email: String, password: String, name: String, phone: String? = nil) async throws -> AuthData {
        let request = SignupRequest(email: email, password: password, name: name, phone: phone)

        let response: AuthResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.signup,
            method: .post,
            body: request,
            requiresAuth: false
        )

        // Save tokens
        try await keychainManager.saveToken(response.data.accessToken)
        try await keychainManager.saveRefreshToken(response.data.refreshToken)
        try await keychainManager.saveUserId(response.data.user.id)
        try await keychainManager.saveUserEmail(response.data.user.email)

        return response.data
    }

    func logout() async throws {
        do {
            // Try to logout on server
            let _: EmptyResponse = try await apiClient.request(
                endpoint: AppConstants.API.Endpoints.logout,
                method: .post
            )
        } catch {
            // Continue even if server logout fails
            print("Server logout failed: \(error)")
        }

        // Always clear local tokens
        await keychainManager.clearTokens()
    }

    func getCurrentUser() async throws -> User {
        let response: AuthResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.me,
            method: .get
        )

        return response.data.user
    }

    func refreshSession() async throws {
        _ = try await getCurrentUser()
    }

    // MARK: - Session Check

    func isAuthenticated() async -> Bool {
        do {
            let token = try await keychainManager.getToken()
            return token != nil && !token!.isEmpty
        } catch {
            return false
        }
    }

    func getUserId() async throws -> String? {
        try await keychainManager.getUserId()
    }

    func getUserEmail() async throws -> String? {
        try await keychainManager.getUserEmail()
    }

    // MARK: - Password Reset

    func sendPasswordReset(email: String) async throws {
        let request = ForgotPasswordRequest(email: email)

        let _: EmptyResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.forgotPassword,
            method: .post,
            body: request,
            requiresAuth: false
        )
    }
}

// MARK: - Empty Response

struct EmptyResponse: Decodable {
    let success: Bool
}
