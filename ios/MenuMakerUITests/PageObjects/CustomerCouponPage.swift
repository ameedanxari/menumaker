//
//  CustomerCouponPage.swift
//  MenuMakerUITests
//
//  Page Object for Customer Coupon Browsing and Application
//

import XCTest

struct CustomerCouponPage {
    let app: XCUIApplication

    // MARK: - Elements

    var availableCouponsList: XCUIElementQuery {
        app.descendants(matching: .any).matching(identifier: "AvailableCoupon")
    }

    var firstAvailableCoupon: XCUIElement {
        availableCouponsList.firstMatch
    }

    var viewAllCouponsButton: XCUIElement {
        let idMatch = app.buttons["view-all-coupons-button"]
        if idMatch.exists { return idMatch }
        return app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'view all coupon'")).firstMatch
    }

    var applyCouponButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'apply'")).firstMatch
    }

    var removeCouponButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'remove'")).firstMatch
    }

    var couponCodeLabel: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label MATCHES '[A-Z0-9]{4,15}'")).firstMatch
    }

    var discountAmountLabel: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS '₹' OR label CONTAINS '%'")).firstMatch
    }

    var appliedCouponBadge: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'applied' OR label CONTAINS[c] 'active'")).firstMatch
    }

    var couponErrorMessage: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'invalid' OR label CONTAINS[c] 'expired' OR label CONTAINS[c] 'minimum order'")).firstMatch
    }

    var emptyStateMessage: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'no coupon'")).firstMatch
    }

    var searchCouponField: XCUIElement {
        let searchField = app.searchFields.matching(identifier: "search-coupon-field").firstMatch
        if searchField.exists {
            return searchField
        }
        return app.textFields.matching(identifier: "search-coupon-field").firstMatch
    }

    var filterButtons: XCUIElementQuery {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'all' OR label CONTAINS[c] 'active' OR label CONTAINS[c] 'expired'"))
    }

    // Coupon detail elements
    var couponDescriptionLabel: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'discount' OR label CONTAINS[c] 'off'")).firstMatch
    }

    var validityLabel: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'valid' OR label CONTAINS[c] 'expire'")).firstMatch
    }

    var termsAndConditionsLabel: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'terms' OR label CONTAINS[c] 'conditions'")).firstMatch
    }

    // MARK: - Actions

    @discardableResult
    func tapViewAllCoupons() -> CustomerCouponPage {
        dismissKeyboardIfPresent()
        if !viewAllCouponsButton.exists {
            scrollToCoupons()
        }
        viewAllCouponsButton.forceTap()
        sleep(1)
        return self
    }

    @discardableResult
    func tapFirstCoupon() -> CustomerCouponPage {
        firstAvailableCoupon.scrollToElement()
        firstAvailableCoupon.forceTap()
        sleep(1)
        return self
    }

    @discardableResult
    func applyCoupon(code: String) -> CustomerCouponPage {
        // Find and tap the coupon with matching code
        let couponElement = app.staticTexts[code]
        if couponElement.waitForExistence(timeout: 10) {
            couponElement.tap()
            sleep(1)
        }

        if applyCouponButton.waitForExistence(timeout: 5) {
            applyCouponButton.tap()
            sleep(1)
        }

        return self
    }

    @discardableResult
    func applyFirstAvailableCoupon() -> CustomerCouponPage {
        tapFirstCoupon()

        if applyCouponButton.waitForExistence(timeout: 5) {
            applyCouponButton.tap()
            sleep(1)
        }

        return self
    }

    @discardableResult
    func removeCoupon() -> CustomerCouponPage {
        removeCouponButton.tap()
        sleep(1)
        return self
    }

    @discardableResult
    func searchCoupon(_ query: String) -> CustomerCouponPage {
        if searchCouponField.waitForExistence(timeout: 5) {
            searchCouponField.tap()
            searchCouponField.typeText(query)
        }
        return self
    }

    @discardableResult
    func filterCoupons(by filter: CouponFilter) -> CustomerCouponPage {
        let filterButton: XCUIElement
        switch filter {
        case .all:
            filterButton = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'all'")).firstMatch
        case .active:
            filterButton = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'active'")).firstMatch
        case .expired:
            filterButton = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'expired'")).firstMatch
        }

        if filterButton.waitForExistence(timeout: 5) {
            filterButton.tap()
            sleep(1)
        }

        return self
    }

    @discardableResult
    func scrollToCoupons() -> CustomerCouponPage {
        let scrollView = app.scrollViews.firstMatch
        if scrollView.exists {
            scrollView.swipeUp()
            scrollView.swipeUp()
        }
        return self
    }

    @discardableResult
    func ensureViewAllVisible(timeout: TimeInterval = 5) -> Bool {
        dismissKeyboardIfPresent()
        if firstAvailableCoupon.exists {
            return true
        }
        if viewAllCouponsButton.waitForExistence(timeout: timeout) {
            return true
        }
        // Try multiple scrolls to surface the coupon section
        for _ in 0..<3 {
            scrollToCoupons()
            if viewAllCouponsButton.waitForExistence(timeout: 2) {
                return true
            }
        }
        return false
    }

    func dismissKeyboardIfPresent() {
        guard app.keyboards.count > 0 else { return }
        let done = app.keyboards.buttons["Done"]
        if done.exists {
            done.tap()
            return
        }
        let returnKey = app.keyboards.buttons["Return"]
        if returnKey.exists {
            returnKey.tap()
            return
        }
        app.tap() // fallback tap outside
    }

    // MARK: - Assertions

    @discardableResult
    func assertScreenDisplayed(timeout: TimeInterval = 10) -> CustomerCouponPage {
        XCTAssertTrue(firstAvailableCoupon.waitForExistence(timeout: timeout) ||
                     emptyStateMessage.waitForExistence(timeout: timeout) ||
                     viewAllCouponsButton.waitForExistence(timeout: timeout),
                     "Coupon screen should be displayed")
        return self
    }

    @discardableResult
    func assertCouponsAvailable() -> CustomerCouponPage {
        XCTAssertTrue(firstAvailableCoupon.exists, "Coupons should be available")
        return self
    }

    @discardableResult
    func assertCouponApplied() -> CustomerCouponPage {
        XCTAssertTrue(appliedCouponBadge.waitForExistence(timeout: 10) ||
                     removeCouponButton.exists,
                     "Coupon should be applied")
        return self
    }

    @discardableResult
    func assertCouponRemoved() -> CustomerCouponPage {
        XCTAssertFalse(appliedCouponBadge.exists, "Coupon should be removed")
        XCTAssertFalse(removeCouponButton.exists, "Remove coupon button should not be visible")
        return self
    }

    @discardableResult
    func assertCouponError() -> CustomerCouponPage {
        XCTAssertTrue(couponErrorMessage.waitForExistence(timeout: 2), "Coupon error message should be displayed")
        return self
    }

    @discardableResult
    func assertEmptyState() -> CustomerCouponPage {
        XCTAssertTrue(emptyStateMessage.exists, "Empty state should be displayed")
        return self
    }

    @discardableResult
    func assertCouponDetails() -> CustomerCouponPage {
        XCTAssertTrue(couponDescriptionLabel.exists || validityLabel.exists,
                     "Coupon details should be displayed")
        return self
    }

    @discardableResult
    func assertDiscountDisplayed() -> CustomerCouponPage {
        XCTAssertTrue(discountAmountLabel.exists, "Discount amount should be displayed")
        return self
    }

    // MARK: - Types

    enum CouponFilter {
        case all
        case active
        case expired
    }
}
