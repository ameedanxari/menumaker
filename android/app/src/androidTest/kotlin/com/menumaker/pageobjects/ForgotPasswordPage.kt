package com.menumaker.pageobjects

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.ComposeTestRule

/**
 * Page Object for Forgot Password Screen
 * Provides fluent API for password reset interactions
 */
class ForgotPasswordPage(private val composeTestRule: ComposeTestRule) {

    // Elements
    private val emailField = composeTestRule.onNodeWithTag("email-field")
    private val submitButton = composeTestRule.onNodeWithTag("submit-button")
    private val backButton = composeTestRule.onNodeWithContentDescription("Back", substring = true)
    private val successMessage = composeTestRule.onNodeWithTag("success-message")
    private val errorMessage = composeTestRule.onNodeWithTag("error-message")

    // Actions
    fun enterEmail(email: String): ForgotPasswordPage {
        emailField.performTextInput(email)
        return this
    }

    fun tapSubmit(): ForgotPasswordPage {
        submitButton.performClick()
        Thread.sleep(2000) // Wait for API response
        return this
    }

    fun tapBack(): LoginPage {
        backButton.performClick()
        Thread.sleep(500)
        return LoginPage(composeTestRule)
    }

    // Assertions
    fun assertScreenDisplayed(): ForgotPasswordPage {
        emailField.assertExists()
        submitButton.assertExists()
        return this
    }

    fun assertSuccessDisplayed(): ForgotPasswordPage {
        successMessage.assertExists()
        return this
    }

    fun assertErrorDisplayed(): ForgotPasswordPage {
        errorMessage.assertExists()
        return this
    }

    fun assertSubmitButtonEnabled(): ForgotPasswordPage {
        submitButton.assertIsEnabled()
        return this
    }

    fun assertSubmitButtonDisabled(): ForgotPasswordPage {
        submitButton.assertIsNotEnabled()
        return this
    }
}
