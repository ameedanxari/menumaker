import Foundation
import Security

/// Keychain errors
enum KeychainError: Error, LocalizedError {
    case itemNotFound
    case duplicateItem
    case invalidData
    case unhandledError(status: OSStatus)

    var errorDescription: String? {
        switch self {
        case .itemNotFound:
            return "Item not found in keychain"
        case .duplicateItem:
            return "Item already exists in keychain"
        case .invalidData:
            return "Invalid data"
        case .unhandledError(let status):
            return "Keychain error: \(status)"
        }
    }
}

/// Keychain manager for secure storage
@MainActor
class KeychainManager {
    static let shared = KeychainManager()

    private let serviceName = "com.menumaker.app"

    private init() {}

    // MARK: - Token Management

    func saveToken(_ token: String) async throws {
        try await save(token, forKey: AppConstants.Storage.authToken)
    }

    func getToken() async throws -> String? {
        try await get(forKey: AppConstants.Storage.authToken)
    }

    func saveRefreshToken(_ token: String) async throws {
        try await save(token, forKey: AppConstants.Storage.refreshToken)
    }

    func getRefreshToken() async throws -> String? {
        try await get(forKey: AppConstants.Storage.refreshToken)
    }

    func clearTokens() async {
        do {
            try await delete(forKey: AppConstants.Storage.authToken)
            try await delete(forKey: AppConstants.Storage.refreshToken)
        } catch {
            print("Error clearing tokens: \(error)")
        }
    }

    // MARK: - User Data

    func saveUserId(_ userId: String) async throws {
        try await save(userId, forKey: AppConstants.Storage.userId)
    }

    func getUserId() async throws -> String? {
        try await get(forKey: AppConstants.Storage.userId)
    }

    func saveBusinessId(_ businessId: String) async throws {
        try await save(businessId, forKey: AppConstants.Storage.businessId)
    }

    func getBusinessId() async throws -> String? {
        try await get(forKey: AppConstants.Storage.businessId)
    }

    func saveUserEmail(_ email: String) async throws {
        try await save(email, forKey: AppConstants.Storage.userEmail)
    }

    func getUserEmail() async throws -> String? {
        try await get(forKey: AppConstants.Storage.userEmail)
    }

    // MARK: - Generic Methods

    private func save(_ value: String, forKey key: String) async throws {
        guard let data = value.data(using: .utf8) else {
            throw KeychainError.invalidData
        }

        // Delete any existing item
        try? await delete(forKey: key)

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock
        ]

        let status = SecItemAdd(query as CFDictionary, nil)

        guard status == errSecSuccess else {
            throw KeychainError.unhandledError(status: status)
        }
    }

    private func get(forKey key: String) async throws -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status != errSecItemNotFound else {
            return nil
        }

        guard status == errSecSuccess else {
            throw KeychainError.unhandledError(status: status)
        }

        guard let data = result as? Data,
              let value = String(data: data, encoding: .utf8) else {
            throw KeychainError.invalidData
        }

        return value
    }

    private func delete(forKey key: String) async throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key
        ]

        let status = SecItemDelete(query as CFDictionary)

        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError.unhandledError(status: status)
        }
    }

    func deleteAll() async throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName
        ]

        let status = SecItemDelete(query as CFDictionary)

        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError.unhandledError(status: status)
        }
    }
}
