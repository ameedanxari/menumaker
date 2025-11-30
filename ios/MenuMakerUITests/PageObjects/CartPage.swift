//
//  CartPage.swift
//  MenuMakerUITests
//
//  Page Object for Cart Screen
//

import XCTest

struct CartPage {
    let app: XCUIApplication

    // MARK: - Elements

    var cartItems: XCUIElementQuery {
        app.descendants(matching: .any).matching(identifier: "CartItem")
    }

    var firstCartItem: XCUIElement {
        cartItems.firstMatch
    }

    var checkoutButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'checkout' OR label CONTAINS[c] 'proceed'")).firstMatch
    }

    var emptyCartMessage: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'empty' OR label CONTAINS[c] 'no items'")).firstMatch
    }

    var totalPrice: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS '₹'")).element(boundBy: 0)
    }

    var incrementButtons: XCUIElementQuery {
        app.buttons.matching(NSPredicate(format: "label == '+'"))
    }

    var decrementButtons: XCUIElementQuery {
        app.buttons.matching(NSPredicate(format: "label == '-'"))
    }

    var removeButtons: XCUIElementQuery {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'remove' OR label CONTAINS[c] 'delete'"))
    }

    var couponField: XCUIElement {
        app.textFields.matching(NSPredicate(format: "placeholderValue CONTAINS[c] 'coupon'")).firstMatch
    }

    var applyCouponButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'apply'")).firstMatch
    }

    // MARK: - Actions

    @discardableResult
    func incrementFirstItem() -> CartPage {
        incrementButtons.firstMatch.tap()
        sleep(1)
        return self
    }

    @discardableResult
    func decrementFirstItem() -> CartPage {
        decrementButtons.firstMatch.tap()
        sleep(1)
        return self
    }

    @discardableResult
    func removeFirstItem() -> CartPage {
        removeButtons.firstMatch.tap()

        // Handle confirmation dialog if present
        let confirmButton = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'confirm' OR label CONTAINS[c] 'yes' OR label CONTAINS[c] 'remove'")).firstMatch
        if confirmButton.waitForExistence(timeout: 1) {
            confirmButton.tap()
        }

        sleep(1)
        return self
    }

    @discardableResult
    func applyCoupon(_ code: String) -> CartPage {
        couponField.tap()
        couponField.typeText(code)
        applyCouponButton.tap()
        sleep(1)
        return self
    }

    @discardableResult
    func proceedToCheckout() -> CheckoutPage {
        checkoutButton.tap()
        return CheckoutPage(app: app)
    }

    // MARK: - Assertions

    @discardableResult
    func assertScreenDisplayed(timeout: TimeInterval = 10) -> CartPage {
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'cart'")).firstMatch.waitForExistence(timeout: timeout),
                     "Cart screen should be displayed")
        return self
    }

    @discardableResult
    func assertCartNotEmpty() -> CartPage {
        XCTAssertTrue(firstCartItem.waitForExistence(timeout: 10), "Cart should contain items")
        return self
    }

    @discardableResult
    func assertCartEmpty() -> CartPage {
        XCTAssertTrue(emptyCartMessage.waitForExistence(timeout: 10), "Cart should be empty")
        return self
    }

    @discardableResult
    func assertItemCount(_ expectedCount: Int) -> CartPage {
        let actualCount = cartItems.count
        XCTAssertEqual(actualCount, expectedCount, "Cart should contain \(expectedCount) items, found \(actualCount)")
        return self
    }

    @discardableResult
    func assertTotalPrice(contains text: String) -> CartPage {
        XCTAssertTrue(totalPrice.label.contains(text), "Total price should contain '\(text)'")
        return self
    }

    @discardableResult
    func assertCheckoutButtonEnabled() -> CartPage {
        XCTAssertTrue(checkoutButton.isEnabled, "Checkout button should be enabled")
        return self
    }
}
