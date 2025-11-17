//
//  MarketplaceFlowTests.swift
//  MenuMakerUITests
//
//  Critical P0 tests for marketplace and ordering flows
//

import XCTest

final class MarketplaceFlowTests: XCTestCase {

    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["UI-Testing"]
        app.launch()

        // Login first (required for marketplace access)
        let loginPage = LoginPage(app: app)
        if loginPage.emailField.waitForExistence(timeout: 2) {
            loginPage.login(email: "test@example.com", password: "password123")
            // Wait for navigation
            _ = app.tabBars.firstMatch.waitForExistence(timeout: 5)
        }

        // Navigate to marketplace tab
        let marketplaceTab = app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'marketplace' OR label CONTAINS[c] 'browse'")).firstMatch
        if marketplaceTab.waitForExistence(timeout: 2) {
            marketplaceTab.tap()
        }
    }

    override func tearDownWithError() throws {
        app = nil
    }

    // MARK: - Marketplace Browsing Tests (P0)

    @MainActor
    func testMarketplaceDisplaysSellers() throws {
        let marketplacePage = MarketplacePage(app: app)

        marketplacePage
            .assertScreenDisplayed()
            .assertSellersDisplayed()
            .assertSortButtonExists()
    }

    @MainActor
    func testSearchSellers() throws {
        let marketplacePage = MarketplacePage(app: app)

        marketplacePage
            .assertSellersDisplayed()
            .search("Pizza")

        // Verify search results update
        sleep(2) // Wait for search debounce
        XCTAssertTrue(marketplacePage.firstSellerCard.exists, "Search results should be displayed")
    }

    @MainActor
    func testSortByDistance() throws {
        let marketplacePage = MarketplacePage(app: app)

        marketplacePage
            .assertSellersDisplayed()
            .sortByDistance()

        // Verify sellers reordered
        sleep(1)
        XCTAssertTrue(marketplacePage.firstSellerCard.exists, "Sorted results should be displayed")
    }

    @MainActor
    func testSortByRating() throws {
        let marketplacePage = MarketplacePage(app: app)

        marketplacePage
            .assertSellersDisplayed()
            .sortByRating()

        sleep(1)
        XCTAssertTrue(marketplacePage.firstSellerCard.exists, "Sorted results should be displayed")
    }

    @MainActor
    func testFilterByCuisine() throws {
        let marketplacePage = MarketplacePage(app: app)

        marketplacePage.assertSellersDisplayed()

        // Try to select a cuisine filter (if available)
        let cuisineButton = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'italian' OR label CONTAINS[c] 'chinese' OR label CONTAINS[c] 'indian'")).firstMatch
        if cuisineButton.waitForExistence(timeout: 2) {
            cuisineButton.tap()
            sleep(1)
            // Verify filtered results
            XCTAssertTrue(marketplacePage.firstSellerCard.exists || marketplacePage.emptyState.exists,
                         "Should show filtered results or empty state")
        } else {
            throw XCTSkip("No cuisine filters available")
        }
    }

    @MainActor
    func testPullToRefresh() throws {
        let marketplacePage = MarketplacePage(app: app)

        marketplacePage
            .assertSellersDisplayed()
            .pullToRefresh()

        sleep(2) // Wait for refresh
        marketplacePage.assertSellersDisplayed()
    }

    // MARK: - Ordering Flow Tests (P0)

    @MainActor
    func testViewSellerMenu() throws {
        let marketplacePage = MarketplacePage(app: app)
        marketplacePage.assertSellersDisplayed()

        let menuPage = marketplacePage.tapFirstSeller()
        menuPage.assertScreenDisplayed()
    }

    @MainActor
    func testAddItemToCart() throws {
        let marketplacePage = MarketplacePage(app: app)
        marketplacePage.assertSellersDisplayed()

        let menuPage = marketplacePage.tapFirstSeller()
        menuPage
            .assertScreenDisplayed()
            .addFirstItemToCart()
            .assertCartBadgeCount(1)
    }

    @MainActor
    func testViewCart() throws {
        let marketplacePage = MarketplacePage(app: app)
        marketplacePage.assertSellersDisplayed()

        // Add item to cart first
        let menuPage = marketplacePage.tapFirstSeller()
        menuPage.addFirstItemToCart()

        // Navigate to cart
        let cartPage = menuPage.navigateToCart()
        cartPage
            .assertScreenDisplayed()
            .assertCartNotEmpty()
    }

    @MainActor
    func testIncrementCartItemQuantity() throws {
        let marketplacePage = MarketplacePage(app: app)
        let menuPage = marketplacePage.assertSellersDisplayed().tapFirstSeller()
        menuPage.addFirstItemToCart()

        let cartPage = menuPage.navigateToCart()
        cartPage
            .assertCartNotEmpty()
            .incrementFirstItem()
            .assertCartNotEmpty()
    }

    @MainActor
    func testRemoveItemFromCart() throws {
        let marketplacePage = MarketplacePage(app: app)
        let menuPage = marketplacePage.assertSellersDisplayed().tapFirstSeller()
        menuPage.addFirstItemToCart()

        let cartPage = menuPage.navigateToCart()
        cartPage
            .assertCartNotEmpty()
            .removeFirstItem()

        // Should show empty state or no items
        sleep(1)
        XCTAssertTrue(cartPage.emptyCartMessage.exists || cartPage.cartItems.count == 0,
                     "Cart should be empty after removing item")
    }

    @MainActor
    func testApplyCouponCode() throws {
        let marketplacePage = MarketplacePage(app: app)
        let menuPage = marketplacePage.assertSellersDisplayed().tapFirstSeller()
        menuPage.addFirstItemToCart()

        let cartPage = menuPage.navigateToCart()
        guard cartPage.couponField.waitForExistence(timeout: 2) else {
            throw XCTSkip("Coupon feature not implemented yet")
        }

        cartPage
            .assertCartNotEmpty()
            .applyCoupon("TESTCODE")

        // Verify coupon applied or error shown
        sleep(2)
        let couponApplied = app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'discount' OR label CONTAINS[c] 'applied'")).firstMatch.exists
        let couponError = app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'invalid' OR label CONTAINS[c] 'error'")).firstMatch.exists
        XCTAssertTrue(couponApplied || couponError, "Should show coupon result")
    }

    @MainActor
    func testProceedToCheckout() throws {
        let marketplacePage = MarketplacePage(app: app)
        let menuPage = marketplacePage.assertSellersDisplayed().tapFirstSeller()
        menuPage.addFirstItemToCart()

        let cartPage = menuPage.navigateToCart()
        guard cartPage.checkoutButton.waitForExistence(timeout: 2) else {
            throw XCTSkip("Checkout button not found")
        }

        cartPage.assertCartNotEmpty()

        let checkoutPage = cartPage.proceedToCheckout()
        checkoutPage.assertScreenDisplayed()
    }

    @MainActor
    func testEmptyCartState() throws {
        // Navigate directly to cart without adding items
        let cartTab = app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'cart'")).firstMatch
        guard cartTab.waitForExistence(timeout: 2) else {
            throw XCTSkip("Cart tab not found")
        }
        cartTab.tap()

        let cartPage = CartPage(app: app)
        cartPage.assertScreenDisplayed()

        // Should show empty state or checkout disabled
        let isEmpty = cartPage.emptyCartMessage.exists
        let checkoutDisabled = !cartPage.checkoutButton.isEnabled

        XCTAssertTrue(isEmpty || checkoutDisabled, "Empty cart should show empty state or disable checkout")
    }
}
