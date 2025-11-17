//
//  SellerOrdersPage.swift
//  MenuMakerUITests
//
//  Page Object for Seller Orders Management Screen
//

import XCTest

struct SellerOrdersPage {
    let app: XCUIApplication

    // MARK: - Elements

    var orderCards: XCUIElementQuery {
        app.scrollViews.otherElements.matching(identifier: "OrderCard")
    }

    var firstOrder: XCUIElement {
        orderCards.firstMatch
    }

    var newOrdersTab: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'new' OR label CONTAINS[c] 'pending'")).firstMatch
    }

    var activeOrdersTab: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'active' OR label CONTAINS[c] 'preparing'")).firstMatch
    }

    var completedOrdersTab: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'completed' OR label CONTAINS[c] 'history'")).firstMatch
    }

    // Order detail elements
    var acceptButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'accept'")).firstMatch
    }

    var rejectButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'reject'")).firstMatch
    }

    var markPreparingButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'preparing' OR label CONTAINS[c] 'start'")).firstMatch
    }

    var markReadyButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'ready' OR label CONTAINS[c] 'complete'")).firstMatch
    }

    var orderIdLabel: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label MATCHES '#\\\\d+'")).firstMatch
    }

    var customerNameLabel: XCUIElement {
        app.staticTexts.matching(identifier: "CustomerName").firstMatch
    }

    var orderTotalLabel: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS '₹'")).firstMatch
    }

    var emptyStateMessage: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'no orders' OR label CONTAINS[c] 'no new orders'")).firstMatch
    }

    var rejectionReasonField: XCUIElement {
        app.textViews.matching(NSPredicate(format: "placeholderValue CONTAINS[c] 'reason'")).firstMatch
    }

    var confirmRejectButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label == 'Reject' OR label == 'Confirm'")).firstMatch
    }

    // MARK: - Actions

    @discardableResult
    func tapFirstOrder() -> SellerOrdersPage {
        firstOrder.tap()
        sleep(1)
        return self
    }

    @discardableResult
    func switchToNewOrders() -> SellerOrdersPage {
        if newOrdersTab.exists {
            newOrdersTab.tap()
            sleep(1)
        }
        return self
    }

    @discardableResult
    func switchToActiveOrders() -> SellerOrdersPage {
        if activeOrdersTab.exists {
            activeOrdersTab.tap()
            sleep(1)
        }
        return self
    }

    @discardableResult
    func switchToCompletedOrders() -> SellerOrdersPage {
        if completedOrdersTab.exists {
            completedOrdersTab.tap()
            sleep(1)
        }
        return self
    }

    @discardableResult
    func acceptOrder() -> SellerOrdersPage {
        acceptButton.tap()
        sleep(1)
        return self
    }

    @discardableResult
    func rejectOrder(reason: String? = nil) -> SellerOrdersPage {
        rejectButton.tap()

        if let reason = reason, rejectionReasonField.waitForExistence(timeout: 1) {
            rejectionReasonField.tap()
            rejectionReasonField.typeText(reason)
        }

        if confirmRejectButton.waitForExistence(timeout: 1) {
            confirmRejectButton.tap()
        }

        sleep(1)
        return self
    }

    @discardableResult
    func markAsPreparing() -> SellerOrdersPage {
        markPreparingButton.tap()
        sleep(1)
        return self
    }

    @discardableResult
    func markAsReady() -> SellerOrdersPage {
        markReadyButton.tap()
        sleep(1)
        return self
    }

    @discardableResult
    func pullToRefresh() -> SellerOrdersPage {
        let firstCell = app.scrollViews.firstMatch
        let start = firstCell.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.2))
        let end = firstCell.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.8))
        start.press(forDuration: 0, thenDragTo: end)
        sleep(2)
        return self
    }

    // MARK: - Assertions

    @discardableResult
    func assertScreenDisplayed(timeout: TimeInterval = 2) -> SellerOrdersPage {
        XCTAssertTrue(orderCards.firstMatch.waitForExistence(timeout: timeout) ||
                     emptyStateMessage.waitForExistence(timeout: timeout),
                     "Orders screen should be displayed")
        return self
    }

    @discardableResult
    func assertOrdersDisplayed() -> SellerOrdersPage {
        XCTAssertTrue(firstOrder.exists, "Orders should be displayed")
        return self
    }

    @discardableResult
    func assertEmptyState() -> SellerOrdersPage {
        XCTAssertTrue(emptyStateMessage.exists, "Empty state should be displayed")
        return self
    }

    @discardableResult
    func assertOrderCount(_ expectedCount: Int) -> SellerOrdersPage {
        let actualCount = orderCards.count
        XCTAssertEqual(actualCount, expectedCount, "Should have \(expectedCount) orders, found \(actualCount)")
        return self
    }

    @discardableResult
    func assertOrderDetailDisplayed(timeout: TimeInterval = 2) -> SellerOrdersPage {
        XCTAssertTrue(orderIdLabel.waitForExistence(timeout: timeout) ||
                     orderTotalLabel.waitForExistence(timeout: timeout),
                     "Order detail should be displayed")
        return self
    }

    @discardableResult
    func assertAcceptButtonVisible() -> SellerOrdersPage {
        XCTAssertTrue(acceptButton.exists, "Accept button should be visible")
        return self
    }

    @discardableResult
    func assertMarkPreparingButtonVisible() -> SellerOrdersPage {
        XCTAssertTrue(markPreparingButton.exists, "Mark preparing button should be visible")
        return self
    }

    @discardableResult
    func assertMarkReadyButtonVisible() -> SellerOrdersPage {
        XCTAssertTrue(markReadyButton.exists, "Mark ready button should be visible")
        return self
    }
}
