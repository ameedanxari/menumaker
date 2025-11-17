//
//  ReferralPage.swift
//  MenuMakerUITests
//
//  Page Object for Referral System Screen
//

import XCTest

struct ReferralPage {
    let app: XCUIApplication

    // MARK: - Elements

    var referralCodeLabel: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label MATCHES '[A-Z0-9]{6,10}'")).firstMatch
    }

    var copyCodeButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'copy'")).firstMatch
    }

    var shareButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'share' OR label CONTAINS[c] 'invite'")).firstMatch
    }

    var totalReferralsLabel: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'referral' AND label MATCHES '.*\\\\d+.*'")).firstMatch
    }

    var pendingRewardsLabel: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'pending' AND label CONTAINS '₹'")).firstMatch
    }

    var availableCreditsLabel: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'available' AND label CONTAINS '₹'")).firstMatch
    }

    var referralHistoryList: XCUIElementQuery {
        app.tables.cells.matching(identifier: "ReferralHistoryCell")
    }

    var firstReferralEntry: XCUIElement {
        referralHistoryList.firstMatch
    }

    var howItWorksButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'how it works'")).firstMatch
    }

    var termsAndConditionsButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'terms'")).firstMatch
    }

    var enterReferralCodeField: XCUIElement {
        app.textFields.matching(NSPredicate(format: "placeholderValue CONTAINS[c] 'enter code' OR placeholderValue CONTAINS[c] 'referral code'")).firstMatch
    }

    var applyReferralButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'apply' OR label CONTAINS[c] 'redeem'")).firstMatch
    }

    var successMessage: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'success' OR label CONTAINS[c] 'applied' OR label CONTAINS[c] 'earned'")).firstMatch
    }

    var errorMessage: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'invalid' OR label CONTAINS[c] 'error' OR label CONTAINS[c] 'expired'")).firstMatch
    }

    // MARK: - Actions

    @discardableResult
    func tapCopyCode() -> ReferralPage {
        copyCodeButton.tap()
        sleep(1)
        return self
    }

    @discardableResult
    func tapShare() -> ReferralPage {
        shareButton.tap()
        sleep(1)

        // Handle share sheet if it appears
        let cancelButton = app.buttons["Cancel"]
        if cancelButton.waitForExistence(timeout: 1) {
            cancelButton.tap()
        }

        return self
    }

    @discardableResult
    func tapHowItWorks() -> ReferralPage {
        howItWorksButton.tap()
        sleep(1)
        return self
    }

    @discardableResult
    func enterReferralCode(_ code: String) -> ReferralPage {
        enterReferralCodeField.tap()
        enterReferralCodeField.typeText(code)
        return self
    }

    @discardableResult
    func applyReferralCode() -> ReferralPage {
        dismissKeyboardIfNeeded()
        applyReferralButton.tap()
        sleep(1)
        return self
    }

    func applyCode(_ code: String) {
        enterReferralCode(code)
        applyReferralCode()
    }

    @discardableResult
    func viewReferralHistory() -> ReferralPage {
        // Scroll down to history section if needed
        let scrollView = app.scrollViews.firstMatch
        if scrollView.exists {
            scrollView.swipeUp()
        }
        return self
    }

    // MARK: - Assertions

    @discardableResult
    func assertScreenDisplayed(timeout: TimeInterval = 2) -> ReferralPage {
        XCTAssertTrue(referralCodeLabel.waitForExistence(timeout: timeout) ||
                     shareButton.waitForExistence(timeout: timeout),
                     "Referral screen should be displayed")
        return self
    }

    @discardableResult
    func assertReferralCodeDisplayed() -> ReferralPage {
        XCTAssertTrue(referralCodeLabel.exists, "Referral code should be displayed")
        XCTAssertGreaterThan(referralCodeLabel.label.count, 5, "Referral code should be valid length")
        return self
    }

    @discardableResult
    func assertShareButtonVisible() -> ReferralPage {
        XCTAssertTrue(shareButton.exists, "Share button should be visible")
        return self
    }

    @discardableResult
    func assertCopyButtonVisible() -> ReferralPage {
        XCTAssertTrue(copyCodeButton.exists, "Copy button should be visible")
        return self
    }

    @discardableResult
    func assertTotalReferralsDisplayed() -> ReferralPage {
        XCTAssertTrue(totalReferralsLabel.exists, "Total referrals should be displayed")
        return self
    }

    @discardableResult
    func assertAvailableCredits(_ expectedAmount: String? = nil) -> ReferralPage {
        XCTAssertTrue(availableCreditsLabel.exists, "Available credits should be displayed")

        if let expected = expectedAmount {
            XCTAssertTrue(availableCreditsLabel.label.contains(expected),
                         "Credits should show \(expected)")
        }

        return self
    }

    @discardableResult
    func assertSuccessMessageDisplayed(timeout: TimeInterval = 3) -> ReferralPage {
        XCTAssertTrue(successMessage.waitForExistence(timeout: timeout), "Success message should be displayed")
        return self
    }

    @discardableResult
    func assertErrorMessageDisplayed(timeout: TimeInterval = 3) -> ReferralPage {
        XCTAssertTrue(errorMessage.waitForExistence(timeout: timeout), "Error message should be displayed")
        return self
    }

    @discardableResult
    func assertReferralHistoryExists() -> ReferralPage {
        XCTAssertTrue(firstReferralEntry.exists, "Referral history should be displayed")
        return self
    }

    // MARK: - Helpers

    private func dismissKeyboardIfNeeded() {
        if app.keyboards.count > 0 {
            app.keyboards.buttons["Return"].tap()
        }
    }
}
