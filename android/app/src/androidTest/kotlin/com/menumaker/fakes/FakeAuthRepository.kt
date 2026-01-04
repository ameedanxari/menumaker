package com.menumaker.fakes

import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.AuthData
import com.menumaker.data.remote.models.UserDto
import com.menumaker.data.repository.AuthRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

/**
 * Fake implementation of AuthRepository for UI tests.
 * Provides configurable responses for deterministic testing.
 */
class FakeAuthRepository : AuthRepository {

    // Configurable responses
    var loginResponse: Resource<AuthData>? = null
    var signupResponse: Resource<AuthData>? = null
    var logoutResponse: Resource<Unit> = Resource.Success(Unit)
    var isAuthenticatedValue: Boolean = false
    var passwordResetResponse: Resource<Unit> = Resource.Success(Unit)
    var updateProfileResponse: Resource<AuthData>? = null
    var changePasswordResponse: Resource<Unit> = Resource.Success(Unit)
    var currentUserResponse: Resource<UserDto>? = null

    // Track method calls for verification
    var loginCallCount = 0
    var signupCallCount = 0
    var logoutCallCount = 0
    var lastLoginEmail: String? = null
    var lastLoginPassword: String? = null
    var lastSignupEmail: String? = null
    var lastSignupPassword: String? = null
    var lastSignupName: String? = null

    // Default test data
    private val defaultUser = UserDto(
        id = "test-user-id",
        email = "test@example.com",
        name = "Test User",
        phone = "+1234567890",
        address = "123 Test St",
        photoUrl = null,
        role = "customer",
        createdAt = "2025-01-01T00:00:00Z",
        updatedAt = null
    )

    private val defaultAuthData = AuthData(
        accessToken = "test-access-token",
        refreshToken = "test-refresh-token",
        user = defaultUser
    )

    override fun login(email: String, password: String): Flow<Resource<AuthData>> = flow {
        emit(Resource.Loading)
        loginCallCount++
        lastLoginEmail = email
        lastLoginPassword = password
        
        val response = loginResponse ?: Resource.Success(defaultAuthData)
        emit(response)
    }

    override fun signup(email: String, password: String, name: String): Flow<Resource<AuthData>> = flow {
        emit(Resource.Loading)
        signupCallCount++
        lastSignupEmail = email
        lastSignupPassword = password
        lastSignupName = name
        
        val response = signupResponse ?: Resource.Success(defaultAuthData.copy(
            user = defaultUser.copy(email = email, name = name)
        ))
        emit(response)
    }

    override fun logout(): Flow<Resource<Unit>> = flow {
        emit(Resource.Loading)
        logoutCallCount++
        isAuthenticatedValue = false
        emit(logoutResponse)
    }

    override fun isAuthenticated(): Flow<Boolean> = flow {
        emit(isAuthenticatedValue)
    }

    override fun sendPasswordReset(email: String): Flow<Resource<Unit>> = flow {
        emit(Resource.Loading)
        emit(passwordResetResponse)
    }

    override fun updateProfile(updates: Map<String, Any>): Flow<Resource<AuthData>> = flow {
        emit(Resource.Loading)
        val response = updateProfileResponse ?: Resource.Success(defaultAuthData)
        emit(response)
    }

    override fun changePassword(current: String, new: String): Flow<Resource<Unit>> = flow {
        emit(Resource.Loading)
        emit(changePasswordResponse)
    }

    override fun getCurrentUser(): Flow<Resource<UserDto>> = flow {
        emit(Resource.Loading)
        val response = currentUserResponse ?: Resource.Success(defaultUser)
        emit(response)
    }

    /**
     * Reset all state for clean test setup
     */
    fun reset() {
        loginResponse = null
        signupResponse = null
        logoutResponse = Resource.Success(Unit)
        isAuthenticatedValue = false
        passwordResetResponse = Resource.Success(Unit)
        updateProfileResponse = null
        changePasswordResponse = Resource.Success(Unit)
        currentUserResponse = null
        loginCallCount = 0
        signupCallCount = 0
        logoutCallCount = 0
        lastLoginEmail = null
        lastLoginPassword = null
        lastSignupEmail = null
        lastSignupPassword = null
        lastSignupName = null
    }

    /**
     * Configure for successful login scenario
     */
    fun configureSuccessfulLogin(user: UserDto = defaultUser) {
        loginResponse = Resource.Success(AuthData(
            accessToken = "test-access-token",
            refreshToken = "test-refresh-token",
            user = user
        ))
        isAuthenticatedValue = true
    }

    /**
     * Configure for failed login scenario
     */
    fun configureFailedLogin(errorMessage: String = "Invalid credentials") {
        loginResponse = Resource.Error(errorMessage)
        isAuthenticatedValue = false
    }
}
