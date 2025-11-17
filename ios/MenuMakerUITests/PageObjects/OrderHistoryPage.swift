//
//  OrderHistoryPage.swift
//  MenuMakerUITests
//
//  Page Object for Order History Screen
//

import XCTest

struct OrderHistoryPage {
    let app: XCUIApplication

    // MARK: - Elements

    var ordersList: XCUIElementQuery {
        app.scrollViews.otherElements.matching(identifier: "OrderItem")
    }

    var firstOrder: XCUIElement {
        ordersList.firstMatch
    }

    var emptyStateMessage: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'no order'")).firstMatch
    }

    var activeTab: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'active' OR label CONTAINS[c] 'ongoing'")).firstMatch
    }

    var completedTab: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'completed' OR label CONTAINS[c] 'past'")).firstMatch
    }

    var cancelledTab: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'cancelled'")).firstMatch
    }

    var filterButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'filter'")).firstMatch
    }

    var searchBar: XCUIElement {
        app.searchFields.firstMatch
    }

    var reorderButtons: XCUIElementQuery {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'reorder' OR label CONTAINS[c] 'order again'"))
    }

    var trackButtons: XCUIElementQuery {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'track'"))
    }

    var viewDetailsButtons: XCUIElementQuery {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'detail' OR label CONTAINS[c] 'view'"))
    }

    var orderIdLabels: XCUIElementQuery {
        app.staticTexts.matching(NSPredicate(format: "label MATCHES '.*#[A-Z0-9]{6,12}.*'"))
    }

    var orderDateLabels: XCUIElementQuery {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'jan' OR label CONTAINS[c] 'feb' OR label CONTAINS[c] 'mar' OR label CONTAINS[c] 'apr' OR label CONTAINS[c] 'may' OR label CONTAINS[c] 'jun' OR label CONTAINS[c] 'today' OR label CONTAINS[c] 'yesterday'"))
    }

    var orderTotalLabels: XCUIElementQuery {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS '₹'"))
    }

    var helpButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'help' OR label CONTAINS[c] 'support'")).firstMatch
    }

    // Date range filter elements
    var dateRangeButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'date' OR label CONTAINS[c] 'range'")).firstMatch
    }

    var last7DaysButton: XCUIElement {
        app.buttons["Last 7 Days"]
    }

    var last30DaysButton: XCUIElement {
        app.buttons["Last 30 Days"]
    }

    var last3MonthsButton: XCUIElement {
        app.buttons["Last 3 Months"]
    }

    // MARK: - Actions

    @discardableResult
    func tapFirstOrder() -> OrderHistoryPage {
        firstOrder.tap()
        sleep(1)
        return self
    }

    @discardableResult
    func tapOrder(at index: Int) -> OrderHistoryPage {
        let order = ordersList.element(boundBy: index)
        if order.waitForExistence(timeout: 2) {
            order.tap()
            sleep(1)
        }
        return self
    }

    @discardableResult
    func switchToActiveOrders() -> OrderHistoryPage {
        if activeTab.waitForExistence(timeout: 2) {
            activeTab.tap()
            sleep(1)
        }
        return self
    }

    @discardableResult
    func switchToCompletedOrders() -> OrderHistoryPage {
        if completedTab.waitForExistence(timeout: 2) {
            completedTab.tap()
            sleep(1)
        }
        return self
    }

    @discardableResult
    func switchToCancelledOrders() -> OrderHistoryPage {
        if cancelledTab.waitForExistence(timeout: 2) {
            cancelledTab.tap()
            sleep(1)
        }
        return self
    }

    @discardableResult
    func reorderFirst() -> OrderHistoryPage {
        let reorderButton = reorderButtons.firstMatch
        if reorderButton.waitForExistence(timeout: 2) {
            reorderButton.tap()
            sleep(1)
        }
        return self
    }

    @discardableResult
    func trackFirstOrder() -> OrderHistoryPage {
        let trackButton = trackButtons.firstMatch
        if trackButton.waitForExistence(timeout: 2) {
            trackButton.tap()
            sleep(1)
        }
        return self
    }

    @discardableResult
    func searchOrders(_ query: String) -> OrderHistoryPage {
        if searchBar.waitForExistence(timeout: 1) {
            searchBar.tap()
            searchBar.typeText(query)
            sleep(1)
        }
        return self
    }

    @discardableResult
    func tapFilter() -> OrderHistoryPage {
        filterButton.tap()
        sleep(1)
        return self
    }

    @discardableResult
    func filterByDateRange(_ range: DateRange) -> OrderHistoryPage {
        tapFilter()

        switch range {
        case .last7Days:
            if last7DaysButton.waitForExistence(timeout: 1) {
                last7DaysButton.tap()
            }
        case .last30Days:
            if last30DaysButton.waitForExistence(timeout: 1) {
                last30DaysButton.tap()
            }
        case .last3Months:
            if last3MonthsButton.waitForExistence(timeout: 1) {
                last3MonthsButton.tap()
            }
        }

        sleep(1)
        return self
    }

    @discardableResult
    func pullToRefresh() -> OrderHistoryPage {
        let scrollView = app.scrollViews.firstMatch
        if scrollView.exists {
            let start = scrollView.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.2))
            let end = scrollView.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.8))
            start.press(forDuration: 0, thenDragTo: end)
            sleep(1)
        }
        return self
    }

    @discardableResult
    func tapHelp() -> OrderHistoryPage {
        if helpButton.waitForExistence(timeout: 1) {
            helpButton.tap()
            sleep(1)
        }
        return self
    }

    // MARK: - Assertions

    @discardableResult
    func assertScreenDisplayed(timeout: TimeInterval = 2) -> OrderHistoryPage {
        XCTAssertTrue(firstOrder.waitForExistence(timeout: timeout) ||
                     emptyStateMessage.waitForExistence(timeout: timeout) ||
                     activeTab.waitForExistence(timeout: timeout),
                     "Order history screen should be displayed")
        return self
    }

    @discardableResult
    func assertOrdersDisplayed() -> OrderHistoryPage {
        XCTAssertTrue(firstOrder.exists, "Orders should be displayed")
        return self
    }

    @discardableResult
    func assertEmptyState() -> OrderHistoryPage {
        XCTAssertTrue(emptyStateMessage.exists, "Empty state should be displayed")
        return self
    }

    @discardableResult
    func assertOrderCount(_ expectedCount: Int) -> OrderHistoryPage {
        let actualCount = ordersList.count
        XCTAssertEqual(actualCount, expectedCount,
                      "Should have \(expectedCount) orders, found \(actualCount)")
        return self
    }

    @discardableResult
    func assertTabsDisplayed() -> OrderHistoryPage {
        XCTAssertTrue(activeTab.exists || completedTab.exists,
                     "Order tabs should be displayed")
        return self
    }

    @discardableResult
    func assertReorderButtonVisible() -> OrderHistoryPage {
        XCTAssertTrue(reorderButtons.firstMatch.exists,
                     "Reorder button should be visible")
        return self
    }

    @discardableResult
    func assertTrackButtonVisible() -> OrderHistoryPage {
        XCTAssertTrue(trackButtons.firstMatch.exists,
                     "Track button should be visible")
        return self
    }

    @discardableResult
    func assertOrderDetailsDisplayed() -> OrderHistoryPage {
        XCTAssertTrue(orderIdLabels.count > 0 ||
                     orderDateLabels.count > 0 ||
                     orderTotalLabels.count > 0,
                     "Order details should be displayed")
        return self
    }

    // MARK: - Types

    enum DateRange {
        case last7Days
        case last30Days
        case last3Months
    }
}
