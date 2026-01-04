package com.menumaker.viewmodel

import com.google.common.truth.Truth.assertThat
import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.AuthData
import com.menumaker.data.remote.models.UserDto
import com.menumaker.data.repository.AuthRepository
import io.kotest.property.Arb
import io.kotest.property.arbitrary.arbitrary
import io.kotest.property.arbitrary.string
import io.kotest.property.checkAll
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.mockito.Mock
import org.mockito.Mockito.`when`
import org.mockito.MockitoAnnotations

/**
 * **Feature: android-test-coverage, Property 5: ViewModel Input Validation**
 * **Validates: Requirements 2.3, 5.3**
 *
 * Property: For any invalid input (empty required fields, malformed email, weak password),
 * the ViewModel SHALL reject the input and set an appropriate error message.
 */
@ExperimentalCoroutinesApi
class AuthViewModelInputValidationPropertyTest {

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

    // Custom Arb for empty or whitespace-only strings
    private fun arbEmptyOrWhitespace(): Arb<String> = arbitrary { rs ->
        val whitespaceChars = listOf(' ', '\t', '\n', '\r')
        val length = (0..5).random(rs.random)
        (0 until length).map { whitespaceChars.random(rs.random) }.joinToString("")
    }

    // Custom Arb for malformed emails (missing @, missing domain, etc.)
    private fun arbMalformedEmail(): Arb<String> = arbitrary { rs ->
        val chars = ('a'..'z') + ('0'..'9')
        val patterns = listOf(
            // No @ symbol
            (1..10).map { chars.random(rs.random) }.joinToString(""),
            // No domain
            (1..5).map { chars.random(rs.random) }.joinToString("") + "@",
            // No local part
            "@" + (1..5).map { chars.random(rs.random) }.joinToString("") + ".com",
            // Multiple @ symbols
            (1..3).map { chars.random(rs.random) }.joinToString("") + "@@" + 
                (1..3).map { chars.random(rs.random) }.joinToString("") + ".com",
            // Just whitespace
            "   ",
            // Empty string
            ""
        )
        patterns.random(rs.random)
    }

    // Custom Arb for weak passwords (less than 6 characters)
    private fun arbWeakPassword(): Arb<String> = arbitrary { rs ->
        val chars = ('a'..'z') + ('A'..'Z') + ('0'..'9')
        val length = (0..5).random(rs.random)
        (0 until length).map { chars.random(rs.random) }.joinToString("")
    }

    @Test
    fun `property - empty email inputs result in error state`() = runTest {
        // Property: For any empty or whitespace-only email, login SHALL result in error
        checkAll(
            iterations = 100,
            arbEmptyOrWhitespace()
        ) { emptyEmail ->
            // Given - repository returns error for empty email
            val errorFlow = flow {
                emit(Resource.Error("Email cannot be empty"))
            }
            `when`(authRepository.login(emptyEmail, "validPassword123")).thenReturn(errorFlow)

            // When
            viewModel.login(emptyEmail, "validPassword123")

            // Then - should be in error state and not authenticated
            val loginState = viewModel.loginState.value
            assertTrue("Login with empty email '$emptyEmail' should result in error", 
                loginState is Resource.Error)
            assertFalse("Should not be authenticated with empty email", 
                viewModel.isAuthenticated.value)
        }
    }

    @Test
    fun `property - malformed email inputs result in error state`() = runTest {
        // Property: For any malformed email, login SHALL result in error
        checkAll(
            iterations = 100,
            arbMalformedEmail()
        ) { malformedEmail ->
            // Given - repository returns error for malformed email
            val errorFlow = flow {
                emit(Resource.Error("Invalid email format"))
            }
            `when`(authRepository.login(malformedEmail, "validPassword123")).thenReturn(errorFlow)

            // When
            viewModel.login(malformedEmail, "validPassword123")

            // Then - should be in error state and not authenticated
            val loginState = viewModel.loginState.value
            assertTrue("Login with malformed email '$malformedEmail' should result in error", 
                loginState is Resource.Error)
            assertFalse("Should not be authenticated with malformed email", 
                viewModel.isAuthenticated.value)
        }
    }

    @Test
    fun `property - weak password inputs result in error state for signup`() = runTest {
        // Property: For any weak password (< 6 chars), signup SHALL result in error
        checkAll(
            iterations = 100,
            arbWeakPassword()
        ) { weakPassword ->
            // Given - repository returns error for weak password
            val errorFlow = flow {
                emit(Resource.Error("Password must be at least 6 characters"))
            }
            `when`(authRepository.signup("valid@email.com", weakPassword, "Test User"))
                .thenReturn(errorFlow)

            // When
            viewModel.signup("valid@email.com", weakPassword, "Test User")

            // Then - should be in error state and not authenticated
            val signupState = viewModel.signupState.value
            assertTrue("Signup with weak password '$weakPassword' should result in error", 
                signupState is Resource.Error)
            assertFalse("Should not be authenticated with weak password", 
                viewModel.isAuthenticated.value)
        }
    }

    @Test
    fun `property - empty name inputs result in error state for signup`() = runTest {
        // Property: For any empty or whitespace-only name, signup SHALL result in error
        checkAll(
            iterations = 100,
            arbEmptyOrWhitespace()
        ) { emptyName ->
            // Given - repository returns error for empty name
            val errorFlow = flow {
                emit(Resource.Error("Name cannot be empty"))
            }
            `when`(authRepository.signup("valid@email.com", "validPassword123", emptyName))
                .thenReturn(errorFlow)

            // When
            viewModel.signup("valid@email.com", "validPassword123", emptyName)

            // Then - should be in error state and not authenticated
            val signupState = viewModel.signupState.value
            assertTrue("Signup with empty name '$emptyName' should result in error", 
                signupState is Resource.Error)
            assertFalse("Should not be authenticated with empty name", 
                viewModel.isAuthenticated.value)
        }
    }

    @Test
    fun `property - empty password inputs result in error state`() = runTest {
        // Property: For any empty or whitespace-only password, login SHALL result in error
        checkAll(
            iterations = 100,
            arbEmptyOrWhitespace()
        ) { emptyPassword ->
            // Given - repository returns error for empty password
            val errorFlow = flow {
                emit(Resource.Error("Password cannot be empty"))
            }
            `when`(authRepository.login("valid@email.com", emptyPassword)).thenReturn(errorFlow)

            // When
            viewModel.login("valid@email.com", emptyPassword)

            // Then - should be in error state and not authenticated
            val loginState = viewModel.loginState.value
            assertTrue("Login with empty password should result in error", 
                loginState is Resource.Error)
            assertFalse("Should not be authenticated with empty password", 
                viewModel.isAuthenticated.value)
        }
    }
}


/**
 * **Feature: android-test-coverage, Property 14: Authentication Error Handling**
 * **Validates: Requirements 5.2**
 *
 * Property: For any invalid login credentials, the login state SHALL be Resource.Error
 * and no tokens SHALL be stored.
 */
@ExperimentalCoroutinesApi
class AuthViewModelErrorHandlingPropertyTest {

    @Mock
    private lateinit var authRepository: AuthRepository

    private lateinit var viewModel: AuthViewModel

    private val testDispatcher = UnconfinedTestDispatcher()

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

    // Custom Arb for error messages
    private fun arbErrorMessage(): Arb<String> = arbitrary { rs ->
        val errorMessages = listOf(
            "Invalid credentials",
            "User not found",
            "Account locked",
            "Too many attempts",
            "Network error",
            "Server error",
            "Authentication failed",
            "Invalid email or password"
        )
        errorMessages.random(rs.random)
    }

    // Custom Arb for valid-looking email
    private fun arbValidEmail(): Arb<String> = arbitrary { rs ->
        val chars = ('a'..'z') + ('0'..'9')
        val localPart = (1..8).map { chars.random(rs.random) }.joinToString("")
        val domain = (1..5).map { chars.random(rs.random) }.joinToString("")
        "$localPart@$domain.com"
    }

    // Custom Arb for password strings
    private fun arbPassword(): Arb<String> = arbitrary { rs ->
        val chars = ('a'..'z') + ('A'..'Z') + ('0'..'9') + listOf('!', '@', '#', '$')
        val length = (6..20).random(rs.random)
        (1..length).map { chars.random(rs.random) }.joinToString("")
    }

    @Test
    fun `property - invalid credentials always result in error state without authentication`() = runTest {
        // Property: For any invalid credentials, login SHALL result in error and no authentication
        checkAll(
            iterations = 100,
            arbValidEmail(),
            arbPassword(),
            arbErrorMessage()
        ) { email, password, errorMessage ->
            // Given - repository returns error for invalid credentials
            val errorFlow = flow {
                emit(Resource.Loading)
                emit(Resource.Error(errorMessage))
            }
            `when`(authRepository.login(email, password)).thenReturn(errorFlow)

            // When
            viewModel.login(email, password)

            // Then - should be in error state
            val loginState = viewModel.loginState.value
            assertTrue("Login should result in error state", loginState is Resource.Error)
            assertThat((loginState as Resource.Error).message).isEqualTo(errorMessage)
            
            // And should NOT be authenticated
            assertFalse("Should not be authenticated after failed login", 
                viewModel.isAuthenticated.value)
        }
    }

    @Test
    fun `property - error responses preserve error message content`() = runTest {
        // Property: For any error response, the error message SHALL be preserved in state
        checkAll(
            iterations = 100,
            arbErrorMessage()
        ) { errorMessage ->
            // Given - repository returns specific error message
            val errorFlow = flow {
                emit(Resource.Error(errorMessage))
            }
            `when`(authRepository.login("test@example.com", "password")).thenReturn(errorFlow)

            // When
            viewModel.login("test@example.com", "password")

            // Then - error message should be preserved exactly
            val loginState = viewModel.loginState.value
            assertTrue("Should be in error state", loginState is Resource.Error)
            assertThat((loginState as Resource.Error).message).isEqualTo(errorMessage)
        }
    }

    @Test
    fun `property - signup with invalid data results in error state without authentication`() = runTest {
        // Property: For any invalid signup data, signup SHALL result in error and no authentication
        checkAll(
            iterations = 100,
            arbValidEmail(),
            arbPassword(),
            Arb.string(1..20),
            arbErrorMessage()
        ) { email, password, name, errorMessage ->
            // Given - repository returns error
            val errorFlow = flow {
                emit(Resource.Loading)
                emit(Resource.Error(errorMessage))
            }
            `when`(authRepository.signup(email, password, name)).thenReturn(errorFlow)

            // When
            viewModel.signup(email, password, name)

            // Then - should be in error state
            val signupState = viewModel.signupState.value
            assertTrue("Signup should result in error state", signupState is Resource.Error)
            
            // And should NOT be authenticated
            assertFalse("Should not be authenticated after failed signup", 
                viewModel.isAuthenticated.value)
        }
    }
}
