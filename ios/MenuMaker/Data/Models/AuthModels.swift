import Foundation

// MARK: - Request Models

struct LoginRequest: Encodable {
    let email: String
    let password: String
}

struct SignupRequest: Encodable {
    let email: String
    let password: String
    let name: String
    let phone: String?
}

struct RefreshTokenRequest: Encodable {
    let refreshToken: String
}

struct ForgotPasswordRequest: Encodable {
    let email: String
}

struct UpdateProfileRequest: Encodable {
    let name: String?
    let phone: String?
    let address: String?
}

struct ChangePasswordRequest: Encodable {
    let currentPassword: String
    let newPassword: String
}

// MARK: - Response Models

struct AuthResponse: Decodable {
    let success: Bool
    let data: AuthData
}

struct AuthData: Decodable {
    let accessToken: String
    let refreshToken: String
    let user: User
}

struct UserResponse: Decodable {
    let success: Bool
    let data: UserData
}

struct UserData: Decodable {
    let user: User
}

struct MessageResponse: Decodable {
    let success: Bool
    let message: String
}

struct User: Codable, Identifiable {
    let id: String
    let email: String
    let name: String
    let phone: String?
    let address: String?
    let photoUrl: String?
    let role: String
    let businessId: String?  // Business ID for seller accounts
    let createdAt: String
    let updatedAt: String?

    var isAdmin: Bool {
        role == "admin"
    }

    var isSeller: Bool {
        role == "seller" || role == "admin"
    }

    var formattedCreatedDate: String {
        guard let date = ISO8601DateFormatter().date(from: createdAt) else {
            return createdAt
        }

        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: date)
    }

    var formattedPhone: String {
        phone ?? "Not provided"
    }

    var formattedAddress: String {
        address ?? "Not provided"
    }
}
