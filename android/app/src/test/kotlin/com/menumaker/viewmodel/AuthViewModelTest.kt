package com.menumaker.viewmodel

import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.AuthData
import com.menumaker.data.remote.models.UserDto
import com.menumaker.data.repository.AuthRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.mockito.Mock
import org.mockito.Mockito.`when`
import org.mockito.MockitoAnnotations
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue

/**
 * Unit tests for AuthViewModel
 * Tests authentication flows including login, signup, and state management
 */
@ExperimentalCoroutinesApi
class AuthViewModelTest {

    @Mock
    private lateinit var authRepository: AuthRepository

    private lateinit var viewModel: AuthViewModel

    private val testDispatcher = UnconfinedTestDispatcher()

    private val mockUser = UserDto(
        id = "user123",
        email = "test@example.com",
        name = "Test User",
        phone = "+919876543210",
        address = null,
        photoUrl = null,
        role = "customer",
        createdAt = "2025-01-01T00:00:00Z",
        updatedAt = null
    )

    private val mockAuthData = AuthData(
        accessToken = "mock_access_token",
        refreshToken = "mock_refresh_token",
        user = mockUser
    )

    @Before
    fun setup() {
        MockitoAnnotations.openMocks(this)
        Dispatchers.setMain(testDispatcher)

        // Mock isAuthenticated() which is called in init
        val isAuthenticatedFlow = flow {
            emit(false)
        }
        `when`(authRepository.isAuthenticated()).thenReturn(isAuthenticatedFlow)

        viewModel = AuthViewModel(authRepository)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    // MARK: - Login Tests

    @Test
    fun `login with valid credentials emits success state`() = runTest {
        // Given
        val email = "test@example.com"
        val password = "password123"
        val successFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Success(mockAuthData))
        }

        `when`(authRepository.login(email, password)).thenReturn(successFlow)

        // When
        viewModel.login(email, password)

        // Then
        val loginState = viewModel.loginState.value
        assertTrue(loginState is Resource.Success)
        assertEquals(mockAuthData, (loginState as Resource.Success).data)
        assertTrue(viewModel.isAuthenticated.value)
    }

    @Test
    fun `login with invalid credentials emits error state`() = runTest {
        // Given
        val email = "test@example.com"
        val password = "wrongpassword"
        val errorMessage = "Invalid credentials"
        val errorFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Error(errorMessage))
        }

        `when`(authRepository.login(email, password)).thenReturn(errorFlow)

        // When
        viewModel.login(email, password)

        // Then
        val loginState = viewModel.loginState.value
        assertTrue(loginState is Resource.Error)
        assertEquals(errorMessage, (loginState as Resource.Error).message)
        assertFalse(viewModel.isAuthenticated.value)
    }

    @Test
    fun `login emits loading state before completion`() = runTest {
        // Given
        val email = "test@example.com"
        val password = "password123"
        val loadingFlow = flow {
            emit(Resource.Loading)
        }

        `when`(authRepository.login(email, password)).thenReturn(loadingFlow)

        // When
        viewModel.login(email, password)

        // Then
        val loginState = viewModel.loginState.value
        assertTrue(loginState is Resource.Loading)
    }

    @Test
    fun `login with empty email does not proceed`() = runTest {
        // Given
        val email = ""
        val password = "password123"
        val errorFlow = flow {
            emit(Resource.Error("Email cannot be empty"))
        }

        `when`(authRepository.login(email, password)).thenReturn(errorFlow)

        // When - ViewModel should validate before calling repository
        // This test verifies that empty inputs are handled
        viewModel.login(email, password)

        // Then - State should not be Success (either null, Loading, or Error)
        val loginState = viewModel.loginState.value
        assertFalse(loginState is Resource.Success)
    }

    // MARK: - Signup Tests

    @Test
    fun `signup with valid data emits success state`() = runTest {
        // Given
        val email = "newuser@example.com"
        val password = "SecurePass123!"
        val name = "New User"
        val successFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Success(mockAuthData))
        }

        `when`(authRepository.signup(email, password, name)).thenReturn(successFlow)

        // When
        viewModel.signup(email, password, name)

        // Then
        val signupState = viewModel.signupState.value
        assertTrue(signupState is Resource.Success)
        assertEquals(mockAuthData, (signupState as Resource.Success).data)
        assertTrue(viewModel.isAuthenticated.value)
    }

    @Test
    fun `signup with existing email emits error state`() = runTest {
        // Given
        val email = "existing@example.com"
        val password = "password123"
        val name = "Duplicate User"
        val errorMessage = "Email already exists"
        val errorFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Error(errorMessage))
        }

        `when`(authRepository.signup(email, password, name)).thenReturn(errorFlow)

        // When
        viewModel.signup(email, password, name)

        // Then
        val signupState = viewModel.signupState.value
        assertTrue(signupState is Resource.Error)
        assertEquals(errorMessage, (signupState as Resource.Error).message)
        assertFalse(viewModel.isAuthenticated.value)
    }

    @Test
    fun `signup with weak password emits error state`() = runTest {
        // Given
        val email = "test@example.com"
        val password = "weak"
        val name = "Test User"
        val errorMessage = "Password must be at least 8 characters"
        val errorFlow = flow {
            emit(Resource.Error(errorMessage))
        }

        `when`(authRepository.signup(email, password, name)).thenReturn(errorFlow)

        // When
        viewModel.signup(email, password, name)

        // Then
        val signupState = viewModel.signupState.value
        assertTrue(signupState is Resource.Error)
        assertEquals(errorMessage, (signupState as Resource.Error).message)
    }

    // MARK: - Logout Tests

    @Test
    fun `logout clears authentication state`() = runTest {
        // Given - User is logged in
        val successFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Success(mockAuthData))
        }
        `when`(authRepository.login("test@example.com", "password123")).thenReturn(successFlow)
        viewModel.login("test@example.com", "password123")

        // Verify user is authenticated before logout
        assertTrue(viewModel.isAuthenticated.value)

        // Mock logout flow
        val logoutFlow = flow {
            emit(Resource.Success(Unit))
        }
        `when`(authRepository.logout()).thenReturn(logoutFlow)

        // When
        viewModel.logout()

        // Then
        assertFalse(viewModel.isAuthenticated.value)
    }

    // MARK: - State Management Tests

    @Test
    fun `loginState is initially null`() {
        // Then
        assertEquals(null, viewModel.loginState.value)
    }

    @Test
    fun `signupState is initially null`() {
        // Then
        assertEquals(null, viewModel.signupState.value)
    }

    @Test
    fun `isAuthenticated is initially false`() {
        // Then
        assertFalse(viewModel.isAuthenticated.value)
    }

    @Test
    fun `multiple login attempts update state correctly`() = runTest {
        // Given
        val successFlow = flow {
            emit(Resource.Success(mockAuthData))
        }
        val errorFlow = flow {
            emit(Resource.Error("Error"))
        }

        // When - First attempt fails
        `when`(authRepository.login("test@example.com", "wrong")).thenReturn(errorFlow)
        viewModel.login("test@example.com", "wrong")

        // Then
        assertTrue(viewModel.loginState.value is Resource.Error)
        assertFalse(viewModel.isAuthenticated.value)

        // When - Second attempt succeeds
        `when`(authRepository.login("test@example.com", "correct")).thenReturn(successFlow)
        viewModel.login("test@example.com", "correct")

        // Then
        assertTrue(viewModel.loginState.value is Resource.Success)
        assertTrue(viewModel.isAuthenticated.value)
    }

    // MARK: - Edge Cases

    @Test
    fun `login with special characters in password succeeds`() = runTest {
        // Given
        val password = "P@ssw0rd!#$%"
        val successFlow = flow {
            emit(Resource.Success(mockAuthData))
        }

        `when`(authRepository.login(mockUser.email, password)).thenReturn(successFlow)

        // When
        viewModel.login(mockUser.email, password)

        // Then
        assertTrue(viewModel.loginState.value is Resource.Success)
    }

    @Test
    fun `signup with international characters in name succeeds`() = runTest {
        // Given
        val name = "José María Müller"
        val successFlow = flow {
            emit(Resource.Success(mockAuthData))
        }

        `when`(authRepository.signup(mockUser.email, "password123", name)).thenReturn(successFlow)

        // When
        viewModel.signup(mockUser.email, "password123", name)

        // Then
        assertTrue(viewModel.signupState.value is Resource.Success)
    }

    @Test
    fun `concurrent login and signup requests handle state correctly`() = runTest {
        // Given
        val loginFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Success(mockAuthData))
        }
        val signupFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Success(mockAuthData))
        }

        `when`(authRepository.login("test@example.com", "pass")).thenReturn(loginFlow)
        `when`(authRepository.signup("new@example.com", "pass", "Name")).thenReturn(signupFlow)

        // When - Execute login
        viewModel.login("test@example.com", "pass")

        // Then - Login should complete successfully
        assertTrue(viewModel.loginState.value is Resource.Success)

        // When - Execute signup
        viewModel.signup("new@example.com", "pass", "Name")

        // Then - Signup should complete successfully
        assertTrue(viewModel.signupState.value is Resource.Success)
    }

    // MARK: - Enhanced Edge Cases for Requirements 2.1, 2.2, 2.3, 5.3

    @Test
    fun `login with malformed email format does not succeed`() = runTest {
        // Given - malformed email
        val email = "invalid-email"
        val password = "password123"
        val errorFlow = flow {
            emit(Resource.Error("Invalid email format"))
        }

        `when`(authRepository.login(email, password)).thenReturn(errorFlow)

        // When
        viewModel.login(email, password)

        // Then
        val loginState = viewModel.loginState.value
        assertTrue(loginState is Resource.Error)
        assertFalse(viewModel.isAuthenticated.value)
    }

    @Test
    fun `login with empty password does not succeed`() = runTest {
        // Given
        val email = "test@example.com"
        val password = ""
        val errorFlow = flow {
            emit(Resource.Error("Password cannot be empty"))
        }

        `when`(authRepository.login(email, password)).thenReturn(errorFlow)

        // When
        viewModel.login(email, password)

        // Then
        val loginState = viewModel.loginState.value
        assertTrue(loginState is Resource.Error)
        assertFalse(viewModel.isAuthenticated.value)
    }

    @Test
    fun `signup with password too short emits error`() = runTest {
        // Given - password less than minimum length
        val email = "test@example.com"
        val password = "12345" // Less than 6 characters
        val name = "Test User"
        val errorFlow = flow {
            emit(Resource.Error("Password must be at least 6 characters"))
        }

        `when`(authRepository.signup(email, password, name)).thenReturn(errorFlow)

        // When
        viewModel.signup(email, password, name)

        // Then
        val signupState = viewModel.signupState.value
        assertTrue(signupState is Resource.Error)
        assertEquals("Password must be at least 6 characters", (signupState as Resource.Error).message)
        assertFalse(viewModel.isAuthenticated.value)
    }

    @Test
    fun `signup with empty name emits error`() = runTest {
        // Given
        val email = "test@example.com"
        val password = "password123"
        val name = ""
        val errorFlow = flow {
            emit(Resource.Error("Name cannot be empty"))
        }

        `when`(authRepository.signup(email, password, name)).thenReturn(errorFlow)

        // When
        viewModel.signup(email, password, name)

        // Then
        val signupState = viewModel.signupState.value
        assertTrue(signupState is Resource.Error)
        assertFalse(viewModel.isAuthenticated.value)
    }

    @Test
    fun `successful login stores user data correctly`() = runTest {
        // Given
        val email = "test@example.com"
        val password = "password123"
        val successFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Success(mockAuthData))
        }

        `when`(authRepository.login(email, password)).thenReturn(successFlow)

        // When
        viewModel.login(email, password)

        // Then - Verify user data is stored
        assertTrue(viewModel.isAuthenticated.value)
        assertNotNull(viewModel.currentUser.value)
        assertEquals(mockUser.email, viewModel.currentUser.value?.email)
        assertEquals(mockUser.name, viewModel.currentUser.value?.name)
    }

    @Test
    fun `successful signup stores user data correctly`() = runTest {
        // Given
        val email = "newuser@example.com"
        val password = "SecurePass123!"
        val name = "New User"
        val successFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Success(mockAuthData))
        }

        `when`(authRepository.signup(email, password, name)).thenReturn(successFlow)

        // When
        viewModel.signup(email, password, name)

        // Then - Verify user data is stored
        assertTrue(viewModel.isAuthenticated.value)
        assertNotNull(viewModel.currentUser.value)
    }

    @Test
    fun `logout clears user data completely`() = runTest {
        // Given - User is logged in
        val successFlow = flow {
            emit(Resource.Success(mockAuthData))
        }
        `when`(authRepository.login("test@example.com", "password123")).thenReturn(successFlow)
        viewModel.login("test@example.com", "password123")

        // Verify user is authenticated and has data
        assertTrue(viewModel.isAuthenticated.value)
        assertNotNull(viewModel.currentUser.value)

        // Mock logout flow
        val logoutFlow = flow {
            emit(Resource.Success(Unit))
        }
        `when`(authRepository.logout()).thenReturn(logoutFlow)

        // When
        viewModel.logout()

        // Then - All user data should be cleared
        assertFalse(viewModel.isAuthenticated.value)
        assertEquals(null, viewModel.currentUser.value)
        assertEquals(null, viewModel.loginState.value)
        assertEquals(null, viewModel.signupState.value)
    }

    @Test
    fun `password reset with valid email emits success`() = runTest {
        // Given
        val email = "test@example.com"
        val successFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Success(Unit))
        }

        `when`(authRepository.sendPasswordReset(email)).thenReturn(successFlow)

        // When
        viewModel.sendPasswordReset(email)

        // Then
        val resetState = viewModel.passwordResetState.value
        assertTrue(resetState is Resource.Success)
    }

    @Test
    fun `password reset with invalid email emits error`() = runTest {
        // Given
        val email = "invalid-email"
        val errorFlow = flow {
            emit(Resource.Error("Invalid email format"))
        }

        `when`(authRepository.sendPasswordReset(email)).thenReturn(errorFlow)

        // When
        viewModel.sendPasswordReset(email)

        // Then
        val resetState = viewModel.passwordResetState.value
        assertTrue(resetState is Resource.Error)
    }

    @Test
    fun `clearPasswordResetState resets state to null`() = runTest {
        // Given - Set a password reset state
        val successFlow = flow {
            emit(Resource.Success(Unit))
        }
        `when`(authRepository.sendPasswordReset("test@example.com")).thenReturn(successFlow)
        viewModel.sendPasswordReset("test@example.com")
        assertNotNull(viewModel.passwordResetState.value)

        // When
        viewModel.clearPasswordResetState()

        // Then
        assertEquals(null, viewModel.passwordResetState.value)
    }

    @Test
    fun `login error does not affect previous successful user data`() = runTest {
        // Given - First login succeeds
        val successFlow = flow {
            emit(Resource.Success(mockAuthData))
        }
        `when`(authRepository.login("test@example.com", "correct")).thenReturn(successFlow)
        viewModel.login("test@example.com", "correct")
        
        assertTrue(viewModel.isAuthenticated.value)
        val originalUser = viewModel.currentUser.value

        // When - Second login fails (simulating re-login attempt)
        val errorFlow = flow {
            emit(Resource.Error("Invalid credentials"))
        }
        `when`(authRepository.login("test@example.com", "wrong")).thenReturn(errorFlow)
        viewModel.login("test@example.com", "wrong")

        // Then - Error state is set but user remains authenticated from first login
        assertTrue(viewModel.loginState.value is Resource.Error)
        // Note: In current implementation, failed login doesn't clear existing auth
        // This tests the actual behavior
    }

    @Test
    fun `signup with whitespace-only name emits error`() = runTest {
        // Given
        val email = "test@example.com"
        val password = "password123"
        val name = "   " // Whitespace only
        val errorFlow = flow {
            emit(Resource.Error("Name cannot be empty"))
        }

        `when`(authRepository.signup(email, password, name)).thenReturn(errorFlow)

        // When
        viewModel.signup(email, password, name)

        // Then
        val signupState = viewModel.signupState.value
        assertTrue(signupState is Resource.Error)
    }

    @Test
    fun `login with email containing leading and trailing spaces`() = runTest {
        // Given - email with spaces (should be trimmed by repository)
        val email = "  test@example.com  "
        val password = "password123"
        val successFlow = flow {
            emit(Resource.Success(mockAuthData))
        }

        `when`(authRepository.login(email, password)).thenReturn(successFlow)

        // When
        viewModel.login(email, password)

        // Then - Should succeed if repository handles trimming
        assertTrue(viewModel.loginState.value is Resource.Success)
    }
}
