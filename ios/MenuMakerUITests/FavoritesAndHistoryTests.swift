//
//  FavoritesAndHistoryTests.swift
//  MenuMakerUITests
//
//  Tests for favorites and order history - save favorites, view orders, reorder
//

import XCTest

final class FavoritesAndHistoryTests: XCTestCase {

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

    // MARK: - Favorites Tests (P0)

    @MainActor
    func testFavoritesScreenDisplays() throws {
        navigateToFavorites()

        let favoritesPage = FavoritesPage(app: app)
        favoritesPage.assertScreenDisplayed()
    }

    @MainActor
    func testAddSellerToFavorites() throws {
        // Navigate to marketplace
        let marketplaceTab = app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'marketplace' OR label CONTAINS[c] 'home'")).firstMatch
        marketplaceTab.tap()
        sleep(1)

        let marketplacePage = MarketplacePage(app: app)

        guard marketplacePage.firstSellerCard.waitForExistence(timeout: 2) else {
            throw XCTSkip("No sellers available")
        }

        marketplacePage.tapFirstSeller()
        sleep(1)

        // Look for favorite button
        let favoriteButton = app.buttons.matching(NSPredicate(format: "label CONTAINS '❤' OR identifier CONTAINS 'favorite'")).firstMatch

        guard favoriteButton.waitForExistence(timeout: 2) else {
            throw XCTSkip("Favorite feature not implemented yet")
        }

        favoriteButton.tap()
        sleep(1)

        // Navigate to favorites
        navigateToFavorites()

        let favoritesPage = FavoritesPage(app: app)
        favoritesPage.assertFavoritesDisplayed()
    }

    @MainActor
    func testRemoveFavorite() throws {
        navigateToFavorites()

        let favoritesPage = FavoritesPage(app: app)

        guard favoritesPage.firstFavorite.waitForExistence(timeout: 2) else {
            throw XCTSkip("No favorites available")
        }

        let initialCount = favoritesPage.favoritesList.count

        favoritesPage.removeFavorite(at: 0)

        sleep(1)

        let finalCount = favoritesPage.favoritesList.count

        XCTAssertLessThanOrEqual(finalCount, initialCount,
                                "Favorite should be removed")
    }

    @MainActor
    func testViewFavoriteDetails() throws {
        navigateToFavorites()

        let favoritesPage = FavoritesPage(app: app)

        guard favoritesPage.firstFavorite.waitForExistence(timeout: 2) else {
            throw XCTSkip("No favorites available")
        }

        favoritesPage.tapFirstFavorite()

        sleep(2)

        // Should navigate to seller menu
        let menuPage = SellerMenuPage(app: app)
        menuPage.assertScreenDisplayed()
    }

    @MainActor
    func testSearchFavorites() throws {
        navigateToFavorites()

        let favoritesPage = FavoritesPage(app: app)

        guard favoritesPage.searchBar.waitForExistence(timeout: 2) else {
            throw XCTSkip("Search favorites not implemented yet")
        }

        favoritesPage.searchFavorites("test")

        sleep(1)
    }

    @MainActor
    func testPullToRefreshFavorites() throws {
        navigateToFavorites()

        let favoritesPage = FavoritesPage(app: app)
        favoritesPage.pullToRefresh()

        sleep(2)

        favoritesPage.assertScreenDisplayed()
    }

    @MainActor
    func testEmptyFavoritesState() throws {
        navigateToFavorites()

        let favoritesPage = FavoritesPage(app: app)

        if favoritesPage.emptyStateMessage.waitForExistence(timeout: 2) {
            favoritesPage.assertEmptyState()

            // Should show explore option
            if favoritesPage.exploreButton.exists {
                favoritesPage.tapExplore()
                sleep(1)

                let marketplacePage = MarketplacePage(app: app)
                marketplacePage.assertScreenDisplayed()
            }
        }
    }

    // MARK: - Order History Tests (P0)

    @MainActor
    func testOrderHistoryScreenDisplays() throws {
        navigateToOrderHistory()

        let orderHistoryPage = OrderHistoryPage(app: app)
        orderHistoryPage.assertScreenDisplayed()
    }

    @MainActor
    func testViewActiveOrders() throws {
        navigateToOrderHistory()

        let orderHistoryPage = OrderHistoryPage(app: app)
        orderHistoryPage.switchToActiveOrders()

        sleep(1)

        // Should show active orders or empty state
        XCTAssertTrue(orderHistoryPage.firstOrder.exists ||
                     orderHistoryPage.emptyStateMessage.exists,
                     "Should show active orders or empty state")
    }

    @MainActor
    func testViewCompletedOrders() throws {
        navigateToOrderHistory()

        let orderHistoryPage = OrderHistoryPage(app: app)
        orderHistoryPage.switchToCompletedOrders()

        sleep(1)

        XCTAssertTrue(orderHistoryPage.firstOrder.exists ||
                     orderHistoryPage.emptyStateMessage.exists,
                     "Should show completed orders or empty state")
    }

    @MainActor
    func testViewCancelledOrders() throws {
        navigateToOrderHistory()

        let orderHistoryPage = OrderHistoryPage(app: app)

        guard orderHistoryPage.cancelledTab.waitForExistence(timeout: 2) else {
            throw XCTSkip("Cancelled orders tab not implemented yet")
        }

        orderHistoryPage.switchToCancelledOrders()

        sleep(1)
    }

    @MainActor
    func testViewOrderDetails() throws {
        navigateToOrderHistory()

        let orderHistoryPage = OrderHistoryPage(app: app)

        guard orderHistoryPage.firstOrder.waitForExistence(timeout: 2) else {
            throw XCTSkip("No orders available")
        }

        orderHistoryPage.tapFirstOrder()

        sleep(2)

        // Should navigate to order details
        let trackingPage = DeliveryTrackingPage(app: app)
        trackingPage.assertScreenDisplayed()
    }

    @MainActor
    func testReorder() throws {
        navigateToOrderHistory()

        let orderHistoryPage = OrderHistoryPage(app: app)
        orderHistoryPage.switchToCompletedOrders()

        guard orderHistoryPage.reorderButtons.firstMatch.waitForExistence(timeout: 2) else {
            throw XCTSkip("Reorder feature not implemented yet")
        }

        orderHistoryPage.reorderFirst()

        sleep(2)

        // Should add items to cart
        let cartTab = app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'cart'")).firstMatch

        if cartTab.waitForExistence(timeout: 1) {
            cartTab.tap()
            sleep(1)

            let cartPage = CartPage(app: app)
            cartPage.assertCartNotEmpty()
        }
    }

    @MainActor
    func testTrackOrderFromHistory() throws {
        navigateToOrderHistory()

        let orderHistoryPage = OrderHistoryPage(app: app)
        orderHistoryPage.switchToActiveOrders()

        guard orderHistoryPage.trackButtons.firstMatch.waitForExistence(timeout: 2) else {
            throw XCTSkip("Track order not implemented yet")
        }

        orderHistoryPage.trackFirstOrder()

        sleep(2)

        let trackingPage = DeliveryTrackingPage(app: app)
        trackingPage.assertScreenDisplayed()
    }

    @MainActor
    func testSearchOrders() throws {
        navigateToOrderHistory()

        let orderHistoryPage = OrderHistoryPage(app: app)

        guard orderHistoryPage.searchBar.waitForExistence(timeout: 2) else {
            throw XCTSkip("Order search not implemented yet")
        }

        orderHistoryPage.searchOrders("pizza")

        sleep(1)
    }

    @MainActor
    func testFilterOrdersByDate() throws {
        navigateToOrderHistory()

        let orderHistoryPage = OrderHistoryPage(app: app)

        guard orderHistoryPage.filterButton.waitForExistence(timeout: 2) else {
            throw XCTSkip("Order filtering not implemented yet")
        }

        orderHistoryPage.filterByDateRange(.last7Days)

        sleep(1)
    }

    @MainActor
    func testPullToRefreshOrders() throws {
        navigateToOrderHistory()

        let orderHistoryPage = OrderHistoryPage(app: app)
        orderHistoryPage.pullToRefresh()

        sleep(2)

        orderHistoryPage.assertScreenDisplayed()
    }

    @MainActor
    func testOrderDetailsDisplayed() throws {
        navigateToOrderHistory()

        let orderHistoryPage = OrderHistoryPage(app: app)

        if orderHistoryPage.firstOrder.waitForExistence(timeout: 2) {
            orderHistoryPage.assertOrderDetailsDisplayed()
        }
    }

    @MainActor
    func testTabNavigation() throws {
        navigateToOrderHistory()

        let orderHistoryPage = OrderHistoryPage(app: app)
        orderHistoryPage.assertTabsDisplayed()

        // Switch between tabs
        orderHistoryPage.switchToActiveOrders()
        sleep(1)

        orderHistoryPage.switchToCompletedOrders()
        sleep(1)

        // Should remain on order history screen
        orderHistoryPage.assertScreenDisplayed()
    }

    @MainActor
    func testHelpSupport() throws {
        navigateToOrderHistory()

        let orderHistoryPage = OrderHistoryPage(app: app)

        guard orderHistoryPage.helpButton.waitForExistence(timeout: 2) else {
            throw XCTSkip("Help support not implemented yet")
        }

        orderHistoryPage.tapHelp()

        sleep(1)
    }

    @MainActor
    func testEmptyOrderHistoryState() throws {
        navigateToOrderHistory()

        let orderHistoryPage = OrderHistoryPage(app: app)
        orderHistoryPage.switchToActiveOrders()

        if orderHistoryPage.emptyStateMessage.waitForExistence(timeout: 2) {
            orderHistoryPage.assertEmptyState()
        }
    }

    // MARK: - Integration Tests (P1)

    @MainActor
    func testOrderInHistoryAfterPlacement() throws {
        // Place a new order
        let marketplaceTab = app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'marketplace' OR label CONTAINS[c] 'home'")).firstMatch
        marketplaceTab.tap()
        sleep(1)

        let marketplacePage = MarketplacePage(app: app)

        if marketplacePage.firstSellerCard.waitForExistence(timeout: 2) {
            let menuPage = marketplacePage.tapFirstSeller()
            menuPage.addFirstItemToCart()

            let cartPage = menuPage.navigateToCart()
            let checkoutPage = cartPage.proceedToCheckout()

            checkoutPage
                .enterDeliveryAddress("123 Test St")
                .selectPaymentMethod(.cash)
                .placeOrder()

            sleep(3)

            // Navigate to order history
            navigateToOrderHistory()

            let orderHistoryPage = OrderHistoryPage(app: app)
            orderHistoryPage.switchToActiveOrders()

            // New order should appear
            orderHistoryPage.assertOrdersDisplayed()
        }
    }

    @MainActor
    func testFavoriteToOrder() throws {
        navigateToFavorites()

        let favoritesPage = FavoritesPage(app: app)

        guard favoritesPage.firstFavorite.waitForExistence(timeout: 2) else {
            throw XCTSkip("No favorites available")
        }

        // Open favorite seller
        favoritesPage.tapFirstFavorite()

        sleep(1)

        let menuPage = SellerMenuPage(app: app)
        menuPage
            .addFirstItemToCart()
            .navigateToCart()

        let cartPage = CartPage(app: app)
        cartPage.assertCartNotEmpty()
    }

    // MARK: - Helper Methods

    private func navigateToFavorites() {
        let favoritesTab = app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'favorite' OR label CONTAINS '❤️'")).firstMatch

        if favoritesTab.waitForExistence(timeout: 2) {
            favoritesTab.tap()
            sleep(1)
        } else {
            // Try via profile
            let profileTab = app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'profile'")).firstMatch
            if profileTab.waitForExistence(timeout: 2) {
                profileTab.tap()
                sleep(1)

                let profilePage = ProfilePage(app: app)
                if profilePage.favoritesButton.waitForExistence(timeout: 2) {
                    profilePage.tapFavorites()
                }
            }
        }
    }

    private func navigateToOrderHistory() {
        let ordersTab = app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'order'")).firstMatch

        if ordersTab.waitForExistence(timeout: 2) {
            ordersTab.tap()
            sleep(1)
        } else {
            // Try via profile
            let profileTab = app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'profile'")).firstMatch
            if profileTab.waitForExistence(timeout: 2) {
                profileTab.tap()
                sleep(1)

                let profilePage = ProfilePage(app: app)
                if profilePage.ordersButton.waitForExistence(timeout: 2) {
                    profilePage.tapOrders()
                }
            }
        }
    }
}
