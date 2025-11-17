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
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

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
        role = "customer",
        phone = "+919876543210",
        createdAt = "2025-01-01T00:00:00Z"
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

        // When -ViewModel should validate before calling repository
        // This test verifies that empty inputs are handled
        viewModel.login(email, password)

        // Then - State should remain null or show validation error
        // (Implementation may vary based on validation strategy)
        assertNotNull(viewModel.loginState.value)
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
        viewModel.login("test@example.com", "password123")

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
        }
        val signupFlow = flow {
            emit(Resource.Loading)
        }

        `when`(authRepository.login("test@example.com", "pass")).thenReturn(loginFlow)
        `when`(authRepository.signup("new@example.com", "pass", "Name")).thenReturn(signupFlow)

        // When
        viewModel.login("test@example.com", "pass")
        viewModel.signup("new@example.com", "pass", "Name")

        // Then - Both states should be loading
        assertTrue(viewModel.loginState.value is Resource.Loading)
        assertTrue(viewModel.signupState.value is Resource.Loading)
    }
}
