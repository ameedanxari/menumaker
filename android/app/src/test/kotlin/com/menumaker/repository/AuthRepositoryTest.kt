package com.menumaker.repository

import com.google.common.truth.Truth.assertThat
import com.menumaker.data.common.Resource
import com.menumaker.data.local.datastore.TokenDataStore
import com.menumaker.data.remote.models.AuthData
import com.menumaker.data.remote.models.AuthResponse
import com.menumaker.data.repository.AuthRepositoryImpl
import com.menumaker.testutils.FakeApiService
import com.menumaker.testutils.TestDataFactory
import com.menumaker.testutils.TestDispatcherRule
import io.kotest.property.Arb
import io.kotest.property.arbitrary.arbitrary
import io.kotest.property.arbitrary.boolean
import io.kotest.property.arbitrary.string
import io.kotest.property.checkAll
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.test.runTest
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.mockito.Mockito
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import retrofit2.Response
import java.io.IOException

/**
 * Unit tests for AuthRepositoryImpl.
 * Tests login, signup, logout, and password reset flows.
 *
 * Requirements: 5.1, 5.2, 5.4, 5.5
 */
@OptIn(ExperimentalCoroutinesApi::class)
class AuthRepositoryTest {

    @get:Rule
    val dispatcherRule = TestDispatcherRule()

    private lateinit var fakeApiService: FakeApiService
    private lateinit var mockTokenDataStore: TokenDataStore
    private lateinit var repository: AuthRepositoryImpl

    @Before
    fun setup() {
        fakeApiService = FakeApiService()
        mockTokenDataStore = mock()
        repository = AuthRepositoryImpl(fakeApiService, mockTokenDataStore)
    }

    // ==================== Login Tests ====================

    @Test
    fun `login with valid credentials emits Loading then Success`() = runTest {
        // Given
        val authData = TestDataFactory.createAuthData(
            accessToken = "test-access-token",
            refreshToken = "test-refresh-token"
        )
        fakeApiService.loginResponse = Response.success(
            AuthResponse(success = true, data = authData)
        )

        // When
        val results = repository.login("test@example.com", "password123").toList()

        // Then
        assertThat(results).hasSize(2)
        assertThat(results[0]).isEqualTo(Resource.Loading)
        assertThat(results[1]).isInstanceOf(Resource.Success::class.java)
        
        val successResult = results[1] as Resource.Success<AuthData>
        assertThat(successResult.data.accessToken).isEqualTo("test-access-token")
        assertThat(successResult.data.refreshToken).isEqualTo("test-refresh-token")
    }

    @Test
    fun `login saves tokens on success`() = runTest {
        // Given
        val authData = TestDataFactory.createAuthData(
            accessToken = "saved-access-token",
            refreshToken = "saved-refresh-token",
            user = TestDataFactory.createUser(id = "user-123", email = "test@example.com")
        )
        fakeApiService.loginResponse = Response.success(
            AuthResponse(success = true, data = authData)
        )

        // When
        repository.login("test@example.com", "password123").toList()

        // Then
        verify(mockTokenDataStore).saveTokens("saved-access-token", "saved-refresh-token")
        verify(mockTokenDataStore).saveUserId("user-123")
        verify(mockTokenDataStore).saveUserEmail("test@example.com")
    }

    @Test
    fun `login with invalid credentials emits Loading then Error`() = runTest {
        // Given
        fakeApiService.errorCode = 401
        fakeApiService.errorMessage = "Invalid credentials"

        // When
        val results = repository.login("test@example.com", "wrongpassword").toList()

        // Then
        assertThat(results).hasSize(2)
        assertThat(results[0]).isEqualTo(Resource.Loading)
        assertThat(results[1]).isInstanceOf(Resource.Error::class.java)
    }

    @Test
    fun `login does not save tokens on error`() = runTest {
        // Given
        fakeApiService.errorCode = 401

        // When
        repository.login("test@example.com", "wrongpassword").toList()

        // Then
        verify(mockTokenDataStore, never()).saveTokens(any(), any())
    }

    @Test
    fun `login handles network error gracefully`() = runTest {
        // Given
        fakeApiService.shouldThrowException = IOException("Network unavailable")

        // When
        val results = repository.login("test@example.com", "password123").toList()

        // Then
        assertThat(results).hasSize(2)
        assertThat(results[0]).isEqualTo(Resource.Loading)
        assertThat(results[1]).isInstanceOf(Resource.Error::class.java)
        
        val errorResult = results[1] as Resource.Error
        assertThat(errorResult.message).contains("Network unavailable")
    }

    // ==================== Signup Tests ====================

    @Test
    fun `signup with valid data emits Loading then Success`() = runTest {
        // Given
        val authData = TestDataFactory.createAuthData(
            accessToken = "new-access-token",
            refreshToken = "new-refresh-token",
            user = TestDataFactory.createUser(name = "New User")
        )
        fakeApiService.signupResponse = Response.success(
            AuthResponse(success = true, data = authData)
        )

        // When
        val results = repository.signup("new@example.com", "password123", "New User").toList()

        // Then
        assertThat(results).hasSize(2)
        assertThat(results[0]).isEqualTo(Resource.Loading)
        assertThat(results[1]).isInstanceOf(Resource.Success::class.java)
        
        val successResult = results[1] as Resource.Success<AuthData>
        assertThat(successResult.data.user.name).isEqualTo("New User")
    }

    @Test
    fun `signup saves tokens on success`() = runTest {
        // Given
        val authData = TestDataFactory.createAuthData(
            accessToken = "signup-access-token",
            refreshToken = "signup-refresh-token",
            user = TestDataFactory.createUser(id = "new-user-123", email = "new@example.com")
        )
        fakeApiService.signupResponse = Response.success(
            AuthResponse(success = true, data = authData)
        )

        // When
        repository.signup("new@example.com", "password123", "New User").toList()

        // Then
        verify(mockTokenDataStore).saveTokens("signup-access-token", "signup-refresh-token")
        verify(mockTokenDataStore).saveUserId("new-user-123")
        verify(mockTokenDataStore).saveUserEmail("new@example.com")
    }

    @Test
    fun `signup with existing email emits Error`() = runTest {
        // Given
        fakeApiService.errorCode = 409
        fakeApiService.errorMessage = "Email already exists"

        // When
        val results = repository.signup("existing@example.com", "password123", "User").toList()

        // Then
        assertThat(results).hasSize(2)
        assertThat(results[0]).isEqualTo(Resource.Loading)
        assertThat(results[1]).isInstanceOf(Resource.Error::class.java)
    }

    @Test
    fun `signup handles network error gracefully`() = runTest {
        // Given
        fakeApiService.shouldThrowException = IOException("Connection timeout")

        // When
        val results = repository.signup("new@example.com", "password123", "New User").toList()

        // Then
        assertThat(results).hasSize(2)
        assertThat(results[0]).isEqualTo(Resource.Loading)
        assertThat(results[1]).isInstanceOf(Resource.Error::class.java)
        
        val errorResult = results[1] as Resource.Error
        assertThat(errorResult.message).contains("Connection timeout")
    }

    // ==================== Logout Tests ====================

    @Test
    fun `logout clears tokens on success`() = runTest {
        // Given
        fakeApiService.logoutResponse = Response.success(Unit)

        // When
        val results = repository.logout().toList()

        // Then
        assertThat(results).hasSize(2)
        assertThat(results[0]).isEqualTo(Resource.Loading)
        assertThat(results[1]).isInstanceOf(Resource.Success::class.java)
        verify(mockTokenDataStore).clearTokens()
    }

    @Test
    fun `logout clears tokens even when API call fails`() = runTest {
        // Given
        fakeApiService.shouldThrowException = IOException("Network error")

        // When
        val results = repository.logout().toList()

        // Then
        // Should still succeed and clear tokens
        assertThat(results).hasSize(2)
        assertThat(results[0]).isEqualTo(Resource.Loading)
        assertThat(results[1]).isInstanceOf(Resource.Success::class.java)
        verify(mockTokenDataStore).clearTokens()
    }

    // ==================== Password Reset Tests ====================

    @Test
    fun `sendPasswordReset with valid email emits Success`() = runTest {
        // Given
        fakeApiService.sendPasswordResetResponse = Response.success(Unit)

        // When
        val results = repository.sendPasswordReset("test@example.com").toList()

        // Then
        assertThat(results).hasSize(2)
        assertThat(results[0]).isEqualTo(Resource.Loading)
        assertThat(results[1]).isInstanceOf(Resource.Success::class.java)
    }

    @Test
    fun `sendPasswordReset with invalid email emits Error`() = runTest {
        // Given
        fakeApiService.errorCode = 404
        fakeApiService.errorMessage = "Email not found"

        // When
        val results = repository.sendPasswordReset("nonexistent@example.com").toList()

        // Then
        assertThat(results).hasSize(2)
        assertThat(results[0]).isEqualTo(Resource.Loading)
        assertThat(results[1]).isInstanceOf(Resource.Error::class.java)
    }

    @Test
    fun `sendPasswordReset handles network error gracefully`() = runTest {
        // Given
        fakeApiService.shouldThrowException = IOException("Network unavailable")

        // When
        val results = repository.sendPasswordReset("test@example.com").toList()

        // Then
        assertThat(results).hasSize(2)
        assertThat(results[0]).isEqualTo(Resource.Loading)
        assertThat(results[1]).isInstanceOf(Resource.Error::class.java)
    }

    // ==================== Change Password Tests ====================

    @Test
    fun `changePassword with valid passwords emits Success`() = runTest {
        // Given
        fakeApiService.changePasswordResponse = Response.success(Unit)

        // When
        val results = repository.changePassword("oldPassword", "newPassword").toList()

        // Then
        assertThat(results).hasSize(2)
        assertThat(results[0]).isEqualTo(Resource.Loading)
        assertThat(results[1]).isInstanceOf(Resource.Success::class.java)
    }

    @Test
    fun `changePassword with wrong current password emits Error`() = runTest {
        // Given
        fakeApiService.errorCode = 401
        fakeApiService.errorMessage = "Current password is incorrect"

        // When
        val results = repository.changePassword("wrongPassword", "newPassword").toList()

        // Then
        assertThat(results).hasSize(2)
        assertThat(results[0]).isEqualTo(Resource.Loading)
        assertThat(results[1]).isInstanceOf(Resource.Error::class.java)
    }

    // ==================== Get Current User Tests ====================

    @Test
    fun `getCurrentUser emits Loading then Success with user data`() = runTest {
        // Given - default response from FakeApiService

        // When
        val results = repository.getCurrentUser().toList()

        // Then
        assertThat(results).hasSize(2)
        assertThat(results[0]).isEqualTo(Resource.Loading)
        assertThat(results[1]).isInstanceOf(Resource.Success::class.java)
    }

    @Test
    fun `getCurrentUser saves user info on success`() = runTest {
        // Given - default response from FakeApiService with user id and email

        // When
        repository.getCurrentUser().toList()

        // Then
        verify(mockTokenDataStore).saveUserId(any())
        verify(mockTokenDataStore).saveUserEmail(any())
    }

    @Test
    fun `getCurrentUser handles unauthorized error`() = runTest {
        // Given
        fakeApiService.errorCode = 401

        // When
        val results = repository.getCurrentUser().toList()

        // Then
        assertThat(results).hasSize(2)
        assertThat(results[0]).isEqualTo(Resource.Loading)
        assertThat(results[1]).isInstanceOf(Resource.Error::class.java)
    }
}


// ==================== Property-Based Tests ====================

/**
 * **Feature: android-test-coverage, Property 13: Authentication Token Storage**
 * **Validates: Requirements 5.1**
 *
 * Property: For any successful login with valid credentials, the access token
 * and refresh token SHALL be stored and retrievable.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class AuthTokenStoragePropertyTest {

    @get:Rule
    val dispatcherRule = TestDispatcherRule()

    private lateinit var fakeApiService: FakeApiService
    private lateinit var mockTokenDataStore: TokenDataStore
    private lateinit var repository: AuthRepositoryImpl

    @Before
    fun setup() {
        fakeApiService = FakeApiService()
        mockTokenDataStore = mock()
        repository = AuthRepositoryImpl(fakeApiService, mockTokenDataStore)
    }

    // Custom Arb for email-like strings
    private fun arbEmail(): Arb<String> = arbitrary { rs ->
        val chars = ('a'..'z') + ('0'..'9')
        val localPart = (1..8).map { chars.random(rs.random) }.joinToString("")
        val domain = (1..5).map { chars.random(rs.random) }.joinToString("")
        "$localPart@$domain.com"
    }

    // Custom Arb for non-blank strings
    private fun arbNonBlankString(range: IntRange): Arb<String> = arbitrary { rs ->
        val chars = ('a'..'z') + ('A'..'Z') + ('0'..'9')
        val length = range.random(rs.random)
        (1..length).map { chars.random(rs.random) }.joinToString("")
    }

    @Test
    fun `property - for any valid auth response, tokens are stored`() = runTest {
        // Property: For any successful login, tokens SHALL be stored
        checkAll(
            iterations = 100,
            arbNonBlankString(10..50),  // accessToken
            arbNonBlankString(10..50),  // refreshToken
            arbNonBlankString(5..20),   // userId
            arbEmail()                   // email
        ) { accessToken, refreshToken, userId, email ->
            // Reset mock for each iteration
            Mockito.reset(mockTokenDataStore)
            
            // Given - a successful auth response with generated tokens
            val authData = TestDataFactory.createAuthData(
                accessToken = accessToken,
                refreshToken = refreshToken,
                user = TestDataFactory.createUser(id = userId, email = email)
            )
            fakeApiService.loginResponse = Response.success(
                AuthResponse(success = true, data = authData)
            )

            // When - login is called
            repository.login(email, "password123").toList()

            // Then - tokens should be saved with exact values
            verify(mockTokenDataStore).saveTokens(accessToken, refreshToken)
            verify(mockTokenDataStore).saveUserId(userId)
            verify(mockTokenDataStore).saveUserEmail(email)
        }
    }
}


/**
 * **Feature: android-test-coverage, Property 15: Logout Token Clearing**
 * **Validates: Requirements 5.4**
 *
 * Property: For any logged-in user, calling logout SHALL clear all stored tokens.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class LogoutTokenClearingPropertyTest {

    @get:Rule
    val dispatcherRule = TestDispatcherRule()

    private lateinit var fakeApiService: FakeApiService
    private lateinit var mockTokenDataStore: TokenDataStore
    private lateinit var repository: AuthRepositoryImpl

    @Before
    fun setup() {
        fakeApiService = FakeApiService()
        mockTokenDataStore = mock()
        repository = AuthRepositoryImpl(fakeApiService, mockTokenDataStore)
    }

    // Custom Arb for non-blank strings
    private fun arbNonBlankString(range: IntRange): Arb<String> = arbitrary { rs ->
        val chars = ('a'..'z') + ('A'..'Z') + ('0'..'9')
        val length = range.random(rs.random)
        (1..length).map { chars.random(rs.random) }.joinToString("")
    }

    @Test
    fun `property - logout always clears tokens regardless of API response`() = runTest {
        // Property: For any logout call, tokens SHALL be cleared
        checkAll(
            iterations = 100,
            Arb.boolean(),  // shouldApiSucceed
            Arb.boolean()   // shouldThrowException
        ) { shouldApiSucceed, shouldThrowException ->
            // Reset mock and API state for each iteration
            Mockito.reset(mockTokenDataStore)
            fakeApiService.reset()
            
            // Given - configure API behavior
            when {
                shouldThrowException -> {
                    fakeApiService.shouldThrowException = IOException("Network error")
                }
                !shouldApiSucceed -> {
                    fakeApiService.errorCode = 500
                }
                else -> {
                    fakeApiService.logoutResponse = Response.success(Unit)
                }
            }

            // When - logout is called
            repository.logout().toList()

            // Then - tokens should ALWAYS be cleared, regardless of API response
            verify(mockTokenDataStore).clearTokens()
        }
    }

    @Test
    fun `property - logout clears tokens for any previously stored token values`() = runTest {
        // Property: For any stored tokens, logout SHALL clear them
        checkAll(
            iterations = 100,
            arbNonBlankString(10..50),  // previousAccessToken
            arbNonBlankString(10..50)   // previousRefreshToken
        ) { previousAccessToken, previousRefreshToken ->
            // Reset mock for each iteration
            Mockito.reset(mockTokenDataStore)
            fakeApiService.reset()
            fakeApiService.logoutResponse = Response.success(Unit)

            // When - logout is called (regardless of what tokens were stored)
            val results = repository.logout().toList()

            // Then - clearTokens should be called
            verify(mockTokenDataStore).clearTokens()
            
            // And the result should be Success
            assertThat(results.last()).isInstanceOf(Resource.Success::class.java)
        }
    }
}
