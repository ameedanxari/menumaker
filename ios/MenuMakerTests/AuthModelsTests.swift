//
//  AuthModelsTests.swift
//  MenuMakerTests
//
//  Unit tests for authentication models
//

import Foundation
import Testing
@testable import MenuMaker

struct AuthModelsTests {

    // MARK: - User Model Tests

    @Test("User model decodes correctly from JSON")
    @MainActor
    func testUserDecoding() throws {
        let json = """
        {
            "id": "user123",
            "email": "test@example.com",
            "name": "Test User",
            "phone": "+1234567890",
            "role": "customer",
            "createdAt": "2025-01-01T00:00:00Z",
            "updatedAt": "2025-01-02T00:00:00Z"
        }
        """

        let data = Data(json.utf8)
        let decoder = JSONDecoder()
        let user = try decoder.decode(User.self, from: data)

        #expect(user.id == "user123")
        #expect(user.email == "test@example.com")
        #expect(user.name == "Test User")
        #expect(user.phone == "+1234567890")
        #expect(user.role == "customer")
    }

    @Test("User isAdmin returns true for admin role")
    func testUserIsAdmin() {
        let adminUser = User(
            id: "1",
            email: "admin@example.com",
            name: "Admin",
            phone: nil,
            address: nil,
            photoUrl: nil,
            role: "admin",
            createdAt: "2025-01-01T00:00:00Z",
            updatedAt: nil
        )

        #expect(adminUser.isAdmin == true)
        #expect(adminUser.isSeller == true)
    }

    @Test("User isAdmin returns false for customer role")
    func testUserIsNotAdmin() {
        let customer = User(
            id: "2",
            email: "customer@example.com",
            name: "Customer",
            phone: nil,
            address: nil,
            photoUrl: nil,
            role: "customer",
            createdAt: "2025-01-01T00:00:00Z",
            updatedAt: nil
        )

        #expect(customer.isAdmin == false)
        #expect(customer.isSeller == false)
    }

    @Test("User isSeller returns true for seller role")
    func testUserIsSeller() {
        let seller = User(
            id: "3",
            email: "seller@example.com",
            name: "Seller",
            phone: nil,
            address: nil,
            photoUrl: nil,
            role: "seller",
            createdAt: "2025-01-01T00:00:00Z",
            updatedAt: nil
        )

        #expect(seller.isAdmin == false)
        #expect(seller.isSeller == true)
    }

    // MARK: - Request Model Tests

    @Test("LoginRequest encodes correctly")
    @MainActor
    func testLoginRequestEncoding() throws {
        let request = LoginRequest(email: "test@example.com", password: "password123")
        let encoder = JSONEncoder()
        let data = try encoder.encode(request)
        let json = try JSONSerialization.jsonObject(with: data) as? [String: String]

        #expect(json?["email"] == "test@example.com")
        #expect(json?["password"] == "password123")
    }

    @Test("SignupRequest encodes with all fields")
    @MainActor
    func testSignupRequestEncoding() throws {
        let request = SignupRequest(
            email: "new@example.com",
            password: "secure123",
            name: "New User",
            phone: "+1234567890"
        )

        let encoder = JSONEncoder()
        let data = try encoder.encode(request)
        let json = try JSONSerialization.jsonObject(with: data) as? [String: String]

        #expect(json?["email"] == "new@example.com")
        #expect(json?["password"] == "secure123")
        #expect(json?["name"] == "New User")
        #expect(json?["phone"] == "+1234567890")
    }

    @Test("SignupRequest encodes without optional phone")
    @MainActor
    func testSignupRequestWithoutPhone() throws {
        let request = SignupRequest(
            email: "new@example.com",
            password: "secure123",
            name: "New User",
            phone: nil
        )

        let encoder = JSONEncoder()
        let data = try encoder.encode(request)
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]

        #expect(json?["email"] as? String == "new@example.com")
        #expect(json?["phone"] == nil)
    }

    // MARK: - AuthResponse Tests

    @Test("AuthResponse decodes successfully")
    @MainActor
    func testAuthResponseDecoding() throws {
        let json = """
        {
            "success": true,
            "data": {
                "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
                "refreshToken": "refresh_token_123",
                "user": {
                    "id": "user123",
                    "email": "test@example.com",
                    "name": "Test User",
                    "phone": null,
                    "role": "customer",
                    "createdAt": "2025-01-01T00:00:00Z",
                    "updatedAt": null
                }
            }
        }
        """

        let data = Data(json.utf8)
        let decoder = JSONDecoder()
        let response = try decoder.decode(AuthResponse.self, from: data)

        #expect(response.success == true)
        #expect(response.data.accessToken.starts(with: "eyJ"))
        #expect(response.data.user.email == "test@example.com")
    }

    @Test("AuthData contains valid tokens and user")
    @MainActor
    func testAuthDataStructure() throws {
        let json = """
        {
            "accessToken": "access_token_123",
            "refreshToken": "refresh_token_456",
            "user": {
                "id": "user123",
                "email": "test@example.com",
                "name": "Test User",
                "phone": null,
                "role": "customer",
                "createdAt": "2025-01-01T00:00:00Z",
                "updatedAt": null
            }
        }
        """

        let data = Data(json.utf8)
        let decoder = JSONDecoder()
        let authData = try decoder.decode(AuthData.self, from: data)

        #expect(authData.accessToken == "access_token_123")
        #expect(authData.refreshToken == "refresh_token_456")
        #expect(authData.user.id == "user123")
    }
}
