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

    var welcomeText: XCUIElement {
        app.staticTexts["Welcome Back"]
    }

    var emailField: XCUIElement {
        app.textFields["Email"]
    }

    var passwordField: XCUIElement {
        app.secureTextFields["Password"]
    }

    var loginButton: XCUIElement {
        // Updated to match actual button label
        app.buttons["Log In"]
    }

    var signUpButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'sign up'")).firstMatch
    }

    var forgotPasswordButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'forgot password'")).firstMatch
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
        XCTAssertTrue(emailField.waitForExistence(timeout: timeout), "Login screen should be displayed")
        return self
    }

    @discardableResult
    func assertAllElementsVisible() -> LoginPage {
        XCTAssertTrue(welcomeText.exists, "Welcome text should be visible")
        XCTAssertTrue(emailField.exists, "Email field should be visible")
        XCTAssertTrue(passwordField.exists, "Password field should be visible")
        XCTAssertTrue(loginButton.exists, "Login button should be visible")
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
