//
//  ForgotPasswordPage.swift
//  MenuMakerUITests
//
//  Page Object for Forgot Password Screen
//

import XCTest

struct ForgotPasswordPage {
    let app: XCUIApplication

    // MARK: - Elements

    private var forgotPasswordScreen: XCUIElement {
        app.scrollViews["forgot-password-screen"]
    }

    var emailField: XCUIElement {
        forgotPasswordScreen.textFields["email-field"]
    }

    var submitButton: XCUIElement {
        app.buttons["submit-button"]
    }

    var backButton: XCUIElement {
        app.navigationBars.buttons.firstMatch
    }

    var successMessage: XCUIElement {
        app.staticTexts["success-message"]
    }

    var errorMessage: XCUIElement {
        app.staticTexts["error-message"]
    }

    // MARK: - Actions

    @discardableResult
    func enterEmail(_ email: String) -> ForgotPasswordPage {
        // Wait for field to be hittable before interacting
        XCTAssertTrue(emailField.waitForExistence(timeout: 3), "Email field should exist")

        emailField.tap()
        emailField.typeText(email)
        return self
    }

    @discardableResult
    func tapSubmit() -> ForgotPasswordPage {
        // No need to dismiss keyboard - tapping button will dismiss it automatically
        submitButton.tap()
        return self
    }

    @discardableResult
    func tapBack() -> LoginPage {
        backButton.tap()
        return LoginPage(app: app)
    }

    // MARK: - Assertions

    @discardableResult
    func assertScreenDisplayed(timeout: TimeInterval = 2) -> ForgotPasswordPage {
        XCTAssertTrue(forgotPasswordScreen.waitForExistence(timeout: timeout), "Forgot password screen should be displayed")
        return self
    }

    @discardableResult
    func assertSuccessDisplayed(timeout: TimeInterval = 3) -> ForgotPasswordPage {
        XCTAssertTrue(successMessage.waitForExistence(timeout: timeout), "Success message should be displayed")
        return self
    }

    @discardableResult
    func assertErrorDisplayed(timeout: TimeInterval = 3) -> ForgotPasswordPage {
        XCTAssertTrue(errorMessage.waitForExistence(timeout: timeout), "Error message should be displayed")
        return self
    }

    // MARK: - Helpers

    private func dismissKeyboardIfNeeded() {
        if app.keyboards.count > 0 {
            app.keyboards.buttons["Return"].tap()
        }
    }
}
