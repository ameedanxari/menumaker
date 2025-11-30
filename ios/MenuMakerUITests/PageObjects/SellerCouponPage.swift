//
//  SellerCouponPage.swift
//  MenuMakerUITests
//
//  Page Object for Seller Coupon Management Screen
//

import XCTest

struct SellerCouponPage {
    let app: XCUIApplication

    // MARK: - Elements

    var createCouponButton: XCUIElement {
        app.buttons["add-coupon-button"]
    }

    var couponList: XCUIElementQuery {
        app.scrollViews.otherElements.matching(identifier: "CouponItem")
    }

    var firstCoupon: XCUIElement {
        couponList.firstMatch
    }

    var emptyStateMessage: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'no coupon'")).firstMatch
    }

    // Coupon form elements
    var couponCodeField: XCUIElement {
        app.textFields.matching(NSPredicate(format: "placeholderValue CONTAINS[c] 'code' OR placeholderValue CONTAINS[c] 'coupon code'")).firstMatch
    }

    var discountTypeButtons: XCUIElementQuery {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'percentage' OR label CONTAINS[c] 'fixed'"))
    }

    var percentageButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'percentage' OR label CONTAINS '%'")).firstMatch
    }

    var fixedAmountButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'fixed' OR label CONTAINS '₹'")).firstMatch
    }

    var discountValueField: XCUIElement {
        app.textFields.matching(NSPredicate(format: "placeholderValue CONTAINS[c] 'discount' OR placeholderValue CONTAINS[c] 'value'")).firstMatch
    }

    var minOrderAmountField: XCUIElement {
        app.textFields.matching(NSPredicate(format: "placeholderValue CONTAINS[c] 'minimum' OR placeholderValue CONTAINS[c] 'min order'")).firstMatch
    }

    var maxDiscountField: XCUIElement {
        app.textFields.matching(NSPredicate(format: "placeholderValue CONTAINS[c] 'max' OR placeholderValue CONTAINS[c] 'maximum discount'")).firstMatch
    }

    var usageLimitField: XCUIElement {
        app.textFields.matching(NSPredicate(format: "placeholderValue CONTAINS[c] 'usage' OR placeholderValue CONTAINS[c] 'limit'")).firstMatch
    }

    var startDatePicker: XCUIElement {
        app.datePickers.matching(NSPredicate(format: "identifier CONTAINS 'start'")).firstMatch
    }

    var endDatePicker: XCUIElement {
        app.datePickers.matching(NSPredicate(format: "identifier CONTAINS 'end'")).firstMatch
    }

    var saveCouponButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'save' OR label CONTAINS[c] 'create'")).firstMatch
    }

    var cancelButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'cancel'")).firstMatch
    }

    var toggleActiveSwitch: XCUIElement {
        app.switches.matching(NSPredicate(format: "identifier CONTAINS 'active' OR identifier CONTAINS 'enabled'")).firstMatch
    }

    var deleteButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'delete'")).firstMatch
    }

    var confirmDeleteButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'confirm' OR label CONTAINS[c] 'yes'")).firstMatch
    }

    // MARK: - Actions

    @discardableResult
    func tapCreateCoupon() -> SellerCouponPage {
        createCouponButton.tap()
        sleep(1)
        return self
    }

    @discardableResult
    func enterCouponCode(_ code: String) -> SellerCouponPage {
        couponCodeField.tap()
        couponCodeField.typeText(code)
        return self
    }

    @discardableResult
    func selectDiscountType(_ type: DiscountType) -> SellerCouponPage {
        switch type {
        case .percentage:
            percentageButton.tap()
        case .fixedAmount:
            fixedAmountButton.tap()
        }
        return self
    }

    @discardableResult
    func enterDiscountValue(_ value: String) -> SellerCouponPage {
        dismissKeyboardIfNeeded()  // Dismiss keyboard from previous field
        discountValueField.tap()
        discountValueField.typeText(value)
        return self
    }

    @discardableResult
    func enterMinOrderAmount(_ amount: String) -> SellerCouponPage {
        dismissKeyboardIfNeeded()  // Dismiss keyboard from previous field
        if minOrderAmountField.waitForExistence(timeout: 1) {
            minOrderAmountField.tap()
            minOrderAmountField.typeText(amount)
        }
        return self
    }

    @discardableResult
    func enterMaxDiscount(_ amount: String) -> SellerCouponPage {
        dismissKeyboardIfNeeded()  // Dismiss keyboard from previous field
        if maxDiscountField.waitForExistence(timeout: 1) {
            maxDiscountField.tap()
            maxDiscountField.typeText(amount)
        }
        return self
    }

    @discardableResult
    func enterUsageLimit(_ limit: String) -> SellerCouponPage {
        dismissKeyboardIfNeeded()  // Dismiss keyboard from previous field
        if usageLimitField.waitForExistence(timeout: 1) {
            usageLimitField.tap()
            usageLimitField.typeText(limit)
        }
        return self
    }

    @discardableResult
    func saveCoupon() -> SellerCouponPage {
        dismissKeyboardIfNeeded()
        saveCouponButton.tap()
        return self
    }

    @discardableResult
    func cancelCouponCreation() -> SellerCouponPage {
        cancelButton.tap()
        return self
    }

    @discardableResult
    func tapFirstCoupon() -> SellerCouponPage {
        firstCoupon.tap()
        sleep(1)
        return self
    }

    @discardableResult
    func toggleCouponActive() -> SellerCouponPage {
        if toggleActiveSwitch.waitForExistence(timeout: 1) {
            toggleActiveSwitch.tap()
            sleep(1)
        }
        return self
    }

    @discardableResult
    func deleteCoupon() -> SellerCouponPage {
        deleteButton.tap()
        if confirmDeleteButton.waitForExistence(timeout: 1) {
            confirmDeleteButton.tap()
        }
        sleep(1)
        return self
    }

    @discardableResult
    func swipeToDelete(at index: Int = 0) -> SellerCouponPage {
        let coupon = couponList.element(boundBy: index)
        coupon.swipeLeft()
        let deleteAction = app.buttons["Delete"]
        if deleteAction.waitForExistence(timeout: 1) {
            deleteAction.tap()
        }
        return self
    }

    func createCoupon(code: String, type: DiscountType, value: String, minOrder: String? = nil) {
        tapCreateCoupon()
        enterCouponCode(code)
        selectDiscountType(type)
        enterDiscountValue(value)

        if let minOrder = minOrder {
            enterMinOrderAmount(minOrder)
        }

        saveCoupon()
    }

    // MARK: - Assertions

    @discardableResult
    func assertScreenDisplayed(timeout: TimeInterval = 2) -> SellerCouponPage {
        XCTAssertTrue(createCouponButton.waitForExistence(timeout: timeout) ||
                     firstCoupon.waitForExistence(timeout: timeout) ||
                     emptyStateMessage.waitForExistence(timeout: timeout),
                     "Coupon management screen should be displayed")
        return self
    }

    @discardableResult
    func assertCouponFormDisplayed() -> SellerCouponPage {
        XCTAssertTrue(couponCodeField.waitForExistence(timeout: 2), "Coupon form should be displayed")
        return self
    }

    @discardableResult
    func assertCouponExists(_ code: String) -> SellerCouponPage {
        let couponLabel = app.staticTexts[code]
        XCTAssertTrue(couponLabel.exists, "Coupon '\(code)' should exist in the list")
        return self
    }

    @discardableResult
    func assertCouponSaved() -> SellerCouponPage {
        sleep(2)  // Wait longer for async coupon creation and form dismissal
        XCTAssertFalse(couponCodeField.exists, "Coupon form should be dismissed after save")
        return self
    }

    @discardableResult
    func assertCouponCount(_ expectedCount: Int) -> SellerCouponPage {
        let actualCount = couponList.count
        XCTAssertEqual(actualCount, expectedCount, "Should have \(expectedCount) coupons, found \(actualCount)")
        return self
    }

    @discardableResult
    func assertEmptyState() -> SellerCouponPage {
        XCTAssertTrue(emptyStateMessage.exists, "Empty state should be displayed")
        return self
    }

    // MARK: - Types

    enum DiscountType {
        case percentage
        case fixedAmount
    }

    // MARK: - Helpers

    private func dismissKeyboardIfNeeded() {
        if app.keyboards.count > 0 {
            // Try Done button first (from keyboard toolbar)
            let doneButton = app.toolbars.buttons["Done"]
            if doneButton.exists {
                doneButton.tap()
                return
            }

            // Try Return button for text keyboards
            let returnButton = app.keyboards.buttons["Return"]
            if returnButton.exists {
                returnButton.tap()
                return
            }

            // For numberPad/decimalPad without toolbar, tap outside to dismiss
            // Tap the navigation bar area
            let navBar = app.navigationBars.firstMatch
            if navBar.exists {
                navBar.tap()
            }
        }
    }
}
