//
//  SellerPaymentsUITests.swift
//  MenuMakerUITests
//
//  Parity tests to mirror Android payment-related seller screens
//

import XCTest

final class SellerPaymentsUITests: XCTestCase {

    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["UI-Testing", "SellerMode"]
        app.launch()

        // Login as seller
        let loginPage = LoginPage(app: app)
        if loginPage.emailField.waitForExistence(timeout: 2) {
            loginPage.login(email: "seller@example.com", password: "password123")
            _ = app.tabBars.firstMatch.waitForExistence(timeout: 5)
        }
    }

    override func tearDownWithError() throws {
        app = nil
    }

    // MARK: - Payment Processors

    @MainActor
    func testPaymentProcessorsScreenDisplays() throws {
        guard navigateToPaymentsSection() else {
            XCTFail("Could not navigate to Payment Processors - UI element not found or feature not implemented"); return
        }

        let title = app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'payment'")).firstMatch
        XCTAssertTrue(title.waitForExistence(timeout: 3), "Payment Processors screen should be visible")
    }

    // MARK: - Payouts

    @MainActor
    func testPayoutsScreenDisplays() throws {
        guard navigateToPayouts() else {
            XCTFail("Could not navigate to Payouts - UI element not found or feature not implemented"); return
        }

        let payoutsLabel = app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'payout'")).firstMatch
        XCTAssertTrue(payoutsLabel.waitForExistence(timeout: 3), "Payouts screen should show payout info")
    }

    // MARK: - Helpers

    /// Attempts to navigate to Payment Processors screen via tab, list item, or button
    private func navigateToPaymentsSection() -> Bool {
        let paymentTab = app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'payment'")).firstMatch
        if paymentTab.waitForExistence(timeout: 2) {
            paymentTab.tap()
            return true
        }

        let paymentCell = app.cells.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'payment'")).firstMatch
        if paymentCell.waitForExistence(timeout: 2) {
            paymentCell.tap()
            return true
        }

        let paymentButton = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'payment'")).firstMatch
        if paymentButton.waitForExistence(timeout: 2) {
            paymentButton.tap()
            return true
        }

        return false
    }

    /// Attempts to navigate to payouts view
    private func navigateToPayouts() -> Bool {
        let payoutsTab = app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'payout' OR label CONTAINS[c] 'payouts'")).firstMatch
        if payoutsTab.waitForExistence(timeout: 2) {
            payoutsTab.tap()
            return true
        }

        let payoutsCell = app.cells.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'payout'")).firstMatch
        if payoutsCell.waitForExistence(timeout: 2) {
            payoutsCell.tap()
            return true
        }

        let payoutsButton = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'payout'")).firstMatch
        if payoutsButton.waitForExistence(timeout: 2) {
            payoutsButton.tap()
            return true
        }

        return false
    }
}
