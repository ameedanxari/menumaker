//
//  SellerAnalyticsPage.swift
//  MenuMakerUITests
//
//  Page Object for Seller Analytics/Dashboard Screen
//

import XCTest

struct SellerAnalyticsPage {
    let app: XCUIApplication

    // MARK: - Elements

    var totalSalesLabel: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS '₹' AND (label CONTAINS[c] 'total' OR label CONTAINS[c] 'sales')")).firstMatch
    }

    var totalOrdersLabel: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'order' AND label MATCHES '.*\\\\d+.*'")).firstMatch
    }

    var totalRevenueLabel: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS '₹' AND label CONTAINS[c] 'revenue'")).firstMatch
    }

    var averageOrderValueLabel: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS '₹' AND label CONTAINS[c] 'average'")).firstMatch
    }

    var todayTab: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'today'")).firstMatch
    }

    var weekTab: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'week'")).firstMatch
    }

    var monthTab: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'month'")).firstMatch
    }

    var customRangeTab: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'custom'")).firstMatch
    }

    var salesChart: XCUIElement {
        app.otherElements.matching(identifier: "SalesChart").firstMatch
    }

    var popularItemsList: XCUIElementQuery {
        app.scrollViews.otherElements.matching(identifier: "PopularItem")
    }

    var firstPopularItem: XCUIElement {
        popularItemsList.firstMatch
    }

    var topSellingSection: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'top selling' OR label CONTAINS[c] 'popular'")).firstMatch
    }

    var peakHoursSection: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'peak' OR label CONTAINS[c] 'busy'")).firstMatch
    }

    var customerInsightsSection: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'customer' OR label CONTAINS[c] 'insights'")).firstMatch
    }

    var newCustomersLabel: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'new customer' AND label MATCHES '.*\\\\d+.*'")).firstMatch
    }

    var repeatCustomersLabel: XCUIElement {
        app.staticTexs.matching(NSPredicate(format: "label CONTAINS[c] 'repeat' AND label MATCHES '.*\\\\d+.*'")).firstMatch
    }

    var averageRatingLabel: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS '★' OR (label CONTAINS[c] 'rating' AND label MATCHES '.*\\\\d+\\\\.\\\\d+.*')")).firstMatch
    }

    var totalReviewsLabel: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'review' AND label MATCHES '.*\\\\d+.*'")).firstMatch
    }

    var exportButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'export' OR label CONTAINS[c] 'download'")).firstMatch
    }

    var refreshButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'refresh'")).firstMatch
    }

    var filterButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'filter'")).firstMatch
    }

    var pendingPayoutsLabel: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS '₹' AND label CONTAINS[c] 'pending'")).firstMatch
    }

    var completedPayoutsLabel: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS '₹' AND label CONTAINS[c] 'completed'")).firstMatch
    }

    var dashboardCards: XCUIElementQuery {
        app.otherElements.matching(identifier: "DashboardCard")
    }

    var emptyStateMessage: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'no data' OR label CONTAINS[c] 'no sales'")).firstMatch
    }

    // MARK: - Actions

    @discardableResult
    func switchToTodayView() -> SellerAnalyticsPage {
        if todayTab.waitForExistence(timeout: 2) {
            todayTab.tap()
            sleep(1)
        }
        return self
    }

    @discardableResult
    func switchToWeekView() -> SellerAnalyticsPage {
        if weekTab.waitForExistence(timeout: 2) {
            weekTab.tap()
            sleep(1)
        }
        return self
    }

    @discardableResult
    func switchToMonthView() -> SellerAnalyticsPage {
        if monthTab.waitForExistence(timeout: 2) {
            monthTab.tap()
            sleep(1)
        }
        return self
    }

    @discardableResult
    func switchToCustomRange() -> SellerAnalyticsPage {
        if customRangeTab.waitForExistence(timeout: 2) {
            customRangeTab.tap()
            sleep(1)
        }
        return self
    }

    @discardableResult
    func tapFirstPopularItem() -> SellerAnalyticsPage {
        if firstPopularItem.waitForExistence(timeout: 2) {
            firstPopularItem.tap()
            sleep(1)
        }
        return self
    }

    @discardableResult
    func tapExport() -> SellerAnalyticsPage {
        if exportButton.waitForExistence(timeout: 2) {
            exportButton.tap()
            sleep(1)

            // Handle export options if sheet appears
            let csvOption = app.buttons["CSV"]
            let pdfOption = app.buttons["PDF"]

            if csvOption.waitForExistence(timeout: 1) {
                csvOption.tap()
            } else if pdfOption.waitForExistence(timeout: 1) {
                pdfOption.tap()
            }
        }
        return self
    }

    @discardableResult
    func refreshDashboard() -> SellerAnalyticsPage {
        if refreshButton.waitForExistence(timeout: 1) {
            refreshButton.tap()
        } else {
            // Try pull to refresh
            let scrollView = app.scrollViews.firstMatch
            if scrollView.exists {
                let start = scrollView.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.2))
                let end = scrollView.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.8))
                start.press(forDuration: 0, thenDragTo: end)
            }
        }
        sleep(2)
        return self
    }

    @discardableResult
    func scrollToSection(_ section: AnalyticsSection) -> SellerAnalyticsPage {
        let scrollView = app.scrollViews.firstMatch
        if scrollView.exists {
            switch section {
            case .popularItems:
                scrollView.swipeUp()
            case .peakHours:
                scrollView.swipeUp()
                scrollView.swipeUp()
            case .customerInsights:
                scrollView.swipeUp()
                scrollView.swipeUp()
                scrollView.swipeUp()
            case .payouts:
                scrollView.swipeUp()
                scrollView.swipeUp()
                scrollView.swipeUp()
                scrollView.swipeUp()
            }
        }
        return self
    }

    @discardableResult
    func tapFilter() -> SellerAnalyticsPage {
        if filterButton.waitForExistence(timeout: 2) {
            filterButton.tap()
            sleep(1)
        }
        return self
    }

    // MARK: - Assertions

    @discardableResult
    func assertScreenDisplayed(timeout: TimeInterval = 2) -> SellerAnalyticsPage {
        XCTAssertTrue(totalSalesLabel.waitForExistence(timeout: timeout) ||
                     totalOrdersLabel.waitForExistence(timeout: timeout) ||
                     salesChart.waitForExistence(timeout: timeout) ||
                     dashboardCards.count > 0,
                     "Analytics dashboard should be displayed")
        return self
    }

    @discardableResult
    func assertSalesMetricsDisplayed() -> SellerAnalyticsPage {
        XCTAssertTrue(totalSalesLabel.exists ||
                     totalOrdersLabel.exists ||
                     totalRevenueLabel.exists,
                     "Sales metrics should be displayed")
        return self
    }

    @discardableResult
    func assertChartDisplayed() -> SellerAnalyticsPage {
        XCTAssertTrue(salesChart.exists, "Sales chart should be displayed")
        return self
    }

    @discardableResult
    func assertTimePeriodsDisplayed() -> SellerAnalyticsPage {
        XCTAssertTrue(todayTab.exists ||
                     weekTab.exists ||
                     monthTab.exists,
                     "Time period tabs should be displayed")
        return self
    }

    @discardableResult
    func assertPopularItemsDisplayed() -> SellerAnalyticsPage {
        XCTAssertTrue(firstPopularItem.exists ||
                     topSellingSection.exists,
                     "Popular items section should be displayed")
        return self
    }

    @discardableResult
    func assertCustomerInsightsDisplayed() -> SellerAnalyticsPage {
        XCTAssertTrue(newCustomersLabel.exists ||
                     repeatCustomersLabel.exists ||
                     customerInsightsSection.exists,
                     "Customer insights should be displayed")
        return self
    }

    @discardableResult
    func assertRatingDisplayed() -> SellerAnalyticsPage {
        XCTAssertTrue(averageRatingLabel.exists ||
                     totalReviewsLabel.exists,
                     "Rating information should be displayed")
        return self
    }

    @discardableResult
    func assertPayoutsDisplayed() -> SellerAnalyticsPage {
        XCTAssertTrue(pendingPayoutsLabel.exists ||
                     completedPayoutsLabel.exists,
                     "Payout information should be displayed")
        return self
    }

    @discardableResult
    func assertExportButtonVisible() -> SellerAnalyticsPage {
        XCTAssertTrue(exportButton.exists, "Export button should be visible")
        return self
    }

    @discardableResult
    func assertEmptyState() -> SellerAnalyticsPage {
        XCTAssertTrue(emptyStateMessage.exists, "Empty state should be displayed")
        return self
    }

    @discardableResult
    func assertDataUpdated() -> SellerAnalyticsPage {
        // After refresh, data should be displayed
        XCTAssertTrue(totalSalesLabel.exists ||
                     totalOrdersLabel.exists,
                     "Data should be updated")
        return self
    }

    // MARK: - Types

    enum AnalyticsSection {
        case popularItems
        case peakHours
        case customerInsights
        case payouts
    }
}
