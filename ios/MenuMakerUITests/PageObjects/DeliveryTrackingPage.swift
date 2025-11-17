//
//  DeliveryTrackingPage.swift
//  MenuMakerUITests
//
//  Page Object for Delivery Tracking Screen
//

import XCTest

struct DeliveryTrackingPage {
    let app: XCUIApplication

    // MARK: - Elements

    var orderStatusLabel: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'preparing' OR label CONTAINS[c] 'ready' OR label CONTAINS[c] 'picked up' OR label CONTAINS[c] 'delivered'")).firstMatch
    }

    var estimatedTimeLabel: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'estimate' OR label CONTAINS[c] 'arrive' OR label CONTAINS 'min'")).firstMatch
    }

    var deliveryPersonNameLabel: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "identifier CONTAINS 'deliveryPerson'")).firstMatch
    }

    var deliveryPersonPhoneButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'call' OR label CONTAINS '📞'")).firstMatch
    }

    var whatsappButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'whatsapp' OR label CONTAINS[c] 'message'")).firstMatch
    }

    var mapView: XCUIElement {
        app.maps.firstMatch
    }

    var deliveryLocationMarker: XCUIElement {
        app.otherElements.matching(identifier: "DeliveryMarker").firstMatch
    }

    var trackingSteps: XCUIElementQuery {
        app.otherElements.matching(identifier: "TrackingStep")
    }

    var orderPlacedStep: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'order placed'")).firstMatch
    }

    var confirmStep: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'confirmed' OR label CONTAINS[c] 'accepted'")).firstMatch
    }

    var preparingStep: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'preparing'")).firstMatch
    }

    var readyStep: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'ready' OR label CONTAINS[c] 'pickup'")).firstMatch
    }

    var outForDeliveryStep: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'out for delivery' OR label CONTAINS[c] 'on the way'")).firstMatch
    }

    var deliveredStep: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'delivered'")).firstMatch
    }

    var refreshButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'refresh'")).firstMatch
    }

    var backButton: XCUIElement {
        app.navigationBars.buttons.firstMatch
    }

    var orderIdLabel: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label MATCHES '.*#[A-Z0-9]{6,12}.*'")).firstMatch
    }

    var orderItemsList: XCUIElementQuery {
        app.scrollViews.otherElements.matching(identifier: "OrderItem")
    }

    var totalAmountLabel: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS '₹' AND label CONTAINS[c] 'total'")).firstMatch
    }

    var deliveryAddressLabel: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'deliver to' OR identifier CONTAINS 'address'")).firstMatch
    }

    var rateOrderButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'rate' OR label CONTAINS[c] 'review'")).firstMatch
    }

    var cancelOrderButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'cancel order'")).firstMatch
    }

    var confirmCancelButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'confirm' OR label CONTAINS[c] 'yes'")).firstMatch
    }

    var liveTrackingIndicator: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'live' OR label CONTAINS '🔴'")).firstMatch
    }

    // MARK: - Actions

    @discardableResult
    func tapCallDeliveryPerson() -> DeliveryTrackingPage {
        if deliveryPersonPhoneButton.waitForExistence(timeout: 2) {
            deliveryPersonPhoneButton.tap()
            sleep(1)

            // Cancel the call dialog
            let cancelButton = app.buttons["Cancel"]
            if cancelButton.waitForExistence(timeout: 1) {
                cancelButton.tap()
            }
        }
        return self
    }

    @discardableResult
    func tapWhatsAppDeliveryPerson() -> DeliveryTrackingPage {
        if whatsappButton.waitForExistence(timeout: 2) {
            whatsappButton.tap()
            sleep(1)

            // Handle WhatsApp opening (may need to return to app)
            app.activate()
        }
        return self
    }

    @discardableResult
    func tapRefresh() -> DeliveryTrackingPage {
        if refreshButton.waitForExistence(timeout: 1) {
            refreshButton.tap()
            sleep(1)
        } else {
            // Try pull-to-refresh
            let scrollView = app.scrollViews.firstMatch
            if scrollView.exists {
                let start = scrollView.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.2))
                let end = scrollView.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.8))
                start.press(forDuration: 0, thenDragTo: end)
            }
        }
        return self
    }

    @discardableResult
    func tapRateOrder() -> DeliveryTrackingPage {
        if rateOrderButton.waitForExistence(timeout: 2) {
            rateOrderButton.tap()
            sleep(1)
        }
        return self
    }

    @discardableResult
    func tapCancelOrder() -> DeliveryTrackingPage {
        cancelOrderButton.tap()
        sleep(1)

        if confirmCancelButton.waitForExistence(timeout: 2) {
            confirmCancelButton.tap()
            sleep(1)
        }

        return self
    }

    @discardableResult
    func goBack() -> DeliveryTrackingPage {
        backButton.tap()
        return self
    }

    @discardableResult
    func scrollToOrderDetails() -> DeliveryTrackingPage {
        let scrollView = app.scrollViews.firstMatch
        if scrollView.exists {
            scrollView.swipeUp()
        }
        return self
    }

    @discardableResult
    func zoomInMap() -> DeliveryTrackingPage {
        if mapView.waitForExistence(timeout: 2) {
            // Pinch to zoom in
            let start1 = mapView.coordinate(withNormalizedOffset: CGVector(dx: 0.4, dy: 0.5))
            let _ = mapView.coordinate(withNormalizedOffset: CGVector(dx: 0.6, dy: 0.5))
            let end1 = mapView.coordinate(withNormalizedOffset: CGVector(dx: 0.2, dy: 0.5))
            let _ = mapView.coordinate(withNormalizedOffset: CGVector(dx: 0.8, dy: 0.5))

            start1.press(forDuration: 0.1, thenDragTo: end1)
        }
        return self
    }

    // MARK: - Assertions

    @discardableResult
    func assertScreenDisplayed(timeout: TimeInterval = 2) -> DeliveryTrackingPage {
        XCTAssertTrue(orderStatusLabel.waitForExistence(timeout: timeout) ||
                     orderIdLabel.waitForExistence(timeout: timeout) ||
                     trackingSteps.count > 0,
                     "Delivery tracking screen should be displayed")
        return self
    }

    @discardableResult
    func assertOrderStatus(_ status: OrderStatus) -> DeliveryTrackingPage {
        let statusText: String
        switch status {
        case .placed:
            statusText = "placed"
        case .confirmed:
            statusText = "confirmed"
        case .preparing:
            statusText = "preparing"
        case .ready:
            statusText = "ready"
        case .outForDelivery:
            statusText = "delivery"
        case .delivered:
            statusText = "delivered"
        }

        XCTAssertTrue(orderStatusLabel.label.lowercased().contains(statusText),
                     "Order status should show '\(statusText)'")
        return self
    }

    @discardableResult
    func assertEstimatedTimeDisplayed() -> DeliveryTrackingPage {
        XCTAssertTrue(estimatedTimeLabel.exists, "Estimated delivery time should be displayed")
        return self
    }

    @discardableResult
    func assertDeliveryPersonInfoDisplayed() -> DeliveryTrackingPage {
        XCTAssertTrue(deliveryPersonNameLabel.exists ||
                     deliveryPersonPhoneButton.exists,
                     "Delivery person info should be displayed")
        return self
    }

    @discardableResult
    func assertMapDisplayed() -> DeliveryTrackingPage {
        XCTAssertTrue(mapView.waitForExistence(timeout: 3), "Map should be displayed")
        return self
    }

    @discardableResult
    func assertTrackingStepsDisplayed() -> DeliveryTrackingPage {
        XCTAssertGreaterThan(trackingSteps.count, 0, "Tracking steps should be displayed")
        return self
    }

    @discardableResult
    func assertLiveTrackingActive() -> DeliveryTrackingPage {
        XCTAssertTrue(liveTrackingIndicator.exists ||
                     mapView.exists,
                     "Live tracking should be active")
        return self
    }

    @discardableResult
    func assertWhatsAppButtonVisible() -> DeliveryTrackingPage {
        XCTAssertTrue(whatsappButton.exists, "WhatsApp button should be visible")
        return self
    }

    @discardableResult
    func assertCallButtonVisible() -> DeliveryTrackingPage {
        XCTAssertTrue(deliveryPersonPhoneButton.exists, "Call button should be visible")
        return self
    }

    @discardableResult
    func assertOrderDetailsDisplayed() -> DeliveryTrackingPage {
        XCTAssertTrue(orderIdLabel.exists || orderItemsList.count > 0 || totalAmountLabel.exists,
                     "Order details should be displayed")
        return self
    }

    @discardableResult
    func assertDeliveryAddressDisplayed() -> DeliveryTrackingPage {
        XCTAssertTrue(deliveryAddressLabel.exists, "Delivery address should be displayed")
        return self
    }

    @discardableResult
    func assertRateOrderButtonVisible() -> DeliveryTrackingPage {
        XCTAssertTrue(rateOrderButton.exists, "Rate order button should be visible")
        return self
    }

    @discardableResult
    func assertCancelOrderButtonVisible() -> DeliveryTrackingPage {
        XCTAssertTrue(cancelOrderButton.exists, "Cancel order button should be visible")
        return self
    }

    // MARK: - Types

    enum OrderStatus {
        case placed
        case confirmed
        case preparing
        case ready
        case outForDelivery
        case delivered
    }
}
