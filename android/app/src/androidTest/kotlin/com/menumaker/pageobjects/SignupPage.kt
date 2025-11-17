package com.menumaker.pageobjects

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.ComposeTestRule

/**
 * Page Object for Signup Screen
 */
class SignupPage(private val composeTestRule: ComposeTestRule) {

    // Elements
    private val nameField = composeTestRule.onNodeWithText("Name", substring = true)
    private val emailField = composeTestRule.onNodeWithText("Email", substring = true)
    private val passwordField = composeTestRule.onAllNodesWithText("Password", substring = true).onFirst()
    private val confirmPasswordField = composeTestRule.onNodeWithText("Confirm Password", substring = true)
    private val phoneField = composeTestRule.onNodeWithText("Phone", substring = true)
    private val signupButton = composeTestRule.onNodeWithText("Sign Up", ignoreCase = true)
    private val loginButton = composeTestRule.onNodeWithText("Log In", ignoreCase = true)
    private val termsCheckbox = composeTestRule.onNode(hasClickAction().and(hasText("terms", substring = true, ignoreCase = true)))

    // Actions
    fun enterName(name: String): SignupPage {
        nameField.performTextInput(name)
        return this
    }

    fun enterEmail(email: String): SignupPage {
        emailField.performTextInput(email)
        return this
    }

    fun enterPassword(password: String): SignupPage {
        passwordField.performTextInput(password)
        return this
    }

    fun enterConfirmPassword(password: String): SignupPage {
        confirmPasswordField.performTextInput(password)
        return this
    }

    fun enterPhone(phone: String): SignupPage {
        phoneField.performTextInput(phone)
        return this
    }

    fun acceptTerms(): SignupPage {
        termsCheckbox.performClick()
        return this
    }

    fun tapSignup(): SignupPage {
        signupButton.performClick()
        Thread.sleep(2000)
        return this
    }

    fun tapLogin(): SignupPage {
        loginButton.performClick()
        Thread.sleep(1000)
        return this
    }

    fun signup(name: String, email: String, password: String, phone: String): SignupPage {
        enterName(name)
        enterEmail(email)
        enterPassword(password)
        enterConfirmPassword(password)
        enterPhone(phone)
        acceptTerms()
        tapSignup()
        return this
    }

    // Assertions
    fun assertScreenDisplayed(): SignupPage {
        signupButton.assertExists()
        emailField.assertExists()
        return this
    }

    fun assertSignupButtonEnabled(): SignupPage {
        signupButton.assertIsEnabled()
        return this
    }
}
