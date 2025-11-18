//
//  SignupPage.swift
//  MenuMakerUITests
//
//  Page Object for Signup Screen
//

import XCTest

struct SignupPage {
    let app: XCUIApplication

    // MARK: - Elements

    private var signupScreen: XCUIElement {
        app.scrollViews["signup-screen"]
    }

    var nameField: XCUIElement {
        signupScreen.textFields["name-field"]
    }

    var emailField: XCUIElement {
        signupScreen.textFields["email-field"]
    }

    var phoneField: XCUIElement {
        signupScreen.textFields["phone-field"]
    }

    var passwordField: XCUIElement {
        signupScreen.secureTextFields["password-field"]
    }

    var confirmPasswordField: XCUIElement {
        signupScreen.secureTextFields["confirm-password-field"]
    }

    var signupButton: XCUIElement {
        app.buttons["signup-button"]
    }

    var loginLink: XCUIElement {
        app.buttons["cancel-button"]
    }

    var errorMessage: XCUIElement {
        signupScreen.staticTexts["error-message"]
    }

    var validationMessage: XCUIElement {
        // Validation messages use the same error-message identifier
        signupScreen.staticTexts["error-message"]
    }

    // MARK: - Actions

    @discardableResult
    func enterName(_ name: String) -> SignupPage {
        nameField.tap()
        nameField.typeText(name)
        return self
    }

    @discardableResult
    func enterEmail(_ email: String) -> SignupPage {
        emailField.tap()
        emailField.typeText(email)
        return self
    }

    @discardableResult
    func enterPhone(_ phone: String) -> SignupPage {
        phoneField.tap()
        phoneField.typeText(phone)
        return self
    }

    @discardableResult
    func enterPassword(_ password: String) -> SignupPage {
        passwordField.tap()
        passwordField.typeText(password)
        return self
    }

    @discardableResult
    func enterConfirmPassword(_ password: String) -> SignupPage {
        confirmPasswordField.tap()
        confirmPasswordField.typeText(password)
        return self
    }

    @discardableResult
    func tapSignup() -> SignupPage {
        // No need to dismiss keyboard - tapping button will dismiss it automatically
        signupButton.tap()
        return self
    }

    @discardableResult
    func tapLoginLink() -> LoginPage {
        loginLink.tap()
        return LoginPage(app: app)
    }

    func signup(name: String, email: String, password: String, phone: String? = nil) {
        enterName(name)
        enterEmail(email)
        if let phone = phone {
            enterPhone(phone)
        }
        enterPassword(password)
        tapSignup()
    }

    // MARK: - Assertions

    @discardableResult
    func assertScreenDisplayed(timeout: TimeInterval = 2) -> SignupPage {
        XCTAssertTrue(signupScreen.waitForExistence(timeout: timeout), "Signup screen should be displayed")
        return self
    }

    @discardableResult
    func assertAllElementsVisible() -> SignupPage {
        XCTAssertTrue(nameField.waitForExistence(timeout: 2), "Name field should be visible")
        XCTAssertTrue(emailField.waitForExistence(timeout: 2), "Email field should be visible")
        XCTAssertTrue(passwordField.waitForExistence(timeout: 2), "Password field should be visible")
        XCTAssertTrue(signupButton.waitForExistence(timeout: 2), "Signup button should be visible")
        return self
    }

    @discardableResult
    func assertErrorDisplayed(timeout: TimeInterval = 3) -> SignupPage {
        XCTAssertTrue(errorMessage.waitForExistence(timeout: timeout), "Error message should be displayed")
        return self
    }

    @discardableResult
    func assertValidationDisplayed(timeout: TimeInterval = 2) -> SignupPage {
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
