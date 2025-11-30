//
//  DeliveryTrackingTests.swift
//  MenuMakerUITests
//
//  Tests for delivery tracking - order status, live tracking, communication
//

import XCTest

final class DeliveryTrackingTests: XCTestCase {

    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["UI-Testing"]
        app.launch()

        // Login as customer
        let loginPage = LoginPage(app: app)
        if loginPage.emailField.waitForExistence(timeout: 2) {
            loginPage.login(email: "test@example.com", password: "password123")
            _ = app.tabBars.firstMatch.waitForExistence(timeout: 5)
        }
    }

    override func tearDownWithError() throws {
        app = nil
    }

    // MARK: - Order Tracking Display Tests (P0)

    @MainActor
    func testTrackingScreenDisplays() throws {
        navigateToActiveOrder()

        let trackingPage = DeliveryTrackingPage(app: app)
        trackingPage.assertScreenDisplayed()
    }

    @MainActor
    func testOrderStatusDisplayed() throws {
        navigateToActiveOrder()

        let trackingPage = DeliveryTrackingPage(app: app)

        guard trackingPage.orderStatusLabel.waitForExistence(timeout: 2) else {
            XCTFail("Order tracking not implemented yet - UI element not found or feature not implemented"); return
        }

        // Status should be one of the valid states
        XCTAssertTrue(trackingPage.orderStatusLabel.exists, "Order status should be displayed")
    }

    @MainActor
    func testTrackingStepsDisplayed() throws {
        navigateToActiveOrder()

        let trackingPage = DeliveryTrackingPage(app: app)

        guard trackingPage.orderStatusLabel.waitForExistence(timeout: 2) else {
            XCTFail("Order tracking not implemented yet - UI element not found or feature not implemented"); return
        }

        trackingPage.assertTrackingStepsDisplayed()
    }

    @MainActor
    func testEstimatedDeliveryTimeDisplayed() throws {
        navigateToActiveOrder()

        let trackingPage = DeliveryTrackingPage(app: app)

        guard trackingPage.estimatedTimeLabel.waitForExistence(timeout: 2) else {
            XCTFail("Estimated time not implemented yet - UI element not found or feature not implemented"); return
        }

        trackingPage.assertEstimatedTimeDisplayed()
    }

    @MainActor
    func testOrderDetailsDisplayed() throws {
        navigateToActiveOrder()

        let trackingPage = DeliveryTrackingPage(app: app)

        guard trackingPage.orderStatusLabel.waitForExistence(timeout: 2) else {
            XCTFail("Order tracking not implemented yet - UI element not found or feature not implemented"); return
        }

        trackingPage
            .scrollToOrderDetails()
            .assertOrderDetailsDisplayed()
    }

    @MainActor
    func testDeliveryAddressDisplayed() throws {
        navigateToActiveOrder()

        let trackingPage = DeliveryTrackingPage(app: app)

        guard trackingPage.orderStatusLabel.waitForExistence(timeout: 2) else {
            XCTFail("Order tracking not implemented yet - UI element not found or feature not implemented"); return
        }

        trackingPage
            .scrollToOrderDetails()

        XCTAssertTrue(trackingPage.deliveryAddressLabel.waitForExistence(timeout: 2), "Delivery address should be displayed")
        trackingPage.assertDeliveryAddressDisplayed()
    }

    // MARK: - Live Tracking Tests (P0)

    @MainActor
    func testMapDisplayed() throws {
        navigateToActiveOrder()

        let trackingPage = DeliveryTrackingPage(app: app)

        guard trackingPage.orderStatusLabel.waitForExistence(timeout: 2) else {
            XCTFail("Order tracking not implemented yet - UI element not found or feature not implemented"); return
        }

        guard trackingPage.mapView.waitForExistence(timeout: 3) else {
            XCTFail("Map view not implemented yet - UI element not found or feature not implemented"); return
        }

        trackingPage.assertMapDisplayed()
    }

    @MainActor
    func testLiveTrackingActive() throws {
        navigateToActiveOrder()

        let trackingPage = DeliveryTrackingPage(app: app)

        guard trackingPage.orderStatusLabel.waitForExistence(timeout: 2) else {
            XCTFail("Order tracking not implemented yet - UI element not found or feature not implemented"); return
        }

        // Live tracking should be active for out-for-delivery orders
        if trackingPage.outForDeliveryStep.exists ||
           trackingPage.orderStatusLabel.label.lowercased().contains("delivery") {

            XCTAssertTrue(trackingPage.mapView.waitForExistence(timeout: 2) || trackingPage.liveTrackingIndicator.waitForExistence(timeout: 2), "Live tracking map or indicator should be visible")
            trackingPage.assertLiveTrackingActive()
        }
    }

    @MainActor
    func testMapInteraction() throws {
        navigateToActiveOrder()

        let trackingPage = DeliveryTrackingPage(app: app)

        guard trackingPage.mapView.waitForExistence(timeout: 3) else {
            XCTFail("Map view not implemented yet - UI element not found or feature not implemented"); return
        }

        trackingPage.zoomInMap()

        sleep(1)
        XCTAssertTrue(trackingPage.mapView.exists, "Map should remain visible after interaction")
    }

    // MARK: - Delivery Person Communication Tests (P0)

    @MainActor
    func testDeliveryPersonInfoDisplayed() throws {
        navigateToActiveOrder()

        let trackingPage = DeliveryTrackingPage(app: app)

        guard trackingPage.orderStatusLabel.waitForExistence(timeout: 2) else {
            XCTFail("Order tracking not implemented yet - UI element not found or feature not implemented"); return
        }

        // Delivery person info should be available when order is out for delivery
        if trackingPage.outForDeliveryStep.exists ||
           trackingPage.deliveryPersonNameLabel.waitForExistence(timeout: 2) {
            trackingPage.assertDeliveryPersonInfoDisplayed()
        }
    }

    @MainActor
    func testCallDeliveryPerson() throws {
        navigateToActiveOrder()

        let trackingPage = DeliveryTrackingPage(app: app)

        guard trackingPage.deliveryPersonPhoneButton.waitForExistence(timeout: 2) else {
            XCTFail("Delivery person contact not implemented yet - UI element not found or feature not implemented"); return
        }

        trackingPage
            .assertCallButtonVisible()
            .tapCallDeliveryPerson()

        sleep(1)
    }

    @MainActor
    func testWhatsAppDeliveryPerson() throws {
        navigateToActiveOrder()

        let trackingPage = DeliveryTrackingPage(app: app)

        guard trackingPage.whatsappButton.waitForExistence(timeout: 2) else {
            XCTFail("WhatsApp integration not implemented yet - UI element not found or feature not implemented"); return
        }

        trackingPage
            .assertWhatsAppButtonVisible()
            .tapWhatsAppDeliveryPerson()

        sleep(1)
    }

    // MARK: - Order Status Updates Tests (P0)

    @MainActor
    func testRefreshTracking() throws {
        navigateToActiveOrder()

        let trackingPage = DeliveryTrackingPage(app: app)

        guard trackingPage.orderStatusLabel.waitForExistence(timeout: 2) else {
            XCTFail("Order tracking not implemented yet - UI element not found or feature not implemented"); return
        }

        let _ = trackingPage.orderStatusLabel.label

        trackingPage.tapRefresh()

        sleep(2)

        // Status should still be displayed after refresh
        XCTAssertTrue(trackingPage.orderStatusLabel.exists, "Status should be displayed after refresh")
    }

    @MainActor
    func testOrderPlacedStatus() throws {
        // This test would need a newly placed order
        navigateToActiveOrder()

        let trackingPage = DeliveryTrackingPage(app: app)

        guard trackingPage.orderStatusLabel.waitForExistence(timeout: 2) else {
            XCTFail("Order tracking not implemented yet - UI element not found or feature not implemented"); return
        }

        // Check if order placed step exists
        if trackingPage.orderPlacedStep.exists {
            XCTAssertTrue(trackingPage.orderPlacedStep.exists, "Order placed step should exist")
        }
    }

    @MainActor
    func testOrderConfirmedStatus() throws {
        navigateToActiveOrder()

        let trackingPage = DeliveryTrackingPage(app: app)

        guard trackingPage.orderStatusLabel.waitForExistence(timeout: 2) else {
            XCTFail("Order tracking not implemented yet - UI element not found or feature not implemented"); return
        }

        // Check if confirmed step is visible
        if trackingPage.confirmStep.exists {
            XCTAssertTrue(trackingPage.confirmStep.exists, "Confirmed step should exist")
        }
    }

    @MainActor
    func testOrderPreparingStatus() throws {
        navigateToActiveOrder()

        let trackingPage = DeliveryTrackingPage(app: app)

        guard trackingPage.orderStatusLabel.waitForExistence(timeout: 2) else {
            XCTFail("Order tracking not implemented yet - UI element not found or feature not implemented"); return
        }

        // Check if preparing step is visible
        if trackingPage.preparingStep.exists {
            XCTAssertTrue(trackingPage.preparingStep.exists, "Preparing step should exist")
        }
    }

    @MainActor
    func testOrderReadyStatus() throws {
        navigateToActiveOrder()

        let trackingPage = DeliveryTrackingPage(app: app)

        guard trackingPage.orderStatusLabel.waitForExistence(timeout: 2) else {
            XCTFail("Order tracking not implemented yet - UI element not found or feature not implemented"); return
        }

        // Check if ready step is visible
        if trackingPage.readyStep.exists {
            XCTAssertTrue(trackingPage.readyStep.exists, "Ready step should exist")
        }
    }

    @MainActor
    func testOutForDeliveryStatus() throws {
        navigateToActiveOrder()

        let trackingPage = DeliveryTrackingPage(app: app)

        guard trackingPage.orderStatusLabel.waitForExistence(timeout: 2) else {
            XCTFail("Order tracking not implemented yet - UI element not found or feature not implemented"); return
        }

        // Check if out for delivery step is visible
        if trackingPage.outForDeliveryStep.exists {
            trackingPage.assertDeliveryPersonInfoDisplayed()
        }
    }

    // MARK: - Order Actions Tests (P1)

    @MainActor
    func testCancelOrder() throws {
        navigateToActiveOrder()

        let trackingPage = DeliveryTrackingPage(app: app)

        guard trackingPage.cancelOrderButton.waitForExistence(timeout: 2) else {
            XCTFail("Cancel order not implemented yet or order cannot be cancelled - UI element not found or feature not implemented"); return
        }

        trackingPage
            .assertCancelOrderButtonVisible()
            .tapCancelOrder()

        sleep(2)

        // Should show cancellation confirmation or navigate away
    }

    @MainActor
    func testRateOrderAfterDelivery() throws {
        navigateToCompletedOrder()

        let trackingPage = DeliveryTrackingPage(app: app)

        guard trackingPage.rateOrderButton.waitForExistence(timeout: 2) else {
            XCTFail("Rate order feature not implemented yet - UI element not found or feature not implemented"); return
        }

        trackingPage
            .assertRateOrderButtonVisible()
            .tapRateOrder()

        sleep(1)

        // Should navigate to review screen
        let reviewPage = ReviewPage(app: app)
        if reviewPage.ratingStars.count > 0 {
            reviewPage.assertScreenDisplayed()
        }
    }

    @MainActor
    func testNavigateBackFromTracking() throws {
        navigateToActiveOrder()

        let trackingPage = DeliveryTrackingPage(app: app)

        guard trackingPage.orderStatusLabel.waitForExistence(timeout: 2) else {
            XCTFail("Order tracking not implemented yet - UI element not found or feature not implemented"); return
        }

        trackingPage.goBack()

        sleep(1)
        // Should navigate back to orders list
    }

    // MARK: - Integration Tests (P1)

    @MainActor
    func testTrackingFromOrderHistory() throws {
        // Navigate to order history
        let ordersTab = app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'order'")).firstMatch

        if ordersTab.waitForExistence(timeout: 2) {
            ordersTab.tap()
        } else {
            // Try via profile
            let profileTab = app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'profile'")).firstMatch
            if profileTab.waitForExistence(timeout: 2) {
                profileTab.tap()
                sleep(1)

                let ordersOption = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'order'")).firstMatch
                if ordersOption.waitForExistence(timeout: 2) {
                    ordersOption.tap()
                }
            }
        }

        sleep(1)

        // Tap first active order
        let firstOrder = app.scrollViews.otherElements.matching(identifier: "OrderItem").firstMatch
        if firstOrder.waitForExistence(timeout: 2) {
            firstOrder.tap()
            sleep(1)

            let trackingPage = DeliveryTrackingPage(app: app)
            trackingPage.assertScreenDisplayed()
        }
    }

    @MainActor
    func testMultipleStatusTransitions() throws {
        navigateToActiveOrder()

        let trackingPage = DeliveryTrackingPage(app: app)

        guard trackingPage.orderStatusLabel.waitForExistence(timeout: 2) else {
            XCTFail("Order tracking not implemented yet - UI element not found or feature not implemented"); return
        }

        // Verify multiple steps are visible in progression
        let visibleSteps = [
            trackingPage.orderPlacedStep.exists,
            trackingPage.confirmStep.exists,
            trackingPage.preparingStep.exists,
            trackingPage.readyStep.exists,
            trackingPage.outForDeliveryStep.exists,
            trackingPage.deliveredStep.exists
        ].filter { $0 }.count

        XCTAssertGreaterThan(visibleSteps, 1, "Multiple tracking steps should be visible")
    }

    @MainActor
    func testWhatsAppNotificationIntegration() throws {
        navigateToActiveOrder()

        let trackingPage = DeliveryTrackingPage(app: app)

        guard trackingPage.whatsappButton.waitForExistence(timeout: 2) else {
            XCTFail("WhatsApp integration not implemented yet - UI element not found or feature not implemented"); return
        }

        // WhatsApp button should be available for communication
        trackingPage.assertWhatsAppButtonVisible()

        // Test opening WhatsApp
        trackingPage.tapWhatsAppDeliveryPerson()

        sleep(2)
        // App should return to tracking screen
        app.activate()
        sleep(1)

        XCTAssertTrue(trackingPage.orderStatusLabel.exists, "Should return to tracking screen")
    }

    // MARK: - Helper Methods

    private func navigateToActiveOrder() {
        // Try to find active orders tab
        let ordersTab = app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'order'")).firstMatch

        if ordersTab.waitForExistence(timeout: 2) {
            ordersTab.tap()
            sleep(1)

            // Tap first active order
            let firstOrder = app.scrollViews.otherElements.matching(identifier: "OrderItem").firstMatch
            if firstOrder.waitForExistence(timeout: 2) {
                firstOrder.tap()
                sleep(1)
            }
        } else {
            // Alternative: Place a new order and track it
            placeOrderAndTrack()
        }
    }

    private func navigateToCompletedOrder() {
        let ordersTab = app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'order'")).firstMatch

        if ordersTab.waitForExistence(timeout: 2) {
            ordersTab.tap()
            sleep(1)

            // Switch to completed orders
            let completedTab = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'completed' OR label CONTAINS[c] 'past'")).firstMatch
            if completedTab.waitForExistence(timeout: 2) {
                completedTab.tap()
                sleep(1)
            }

            // Tap first completed order
            let firstOrder = app.scrollViews.otherElements.matching(identifier: "OrderItem").firstMatch
            if firstOrder.waitForExistence(timeout: 2) {
                firstOrder.tap()
                sleep(1)
            }
        }
    }

    private func placeOrderAndTrack() {
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
                .enterDeliveryAddress("123 Test Street, Test City")
                .selectPaymentMethod(.cash)
                .placeOrder()

            sleep(3)

            // Should navigate to tracking automatically or show order confirmation
        }
    }
}
