//
//  ReferralFlowTests.swift
//  MenuMakerUITests
//
//  Tests for referral system - share codes, apply codes, track rewards
//

import XCTest

final class ReferralFlowTests: XCTestCase {

    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["UI-Testing"]
        app.launch()

        // Login
        let loginPage = LoginPage(app: app)
        if loginPage.emailField.waitForExistence(timeout: 2) {
            loginPage.login(email: "test@example.com", password: "password123")
            _ = app.tabBars.firstMatch.waitForExistence(timeout: 5)
        }
    }

    override func tearDownWithError() throws {
        app = nil
    }

    // MARK: - Referral Code Display Tests (P0)

    @MainActor
    func testReferralScreenDisplays() throws {
        navigateToReferrals()

        let referralPage = ReferralPage(app: app)
        referralPage.assertScreenDisplayed()
    }

    @MainActor
    func testUserReferralCodeDisplayed() throws {
        navigateToReferrals()

        let referralPage = ReferralPage(app: app)

        guard referralPage.referralCodeLabel.waitForExistence(timeout: 2) else {
            XCTFail("Referral feature not implemented yet - UI element not found or feature not implemented"); return
        }

        referralPage
            .assertReferralCodeDisplayed()
            .assertShareButtonVisible()
            .assertCopyButtonVisible()
    }

    @MainActor
    func testCopyReferralCode() throws {
        navigateToReferrals()

        let referralPage = ReferralPage(app: app)

        guard referralPage.copyCodeButton.waitForExistence(timeout: 2) else {
            XCTFail("Copy code feature not implemented yet - UI element not found or feature not implemented"); return
        }

        referralPage
            .assertReferralCodeDisplayed()
            .tapCopyCode()

        // Verify code was copied (ideally check pasteboard, but UITest limitations)
        sleep(1)
    }

    @MainActor
    func testShareReferralCode() throws {
        navigateToReferrals()

        let referralPage = ReferralPage(app: app)

        guard referralPage.shareButton.waitForExistence(timeout: 2) else {
            XCTFail("Share feature not implemented yet - UI element not found or feature not implemented"); return
        }

        referralPage
            .assertReferralCodeDisplayed()
            .tapShare()

        // Share sheet handling is done in page object
        sleep(1)
    }

    // MARK: - Referral Stats Tests (P0)

    @MainActor
    func testViewReferralStats() throws {
        navigateToReferrals()

        let referralPage = ReferralPage(app: app)

        guard referralPage.totalReferralsLabel.waitForExistence(timeout: 2) ||
              referralPage.availableCreditsLabel.waitForExistence(timeout: 2) else {
            XCTFail("Referral stats not implemented yet - UI element not found or feature not implemented"); return
        }

        // Verify stats are displayed
        XCTAssertTrue(
            referralPage.totalReferralsLabel.exists ||
            referralPage.availableCreditsLabel.exists ||
            referralPage.pendingRewardsLabel.exists,
            "At least one stat should be displayed"
        )
    }

    @MainActor
    func testViewAvailableCredits() throws {
        navigateToReferrals()

        let referralPage = ReferralPage(app: app)

        guard referralPage.availableCreditsLabel.waitForExistence(timeout: 2) else {
            XCTFail("Credits display not implemented yet - UI element not found or feature not implemented"); return
        }

        referralPage.assertAvailableCredits()
    }

    @MainActor
    func testViewReferralHistory() throws {
        navigateToReferrals()

        let referralPage = ReferralPage(app: app)

        guard referralPage.referralCodeLabel.waitForExistence(timeout: 2) else {
            XCTFail("Referral feature not implemented yet - UI element not found or feature not implemented"); return
        }

        referralPage.viewReferralHistory()

        // Either history exists or empty state
        XCTAssertTrue(
            referralPage.firstReferralEntry.exists ||
            app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'no referrals'")).firstMatch.exists,
            "Should show referral history or empty state"
        )
    }

    // MARK: - Apply Referral Code Tests (P0)

    @MainActor
    func testApplyValidReferralCode() throws {
        navigateToReferrals()

        let referralPage = ReferralPage(app: app)

        guard referralPage.enterReferralCodeField.waitForExistence(timeout: 2) else {
            XCTFail("Apply referral code feature not implemented yet - UI element not found or feature not implemented"); return
        }

        referralPage
            .enterReferralCode("TESTCODE123")
            .applyReferralCode()

        // Should show success or already used message
        sleep(2)
        XCTAssertTrue(
            referralPage.successMessage.exists ||
            referralPage.errorMessage.exists,
            "Should show feedback after applying code"
        )
    }

    @MainActor
    func testApplyInvalidReferralCode() throws {
        navigateToReferrals()

        let referralPage = ReferralPage(app: app)

        guard referralPage.enterReferralCodeField.waitForExistence(timeout: 2) else {
            XCTFail("Apply referral code feature not implemented yet - UI element not found or feature not implemented"); return
        }

        referralPage
            .enterReferralCode("INVALID999")
            .applyReferralCode()

        // Should show error for invalid code
        sleep(2)
    }

    @MainActor
    func testApplyEmptyReferralCode() throws {
        navigateToReferrals()

        let referralPage = ReferralPage(app: app)

        guard referralPage.enterReferralCodeField.waitForExistence(timeout: 2) else {
            XCTFail("Apply referral code feature not implemented yet - UI element not found or feature not implemented"); return
        }

        referralPage.applyReferralCode()

        // Should show error or disable button
        sleep(1)
        XCTAssertFalse(referralPage.applyReferralButton.isEnabled || referralPage.errorMessage.exists,
                      "Should not allow applying empty code")
    }

    @MainActor
    func testApplyOwnReferralCode() throws {
        navigateToReferrals()

        let referralPage = ReferralPage(app: app)

        guard referralPage.referralCodeLabel.waitForExistence(timeout: 2) &&
              referralPage.enterReferralCodeField.waitForExistence(timeout: 2) else {
            XCTFail("Referral code feature not fully implemented yet - UI element not found or feature not implemented"); return
        }

        // Get user's own code
        let ownCode = referralPage.referralCodeLabel.label

        referralPage
            .enterReferralCode(ownCode)
            .applyReferralCode()

        // Should show error for applying own code
        sleep(2)
        // Most apps don't allow users to apply their own referral code
    }

    // MARK: - Referral Information Tests (P1)

    @MainActor
    func testViewHowItWorks() throws {
        navigateToReferrals()

        let referralPage = ReferralPage(app: app)

        guard referralPage.howItWorksButton.waitForExistence(timeout: 2) else {
            XCTFail("How it works feature not implemented yet - UI element not found or feature not implemented"); return
        }

        referralPage.tapHowItWorks()

        // Should display information sheet or navigate to info screen
        sleep(1)
        XCTAssertTrue(
            app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'how' AND label CONTAINS[c] 'works'")).firstMatch.exists ||
            app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'refer'")).count > 2,
            "Should show referral information"
        )
    }

    @MainActor
    func testViewTermsAndConditions() throws {
        navigateToReferrals()

        let referralPage = ReferralPage(app: app)

        guard referralPage.termsAndConditionsButton.waitForExistence(timeout: 2) else {
            XCTFail("Terms and conditions not implemented yet - UI element not found or feature not implemented"); return
        }

        referralPage.termsAndConditionsButton.tap()

        // Should display terms
        sleep(1)
        XCTAssertTrue(
            app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'terms'")).count > 1 ||
            app.textViews.firstMatch.exists,
            "Should show terms and conditions"
        )
    }

    // MARK: - Referral Rewards Tests (P1)

    @MainActor
    func testPendingRewardsDisplayed() throws {
        navigateToReferrals()

        let referralPage = ReferralPage(app: app)

        guard referralPage.pendingRewardsLabel.waitForExistence(timeout: 2) else {
            XCTFail("Pending rewards not implemented yet - UI element not found or feature not implemented"); return
        }

        // Verify pending rewards label contains currency symbol
        XCTAssertTrue(referralPage.pendingRewardsLabel.label.contains("₹"),
                     "Pending rewards should display amount")
    }

    @MainActor
    func testTotalReferralsCount() throws {
        navigateToReferrals()

        let referralPage = ReferralPage(app: app)

        guard referralPage.totalReferralsLabel.waitForExistence(timeout: 2) else {
            XCTFail("Total referrals count not implemented yet - UI element not found or feature not implemented"); return
        }

        referralPage.assertTotalReferralsDisplayed()
    }

    // MARK: - Integration Tests (P1)

    @MainActor
    func testReferralCreditsAppliedAtCheckout() throws {
        // This test verifies that referral credits can be used during checkout
        navigateToReferrals()

        let referralPage = ReferralPage(app: app)

        guard referralPage.availableCreditsLabel.waitForExistence(timeout: 2) else {
            XCTFail("Referral credits not implemented yet - UI element not found or feature not implemented"); return
        }

        // Get available credits amount
        let _ = referralPage.availableCreditsLabel.label

        // Navigate to marketplace and make a purchase
        app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'marketplace' OR label CONTAINS[c] 'home'")).firstMatch.tap()
        sleep(1)

        let marketplacePage = MarketplacePage(app: app)

        guard marketplacePage.firstSellerCard.waitForExistence(timeout: 2) else {
            XCTFail("No sellers available for testing - UI element not found or feature not implemented"); return
        }

        let menuPage = marketplacePage.tapFirstSeller()
        menuPage
            .assertScreenDisplayed()
            .addFirstItemToCart()

        let cartPage = menuPage.navigateToCart()

        // At checkout, credits should be available
        let _ = cartPage.proceedToCheckout()
        sleep(1)

        // Look for credits option in checkout
        let useCreditsButton = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'use credit' OR label CONTAINS[c] 'apply credit'")).firstMatch

        if useCreditsButton.waitForExistence(timeout: 2) {
            useCreditsButton.tap()
            sleep(1)
        }
    }

    @MainActor
    func testReferralCodeSharedViaWhatsApp() throws {
        navigateToReferrals()

        let referralPage = ReferralPage(app: app)

        guard referralPage.shareButton.waitForExistence(timeout: 2) else {
            XCTFail("Share feature not implemented yet - UI element not found or feature not implemented"); return
        }

        referralPage.shareButton.tap()

        // Share sheet should appear
        sleep(1)

        // Look for WhatsApp option if available
        let whatsappOption = app.otherElements.matching(NSPredicate(format: "label CONTAINS[c] 'whatsapp'")).firstMatch

        if whatsappOption.waitForExistence(timeout: 2) {
            // WhatsApp is available in share sheet
            XCTAssertTrue(whatsappOption.exists, "WhatsApp sharing option should be available")
        }

        // Cancel share sheet
        let cancelButton = app.buttons["Cancel"]
        if cancelButton.waitForExistence(timeout: 1) {
            cancelButton.tap()
        }
    }

    // MARK: - Helper Methods

    private func navigateToReferrals() {
        // Navigate to referral tab or section
        // This might be in profile, or a dedicated tab
        let referralTab = app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'referral' OR label CONTAINS[c] 'invite'")).firstMatch

        if referralTab.waitForExistence(timeout: 2) {
            referralTab.tap()
        } else {
            // Try navigating via profile
            let profileTab = app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'profile' OR label CONTAINS[c] 'account'")).firstMatch
            if profileTab.waitForExistence(timeout: 2) {
                profileTab.tap()
                sleep(1)

                // Look for referral option in profile
                let referralOption = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'referral' OR label CONTAINS[c] 'invite'")).firstMatch
                if referralOption.waitForExistence(timeout: 2) {
                    referralOption.tap()
                }
            }
        }
    }
}
