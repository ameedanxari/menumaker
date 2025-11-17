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

    var emailField: XCUIElement {
        app.textFields["email-field"]
    }

    var submitButton: XCUIElement {
        // Since ForgotPasswordView doesn't exist yet, look for any button that might be a submit button
        app.buttons["submit-button"]
    }

    var backButton: XCUIElement {
        app.navigationBars.buttons.firstMatch
    }

    var successMessage: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'sent' OR label CONTAINS[c] 'check email'")).firstMatch
    }

    var errorMessage: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'error' OR label CONTAINS[c] 'invalid'")).firstMatch
    }

    // MARK: - Actions

    @discardableResult
    func enterEmail(_ email: String) -> ForgotPasswordPage {
        emailField.tap()
        emailField.typeText(email)
        return self
    }

    @discardableResult
    func tapSubmit() -> ForgotPasswordPage {
        dismissKeyboardIfNeeded()
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
        // Check if we actually navigated to a forgot password screen
        // For now, check if the email field exists and login button doesn't exist
        let onForgotPasswordScreen = emailField.waitForExistence(timeout: timeout) &&
                                     !app.buttons["login-button"].exists
        XCTAssertTrue(onForgotPasswordScreen, "Forgot password screen should be displayed")
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
