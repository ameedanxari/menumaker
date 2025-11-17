package com.menumaker.pageobjects

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.ComposeTestRule

/**
 * Page Object for Login Screen
 * Provides fluent API for login interactions
 */
class LoginPage(private val composeTestRule: ComposeTestRule) {

    // Elements
    private val emailField = composeTestRule.onNodeWithText("Email", substring = true, useUnmergedTree = true)
    private val passwordField = composeTestRule.onNodeWithText("Password", substring = true, useUnmergedTree = true)
    private val loginButton = composeTestRule.onNodeWithText("Log In", ignoreCase = true)
    private val signupButton = composeTestRule.onNodeWithText("Sign Up", ignoreCase = true)
    private val forgotPasswordButton = composeTestRule.onNodeWithText("Forgot Password", ignoreCase = true)
    private val errorMessage = composeTestRule.onNodeWithText("error", substring = true, ignoreCase = true, useUnmergedTree = true)

    // Actions
    fun enterEmail(email: String): LoginPage {
        emailField.performTextInput(email)
        return this
    }

    fun enterPassword(password: String): LoginPage {
        passwordField.performTextInput(password)
        return this
    }

    fun tapLogin(): LoginPage {
        loginButton.performClick()
        Thread.sleep(2000)
        return this
    }

    fun tapSignup(): LoginPage {
        signupButton.performClick()
        Thread.sleep(1000)
        return this
    }

    fun tapForgotPassword(): LoginPage {
        forgotPasswordButton.performClick()
        Thread.sleep(1000)
        return this
    }

    fun login(email: String, password: String): LoginPage {
        enterEmail(email)
        enterPassword(password)
        tapLogin()
        return this
    }

    // Assertions
    fun assertScreenDisplayed(): LoginPage {
        emailField.assertExists()
        passwordField.assertExists()
        loginButton.assertExists()
        return this
    }

    fun assertErrorDisplayed(): LoginPage {
        errorMessage.assertExists()
        return this
    }

    fun assertLoginButtonEnabled(): LoginPage {
        loginButton.assertIsEnabled()
        return this
    }

    fun assertLoginButtonDisabled(): LoginPage {
        loginButton.assertIsNotEnabled()
        return this
    }
}
