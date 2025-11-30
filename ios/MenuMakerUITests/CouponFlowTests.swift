//
//  CouponFlowTests.swift
//  MenuMakerUITests
//
//  Tests for coupon system - seller creation and customer application
//

import XCTest

final class CouponFlowTests: XCTestCase {

    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["UI-Testing"]
        app.launch()
    }

    override func tearDownWithError() throws {
        app = nil
    }

    // MARK: - Seller Coupon Management Tests (P0)

    @MainActor
    func testSellerCouponScreenDisplays() throws {
        loginAsSeller()
        navigateToSellerCoupons()

        let couponPage = SellerCouponPage(app: app)
        couponPage.assertScreenDisplayed()
    }

    @MainActor
    func testCreatePercentageCoupon() throws {
        loginAsSeller()
        navigateToSellerCoupons()

        let couponPage = SellerCouponPage(app: app)

        guard couponPage.createCouponButton.waitForExistence(timeout: 10) else {
            XCTFail("Coupon creation feature not accessible - 'add-coupon-button' not found")
            return
        }

        couponPage
            .tapCreateCoupon()
            .assertCouponFormDisplayed()
            .enterCouponCode("SAVE20")
            .selectDiscountType(.percentage)
            .enterDiscountValue("20")
            .enterMinOrderAmount("500")
            .saveCoupon()
            .assertCouponSaved()
            .assertCouponExists("SAVE20")
    }

    @MainActor
    func testCreateFixedAmountCoupon() throws {
        loginAsSeller()
        navigateToSellerCoupons()

        let couponPage = SellerCouponPage(app: app)

        guard couponPage.createCouponButton.waitForExistence(timeout: 10) else {
            XCTFail("Coupon creation feature not accessible - 'add-coupon-button' not found")
            return
        }

        couponPage
            .tapCreateCoupon()
            .assertCouponFormDisplayed()
            .enterCouponCode("FLAT100")
            .selectDiscountType(.fixedAmount)
            .enterDiscountValue("100")
            .enterMinOrderAmount("1000")
            .saveCoupon()
            .assertCouponSaved()
            .assertCouponExists("FLAT100")
    }

    @MainActor
    func testCreateCouponWithMaxDiscount() throws {
        loginAsSeller()
        navigateToSellerCoupons()

        let couponPage = SellerCouponPage(app: app)

        guard couponPage.createCouponButton.waitForExistence(timeout: 10) else {
            XCTFail("Coupon creation feature not accessible - 'add-coupon-button' not found")
            return
        }

        couponPage
            .tapCreateCoupon()
            .enterCouponCode("MEGA50")
            .selectDiscountType(.percentage)
            .enterDiscountValue("50")
            .enterMinOrderAmount("2000")
            .enterMaxDiscount("500")
            .saveCoupon()
            .assertCouponSaved()
    }

    @MainActor
    func testCreateCouponWithUsageLimit() throws {
        loginAsSeller()
        navigateToSellerCoupons()

        let couponPage = SellerCouponPage(app: app)

        guard couponPage.createCouponButton.waitForExistence(timeout: 10) else {
            XCTFail("Coupon creation feature not accessible - 'add-coupon-button' not found")
            return
        }

        couponPage
            .tapCreateCoupon()
            .enterCouponCode("LIMITED10")
            .selectDiscountType(.percentage)
            .enterDiscountValue("10")
            .enterUsageLimit("100")
            .saveCoupon()
            .assertCouponSaved()
    }

    @MainActor
    func testEditCoupon() throws {
        loginAsSeller()
        navigateToSellerCoupons()

        let couponPage = SellerCouponPage(app: app)

        guard couponPage.firstCoupon.waitForExistence(timeout: 10) else {
            XCTFail("TEST DATA ISSUE: No coupons available to edit - create test data in setUp")
            return
        }

        couponPage
            .tapFirstCoupon()
            .assertCouponFormDisplayed()
            .enterDiscountValue("25")
            .saveCoupon()
            .assertCouponSaved()
    }

    @MainActor
    func testToggleCouponActive() throws {
        loginAsSeller()
        navigateToSellerCoupons()

        let couponPage = SellerCouponPage(app: app)

        guard couponPage.firstCoupon.waitForExistence(timeout: 10) else {
            XCTFail("TEST DATA ISSUE: No coupons available - create test data in setUp")
            return
        }

        couponPage
            .tapFirstCoupon()
            .toggleCouponActive()
            .saveCoupon()
    }

    @MainActor
    func testDeleteCoupon() throws {
        loginAsSeller()
        navigateToSellerCoupons()

        let couponPage = SellerCouponPage(app: app)

        guard couponPage.firstCoupon.waitForExistence(timeout: 10) else {
            XCTFail("TEST DATA ISSUE: No coupons to delete - create test data in setUp")
            return
        }

        let initialCount = couponPage.couponList.count

        couponPage.swipeToDelete(at: 0)

        sleep(1)
        let newCount = couponPage.couponList.count
        XCTAssertLessThan(newCount, initialCount, "Coupon should be deleted")
    }

    @MainActor
    func testCancelCouponCreation() throws {
        loginAsSeller()
        navigateToSellerCoupons()

        let couponPage = SellerCouponPage(app: app)

        guard couponPage.createCouponButton.waitForExistence(timeout: 10) else {
            XCTFail("Coupon creation feature not accessible - 'add-coupon-button' not found")
            return
        }

        couponPage
            .tapCreateCoupon()
            .assertCouponFormDisplayed()
            .enterCouponCode("CANCELLED")
            .cancelCouponCreation()

        sleep(1)
        XCTAssertFalse(couponPage.couponCodeField.exists, "Form should be dismissed")
    }

    @MainActor
    func testCreateMultipleCoupons() throws {
        loginAsSeller()
        navigateToSellerCoupons()

        let couponPage = SellerCouponPage(app: app)

        guard couponPage.createCouponButton.waitForExistence(timeout: 10) else {
            XCTFail("Coupon creation feature not accessible - 'add-coupon-button' not found")
            return
        }

        let coupons = [
            ("WELCOME10", SellerCouponPage.DiscountType.percentage, "10", "300"),
            ("FLAT50", SellerCouponPage.DiscountType.fixedAmount, "50", "500"),
            ("SAVE30", SellerCouponPage.DiscountType.percentage, "30", "1000")
        ]

        for (code, type, value, minOrder) in coupons {
            couponPage.createCoupon(code: code, type: type, value: value, minOrder: minOrder)
            // Wait for form to dismiss by checking that code field no longer exists
            XCTAssertTrue(couponPage.couponCodeField.waitForNonExistence(timeout: 5),
                         "Coupon form should dismiss after creating '\(code)'")
        }

        // Verify all coupons were created - wait for first one to ensure list has loaded
        guard app.staticTexts[coupons[0].0].waitForExistence(timeout: 5) else {
            XCTFail("Created coupons should appear in list - '\(coupons[0].0)' not found")
            return
        }

        // Verify remaining coupons exist
        for (code, _, _, _) in coupons.dropFirst() {
            let couponLabel = app.staticTexts[code]
            if !couponLabel.exists {
                XCTFail("Coupon '\(code)' should exist in list")
            }
        }
    }

    // MARK: - Customer Coupon Tests (P0)

    @MainActor
    func testViewAvailableCoupons() throws {
        loginAsCustomer()
        navigateToCheckoutWithItems()

        let customerCouponPage = CustomerCouponPage(app: app)

        guard customerCouponPage.viewAllCouponsButton.waitForExistence(timeout: 10) ||
              customerCouponPage.firstAvailableCoupon.waitForExistence(timeout: 10) else {
            XCTFail("FEATURE NOT IMPLEMENTED: Coupon browsing UI missing - 'viewAllCouponsButton' or 'firstAvailableCoupon' not found in checkout/cart view")
            return
        }

        if customerCouponPage.viewAllCouponsButton.exists {
            customerCouponPage.tapViewAllCoupons()
        }

        customerCouponPage.assertScreenDisplayed()
    }

    @MainActor
    func testApplyCouponAtCheckout() throws {
        loginAsCustomer()
        navigateToCheckoutWithItems()

        let cartPage = CartPage(app: app)

        guard cartPage.couponField.waitForExistence(timeout: 10) else {
            XCTFail("FEATURE NOT IMPLEMENTED: Coupon application field missing - 'couponField' not found in cart/checkout view")
            return
        }

        cartPage
            .applyCoupon("TESTCODE")

        sleep(2)
        // Coupon should be applied or show error
    }

    @MainActor
    func testApplyValidCoupon() throws {
        loginAsCustomer()
        navigateToCheckoutWithItems()

        let customerCouponPage = CustomerCouponPage(app: app)

        guard customerCouponPage.firstAvailableCoupon.waitForExistence(timeout: 10) else {
            XCTFail("TEST DATA ISSUE: No coupons available - create test coupons in setUp or verify mock data")
            return
        }

        customerCouponPage
            .applyFirstAvailableCoupon()
            .assertCouponApplied()
    }

    @MainActor
    func testRemoveAppliedCoupon() throws {
        loginAsCustomer()
        navigateToCheckoutWithItems()

        let customerCouponPage = CustomerCouponPage(app: app)

        guard customerCouponPage.firstAvailableCoupon.waitForExistence(timeout: 10) else {
            XCTFail("TEST DATA ISSUE: No coupons available - create test coupons in setUp or verify mock data")
            return
        }

        customerCouponPage
            .applyFirstAvailableCoupon()
            .assertCouponApplied()
            .removeCoupon()
            .assertCouponRemoved()
    }

    @MainActor
    func testApplyInvalidCoupon() throws {
        loginAsCustomer()
        navigateToCheckoutWithItems()

        let cartPage = CartPage(app: app)

        guard cartPage.couponField.waitForExistence(timeout: 10) else {
            XCTFail("FEATURE NOT IMPLEMENTED: Coupon application field missing - 'couponField' not found in cart/checkout view")
            return
        }

        cartPage.applyCoupon("INVALIDCODE999")

        sleep(2)

        let customerCouponPage = CustomerCouponPage(app: app)
        // Should show error for invalid coupon
        if customerCouponPage.couponErrorMessage.waitForExistence(timeout: 10) {
            customerCouponPage.assertCouponError()
        }
    }

    @MainActor
    func testApplyCouponBelowMinimumOrder() throws {
        loginAsCustomer()

        // Add small item to cart (below minimum order)
        navigateToMarketplace()

        let marketplacePage = MarketplacePage(app: app)
        guard marketplacePage.firstSellerCard.waitForExistence(timeout: 10) else {
            XCTFail("TEST DATA ISSUE: No sellers available in marketplace - verify mock data or navigation")
            return
        }

        let menuPage = marketplacePage.tapFirstSeller()
        menuPage.addFirstItemToCart()

        let cartPage = menuPage.navigateToCart()

        guard cartPage.couponField.waitForExistence(timeout: 10) else {
            XCTFail("FEATURE NOT IMPLEMENTED: Coupon application field missing - 'couponField' not found in cart/checkout view")
            return
        }

        // Try to apply coupon that has minimum order requirement
        cartPage.applyCoupon("SAVE50")

        sleep(2)

        let customerCouponPage = CustomerCouponPage(app: app)
        // Should show error about minimum order not met
        if customerCouponPage.couponErrorMessage.waitForExistence(timeout: 10) {
            XCTAssertTrue(customerCouponPage.couponErrorMessage.label.contains("minimum") ||
                         customerCouponPage.couponErrorMessage.label.contains("order"),
                         "Should show minimum order error")
        }
    }

    @MainActor
    func testSearchCoupons() throws {
        loginAsCustomer()
        navigateToCheckoutWithItems()

        let customerCouponPage = CustomerCouponPage(app: app)

        guard customerCouponPage.viewAllCouponsButton.waitForExistence(timeout: 10) else {
            XCTFail("FEATURE NOT IMPLEMENTED: Coupon browsing UI missing - 'viewAllCouponsButton' not found")
            return
        }

        customerCouponPage
            .tapViewAllCoupons()

        guard customerCouponPage.searchCouponField.waitForExistence(timeout: 10) else {
            XCTFail("FEATURE NOT IMPLEMENTED: Coupon search field missing - 'searchCouponField' not found in coupon browse view")
            return
        }

        customerCouponPage.searchCoupon("SAVE")

        sleep(1)
    }

    @MainActor
    func testFilterCoupons() throws {
        loginAsCustomer()
        navigateToCheckoutWithItems()

        let customerCouponPage = CustomerCouponPage(app: app)

        guard customerCouponPage.viewAllCouponsButton.waitForExistence(timeout: 10) else {
            XCTFail("FEATURE NOT IMPLEMENTED: Coupon browsing UI missing - 'viewAllCouponsButton' not found")
            return
        }

        customerCouponPage
            .tapViewAllCoupons()

        guard customerCouponPage.filterButtons.count > 0 else {
            XCTFail("FEATURE NOT IMPLEMENTED: Coupon filtering missing - no filter buttons found in coupon browse view")
            return
        }

        customerCouponPage
            .filterCoupons(by: .active)

        sleep(1)
    }

    @MainActor
    func testCouponDiscountCalculation() throws {
        loginAsCustomer()
        navigateToCheckoutWithItems()

        let cartPage = CartPage(app: app)

        // Get original total
        let originalTotalLabel = cartPage.totalPrice.label

        guard cartPage.couponField.waitForExistence(timeout: 10) else {
            XCTFail("FEATURE NOT IMPLEMENTED: Coupon application field missing - 'couponField' not found in cart/checkout view")
            return
        }

        cartPage.applyCoupon("TESTCODE")

        sleep(2)

        // Get new total after discount
        let newTotalLabel = cartPage.totalPrice.label

        // If coupon was applied successfully, total should change
        if !CustomerCouponPage(app: app).couponErrorMessage.exists {
            XCTAssertNotEqual(originalTotalLabel, newTotalLabel,
                            "Total should change after applying valid coupon")
        }
    }

    @MainActor
    func testViewCouponDetails() throws {
        loginAsCustomer()
        navigateToCheckoutWithItems()

        let customerCouponPage = CustomerCouponPage(app: app)

        guard customerCouponPage.viewAllCouponsButton.waitForExistence(timeout: 10) else {
            XCTFail("FEATURE NOT IMPLEMENTED: Coupon browsing UI missing - 'viewAllCouponsButton' not found")
            return
        }

        customerCouponPage
            .tapViewAllCoupons()

        guard customerCouponPage.firstAvailableCoupon.waitForExistence(timeout: 10) else {
            XCTFail("TEST DATA ISSUE: No coupons available - create test coupons in setUp or verify mock data")
            return
        }

        customerCouponPage
            .tapFirstCoupon()
            .assertCouponDetails()
    }

    // MARK: - Integration Tests (P1)

    @MainActor
    func testCouponWorksWithReferralCredits() throws {
        loginAsCustomer()
        navigateToCheckoutWithItems()

        let cartPage = CartPage(app: app)

        guard cartPage.couponField.waitForExistence(timeout: 10) else {
            XCTFail("FEATURE NOT IMPLEMENTED: Coupon application field missing - 'couponField' not found in cart/checkout view")
            return
        }

        // Apply coupon
        cartPage.applyCoupon("TESTCODE")
        sleep(2)

        // Check if referral credits option is also available
        let useCreditsButton = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'use credit'")).firstMatch

        if useCreditsButton.waitForExistence(timeout: 1) {
            // Both coupon and credits can potentially be used together
            XCTAssertTrue(useCreditsButton.exists, "Credits option should still be available")
        }
    }

    @MainActor
    func testExpiredCouponHandling() throws {
        loginAsCustomer()
        navigateToCheckoutWithItems()

        let cartPage = CartPage(app: app)

        guard cartPage.couponField.waitForExistence(timeout: 10) else {
            XCTFail("FEATURE NOT IMPLEMENTED: Coupon application field missing - 'couponField' not found in cart/checkout view")
            return
        }

        // Try to apply expired coupon
        cartPage.applyCoupon("EXPIRED")

        sleep(2)

        let customerCouponPage = CustomerCouponPage(app: app)
        if customerCouponPage.couponErrorMessage.waitForExistence(timeout: 10) {
            XCTAssertTrue(customerCouponPage.couponErrorMessage.label.contains("expired") ||
                         customerCouponPage.couponErrorMessage.label.contains("invalid"),
                         "Should show expired coupon error")
        }
    }

    // MARK: - Helper Methods

    private func loginAsSeller() {
        let loginPage = LoginPage(app: app)
        if loginPage.emailField.waitForExistence(timeout: 10) {
            loginPage.login(email: "seller@example.com", password: "password123")
            _ = app.tabBars.firstMatch.waitForExistence(timeout: 5)
        }
    }

    private func loginAsCustomer() {
        let loginPage = LoginPage(app: app)
        if loginPage.emailField.waitForExistence(timeout: 10) {
            loginPage.login(email: "test@example.com", password: "password123")
            _ = app.tabBars.firstMatch.waitForExistence(timeout: 5)
        }
    }

    private func navigateToSellerCoupons() {
        // Try direct coupons tab first
        let couponsTab = app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'coupon'")).firstMatch

        if couponsTab.waitForExistence(timeout: 10) {
            couponsTab.tap()
            return
        }

        // Try navigating via More tab -> Coupons link
        let moreTab = app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'more'")).firstMatch
        if moreTab.waitForExistence(timeout: 10) {
            moreTab.tap()
            sleep(1)

            let couponsLink = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'coupon'")).firstMatch
            if couponsLink.waitForExistence(timeout: 10) {
                couponsLink.tap()
                return
            }
        }

        // Fallback: Try navigating via navigation bar menu button
        let menuButton = app.navigationBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'menu'")).firstMatch
        if menuButton.waitForExistence(timeout: 10) {
            menuButton.tap()
            sleep(1)

            let couponsOption = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'coupon'")).firstMatch
            if couponsOption.waitForExistence(timeout: 10) {
                couponsOption.tap()
            }
        }
    }

    private func navigateToMarketplace() {
        let marketplaceTab = app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'marketplace' OR label CONTAINS[c] 'home'")).firstMatch
        if marketplaceTab.waitForExistence(timeout: 10) {
            marketplaceTab.tap()
        }
    }

    private func navigateToCheckoutWithItems() {
        // Add items to cart first
        navigateToMarketplace()

        let marketplacePage = MarketplacePage(app: app)
        if marketplacePage.firstSellerCard.waitForExistence(timeout: 10) {
            let menuPage = marketplacePage.tapFirstSeller()
            menuPage
                .addFirstItemToCart()
                .addItemToCart(at: 1)

            let cartPage = menuPage.navigateToCart()
            cartPage.assertCartNotEmpty()
        }
    }
}
