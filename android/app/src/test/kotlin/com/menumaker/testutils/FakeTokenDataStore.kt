package com.menumaker.testutils

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map

/**
 * Fake implementation of TokenDataStore for unit testing.
 * Provides in-memory storage for tokens without requiring Android Context.
 *
 * Requirements: 1.4 - Use mocked ApiService and DAO dependencies to ensure deterministic results
 *
 * Usage:
 * ```
 * val fakeTokenDataStore = FakeTokenDataStore()
 * fakeTokenDataStore.saveTokens("access-token", "refresh-token")
 * 
 * // Verify tokens are stored
 * fakeTokenDataStore.getAccessToken().first() // returns "access-token"
 * ```
 */
class FakeTokenDataStore {

    private val accessTokenFlow = MutableStateFlow<String?>(null)
    private val refreshTokenFlow = MutableStateFlow<String?>(null)
    private val userIdFlow = MutableStateFlow<String?>(null)
    private val userEmailFlow = MutableStateFlow<String?>(null)
    private val businessIdFlow = MutableStateFlow<String?>(null)

    /**
     * Returns a Flow of the current access token.
     */
    fun getAccessToken(): Flow<String?> = accessTokenFlow

    /**
     * Returns a Flow of the current refresh token.
     */
    fun getRefreshToken(): Flow<String?> = refreshTokenFlow

    /**
     * Returns a Flow of the current user ID.
     */
    fun getUserId(): Flow<String?> = userIdFlow

    /**
     * Returns a Flow of the current user email.
     */
    fun getUserEmail(): Flow<String?> = userEmailFlow

    /**
     * Returns a Flow of the current business ID.
     */
    fun getBusinessId(): Flow<String?> = businessIdFlow

    /**
     * Saves access and refresh tokens.
     */
    suspend fun saveTokens(accessToken: String, refreshToken: String) {
        accessTokenFlow.value = accessToken
        refreshTokenFlow.value = refreshToken
    }

    /**
     * Saves the user ID.
     */
    suspend fun saveUserId(userId: String) {
        userIdFlow.value = userId
    }

    /**
     * Saves the user email.
     */
    suspend fun saveUserEmail(email: String) {
        userEmailFlow.value = email
    }

    /**
     * Saves the business ID.
     */
    suspend fun saveBusinessId(businessId: String) {
        businessIdFlow.value = businessId
    }

    /**
     * Clears all stored tokens and user data.
     */
    suspend fun clearTokens() {
        accessTokenFlow.value = null
        refreshTokenFlow.value = null
        userIdFlow.value = null
        userEmailFlow.value = null
        businessIdFlow.value = null
    }

    // ==================== Test Helper Methods ====================

    /**
     * Returns the current access token value directly (for test assertions).
     */
    fun getCurrentAccessToken(): String? = accessTokenFlow.value

    /**
     * Returns the current refresh token value directly (for test assertions).
     */
    fun getCurrentRefreshToken(): String? = refreshTokenFlow.value

    /**
     * Returns the current user ID value directly (for test assertions).
     */
    fun getCurrentUserId(): String? = userIdFlow.value

    /**
     * Returns the current user email value directly (for test assertions).
     */
    fun getCurrentUserEmail(): String? = userEmailFlow.value

    /**
     * Returns the current business ID value directly (for test assertions).
     */
    fun getCurrentBusinessId(): String? = businessIdFlow.value

    /**
     * Checks if any tokens are currently stored.
     */
    fun hasTokens(): Boolean = accessTokenFlow.value != null && refreshTokenFlow.value != null

    /**
     * Resets all stored data to initial state.
     */
    fun reset() {
        accessTokenFlow.value = null
        refreshTokenFlow.value = null
        userIdFlow.value = null
        userEmailFlow.value = null
        businessIdFlow.value = null
    }

    /**
     * Pre-populates the store with test tokens for testing authenticated scenarios.
     */
    fun populateWithTestTokens(
        accessToken: String = "test-access-token",
        refreshToken: String = "test-refresh-token",
        userId: String = "test-user-id",
        userEmail: String = "test@example.com",
        businessId: String? = null
    ) {
        accessTokenFlow.value = accessToken
        refreshTokenFlow.value = refreshToken
        userIdFlow.value = userId
        userEmailFlow.value = userEmail
        businessIdFlow.value = businessId
    }
}
