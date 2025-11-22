package com.menumaker

import com.google.gson.Gson
import com.menumaker.data.remote.models.*
import org.junit.Assert.*
import org.junit.Test

/**
 * Unit tests for authentication models
 */
class AuthModelsTest {

    private val gson = Gson()

    // MARK: - User Model Tests

    @Test
    fun `user model decodes correctly from JSON`() {
        val json = """
        {
            "id": "user123",
            "email": "test@example.com",
            "name": "Test User",
            "phone": "+1234567890",
            "address": null,
            "photo_url": null,
            "role": "customer",
            "created_at": "2025-01-01T00:00:00Z",
            "updated_at": "2025-01-02T00:00:00Z"
        }
        """

        val user = gson.fromJson(json, UserDto::class.java)

        assertEquals("user123", user.id)
        assertEquals("test@example.com", user.email)
        assertEquals("Test User", user.name)
        assertEquals("+1234567890", user.phone)
        assertEquals("customer", user.role)
    }

    @Test
    fun `user isAdmin returns true for admin role`() {
        val adminUser = UserDto(
            id = "1",
            email = "admin@example.com",
            name = "Admin",
            phone = null,
            address = null,
            photoUrl = null,
            role = "admin",
            createdAt = "2025-01-01T00:00:00Z",
            updatedAt = null
        )

        assertTrue(adminUser.isAdmin)
        assertTrue(adminUser.isSeller)
    }

    @Test
    fun `user isAdmin returns false for customer role`() {
        val customer = UserDto(
            id = "2",
            email = "customer@example.com",
            name = "Customer",
            phone = null,
            address = null,
            photoUrl = null,
            role = "customer",
            createdAt = "2025-01-01T00:00:00Z",
            updatedAt = null
        )

        assertFalse(customer.isAdmin)
        assertFalse(customer.isSeller)
    }

    @Test
    fun `user isSeller returns true for seller role`() {
        val seller = UserDto(
            id = "3",
            email = "seller@example.com",
            name = "Seller",
            phone = null,
            address = null,
            photoUrl = null,
            role = "seller",
            createdAt = "2025-01-01T00:00:00Z",
            updatedAt = null
        )

        assertFalse(seller.isAdmin)
        assertTrue(seller.isSeller)
    }

    // MARK: - Request Model Tests

    @Test
    fun `LoginRequest encodes correctly`() {
        val request = LoginRequest(email = "test@example.com", password = "password123")
        val json = gson.toJson(request)

        assertTrue(json.contains("test@example.com"))
        assertTrue(json.contains("password123"))
    }

    @Test
    fun `SignupRequest encodes with all fields`() {
        val request = SignupRequest(
            email = "new@example.com",
            password = "secure123",
            name = "New User",
            phone = "+1234567890"
        )

        val json = gson.toJson(request)

        assertTrue(json.contains("new@example.com"))
        assertTrue(json.contains("secure123"))
        assertTrue(json.contains("New User"))
        assertTrue(json.contains("+1234567890"))
    }

    @Test
    fun `SignupRequest encodes without optional phone`() {
        val request = SignupRequest(
            email = "new@example.com",
            password = "secure123",
            name = "New User",
            phone = null
        )

        val json = gson.toJson(request)

        assertTrue(json.contains("new@example.com"))
        assertFalse(json.contains("phone"))
    }

    // MARK: - AuthResponse Tests

    @Test
    fun `AuthResponse decodes successfully`() {
        val json = """
        {
            "success": true,
            "data": {
                "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
                "refresh_token": "refresh_token_123",
                "user": {
                    "id": "user123",
                    "email": "test@example.com",
                    "name": "Test User",
                    "phone": null,
                    "address": null,
                    "photo_url": null,
                    "role": "customer",
                    "created_at": "2025-01-01T00:00:00Z",
                    "updated_at": null
                }
            }
        }
        """

        val response = gson.fromJson(json, AuthResponse::class.java)

        assertTrue(response.success)
        assertTrue(response.data.accessToken.startsWith("eyJ"))
        assertEquals("test@example.com", response.data.user.email)
    }

    @Test
    fun `AuthData contains valid tokens and user`() {
        val json = """
        {
            "access_token": "access_token_123",
            "refresh_token": "refresh_token_456",
            "user": {
                "id": "user123",
                "email": "test@example.com",
                "name": "Test User",
                "phone": null,
                "address": null,
                "photo_url": null,
                "role": "customer",
                "created_at": "2025-01-01T00:00:00Z",
                "updated_at": null
            }
        }
        """

        val authData = gson.fromJson(json, AuthData::class.java)

        assertEquals("access_token_123", authData.accessToken)
        assertEquals("refresh_token_456", authData.refreshToken)
        assertEquals("user123", authData.user.id)
    }

    @Test
    fun `ForgotPasswordRequest encodes correctly`() {
        val request = mapOf("email" to "forgot@example.com")
        val json = gson.toJson(request)

        assertTrue(json.contains("forgot@example.com"))
    }

    @Test
    fun `RefreshTokenRequest encodes correctly`() {
        val request = RefreshTokenRequest(refreshToken = "refresh_token_123")
        val json = gson.toJson(request)

        assertTrue(json.contains("refresh_token_123"))
    }
}
