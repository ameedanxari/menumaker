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
        app.scrollViews.otherElements.matching(identifier: "AvailableCoupon")
    }

    var firstAvailableCoupon: XCUIElement {
        availableCouponsList.firstMatch
    }

    var viewAllCouponsButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'view all' OR label CONTAINS[c] 'see all'")).firstMatch
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
        app.searchFields.firstMatch
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
        viewAllCouponsButton.tap()
        sleep(1)
        return self
    }

    @discardableResult
    func tapFirstCoupon() -> CustomerCouponPage {
        firstAvailableCoupon.tap()
        sleep(1)
        return self
    }

    @discardableResult
    func applyCoupon(code: String) -> CustomerCouponPage {
        // Find and tap the coupon with matching code
        let couponElement = app.staticTexts[code]
        if couponElement.waitForExistence(timeout: 2) {
            couponElement.tap()
            sleep(1)
        }

        if applyCouponButton.waitForExistence(timeout: 1) {
            applyCouponButton.tap()
            sleep(1)
        }

        return self
    }

    @discardableResult
    func applyFirstAvailableCoupon() -> CustomerCouponPage {
        tapFirstCoupon()

        if applyCouponButton.waitForExistence(timeout: 1) {
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
        if searchCouponField.waitForExistence(timeout: 1) {
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

        if filterButton.waitForExistence(timeout: 1) {
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
        }
        return self
    }

    // MARK: - Assertions

    @discardableResult
    func assertScreenDisplayed(timeout: TimeInterval = 2) -> CustomerCouponPage {
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
        XCTAssertTrue(appliedCouponBadge.waitForExistence(timeout: 2) ||
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
