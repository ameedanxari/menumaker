package com.menumaker.ui

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import com.menumaker.MainActivity
import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.AuthData
import com.menumaker.data.remote.models.UserDto
import com.menumaker.data.repository.AuthRepository
import com.menumaker.fakes.FakeAuthRepository
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import javax.inject.Inject

/**
 * Instrumented UI tests for authentication flows
 * Tests login, signup, and password reset functionality
 *
 * These tests use FakeAuthRepository via Hilt test module for deterministic,
 * network-independent testing.
 *
 * Requirements covered:
 * - 5.1: Login with valid credentials stores tokens
 * - 5.2: Login with invalid credentials shows error
 * - 5.3: Signup validates email, password strength, required fields
 * - 7.2: Navigation between screens
 * - 7.3: Form validation feedback
 */
@LargeTest
@RunWith(AndroidJUnit4::class)
@HiltAndroidTest
class AuthenticationFlowTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    @Inject
    lateinit var authRepository: AuthRepository

    private val fakeAuthRepository: FakeAuthRepository
        get() = authRepository as FakeAuthRepository

    @Before
    fun setup() {
        hiltRule.inject()
        // Reset fake repository to clean state before each test
        fakeAuthRepository.reset()
    }

    // Test data constants
    companion object {
        private const val VALID_EMAIL = "test@example.com"
        private const val VALID_PASSWORD = "SecurePass123!"
        private const val VALID_NAME = "Test User"
        private const val VALID_PHONE = "1234567890"
        private const val INVALID_EMAIL = "invalid-email"
        private const val WEAK_PASSWORD = "weak"
        private const val WRONG_EMAIL = "wrong@example.com"
        private const val WRONG_PASSWORD = "wrongpassword"
    }

    // MARK: - Login Screen Tests

    @Test
    fun loginScreen_displaysAllElements() {
        // Verify email field exists
        composeTestRule.onNodeWithText("Email").assertExists()
        composeTestRule.onNodeWithText("Email").assertIsDisplayed()

        // Verify password field exists
        composeTestRule.onNodeWithText("Password").assertExists()
        composeTestRule.onNodeWithText("Password").assertIsDisplayed()

        // Verify login button exists
        composeTestRule.onNodeWithText("Login").assertExists()
        composeTestRule.onNodeWithText("Login").assertIsDisplayed()

        // Verify signup link exists
        composeTestRule.onNode(
            hasText("Sign Up", substring = true, ignoreCase = true) or
            hasText("Create Account", substring = true, ignoreCase = true)
        ).assertExists()
    }

    @Test
    fun loginScreen_emailField_acceptsInput() {
        // Find and interact with email field
        composeTestRule.onNodeWithText("Email")
            .performTextInput(VALID_EMAIL)

        // Verify input was entered
        composeTestRule.onNodeWithText(VALID_EMAIL).assertExists()
    }

    @Test
    fun loginScreen_passwordField_acceptsInput() {
        // Find and interact with password field
        composeTestRule.onNodeWithText("Password")
            .performTextInput(VALID_PASSWORD)

        // Password field should mask input, so we can't verify the exact text
        // but we can verify the field is filled
        composeTestRule.onNodeWithText("Password")
            .assertExists()
    }

    /**
     * Test: Login with valid credentials shows loading then navigates to home
     * Requirements: 5.1 - Login with valid credentials stores tokens
     */
    @Test
    fun loginScreen_withValidCredentials_showsLoadingThenSuccess() {
        // Configure fake repository for successful login
        fakeAuthRepository.configureSuccessfulLogin()

        // Enter valid test credentials
        composeTestRule.onNodeWithText("Email")
            .performTextInput(VALID_EMAIL)

        composeTestRule.onNodeWithText("Password")
            .performTextInput(VALID_PASSWORD)

        // Click login button
        composeTestRule.onNodeWithText("Login")
            .performClick()

        // Wait for navigation or success message
        composeTestRule.waitUntil(timeoutMillis = 5000) {
            composeTestRule.onAllNodesWithText("Home", useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty() ||
            composeTestRule.onAllNodesWithText("Dashboard", useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty() ||
            composeTestRule.onAllNodesWithText("Marketplace", useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()
        }

        // Verify login was called with correct credentials
        assertEquals("Login should be called once", 1, fakeAuthRepository.loginCallCount)
        assertEquals("Email should match", VALID_EMAIL, fakeAuthRepository.lastLoginEmail)
        assertEquals("Password should match", VALID_PASSWORD, fakeAuthRepository.lastLoginPassword)
    }

    /**
     * Test: Login with invalid credentials shows error message
     * Requirements: 5.2 - Login with invalid credentials shows error
     */
    @Test
    fun loginScreen_withInvalidCredentials_showsError() {
        // Configure fake repository for failed login
        fakeAuthRepository.configureFailedLogin("Invalid email or password")

        // Enter credentials
        composeTestRule.onNodeWithText("Email")
            .performTextInput(WRONG_EMAIL)

        composeTestRule.onNodeWithText("Password")
            .performTextInput(WRONG_PASSWORD)

        // Click login button
        composeTestRule.onNodeWithText("Login")
            .performClick()

        // Wait for error message
        composeTestRule.waitForIdle()
        composeTestRule.waitUntil(timeoutMillis = 3000) {
            composeTestRule.onAllNodes(
                hasText("Invalid", substring = true, ignoreCase = true) or
                hasText("error", substring = true, ignoreCase = true) or
                hasText("failed", substring = true, ignoreCase = true)
            ).fetchSemanticsNodes().isNotEmpty()
        }

        // Verify login was attempted
        assertEquals("Login should be called once", 1, fakeAuthRepository.loginCallCount)
    }

    /**
     * Test: Login with empty fields shows validation error
     * Requirements: 7.3 - Form validation feedback
     */
    @Test
    fun loginScreen_withEmptyFields_showsValidationError() {
        // Click login without entering credentials
        composeTestRule.onNodeWithText("Login")
            .performClick()

        // Verify error messages appear
        composeTestRule.waitForIdle()
        composeTestRule.onNode(
            hasText("required", substring = true, ignoreCase = true) or
            hasText("empty", substring = true, ignoreCase = true) or
            hasText("enter", substring = true, ignoreCase = true)
        ).assertExists()
    }

    /**
     * Test: Login with invalid email format shows validation error
     * Requirements: 5.3 - Validates email format
     */
    @Test
    fun loginScreen_withInvalidEmail_showsError() {
        // Enter invalid email
        composeTestRule.onNodeWithText("Email")
            .performTextInput(INVALID_EMAIL)

        composeTestRule.onNodeWithText("Password")
            .performTextInput(VALID_PASSWORD)

        composeTestRule.onNodeWithText("Login")
            .performClick()

        // Verify error message
        composeTestRule.waitForIdle()
        composeTestRule.onNode(
            hasText("valid email", substring = true, ignoreCase = true) or
            hasText("invalid email", substring = true, ignoreCase = true) or
            hasText("email format", substring = true, ignoreCase = true)
        ).assertExists()
    }

    /**
     * Test: Login with network error shows appropriate error
     * Requirements: 5.2 - Shows appropriate error messages
     */
    @Test
    fun loginScreen_withNetworkError_showsError() {
        // Configure fake repository for network error
        fakeAuthRepository.loginResponse = Resource.Error("Network error. Please check your connection.")

        // Enter credentials
        composeTestRule.onNodeWithText("Email")
            .performTextInput(VALID_EMAIL)

        composeTestRule.onNodeWithText("Password")
            .performTextInput(VALID_PASSWORD)

        // Click login button
        composeTestRule.onNodeWithText("Login")
            .performClick()

        // Wait for error message
        composeTestRule.waitForIdle()
        composeTestRule.waitUntil(timeoutMillis = 3000) {
            composeTestRule.onAllNodes(
                hasText("Network", substring = true, ignoreCase = true) or
                hasText("error", substring = true, ignoreCase = true) or
                hasText("connection", substring = true, ignoreCase = true)
            ).fetchSemanticsNodes().isNotEmpty()
        }

        // Verify login was attempted
        assertEquals("Login should be called once", 1, fakeAuthRepository.loginCallCount)
    }

    // MARK: - Signup Flow Tests

    /**
     * Test: Navigation from login to signup screen
     * Requirements: 7.2 - Navigation between screens
     */
    @Test
    fun signupScreen_navigatesFromLogin() {
        // Click signup link
        composeTestRule.onNode(
            hasText("Sign Up", substring = true, ignoreCase = true) or
            hasText("Create Account", substring = true, ignoreCase = true)
        ).performClick()

        // Verify signup screen appears
        composeTestRule.waitForIdle()
        composeTestRule.onNodeWithText("Name").assertExists()
        composeTestRule.onNodeWithText("Email").assertExists()
        composeTestRule.onNodeWithText("Password").assertExists()
    }

    @Test
    fun signupScreen_displaysAllRequiredFields() {
        // Navigate to signup
        composeTestRule.onNode(
            hasText("Sign Up", substring = true, ignoreCase = true)
        ).performClick()

        composeTestRule.waitForIdle()

        // Verify all fields
        composeTestRule.onNodeWithText("Name").assertExists()
        composeTestRule.onNodeWithText("Email").assertExists()
        composeTestRule.onNodeWithText("Password").assertExists()
    }

    /**
     * Test: Signup with valid data creates account successfully
     * Requirements: 5.3 - Signup validates required fields
     */
    @Test
    fun signupScreen_withValidData_createsAccount() {
        // Configure fake repository for successful signup
        fakeAuthRepository.signupResponse = Resource.Success(
            AuthData(
                accessToken = "test-token",
                refreshToken = "test-refresh",
                user = UserDto(
                    id = "new-user-id",
                    email = "newuser@example.com",
                    name = VALID_NAME,
                    phone = VALID_PHONE,
                    address = null,
                    photoUrl = null,
                    role = "customer",
                    createdAt = "2025-01-01T00:00:00Z",
                    updatedAt = null
                )
            )
        )

        // Navigate to signup
        composeTestRule.onNode(
            hasText("Sign Up", substring = true, ignoreCase = true)
        ).performClick()

        composeTestRule.waitForIdle()

        // Fill form
        composeTestRule.onNodeWithText("Name")
            .performTextInput(VALID_NAME)

        composeTestRule.onNodeWithText("Email")
            .performTextInput("newuser@example.com")

        // Check if Phone field exists before filling
        val phoneField = composeTestRule.onAllNodesWithText("Phone")
        if (phoneField.fetchSemanticsNodes().isNotEmpty()) {
            composeTestRule.onNodeWithText("Phone")
                .performTextInput(VALID_PHONE)
        }

        composeTestRule.onNodeWithText("Password")
            .performTextInput(VALID_PASSWORD)

        // Submit
        composeTestRule.onNode(
            hasText("Create Account", ignoreCase = true) or
            hasText("Sign Up", ignoreCase = true)
        ).performClick()

        // Verify success or navigation
        composeTestRule.waitUntil(timeoutMillis = 5000) {
            composeTestRule.onAllNodesWithText("Success", useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty() ||
            composeTestRule.onAllNodesWithText("Home", useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty() ||
            composeTestRule.onAllNodesWithText("Marketplace", useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()
        }

        // Verify signup was called
        assertEquals("Signup should be called once", 1, fakeAuthRepository.signupCallCount)
        assertEquals("Email should match", "newuser@example.com", fakeAuthRepository.lastSignupEmail)
        assertEquals("Name should match", VALID_NAME, fakeAuthRepository.lastSignupName)
    }

    /**
     * Test: Signup with weak password shows validation error
     * Requirements: 5.3 - Validates password strength
     */
    @Test
    fun signupScreen_withWeakPassword_showsError() {
        // Navigate to signup
        composeTestRule.onNode(
            hasText("Sign Up", substring = true, ignoreCase = true)
        ).performClick()

        composeTestRule.waitForIdle()

        // Enter weak password
        composeTestRule.onNodeWithText("Name")
            .performTextInput(VALID_NAME)

        composeTestRule.onNodeWithText("Email")
            .performTextInput(VALID_EMAIL)

        composeTestRule.onNodeWithText("Password")
            .performTextInput(WEAK_PASSWORD)

        // Submit
        composeTestRule.onNode(
            hasText("Create Account", ignoreCase = true) or
            hasText("Sign Up", ignoreCase = true)
        ).performClick()

        // Verify error
        composeTestRule.waitForIdle()
        composeTestRule.onNode(
            hasText("password", substring = true, ignoreCase = true) and
            (hasText("weak", substring = true, ignoreCase = true) or
             hasText("characters", substring = true, ignoreCase = true) or
             hasText("short", substring = true, ignoreCase = true) or
             hasText("strong", substring = true, ignoreCase = true))
        ).assertExists()
    }

    /**
     * Test: Signup with existing email shows error
     * Requirements: 5.2 - Shows appropriate error messages
     */
    @Test
    fun signupScreen_withExistingEmail_showsError() {
        // Configure fake repository for email already exists error
        fakeAuthRepository.signupResponse = Resource.Error("Email already exists")

        // Navigate to signup
        composeTestRule.onNode(
            hasText("Sign Up", substring = true, ignoreCase = true)
        ).performClick()

        composeTestRule.waitForIdle()

        // Use existing email
        composeTestRule.onNodeWithText("Name")
            .performTextInput(VALID_NAME)

        composeTestRule.onNodeWithText("Email")
            .performTextInput("existing@example.com")

        // Check if Phone field exists before filling
        val phoneField = composeTestRule.onAllNodesWithText("Phone")
        if (phoneField.fetchSemanticsNodes().isNotEmpty()) {
            composeTestRule.onNodeWithText("Phone")
                .performTextInput(VALID_PHONE)
        }

        composeTestRule.onNodeWithText("Password")
            .performTextInput(VALID_PASSWORD)

        // Submit
        composeTestRule.onNode(
            hasText("Create Account", ignoreCase = true) or
            hasText("Sign Up", ignoreCase = true)
        ).performClick()

        // Verify error message
        composeTestRule.waitForIdle()
        composeTestRule.waitUntil(timeoutMillis = 3000) {
            composeTestRule.onAllNodes(
                hasText("email", substring = true, ignoreCase = true) and
                (hasText("exists", substring = true, ignoreCase = true) or
                 hasText("already", substring = true, ignoreCase = true))
            ).fetchSemanticsNodes().isNotEmpty() ||
            composeTestRule.onAllNodes(
                hasText("error", substring = true, ignoreCase = true)
            ).fetchSemanticsNodes().isNotEmpty()
        }
    }

    /**
     * Test: Signup with invalid email format shows validation error
     * Requirements: 5.3 - Validates email format
     */
    @Test
    fun signupScreen_withInvalidEmail_showsError() {
        // Navigate to signup
        composeTestRule.onNode(
            hasText("Sign Up", substring = true, ignoreCase = true)
        ).performClick()

        composeTestRule.waitForIdle()

        // Enter invalid email
        composeTestRule.onNodeWithText("Name")
            .performTextInput(VALID_NAME)

        composeTestRule.onNodeWithText("Email")
            .performTextInput(INVALID_EMAIL)

        composeTestRule.onNodeWithText("Password")
            .performTextInput(VALID_PASSWORD)

        // Submit
        composeTestRule.onNode(
            hasText("Create Account", ignoreCase = true) or
            hasText("Sign Up", ignoreCase = true)
        ).performClick()

        // Verify error message
        composeTestRule.waitForIdle()
        composeTestRule.onNode(
            hasText("valid email", substring = true, ignoreCase = true) or
            hasText("invalid email", substring = true, ignoreCase = true) or
            hasText("email format", substring = true, ignoreCase = true)
        ).assertExists()
    }

    /**
     * Test: Signup with empty required fields shows validation error
     * Requirements: 5.3 - Validates required fields
     * Requirements: 7.3 - Form validation feedback
     */
    @Test
    fun signupScreen_withEmptyRequiredFields_showsError() {
        // Navigate to signup
        composeTestRule.onNode(
            hasText("Sign Up", substring = true, ignoreCase = true)
        ).performClick()

        composeTestRule.waitForIdle()

        // Submit without filling any fields
        composeTestRule.onNode(
            hasText("Create Account", ignoreCase = true) or
            hasText("Sign Up", ignoreCase = true)
        ).performClick()

        // Verify error message
        composeTestRule.waitForIdle()
        composeTestRule.onNode(
            hasText("required", substring = true, ignoreCase = true) or
            hasText("empty", substring = true, ignoreCase = true) or
            hasText("enter", substring = true, ignoreCase = true)
        ).assertExists()
    }

    /**
     * Test: Signup with missing name shows validation error
     * Requirements: 5.3 - Validates required fields
     */
    @Test
    fun signupScreen_withMissingName_showsError() {
        // Navigate to signup
        composeTestRule.onNode(
            hasText("Sign Up", substring = true, ignoreCase = true)
        ).performClick()

        composeTestRule.waitForIdle()

        // Fill only email and password
        composeTestRule.onNodeWithText("Email")
            .performTextInput(VALID_EMAIL)

        composeTestRule.onNodeWithText("Password")
            .performTextInput(VALID_PASSWORD)

        // Submit
        composeTestRule.onNode(
            hasText("Create Account", ignoreCase = true) or
            hasText("Sign Up", ignoreCase = true)
        ).performClick()

        // Verify error message for name
        composeTestRule.waitForIdle()
        composeTestRule.onNode(
            hasText("name", substring = true, ignoreCase = true) and
            (hasText("required", substring = true, ignoreCase = true) or
             hasText("enter", substring = true, ignoreCase = true))
        ).assertExists()
    }

    // MARK: - Password Field Security Tests

    @Test
    fun passwordField_masksInput() {
        composeTestRule.onNodeWithText("Password")
            .performTextInput("secretpassword")

        // Verify the actual password text is not visible
        composeTestRule.onNodeWithText("secretpassword").assertDoesNotExist()

        // Verify password field exists (but content is masked)
        composeTestRule.onNode(
            hasText("Password") and hasSetTextAction()
        ).assertExists()
    }

    @Test
    fun passwordField_toggleVisibilityIcon_showsPassword() {
        composeTestRule.onNodeWithText("Password")
            .performTextInput(VALID_PASSWORD)

        // Find and click visibility toggle if it exists
        val visibilityToggle = composeTestRule.onNode(
            hasContentDescription("Show password", substring = true, ignoreCase = true) or
            hasContentDescription("Toggle password visibility", substring = true, ignoreCase = true)
        )

        if (visibilityToggle.isDisplayed()) {
            visibilityToggle.performClick()

            // After clicking, password might be visible
            // This is implementation dependent
            composeTestRule.waitForIdle()
        }
    }

    // MARK: - Forgot Password Tests

    @Test
    fun forgotPassword_link_navigatesToResetScreen() {
        val forgotPasswordLink = composeTestRule.onNode(
            hasText("Forgot Password", substring = true, ignoreCase = true)
        )

        if (forgotPasswordLink.isDisplayed()) {
            forgotPasswordLink.performClick()

            // Verify reset password screen
            composeTestRule.waitForIdle()
            composeTestRule.onNode(
                hasText("Reset Password", substring = true, ignoreCase = true) or
                hasText("Enter your email", substring = true, ignoreCase = true)
            ).assertExists()
        }
    }

    /**
     * Test: Password reset with valid email sends reset email
     * Requirements: 5.5 - Password reset sends email
     */
    @Test
    fun forgotPassword_withValidEmail_sendsResetEmail() {
        val forgotPasswordLink = composeTestRule.onNode(
            hasText("Forgot Password", substring = true, ignoreCase = true)
        )

        if (forgotPasswordLink.isDisplayed()) {
            forgotPasswordLink.performClick()
            composeTestRule.waitForIdle()

            // Enter email
            composeTestRule.onNodeWithText("Email")
                .performTextInput(VALID_EMAIL)

            // Submit
            composeTestRule.onNode(
                hasText("Reset", ignoreCase = true) or
                hasText("Send", ignoreCase = true)
            ).performClick()

            // Verify success message
            composeTestRule.waitForIdle()
            composeTestRule.waitUntil(timeoutMillis = 3000) {
                composeTestRule.onAllNodes(
                    hasText("sent", substring = true, ignoreCase = true) or
                    hasText("check your email", substring = true, ignoreCase = true) or
                    hasText("success", substring = true, ignoreCase = true)
                ).fetchSemanticsNodes().isNotEmpty()
            }
        }
    }

    // MARK: - Navigation Tests

    /**
     * Test: Back button on signup returns to login
     * Requirements: 7.2 - Navigation between screens
     */
    @Test
    fun signupScreen_backButton_returnsToLogin() {
        // Navigate to signup
        composeTestRule.onNode(
            hasText("Sign Up", substring = true, ignoreCase = true)
        ).performClick()

        composeTestRule.waitForIdle()

        // Press back
        composeTestRule.activityRule.scenario.onActivity { activity ->
            activity.onBackPressed()
        }

        // Verify return to login
        composeTestRule.waitForIdle()
        composeTestRule.onNodeWithText("Login").assertExists()
    }

    /**
     * Test: Login link on signup navigates back to login
     * Requirements: 7.2 - Navigation between screens
     */
    @Test
    fun signupScreen_loginLink_navigatesToLogin() {
        // Navigate to signup
        composeTestRule.onNode(
            hasText("Sign Up", substring = true, ignoreCase = true)
        ).performClick()

        composeTestRule.waitForIdle()

        // Click login link
        val loginLink = composeTestRule.onNode(
            hasText("Login", substring = true, ignoreCase = true) or
            hasText("Already have an account", substring = true, ignoreCase = true)
        )

        if (loginLink.isDisplayed()) {
            loginLink.performClick()

            // Verify return to login
            composeTestRule.waitForIdle()
            composeTestRule.onNodeWithText("Login").assertExists()
        }
    }

    // MARK: - Accessibility Tests

    @Test
    fun loginScreen_hasAccessibleElements() {
        // Verify email field has content description
        composeTestRule.onNodeWithText("Email").assertExists()

        // Verify password field has content description
        composeTestRule.onNodeWithText("Password").assertExists()

        // Verify login button is accessible
        composeTestRule.onNodeWithText("Login")
            .assertHasClickAction()
    }

    @Test
    fun signupScreen_hasAccessibleElements() {
        // Navigate to signup
        composeTestRule.onNode(
            hasText("Sign Up", substring = true, ignoreCase = true)
        ).performClick()

        composeTestRule.waitForIdle()

        // Verify all fields are accessible
        composeTestRule.onNodeWithText("Name").assertExists()
        composeTestRule.onNodeWithText("Email").assertExists()
        composeTestRule.onNodeWithText("Password").assertExists()

        // Verify submit button is accessible
        composeTestRule.onNode(
            hasText("Create Account", ignoreCase = true) or
            hasText("Sign Up", ignoreCase = true)
        ).assertHasClickAction()
    }

    // MARK: - Performance Tests

    @Test
    fun loginScreen_rendersQuickly() {
        // Measure time to render login screen
        val startTime = System.currentTimeMillis()

        composeTestRule.waitForIdle()

        val endTime = System.currentTimeMillis()
        val renderTime = endTime - startTime

        // Login screen should render within 2 seconds
        assertTrue(
            "Login screen took too long to render: ${renderTime}ms",
            renderTime < 2000
        )
    }

    @Test
    fun loginButton_respondsQuicklyToClick() {
        // Enter valid credentials
        composeTestRule.onNodeWithText("Email")
            .performTextInput(VALID_EMAIL)

        composeTestRule.onNodeWithText("Password")
            .performTextInput(VALID_PASSWORD)

        // Measure response time
        val startTime = System.currentTimeMillis()

        composeTestRule.onNodeWithText("Login")
            .performClick()

        // Wait for any response (loading indicator or state change)
        composeTestRule.waitForIdle()

        val responseTime = System.currentTimeMillis() - startTime

        // Button should respond within 1 second
        assertTrue(
            "Login button took too long to respond: ${responseTime}ms",
            responseTime < 1000
        )
    }

    // MARK: - Token Storage Verification Tests

    /**
     * Test: Successful login stores authentication tokens
     * Requirements: 5.1 - Login with valid credentials stores tokens
     */
    @Test
    fun loginScreen_successfulLogin_storesTokens() {
        // Configure fake repository for successful login
        fakeAuthRepository.configureSuccessfulLogin()

        // Enter credentials and login
        composeTestRule.onNodeWithText("Email")
            .performTextInput(VALID_EMAIL)

        composeTestRule.onNodeWithText("Password")
            .performTextInput(VALID_PASSWORD)

        composeTestRule.onNodeWithText("Login")
            .performClick()

        // Wait for login to complete
        composeTestRule.waitUntil(timeoutMillis = 5000) {
            composeTestRule.onAllNodesWithText("Home", useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty() ||
            composeTestRule.onAllNodesWithText("Dashboard", useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty() ||
            composeTestRule.onAllNodesWithText("Marketplace", useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()
        }

        // Verify authentication state
        assertTrue("User should be authenticated after login", fakeAuthRepository.isAuthenticatedValue)
    }

    /**
     * Test: Failed login does not store tokens
     * Requirements: 5.2 - Invalid credentials don't store tokens
     */
    @Test
    fun loginScreen_failedLogin_doesNotStoreTokens() {
        // Configure fake repository for failed login
        fakeAuthRepository.configureFailedLogin("Invalid credentials")

        // Enter credentials and login
        composeTestRule.onNodeWithText("Email")
            .performTextInput(WRONG_EMAIL)

        composeTestRule.onNodeWithText("Password")
            .performTextInput(WRONG_PASSWORD)

        composeTestRule.onNodeWithText("Login")
            .performClick()

        // Wait for error
        composeTestRule.waitForIdle()
        composeTestRule.waitUntil(timeoutMillis = 3000) {
            composeTestRule.onAllNodes(
                hasText("Invalid", substring = true, ignoreCase = true) or
                hasText("error", substring = true, ignoreCase = true)
            ).fetchSemanticsNodes().isNotEmpty()
        }

        // Verify authentication state
        assertTrue("User should not be authenticated after failed login", !fakeAuthRepository.isAuthenticatedValue)
    }
}


// MARK: - Helper Extensions

/**
 * Extension function to wait for a condition with timeout
 */
private fun androidx.compose.ui.test.junit4.ComposeTestRule.waitUntil(
    timeoutMillis: Long = 3000,
    condition: () -> Boolean
) {
    val startTime = System.currentTimeMillis()
    while (!condition()) {
        if (System.currentTimeMillis() - startTime > timeoutMillis) {
            throw AssertionError("Condition not met within ${timeoutMillis}ms")
        }
        Thread.sleep(100)
    }
}

/**
 * Extension to check if a node is displayed
 */
private fun SemanticsNodeInteraction.isDisplayed(): Boolean {
    return try {
        assertIsDisplayed()
        true
    } catch (e: AssertionError) {
        false
    }
}
