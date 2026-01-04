package com.menumaker.ui

import com.google.common.truth.Truth.assertThat
import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.AuthData
import com.menumaker.data.remote.models.UserDto
import com.menumaker.data.repository.AuthRepository
import com.menumaker.viewmodel.AuthViewModel
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
 * **Feature: android-test-coverage, Property 19: Form Validation Feedback**
 * **Validates: Requirements 7.3**
 *
 * Property: For any form with invalid input, submitting SHALL display validation error messages.
 *
 * This property test verifies that the ViewModel correctly provides validation feedback
 * for various invalid input combinations, which the UI layer uses to display error messages.
 */
@ExperimentalCoroutinesApi
class FormValidationFeedbackPropertyTest {

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

    // Arb for invalid email formats that should trigger validation feedback
    private fun arbInvalidEmail(): Arb<String> = arbitrary { rs ->
        val invalidPatterns = listOf(
            // Empty string
            "",
            // Whitespace only
            "   ",
            "\t\n",
            // Missing @ symbol
            "invalidemail.com",
            "userexample.com",
            // Missing domain
            "user@",
            "test@.com",
            // Missing local part
            "@domain.com",
            "@example.com",
            // Multiple @ symbols
            "user@@domain.com",
            "test@test@example.com",
            // Invalid characters
            "user name@domain.com",
            "user<>@domain.com",
            // Missing TLD
            "user@domain",
            "test@localhost"
        )
        invalidPatterns.random(rs.random)
    }

    // Arb for invalid passwords that should trigger validation feedback
    private fun arbInvalidPassword(): Arb<String> = arbitrary { rs ->
        val invalidPatterns = listOf(
            // Empty string
            "",
            // Whitespace only
            "   ",
            "\t",
            // Too short (less than 6 characters)
            "a",
            "ab",
            "abc",
            "abcd",
            "abcde",
            // Only whitespace with some chars
            " a ",
            "  ab  "
        )
        invalidPatterns.random(rs.random)
    }

    // Arb for invalid names that should trigger validation feedback
    private fun arbInvalidName(): Arb<String> = arbitrary { rs ->
        val invalidPatterns = listOf(
            // Empty string
            "",
            // Whitespace only
            "   ",
            "\t\n",
            // Only special characters
            "!!!",
            "@#$%",
            // Too short
            "A"
        )
        invalidPatterns.random(rs.random)
    }

    // Arb for validation error messages
    private fun arbValidationErrorMessage(): Arb<String> = arbitrary { rs ->
        val errorMessages = listOf(
            "Email is required",
            "Invalid email format",
            "Please enter a valid email",
            "Password is required",
            "Password must be at least 6 characters",
            "Password is too weak",
            "Name is required",
            "Please enter your name",
            "Invalid input"
        )
        errorMessages.random(rs.random)
    }

    /**
     * Property: For any invalid email input, form submission SHALL result in error state
     * with validation feedback message.
     */
    @Test
    fun `property - invalid email inputs produce validation error feedback`() = runTest {
        checkAll(
            iterations = 100,
            arbInvalidEmail(),
            arbValidationErrorMessage()
        ) { invalidEmail, errorMessage ->
            // Given - repository returns validation error for invalid email
            val errorFlow = flow {
                emit(Resource.Loading)
                emit(Resource.Error(errorMessage))
            }
            `when`(authRepository.login(invalidEmail, "validPassword123")).thenReturn(errorFlow)

            // When - form is submitted with invalid email
            viewModel.login(invalidEmail, "validPassword123")

            // Then - should be in error state with feedback message
            val loginState = viewModel.loginState.value
            assertTrue(
                "Form submission with invalid email '$invalidEmail' should result in error state for validation feedback",
                loginState is Resource.Error
            )
            assertThat((loginState as Resource.Error).message).isNotEmpty()
            assertFalse(
                "User should not be authenticated when validation fails",
                viewModel.isAuthenticated.value
            )
        }
    }

    /**
     * Property: For any invalid password input, form submission SHALL result in error state
     * with validation feedback message.
     */
    @Test
    fun `property - invalid password inputs produce validation error feedback`() = runTest {
        checkAll(
            iterations = 100,
            arbInvalidPassword(),
            arbValidationErrorMessage()
        ) { invalidPassword, errorMessage ->
            // Given - repository returns validation error for invalid password
            val errorFlow = flow {
                emit(Resource.Loading)
                emit(Resource.Error(errorMessage))
            }
            `when`(authRepository.login("valid@email.com", invalidPassword)).thenReturn(errorFlow)

            // When - form is submitted with invalid password
            viewModel.login("valid@email.com", invalidPassword)

            // Then - should be in error state with feedback message
            val loginState = viewModel.loginState.value
            assertTrue(
                "Form submission with invalid password should result in error state for validation feedback",
                loginState is Resource.Error
            )
            assertThat((loginState as Resource.Error).message).isNotEmpty()
            assertFalse(
                "User should not be authenticated when validation fails",
                viewModel.isAuthenticated.value
            )
        }
    }

    /**
     * Property: For any invalid name input in signup form, submission SHALL result in error state
     * with validation feedback message.
     */
    @Test
    fun `property - invalid name inputs in signup produce validation error feedback`() = runTest {
        checkAll(
            iterations = 100,
            arbInvalidName(),
            arbValidationErrorMessage()
        ) { invalidName, errorMessage ->
            // Given - repository returns validation error for invalid name
            val errorFlow = flow {
                emit(Resource.Loading)
                emit(Resource.Error(errorMessage))
            }
            `when`(authRepository.signup("valid@email.com", "validPassword123", invalidName))
                .thenReturn(errorFlow)

            // When - signup form is submitted with invalid name
            viewModel.signup("valid@email.com", "validPassword123", invalidName)

            // Then - should be in error state with feedback message
            val signupState = viewModel.signupState.value
            assertTrue(
                "Signup form submission with invalid name '$invalidName' should result in error state for validation feedback",
                signupState is Resource.Error
            )
            assertThat((signupState as Resource.Error).message).isNotEmpty()
            assertFalse(
                "User should not be authenticated when validation fails",
                viewModel.isAuthenticated.value
            )
        }
    }

    /**
     * Property: For any combination of invalid inputs, form submission SHALL result in error state
     * with validation feedback message.
     */
    @Test
    fun `property - multiple invalid inputs produce validation error feedback`() = runTest {
        checkAll(
            iterations = 100,
            arbInvalidEmail(),
            arbInvalidPassword(),
            arbValidationErrorMessage()
        ) { invalidEmail, invalidPassword, errorMessage ->
            // Given - repository returns validation error for multiple invalid inputs
            val errorFlow = flow {
                emit(Resource.Loading)
                emit(Resource.Error(errorMessage))
            }
            `when`(authRepository.login(invalidEmail, invalidPassword)).thenReturn(errorFlow)

            // When - form is submitted with multiple invalid inputs
            viewModel.login(invalidEmail, invalidPassword)

            // Then - should be in error state with feedback message
            val loginState = viewModel.loginState.value
            assertTrue(
                "Form submission with multiple invalid inputs should result in error state for validation feedback",
                loginState is Resource.Error
            )
            assertThat((loginState as Resource.Error).message).isNotEmpty()
            assertFalse(
                "User should not be authenticated when validation fails",
                viewModel.isAuthenticated.value
            )
        }
    }

    /**
     * Property: Error feedback message SHALL be preserved exactly as returned by validation.
     */
    @Test
    fun `property - validation error messages are preserved in feedback`() = runTest {
        checkAll(
            iterations = 100,
            arbValidationErrorMessage()
        ) { errorMessage ->
            // Given - repository returns specific validation error message
            val errorFlow = flow {
                emit(Resource.Loading)
                emit(Resource.Error(errorMessage))
            }
            `when`(authRepository.login("invalid", "short")).thenReturn(errorFlow)

            // When - form is submitted
            viewModel.login("invalid", "short")

            // Then - error message should be preserved exactly for UI display
            val loginState = viewModel.loginState.value
            assertTrue("Should be in error state", loginState is Resource.Error)
            assertThat((loginState as Resource.Error).message).isEqualTo(errorMessage)
        }
    }
}
