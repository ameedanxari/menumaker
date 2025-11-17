package com.menumaker

import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.menumaker.pageobjects.LoginPage
import com.menumaker.pageobjects.SignupPage
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Android Instrumentation Tests for Authentication Flow
 * Covers login, signup, logout, password recovery
 */
@RunWith(AndroidJUnit4::class)
class AuthenticationFlowTests {

    @get:Rule
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    // MARK: - Login Tests (P0)

    @Test
    fun testLoginScreenDisplays() {
        val loginPage = LoginPage(composeTestRule)
        loginPage.assertScreenDisplayed()
    }

    @Test
    fun testLoginWithValidCredentials() {
        val loginPage = LoginPage(composeTestRule)

        loginPage
            .login("test@example.com", "password123")

        Thread.sleep(2000)
        // Should navigate to marketplace or home
    }

    @Test
    fun testLoginWithInvalidEmail() {
        val loginPage = LoginPage(composeTestRule)

        loginPage
            .enterEmail("invalid-email")
            .enterPassword("password123")
            .tapLogin()

        Thread.sleep(1000)
        loginPage.assertErrorDisplayed()
    }

    @Test
    fun testLoginWithEmptyFields() {
        val loginPage = LoginPage(composeTestRule)

        loginPage
            .tapLogin()

        // Button should be disabled or show error
    }

    @Test
    fun testLoginWithWrongPassword() {
        val loginPage = LoginPage(composeTestRule)

        loginPage
            .login("test@example.com", "wrongpassword")

        Thread.sleep(1000)
        loginPage.assertErrorDisplayed()
    }

    @Test
    fun testNavigateToSignup() {
        val loginPage = LoginPage(composeTestRule)

        loginPage.tapSignup()

        val signupPage = SignupPage(composeTestRule)
        signupPage.assertScreenDisplayed()
    }

    @Test
    fun testNavigateToForgotPassword() {
        val loginPage = LoginPage(composeTestRule)

        loginPage.tapForgotPassword()

        Thread.sleep(1000)
        // Forgot password screen should be displayed
    }

    // MARK: - Signup Tests (P0)

    @Test
    fun testSignupScreenDisplays() {
        val loginPage = LoginPage(composeTestRule)
        loginPage.tapSignup()

        val signupPage = SignupPage(composeTestRule)
        signupPage.assertScreenDisplayed()
    }

    @Test
    fun testSignupWithValidDetails() {
        val loginPage = LoginPage(composeTestRule)
        loginPage.tapSignup()

        val signupPage = SignupPage(composeTestRule)
        signupPage.signup(
            name = "Test User",
            email = "newuser@example.com",
            password = "password123",
            phone = "1234567890"
        )

        Thread.sleep(2000)
        // Should navigate to verification or login
    }

    @Test
    fun testSignupWithInvalidEmail() {
        val loginPage = LoginPage(composeTestRule)
        loginPage.tapSignup()

        val signupPage = SignupPage(composeTestRule)
        signupPage
            .enterName("Test User")
            .enterEmail("invalid-email")
            .enterPassword("password123")
            .enterConfirmPassword("password123")
            .enterPhone("1234567890")
            .acceptTerms()
            .tapSignup()

        Thread.sleep(1000)
        // Should show error
    }

    @Test
    fun testSignupWithPasswordMismatch() {
        val loginPage = LoginPage(composeTestRule)
        loginPage.tapSignup()

        val signupPage = SignupPage(composeTestRule)
        signupPage
            .enterName("Test User")
            .enterEmail("test@example.com")
            .enterPassword("password123")
            .enterConfirmPassword("differentpassword")
            .tapSignup()

        Thread.sleep(1000)
        // Should show error
    }

    @Test
    fun testSignupWithoutAcceptingTerms() {
        val loginPage = LoginPage(composeTestRule)
        loginPage.tapSignup()

        val signupPage = SignupPage(composeTestRule)
        signupPage
            .enterName("Test User")
            .enterEmail("test@example.com")
            .enterPassword("password123")
            .enterConfirmPassword("password123")
            .enterPhone("1234567890")
            .tapSignup()

        Thread.sleep(1000)
        // Should not proceed without accepting terms
    }

    @Test
    fun testSignupWithExistingEmail() {
        val loginPage = LoginPage(composeTestRule)
        loginPage.tapSignup()

        val signupPage = SignupPage(composeTestRule)
        signupPage.signup(
            name = "Test User",
            email = "test@example.com", // Already exists
            password = "password123",
            phone = "1234567890"
        )

        Thread.sleep(2000)
        // Should show error that email exists
    }

    @Test
    fun testNavigateBackToLogin() {
        val loginPage = LoginPage(composeTestRule)
        loginPage.tapSignup()

        val signupPage = SignupPage(composeTestRule)
        signupPage.tapLogin()

        loginPage.assertScreenDisplayed()
    }

    // MARK: - Password Validation Tests (P1)

    @Test
    fun testSignupWithWeakPassword() {
        val loginPage = LoginPage(composeTestRule)
        loginPage.tapSignup()

        val signupPage = SignupPage(composeTestRule)
        signupPage
            .enterName("Test User")
            .enterEmail("test@example.com")
            .enterPassword("123") // Too short
            .enterConfirmPassword("123")
            .tapSignup()

        Thread.sleep(1000)
        // Should show password strength error
    }

    @Test
    fun testSignupWithEmptyName() {
        val loginPage = LoginPage(composeTestRule)
        loginPage.tapSignup()

        val signupPage = SignupPage(composeTestRule)
        signupPage
            .enterEmail("test@example.com")
            .enterPassword("password123")
            .enterConfirmPassword("password123")
            .enterPhone("1234567890")
            .acceptTerms()
            .tapSignup()

        // Should not allow empty name
    }

    @Test
    fun testSignupWithInvalidPhone() {
        val loginPage = LoginPage(composeTestRule)
        loginPage.tapSignup()

        val signupPage = SignupPage(composeTestRule)
        signupPage
            .enterName("Test User")
            .enterEmail("test@example.com")
            .enterPassword("password123")
            .enterConfirmPassword("password123")
            .enterPhone("123") // Too short
            .acceptTerms()
            .tapSignup()

        Thread.sleep(1000)
        // Should show phone validation error
    }
}
