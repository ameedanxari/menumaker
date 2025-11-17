//
//  LoginPage.swift
//  MenuMakerUITests
//
//  Page Object for Login Screen
//

import XCTest

struct LoginPage {
    let app: XCUIApplication

    // MARK: - Elements

    private var loginScreen: XCUIElement {
        app.scrollViews["login-screen"]
    }

    var welcomeText: XCUIElement {
        app.staticTexts["Welcome Back"]
    }

    var emailField: XCUIElement {
        loginScreen.textFields["email-field"]
    }

    var passwordField: XCUIElement {
        loginScreen.secureTextFields["password-field"]
    }

    var loginButton: XCUIElement {
        // Use accessibility identifier instead of label
        app.buttons["login-button"]
    }

    var signUpButton: XCUIElement {
        app.buttons["signup-link-button"]
    }

    var forgotPasswordButton: XCUIElement {
        app.buttons["forgot-password-link"]
    }

    var errorMessage: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'error' OR label CONTAINS[c] 'invalid'")).firstMatch
    }

    var validationMessage: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'required' OR label CONTAINS[c] 'empty'")).firstMatch
    }

    // MARK: - Actions

    @discardableResult
    func enterEmail(_ email: String) -> LoginPage {
        emailField.tap()
        emailField.typeText(email)
        return self
    }

    @discardableResult
    func enterPassword(_ password: String) -> LoginPage {
        passwordField.tap()
        passwordField.typeText(password)
        return self
    }

    @discardableResult
    func tapLogin() -> LoginPage {
        dismissKeyboardIfNeeded()
        loginButton.tap()
        return self
    }

    @discardableResult
    func tapSignUp() -> SignupPage {
        signUpButton.tap()
        return SignupPage(app: app)
    }

    @discardableResult
    func tapForgotPassword() -> ForgotPasswordPage {
        forgotPasswordButton.tap()
        return ForgotPasswordPage(app: app)
    }

    func login(email: String, password: String) {
        enterEmail(email)
        enterPassword(password)
        tapLogin()
    }

    // MARK: - Assertions

    @discardableResult
    func assertScreenDisplayed(timeout: TimeInterval = 2) -> LoginPage {
        XCTAssertTrue(loginScreen.waitForExistence(timeout: timeout), "Login screen should be displayed")
        return self
    }

    @discardableResult
    func assertAllElementsVisible() -> LoginPage {
        XCTAssertTrue(emailField.waitForExistence(timeout: 2), "Email field should be visible")
        XCTAssertTrue(passwordField.waitForExistence(timeout: 2), "Password field should be visible")
        XCTAssertTrue(loginButton.waitForExistence(timeout: 2), "Login button should be visible")
        return self
    }

    @discardableResult
    func assertErrorDisplayed(timeout: TimeInterval = 3) -> LoginPage {
        XCTAssertTrue(errorMessage.waitForExistence(timeout: timeout), "Error message should be displayed")
        return self
    }

    @discardableResult
    func assertValidationDisplayed(timeout: TimeInterval = 2) -> LoginPage {
        XCTAssertTrue(validationMessage.waitForExistence(timeout: timeout), "Validation message should be displayed")
        return self
    }

    // MARK: - Helpers

    private func dismissKeyboardIfNeeded() {
        if app.keyboards.count > 0 {
            app.keyboards.buttons["Return"].tap()
        }
    }
}
