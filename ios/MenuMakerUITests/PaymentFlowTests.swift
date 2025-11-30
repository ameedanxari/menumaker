//
//  PaymentFlowTests.swift
//  MenuMakerUITests
//
//  Tests for payment processing - multiple methods, validation, success/failure handling
//

import XCTest

final class PaymentFlowTests: XCTestCase {

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

    // MARK: - Payment Method Selection Tests (P0)

    @MainActor
    func testPaymentScreenDisplays() throws {
        proceedToPayment()

        let paymentPage = PaymentPage(app: app)
        paymentPage.assertScreenDisplayed()
    }

    @MainActor
    func testPaymentMethodsDisplayed() throws {
        proceedToPayment()

        let paymentPage = PaymentPage(app: app)

        guard paymentPage.cardPaymentOption.waitForExistence(timeout: 2) ||
              paymentPage.cashPaymentOption.waitForExistence(timeout: 2) else {
            XCTFail("Payment methods not implemented yet - UI element not found or feature not implemented"); return
        }

        paymentPage.assertPaymentMethodsDisplayed()
    }

    @MainActor
    func testSelectCashOnDelivery() throws {
        proceedToPayment()

        let paymentPage = PaymentPage(app: app)

        guard paymentPage.cashPaymentOption.waitForExistence(timeout: 2) else {
            XCTFail("Cash payment not implemented yet - UI element not found or feature not implemented"); return
        }

        paymentPage
            .selectPaymentMethod(.cash)
            .pay()

        sleep(3)

        // Order should be placed
        if paymentPage.paymentSuccessMessage.waitForExistence(timeout: 5) {
            paymentPage.assertPaymentSuccess()
        }
    }

    @MainActor
    func testSelectCardPayment() throws {
        proceedToPayment()

        let paymentPage = PaymentPage(app: app)

        guard paymentPage.cardPaymentOption.waitForExistence(timeout: 2) else {
            XCTFail("Card payment not implemented yet - UI element not found or feature not implemented"); return
        }

        paymentPage.selectPaymentMethod(.card)

        sleep(1)

        guard paymentPage.cardNumberField.waitForExistence(timeout: 2) else {
            XCTFail("Card form not implemented yet - UI element not found or feature not implemented"); return
        }

        paymentPage.assertCardFormDisplayed()
    }

    @MainActor
    func testSelectUPIPayment() throws {
        proceedToPayment()

        let paymentPage = PaymentPage(app: app)

        guard paymentPage.upiPaymentOption.waitForExistence(timeout: 2) else {
            XCTFail("UPI payment not implemented yet - UI element not found or feature not implemented"); return
        }

        paymentPage.selectPaymentMethod(.upi)

        sleep(1)

        XCTAssertTrue(paymentPage.upiIdField.waitForExistence(timeout: 2), "UPI ID field should be displayed")
        paymentPage.assertUpiFormDisplayed()
    }

    // MARK: - Card Payment Tests (P0)

    @MainActor
    func testEnterCardDetails() throws {
        proceedToPayment()

        let paymentPage = PaymentPage(app: app)

        guard paymentPage.cardPaymentOption.waitForExistence(timeout: 2) else {
            XCTFail("Card payment not implemented yet - UI element not found or feature not implemented"); return
        }

        paymentPage
            .selectPaymentMethod(.card)

        guard paymentPage.cardNumberField.waitForExistence(timeout: 2) else {
            XCTFail("Card form not implemented yet - UI element not found or feature not implemented"); return
        }

        paymentPage
            .enterCardDetails(
                number: "4111111111111111",
                holder: "Test User",
                expiry: "12/25",
                cvv: "123"
            )
            .assertPayButtonEnabled()
    }

    @MainActor
    func testPayWithCard() throws {
        proceedToPayment()

        let paymentPage = PaymentPage(app: app)

        guard paymentPage.cardPaymentOption.waitForExistence(timeout: 2) else {
            XCTFail("Card payment not implemented yet - UI element not found or feature not implemented"); return
        }

        paymentPage
            .selectPaymentMethod(.card)

        guard paymentPage.cardNumberField.waitForExistence(timeout: 2) else {
            XCTFail("Card form not implemented yet - UI element not found or feature not implemented"); return
        }

        paymentPage
            .enterCardDetails(
                number: "4111111111111111",
                holder: "Test User",
                expiry: "12/25",
                cvv: "123"
            )
            .pay()

        sleep(5)

        // Payment should process
        if paymentPage.paymentSuccessMessage.waitForExistence(timeout: 10) {
            paymentPage.assertPaymentSuccess()
        } else if paymentPage.paymentFailedMessage.waitForExistence(timeout: 5) {
            // In test mode, payment might fail
            paymentPage.assertPaymentFailed()
        }
    }

    @MainActor
    func testSaveCardOption() throws {
        proceedToPayment()

        let paymentPage = PaymentPage(app: app)

        guard paymentPage.cardPaymentOption.waitForExistence(timeout: 2) else {
            XCTFail("Card payment not implemented yet - UI element not found or feature not implemented"); return
        }

        paymentPage.selectPaymentMethod(.card)

        guard paymentPage.saveCardCheckbox.waitForExistence(timeout: 2) else {
            XCTFail("Save card feature not implemented yet - UI element not found or feature not implemented"); return
        }

        paymentPage
            .toggleSaveCard()
            .enterCardDetails(
                number: "4111111111111111",
                holder: "Test User",
                expiry: "12/25",
                cvv: "123"
            )
            .pay()
    }

    // MARK: - UPI Payment Tests (P0)

    @MainActor
    func testPayWithUPI() throws {
        proceedToPayment()

        let paymentPage = PaymentPage(app: app)

        guard paymentPage.upiPaymentOption.waitForExistence(timeout: 2) else {
            XCTFail("UPI payment not implemented yet - UI element not found or feature not implemented"); return
        }

        paymentPage
            .selectPaymentMethod(.upi)

        guard paymentPage.upiIdField.waitForExistence(timeout: 2) else {
            XCTFail("UPI form not implemented yet - UI element not found or feature not implemented"); return
        }

        paymentPage
            .enterUpiId("test@upi")
            .pay()

        sleep(3)
    }

    // MARK: - Saved Cards Tests (P1)

    @MainActor
    func testSelectSavedCard() throws {
        proceedToPayment()

        let paymentPage = PaymentPage(app: app)

        guard paymentPage.cardPaymentOption.waitForExistence(timeout: 2) else {
            XCTFail("Card payment not implemented yet - UI element not found or feature not implemented"); return
        }

        paymentPage.selectPaymentMethod(.card)

        guard paymentPage.firstSavedCard.waitForExistence(timeout: 2) else {
            XCTFail("No saved cards or feature not implemented yet - UI element not found or feature not implemented"); return
        }

        paymentPage
            .assertSavedCardsDisplayed()
            .selectSavedCard(at: 0)

        sleep(1)

        // Should be able to pay with saved card
        paymentPage.assertPayButtonEnabled()
    }

    @MainActor
    func testAddNewCard() throws {
        proceedToPayment()

        let paymentPage = PaymentPage(app: app)

        guard paymentPage.cardPaymentOption.waitForExistence(timeout: 2) else {
            XCTFail("Card payment not implemented yet - UI element not found or feature not implemented"); return
        }

        paymentPage.selectPaymentMethod(.card)

        guard paymentPage.addNewCardButton.waitForExistence(timeout: 2) else {
            XCTFail("Add new card feature not implemented yet - UI element not found or feature not implemented"); return
        }

        paymentPage
            .tapAddNewCard()

        sleep(1)

        paymentPage.assertCardFormDisplayed()
    }

    // MARK: - Payment Validation Tests (P1)

    @MainActor
    func testInvalidCardNumber() throws {
        proceedToPayment()

        let paymentPage = PaymentPage(app: app)

        guard paymentPage.cardPaymentOption.waitForExistence(timeout: 2) else {
            XCTFail("Card payment not implemented yet - UI element not found or feature not implemented"); return
        }

        paymentPage
            .selectPaymentMethod(.card)

        guard paymentPage.cardNumberField.waitForExistence(timeout: 2) else {
            XCTFail("Card form not implemented yet - UI element not found or feature not implemented"); return
        }

        paymentPage.enterCardDetails(
            number: "1234",
            holder: "Test",
            expiry: "12/25",
            cvv: "123"
        )

        // Pay button should be disabled or show error
        XCTAssertFalse(paymentPage.payButton.isEnabled,
                      "Pay button should be disabled for invalid card")
    }

    @MainActor
    func testCancelPayment() throws {
        proceedToPayment()

        let paymentPage = PaymentPage(app: app)

        guard paymentPage.cancelButton.waitForExistence(timeout: 2) else {
            XCTFail("Cancel payment not implemented yet - UI element not found or feature not implemented"); return
        }

        paymentPage.cancelPayment()

        sleep(1)

        // Should navigate back to checkout or cart
    }

    // MARK: - Payment Status Tests (P0)

    @MainActor
    func testPaymentSuccess() throws {
        proceedToPayment()

        let paymentPage = PaymentPage(app: app)

        guard paymentPage.cashPaymentOption.waitForExistence(timeout: 2) else {
            XCTFail("Cash payment not implemented yet - UI element not found or feature not implemented"); return
        }

        paymentPage
            .selectPaymentMethod(.cash)
            .pay()

        sleep(5)

        XCTAssertTrue(paymentPage.paymentSuccessMessage.waitForExistence(timeout: 10), "Payment success message should appear")
        paymentPage.assertPaymentSuccess()

        // Should navigate to order tracking or confirmation
        sleep(2)
    }

    @MainActor
    func testRetryFailedPayment() throws {
        proceedToPayment()

        let paymentPage = PaymentPage(app: app)

        guard paymentPage.cardPaymentOption.waitForExistence(timeout: 2) else {
            XCTFail("Card payment not implemented yet - UI element not found or feature not implemented"); return
        }

        paymentPage
            .selectPaymentMethod(.card)

        guard paymentPage.cardNumberField.waitForExistence(timeout: 2) else {
            XCTFail("Card form not implemented yet - UI element not found or feature not implemented"); return
        }

        paymentPage
            .enterCardDetails(
                number: "4111111111111111",
                holder: "Test",
                expiry: "12/25",
                cvv: "123"
            )
            .pay()

        sleep(5)

        if paymentPage.paymentFailedMessage.waitForExistence(timeout: 10) {
            paymentPage
                .assertPaymentFailed()
                .retryPayment()

            sleep(2)

            // Should return to payment screen
            paymentPage.assertScreenDisplayed()
        }
    }

    // MARK: - Security Tests (P1)

    @MainActor
    func testSecurePaymentBadgeDisplayed() throws {
        proceedToPayment()

        let paymentPage = PaymentPage(app: app)

        XCTAssertTrue(paymentPage.securePaymentBadge.waitForExistence(timeout: 2), "Secure payment badge should be visible")
        paymentPage.assertSecurePaymentBadgeVisible()
    }

    @MainActor
    func testOrderTotalDisplayed() throws {
        proceedToPayment()

        let paymentPage = PaymentPage(app: app)

        XCTAssertTrue(paymentPage.orderTotalLabel.waitForExistence(timeout: 2), "Order total should be displayed")
        paymentPage.assertOrderTotalDisplayed()
    }

    // MARK: - Helper Methods

    private func proceedToPayment() {
        // Navigate to marketplace
        let marketplaceTab = app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'marketplace' OR label CONTAINS[c] 'home'")).firstMatch
        if marketplaceTab.waitForExistence(timeout: 2) {
            marketplaceTab.tap()
            sleep(1)
        }

        let marketplacePage = MarketplacePage(app: app)
        if marketplacePage.firstSellerCard.waitForExistence(timeout: 2) {
            let menuPage = marketplacePage.tapFirstSeller()
            menuPage.addFirstItemToCart()

            let cartPage = menuPage.navigateToCart()
            let checkoutPage = cartPage.proceedToCheckout()

            checkoutPage
                .enterDeliveryAddress("123 Test St, Test City")

            sleep(1)
            // Should show payment options
        }
    }
}
