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

    var nameField: XCUIElement {
        app.textFields["Name"]
    }

    var emailField: XCUIElement {
        app.textFields["Email"]
    }

    var phoneField: XCUIElement {
        app.textFields["Phone"]
    }

    var passwordField: XCUIElement {
        app.secureTextFields["Password"]
    }

    var confirmPasswordField: XCUIElement {
        app.secureTextFields.matching(NSPredicate(format: "placeholderValue CONTAINS[c] 'confirm'")).firstMatch
    }

    var signupButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'sign up' OR label CONTAINS[c] 'create account'")).firstMatch
    }

    var loginLink: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'log in' OR label CONTAINS[c] 'sign in'")).firstMatch
    }

    var errorMessage: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'error' OR label CONTAINS[c] 'invalid' OR label CONTAINS[c] 'exists'")).firstMatch
    }

    var validationMessage: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'required' OR label CONTAINS[c] 'weak password' OR label CONTAINS[c] 'strength'")).firstMatch
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
        dismissKeyboardIfNeeded()
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
        XCTAssertTrue(nameField.waitForExistence(timeout: timeout), "Signup screen should be displayed")
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
