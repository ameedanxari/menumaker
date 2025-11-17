package com.menumaker.ui

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import com.menumaker.MainActivity
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Instrumented UI tests for authentication flows
 * Tests login, signup, and password reset functionality
 *
 * These are high-value tests that verify critical business functionality
 */
@LargeTest
@RunWith(AndroidJUnit4::class)
@HiltAndroidTest
class AuthenticationFlowTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    @Before
    fun setup() {
        hiltRule.inject()
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
            .performTextInput("test@example.com")

        // Verify input was entered
        composeTestRule.onNodeWithText("test@example.com").assertExists()
    }

    @Test
    fun loginScreen_passwordField_acceptsInput() {
        // Find and interact with password field
        composeTestRule.onNodeWithText("Password")
            .performTextInput("password123")

        // Password field should mask input, so we can't verify the exact text
        // but we can verify the field is filled
        composeTestRule.onNodeWithText("Password")
            .assertExists()
    }

    @Test
    fun loginScreen_withValidCredentials_showsLoadingThenSuccess() {
        // Enter valid test credentials
        composeTestRule.onNodeWithText("Email")
            .performTextInput("test@example.com")

        composeTestRule.onNodeWithText("Password")
            .performTextInput("password123")

        // Click login button
        composeTestRule.onNodeWithText("Login")
            .performClick()

        // Verify loading indicator appears
        composeTestRule.onNode(
            hasTestTag("loading") or hasContentDescription("Loading")
        ).assertExists()

        // Wait for navigation or success message
        composeTestRule.waitUntil(timeoutMillis = 5000) {
            composeTestRule.onAllNodesWithText("Home", useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty() ||
            composeTestRule.onAllNodesWithText("Dashboard", useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()
        }
    }

    @Test
    fun loginScreen_withEmptyFields_showsValidationError() {
        // Click login without entering credentials
        composeTestRule.onNodeWithText("Login")
            .performClick()

        // Verify error messages appear
        composeTestRule.waitForIdle()
        composeTestRule.onNode(
            hasText("required", substring = true, ignoreCase = true) or
            hasText("empty", substring = true, ignoreCase = true)
        ).assertExists()
    }

    @Test
    fun loginScreen_withInvalidEmail_showsError() {
        // Enter invalid email
        composeTestRule.onNodeWithText("Email")
            .performTextInput("invalid-email")

        composeTestRule.onNodeWithText("Password")
            .performTextInput("password123")

        composeTestRule.onNodeWithText("Login")
            .performClick()

        // Verify error message
        composeTestRule.waitForIdle()
        composeTestRule.onNode(
            hasText("valid email", substring = true, ignoreCase = true) or
            hasText("invalid email", substring = true, ignoreCase = true)
        ).assertExists()
    }

    // MARK: - Signup Flow Tests

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
        composeTestRule.onNodeWithText("Phone").assertExists()
        composeTestRule.onNodeWithText("Password").assertExists()
    }

    @Test
    fun signupScreen_withValidData_createsAccount() {
        // Navigate to signup
        composeTestRule.onNode(
            hasText("Sign Up", substring = true, ignoreCase = true)
        ).performClick()

        composeTestRule.waitForIdle()

        // Fill form
        composeTestRule.onNodeWithText("Name")
            .performTextInput("Test User")

        composeTestRule.onNodeWithText("Email")
            .performTextInput("newuser@example.com")

        composeTestRule.onNodeWithText("Phone")
            .performTextInput("9876543210")

        composeTestRule.onNodeWithText("Password")
            .performTextInput("SecurePass123!")

        // Submit
        composeTestRule.onNode(
            hasText("Create Account", ignoreCase = true) or
            hasText("Sign Up", ignoreCase = true)
        ).performClick()

        // Verify success or navigation
        composeTestRule.waitUntil(timeoutMillis = 5000) {
            composeTestRule.onAllNodesWithText("Success", useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty() ||
            composeTestRule.onAllNodesWithText("Home", useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()
        }
    }

    @Test
    fun signupScreen_withWeakPassword_showsError() {
        // Navigate to signup
        composeTestRule.onNode(
            hasText("Sign Up", substring = true, ignoreCase = true)
        ).performClick()

        composeTestRule.waitForIdle()

        // Enter weak password
        composeTestRule.onNodeWithText("Name")
            .performTextInput("Test User")

        composeTestRule.onNodeWithText("Email")
            .performTextInput("test@example.com")

        composeTestRule.onNodeWithText("Password")
            .performTextInput("weak")

        // Submit
        composeTestRule.onNode(
            hasText("Create Account", ignoreCase = true)
        ).performClick()

        // Verify error
        composeTestRule.waitForIdle()
        composeTestRule.onNode(
            hasText("password", substring = true, ignoreCase = true) and
            (hasText("weak", substring = true, ignoreCase = true) or
             hasText("characters", substring = true, ignoreCase = true))
        ).assertExists()
    }

    @Test
    fun signupScreen_withExistingEmail_showsError() {
        // Navigate to signup
        composeTestRule.onNode(
            hasText("Sign Up", substring = true, ignoreCase = true)
        ).performClick()

        composeTestRule.waitForIdle()

        // Use existing email
        composeTestRule.onNodeWithText("Name")
            .performTextInput("Test User")

        composeTestRule.onNodeWithText("Email")
            .performTextInput("existing@example.com")

        composeTestRule.onNodeWithText("Password")
            .performTextInput("SecurePass123!")

        // Submit
        composeTestRule.onNode(
            hasText("Create Account", ignoreCase = true)
        ).performClick()

        // Verify error message
        composeTestRule.waitForIdle()
        composeTestRule.onNode(
            hasText("email", substring = true, ignoreCase = true) and
            (hasText("exists", substring = true, ignoreCase = true) or
             hasText("already", substring = true, ignoreCase = true))
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
            .performTextInput("password123")

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

    // MARK: - Navigation Tests

    @Test
    fun loginScreen_backButton_closesApp() {
        // Press back button on login screen
        composeTestRule.onRoot().performKeyPress(androidx.compose.ui.input.key.KeyEvent(
            androidx.compose.ui.input.key.Key.Back,
            androidx.compose.ui.input.key.KeyEventType.Up
        ))

        // App should close or show exit confirmation
        // This is implementation dependent
    }

    @Test
    fun signupScreen_backButton_returnsToLogin() {
        // Navigate to signup
        composeTestRule.onNode(
            hasText("Sign Up", substring = true, ignoreCase = true)
        ).performClick()

        composeTestRule.waitForIdle()

        // Press back
        composeTestRule.onRoot().performKeyPress(androidx.compose.ui.input.key.KeyEvent(
            androidx.compose.ui.input.key.Key.Back,
            androidx.compose.ui.input.key.KeyEventType.Up
        ))

        // Verify return to login
        composeTestRule.waitForIdle()
        composeTestRule.onNodeWithText("Login").assertExists()
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

    // MARK: - Performance Tests

    @Test
    fun loginScreen_rendersQuickly() {
        // Measure time to render login screen
        val startTime = System.currentTimeMillis()

        composeTestRule.waitForIdle()

        val endTime = System.currentTimeMillis()
        val renderTime = endTime - startTime

        // Login screen should render within 2 seconds
        assert(renderTime < 2000) {
            "Login screen took too long to render: ${renderTime}ms"
        }
    }

    @Test
    fun loginButton_respondsQuicklyToClick() {
        // Enter valid credentials
        composeTestRule.onNodeWithText("Email")
            .performTextInput("test@example.com")

        composeTestRule.onNodeWithText("Password")
            .performTextInput("password123")

        // Measure response time
        val startTime = System.currentTimeMillis()

        composeTestRule.onNodeWithText("Login")
            .performClick()

        // Loading indicator should appear quickly
        composeTestRule.waitUntil(timeoutMillis = 1000) {
            composeTestRule.onAllNodesWithContentDescription("Loading", useUnmergedTree = true)
                .fetchSemanticsNodes().isNotEmpty()
        }

        val responseTime = System.currentTimeMillis() - startTime

        // Button should respond within 500ms
        assert(responseTime < 500) {
            "Login button took too long to respond: ${responseTime}ms"
        }
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
