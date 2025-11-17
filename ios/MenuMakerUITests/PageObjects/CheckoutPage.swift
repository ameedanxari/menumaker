//
//  CheckoutPage.swift
//  MenuMakerUITests
//
//  Page Object for Checkout Screen
//

import XCTest

struct CheckoutPage {
    let app: XCUIApplication

    // MARK: - Elements

    var deliveryAddressField: XCUIElement {
        app.textFields.matching(NSPredicate(format: "placeholderValue CONTAINS[c] 'address'")).firstMatch
    }

    var paymentMethodButtons: XCUIElementQuery {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'card' OR label CONTAINS[c] 'cash' OR label CONTAINS[c] 'upi'"))
    }

    var cardPaymentButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'card'")).firstMatch
    }

    var cashPaymentButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'cash'")).firstMatch
    }

    var upiPaymentButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'upi'")).firstMatch
    }

    var placeOrderButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'place order' OR label CONTAINS[c] 'confirm'")).firstMatch
    }

    var orderSummary: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'order summary'")).firstMatch
    }

    var orderConfirmation: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'order placed' OR label CONTAINS[c] 'confirmed' OR label CONTAINS[c] 'order #'")).firstMatch
    }

    // MARK: - Actions

    @discardableResult
    func enterDeliveryAddress(_ address: String) -> CheckoutPage {
        deliveryAddressField.tap()
        deliveryAddressField.typeText(address)
        return self
    }

    @discardableResult
    func selectPaymentMethod(_ method: PaymentMethod) -> CheckoutPage {
        switch method {
        case .card:
            cardPaymentButton.tap()
        case .cash:
            cashPaymentButton.tap()
        case .upi:
            upiPaymentButton.tap()
        }
        return self
    }

    @discardableResult
    func placeOrder() -> CheckoutPage {
        placeOrderButton.tap()
        return self
    }

    // MARK: - Assertions

    @discardableResult
    func assertScreenDisplayed(timeout: TimeInterval = 2) -> CheckoutPage {
        XCTAssertTrue(orderSummary.waitForExistence(timeout: timeout) ||
                     placeOrderButton.waitForExistence(timeout: timeout),
                     "Checkout screen should be displayed")
        return self
    }

    @discardableResult
    func assertOrderConfirmed(timeout: TimeInterval = 5) -> CheckoutPage {
        XCTAssertTrue(orderConfirmation.waitForExistence(timeout: timeout), "Order confirmation should be displayed")
        return self
    }

    @discardableResult
    func assertPlaceOrderButtonEnabled() -> CheckoutPage {
        XCTAssertTrue(placeOrderButton.isEnabled, "Place order button should be enabled")
        return self
    }

    // MARK: - Types

    enum PaymentMethod {
        case card
        case cash
        case upi
    }
}
