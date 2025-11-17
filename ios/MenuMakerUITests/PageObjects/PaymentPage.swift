//
//  PaymentPage.swift
//  MenuMakerUITests
//
//  Page Object for Payment Processing Screen
//

import XCTest

struct PaymentPage {
    let app: XCUIApplication

    // MARK: - Elements

    var paymentMethodsList: XCUIElementQuery {
        app.scrollViews.otherElements.matching(identifier: "PaymentMethod")
    }

    var cardPaymentOption: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'card' OR label CONTAINS[c] 'debit' OR label CONTAINS[c] 'credit'")).firstMatch
    }

    var cashPaymentOption: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'cash' OR label CONTAINS[c] 'cod'")).firstMatch
    }

    var upiPaymentOption: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'upi'")).firstMatch
    }

    var walletPaymentOption: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'wallet'")).firstMatch
    }

    var netBankingOption: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'net banking' OR label CONTAINS[c] 'bank'")).firstMatch
    }

    // Card payment fields
    var cardNumberField: XCUIElement {
        app.textFields.matching(NSPredicate(format: "placeholderValue CONTAINS[c] 'card number'")).firstMatch
    }

    var cardHolderField: XCUIElement {
        app.textFields.matching(NSPredicate(format: "placeholderValue CONTAINS[c] 'name' OR placeholderValue CONTAINS[c] 'holder'")).firstMatch
    }

    var expiryField: XCUIElement {
        app.textFields.matching(NSPredicate(format: "placeholderValue CONTAINS[c] 'expiry' OR placeholderValue CONTAINS 'MM/YY'")).firstMatch
    }

    var cvvField: XCUIElement {
        app.textFields.matching(NSPredicate(format: "placeholderValue CONTAINS[c] 'cvv' OR placeholderValue CONTAINS[c] 'cvc'")).firstMatch
    }

    // UPI fields
    var upiIdField: XCUIElement {
        app.textFields.matching(NSPredicate(format: "placeholderValue CONTAINS[c] 'upi' OR placeholderValue CONTAINS '@'")).firstMatch
    }

    var saveCardCheckbox: XCUIElement {
        app.switches.matching(NSPredicate(format: "identifier CONTAINS 'saveCard'")).firstMatch
    }

    var savedCards: XCUIElementQuery {
        app.scrollViews.otherElements.matching(identifier: "SavedCard")
    }

    var firstSavedCard: XCUIElement {
        savedCards.firstMatch
    }

    var addNewCardButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'add card' OR label CONTAINS[c] 'new card'")).firstMatch
    }

    var payButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'pay' OR label CONTAINS[c] 'proceed'")).firstMatch
    }

    var cancelButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'cancel'")).firstMatch
    }

    var orderTotalLabel: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS '₹' AND label CONTAINS[c] 'total'")).firstMatch
    }

    var processingIndicator: XCUIElement {
        app.activityIndicators.firstMatch
    }

    var paymentSuccessMessage: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'success' OR label CONTAINS[c] 'confirmed' OR label CONTAINS[c] 'placed'")).firstMatch
    }

    var paymentFailedMessage: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'failed' OR label CONTAINS[c] 'error' OR label CONTAINS[c] 'declined'")).firstMatch
    }

    var retryButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'retry' OR label CONTAINS[c] 'try again'")).firstMatch
    }

    var securePaymentBadge: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'secure' OR label CONTAINS '🔒'")).firstMatch
    }

    // MARK: - Actions

    @discardableResult
    func selectPaymentMethod(_ method: PaymentMethod) -> PaymentPage {
        switch method {
        case .card:
            cardPaymentOption.tap()
        case .cash:
            cashPaymentOption.tap()
        case .upi:
            upiPaymentOption.tap()
        case .wallet:
            walletPaymentOption.tap()
        case .netBanking:
            netBankingOption.tap()
        }
        sleep(1)
        return self
    }

    @discardableResult
    func enterCardDetails(number: String, holder: String, expiry: String, cvv: String) -> PaymentPage {
        cardNumberField.tap()
        cardNumberField.typeText(number)

        cardHolderField.tap()
        cardHolderField.typeText(holder)

        expiryField.tap()
        expiryField.typeText(expiry)

        cvvField.tap()
        cvvField.typeText(cvv)

        return self
    }

    @discardableResult
    func enterUpiId(_ upiId: String) -> PaymentPage {
        upiIdField.tap()
        upiIdField.typeText(upiId)
        return self
    }

    @discardableResult
    func toggleSaveCard() -> PaymentPage {
        if saveCardCheckbox.waitForExistence(timeout: 1) {
            saveCardCheckbox.tap()
        }
        return self
    }

    @discardableResult
    func selectSavedCard(at index: Int = 0) -> PaymentPage {
        let card = savedCards.element(boundBy: index)
        if card.waitForExistence(timeout: 2) {
            card.tap()
            sleep(1)
        }
        return self
    }

    @discardableResult
    func tapAddNewCard() -> PaymentPage {
        addNewCardButton.tap()
        sleep(1)
        return self
    }

    @discardableResult
    func pay() -> PaymentPage {
        dismissKeyboardIfNeeded()
        payButton.tap()
        sleep(3) // Wait for payment processing
        return self
    }

    @discardableResult
    func cancelPayment() -> PaymentPage {
        cancelButton.tap()
        sleep(1)
        return self
    }

    @discardableResult
    func retryPayment() -> PaymentPage {
        if retryButton.waitForExistence(timeout: 2) {
            retryButton.tap()
            sleep(1)
        }
        return self
    }

    // MARK: - Assertions

    @discardableResult
    func assertScreenDisplayed(timeout: TimeInterval = 2) -> PaymentPage {
        XCTAssertTrue(cardPaymentOption.waitForExistence(timeout: timeout) ||
                     cashPaymentOption.waitForExistence(timeout: timeout) ||
                     paymentMethodsList.count > 0,
                     "Payment screen should be displayed")
        return self
    }

    @discardableResult
    func assertPaymentMethodsDisplayed() -> PaymentPage {
        XCTAssertTrue(paymentMethodsList.count > 0 ||
                     cardPaymentOption.exists ||
                     cashPaymentOption.exists,
                     "Payment methods should be displayed")
        return self
    }

    @discardableResult
    func assertCardFormDisplayed() -> PaymentPage {
        XCTAssertTrue(cardNumberField.waitForExistence(timeout: 2),
                     "Card payment form should be displayed")
        return self
    }

    @discardableResult
    func assertUpiFormDisplayed() -> PaymentPage {
        XCTAssertTrue(upiIdField.waitForExistence(timeout: 2),
                     "UPI payment form should be displayed")
        return self
    }

    @discardableResult
    func assertSavedCardsDisplayed() -> PaymentPage {
        XCTAssertGreaterThan(savedCards.count, 0, "Saved cards should be displayed")
        return self
    }

    @discardableResult
    func assertOrderTotalDisplayed() -> PaymentPage {
        XCTAssertTrue(orderTotalLabel.exists, "Order total should be displayed")
        return self
    }

    @discardableResult
    func assertPaymentProcessing() -> PaymentPage {
        XCTAssertTrue(processingIndicator.exists, "Payment processing indicator should be displayed")
        return self
    }

    @discardableResult
    func assertPaymentSuccess(timeout: TimeInterval = 5) -> PaymentPage {
        XCTAssertTrue(paymentSuccessMessage.waitForExistence(timeout: timeout),
                     "Payment success message should be displayed")
        return self
    }

    @discardableResult
    func assertPaymentFailed(timeout: TimeInterval = 5) -> PaymentPage {
        XCTAssertTrue(paymentFailedMessage.waitForExistence(timeout: timeout),
                     "Payment failed message should be displayed")
        return self
    }

    @discardableResult
    func assertSecurePaymentBadgeVisible() -> PaymentPage {
        XCTAssertTrue(securePaymentBadge.exists, "Secure payment badge should be visible")
        return self
    }

    @discardableResult
    func assertPayButtonEnabled() -> PaymentPage {
        XCTAssertTrue(payButton.isEnabled, "Pay button should be enabled")
        return self
    }

    @discardableResult
    func assertPayButtonDisabled() -> PaymentPage {
        XCTAssertFalse(payButton.isEnabled, "Pay button should be disabled")
        return self
    }

    // MARK: - Types

    enum PaymentMethod {
        case card
        case cash
        case upi
        case wallet
        case netBanking
    }

    // MARK: - Helpers

    private func dismissKeyboardIfNeeded() {
        if app.keyboards.count > 0 {
            app.keyboards.buttons["Return"].tap()
        }
    }
}
