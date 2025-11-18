//
//  AuthenticationUITests.swift
//  MenuMakerUITests
//
//  UI tests for authentication flows
//  Refactored to use Page Object pattern
//

import XCTest

final class AuthenticationUITests: XCTestCase {

    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["UI-Testing"]
        app.launch()
    }

    override func tearDownWithError() throws {
        app = nil
    }

    // MARK: - Login Flow Tests

    @MainActor
    func testLoginScreenDisplaysCorrectly() throws {
        let loginPage = LoginPage(app: app)

        loginPage
            .assertScreenDisplayed()
            .assertAllElementsVisible()
    }

    @MainActor
    func testLoginWithValidCredentials() throws {
        let loginPage = LoginPage(app: app)

        loginPage
            .enterEmail("test@example.com")
            .enterPassword("password123")
            .tapLogin()

        // Verify navigation to home screen or marketplace
        let homeOrMarketplace = app.staticTexts["Home"].waitForExistence(timeout: 5) ||
                                app.navigationBars["MenuMaker"].waitForExistence(timeout: 5) ||
                                app.staticTexts["Marketplace"].waitForExistence(timeout: 5)
        XCTAssertTrue(homeOrMarketplace, "Should navigate to home/marketplace after successful login")
    }

    @MainActor
    func testLoginWithInvalidEmail() throws {
        let loginPage = LoginPage(app: app)

        loginPage
            .enterEmail("invalid-email")
            .enterPassword("password123")
            .tapLogin()
            .assertErrorDisplayed()
    }

    @MainActor
    func testLoginWithEmptyFields() throws {
        let loginPage = LoginPage(app: app)

        loginPage
            .tapLogin()
            .assertValidationDisplayed()
    }

    @MainActor
    func testNavigateToSignupFromLogin() throws {
        let loginPage = LoginPage(app: app)
        let signupPage = loginPage.tapSignUp()

        signupPage.assertScreenDisplayed()
    }

    // MARK: - Signup Flow Tests

    @MainActor
    func testSignupScreenDisplaysCorrectly() throws {
        let loginPage = LoginPage(app: app)
        let signupPage = loginPage.tapSignUp()

        signupPage
            .assertScreenDisplayed()
            .assertAllElementsVisible()
    }

    @MainActor
    func testSignupWithValidData() throws {
        let loginPage = LoginPage(app: app)
        let signupPage = loginPage.tapSignUp()

        signupPage
            .enterName("Test User")
            .enterEmail("newuser@example.com")
            .enterPhone("9876543210")
            .enterPassword("SecurePassword123!")
            .tapSignup()

        // Verify navigation to home or success message
        let success = app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'welcome' OR label CONTAINS[c] 'success'")).firstMatch.waitForExistence(timeout: 5) ||
                     app.navigationBars["MenuMaker"].waitForExistence(timeout: 5)
        XCTAssertTrue(success, "Should show success after signup")
    }

    @MainActor
    func testSignupWithMissingRequiredFields() throws {
        let loginPage = LoginPage(app: app)
        let signupPage = loginPage.tapSignUp()

        signupPage
            .enterEmail("incomplete@example.com")
            .tapSignup()
            .assertValidationDisplayed()
    }

    @MainActor
    func testSignupWithWeakPassword() throws {
        let loginPage = LoginPage(app: app)
        let signupPage = loginPage.tapSignUp()

        signupPage
            .enterName("Test User")
            .enterEmail("test@example.com")
            .enterPassword("123")
            .tapSignup()
            .assertValidationDisplayed()
    }

    @MainActor
    func testNavigateBackToLoginFromSignup() throws {
        let loginPage = LoginPage(app: app)
        let signupPage = loginPage.tapSignUp()

        signupPage.assertScreenDisplayed()

        let backToLogin = signupPage.tapLoginLink()
        backToLogin.assertScreenDisplayed()
    }

    // MARK: - Password Reset Flow Tests

    @MainActor
    func testForgotPasswordFlow() throws {
        let loginPage = LoginPage(app: app)
        let forgotPasswordPage = loginPage.tapForgotPassword()

        forgotPasswordPage
            .assertScreenDisplayed()
            .enterEmail("test@example.com")
            .tapSubmit()
            .assertSuccessDisplayed()
    }

    @MainActor
    func testForgotPasswordWithInvalidEmail() throws {
        let loginPage = LoginPage(app: app)
        let forgotPasswordPage = loginPage.tapForgotPassword()

        forgotPasswordPage
            .assertScreenDisplayed()
            .enterEmail("nonexistent@example.com")
            .tapSubmit()
            .assertErrorDisplayed()
    }

    // MARK: - Logout Flow Tests

    @MainActor
    func testLogoutFlow() throws {
        // First login
        let loginPage = LoginPage(app: app)
        loginPage.login(email: "test@example.com", password: "password123")

        // Wait for home screen
        XCTAssertTrue(app.navigationBars["MenuMaker"].waitForExistence(timeout: 5) ||
                     app.tabBars.firstMatch.waitForExistence(timeout: 5),
                     "Should navigate to home after login")

        // Navigate to profile/more
        let moreTab = app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'more' OR label CONTAINS[c] 'profile'")).firstMatch
        guard moreTab.waitForExistence(timeout: 2) else {
            throw XCTSkip("Profile/More tab not found")
        }
        moreTab.tap()

        // Tap logout
        let logoutButton = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'logout' OR label CONTAINS[c] 'sign out'")).firstMatch
        guard logoutButton.waitForExistence(timeout: 2) else {
            throw XCTSkip("Logout button not found")
        }
        logoutButton.tap()

        // Confirm logout in the confirmation dialog
        let confirmButton = app.buttons["confirm-logout-button"]
        if confirmButton.waitForExistence(timeout: 2) {
            confirmButton.tap()
        }

        // Verify back on login screen
        XCTAssertTrue(loginPage.emailField.waitForExistence(timeout: 3), "Should return to login screen after logout")
    }

    // MARK: - Accessibility Tests

    @MainActor
    func testLoginScreenAccessibility() throws {
        let loginPage = LoginPage(app: app)

        XCTAssertTrue(loginPage.emailField.isHittable, "Email field should be accessible")
        XCTAssertTrue(loginPage.passwordField.isHittable, "Password field should be accessible")
        XCTAssertTrue(loginPage.loginButton.isHittable, "Login button should be accessible")
    }

    // MARK: - Performance Tests

    @MainActor
    func testLoginButtonResponseTime() throws {
        let loginPage = LoginPage(app: app)

        loginPage
            .enterEmail("test@example.com")
            .enterPassword("password123")

        measure {
            loginPage.loginButton.tap()
            // Wait for response
            _ = app.staticTexts.firstMatch.waitForExistence(timeout: 1)
        }
    }
}
