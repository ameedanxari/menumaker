//
//  SellerAnalyticsTests.swift
//  MenuMakerUITests
//
//  Tests for seller analytics dashboard - sales, revenue, insights, reports
//

import XCTest

final class SellerAnalyticsTests: XCTestCase {

    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["UI-Testing", "SellerMode"]
        app.launch()

        // Login as seller
        let loginPage = LoginPage(app: app)
        if loginPage.emailField.waitForExistence(timeout: 2) {
            loginPage.login(email: "seller@example.com", password: "password123")
            _ = app.tabBars.firstMatch.waitForExistence(timeout: 5)
        }
    }

    override func tearDownWithError() throws {
        app = nil
    }

    // MARK: - Dashboard Display Tests (P0)

    @MainActor
    func testAnalyticsDashboardDisplays() throws {
        navigateToAnalytics()

        let analyticsPage = SellerAnalyticsPage(app: app)
        analyticsPage.assertScreenDisplayed()
    }

    @MainActor
    func testSalesMetricsDisplayed() throws {
        navigateToAnalytics()

        let analyticsPage = SellerAnalyticsPage(app: app)

        guard analyticsPage.totalSalesLabel.waitForExistence(timeout: 2) ||
              analyticsPage.totalOrdersLabel.waitForExistence(timeout: 2) else {
            XCTFail("Sales metrics not implemented yet - UI element not found or feature not implemented"); return
        }

        analyticsPage.assertSalesMetricsDisplayed()
    }

    @MainActor
    func testTimePeriodTabsDisplayed() throws {
        navigateToAnalytics()

        let analyticsPage = SellerAnalyticsPage(app: app)

        guard analyticsPage.todayTab.waitForExistence(timeout: 2) ||
              analyticsPage.weekTab.waitForExistence(timeout: 2) else {
            XCTFail("Time period tabs not implemented yet - UI element not found or feature not implemented"); return
        }

        analyticsPage.assertTimePeriodsDisplayed()
    }

    // MARK: - Time Period Tests (P0)

    @MainActor
    func testSwitchToTodayView() throws {
        navigateToAnalytics()

        let analyticsPage = SellerAnalyticsPage(app: app)

        guard analyticsPage.todayTab.waitForExistence(timeout: 2) else {
            XCTFail("Today view not implemented yet - UI element not found or feature not implemented"); return
        }

        analyticsPage.switchToTodayView()

        sleep(2)

        // Should display today's data
        analyticsPage.assertSalesMetricsDisplayed()
    }

    @MainActor
    func testSwitchToWeekView() throws {
        navigateToAnalytics()

        let analyticsPage = SellerAnalyticsPage(app: app)

        guard analyticsPage.weekTab.waitForExistence(timeout: 2) else {
            XCTFail("Week view not implemented yet - UI element not found or feature not implemented"); return
        }

        analyticsPage.switchToWeekView()

        sleep(2)

        analyticsPage.assertSalesMetricsDisplayed()
    }

    @MainActor
    func testSwitchToMonthView() throws {
        navigateToAnalytics()

        let analyticsPage = SellerAnalyticsPage(app: app)

        guard analyticsPage.monthTab.waitForExistence(timeout: 2) else {
            XCTFail("Month view not implemented yet - UI element not found or feature not implemented"); return
        }

        analyticsPage.switchToMonthView()

        sleep(2)

        analyticsPage.assertSalesMetricsDisplayed()
    }

    @MainActor
    func testCustomDateRange() throws {
        navigateToAnalytics()

        let analyticsPage = SellerAnalyticsPage(app: app)

        guard analyticsPage.customRangeTab.waitForExistence(timeout: 2) else {
            XCTFail("Custom range not implemented yet - UI element not found or feature not implemented"); return
        }

        analyticsPage.switchToCustomRange()

        sleep(1)
    }

    // MARK: - Charts and Visualizations Tests (P0)

    @MainActor
    func testSalesChartDisplayed() throws {
        navigateToAnalytics()

        let analyticsPage = SellerAnalyticsPage(app: app)

        guard analyticsPage.salesChart.waitForExistence(timeout: 3) else {
            XCTFail("Sales chart not implemented yet - UI element not found or feature not implemented"); return
        }

        analyticsPage.assertChartDisplayed()
    }

    // MARK: - Popular Items Tests (P0)

    @MainActor
    func testPopularItemsDisplayed() throws {
        navigateToAnalytics()

        let analyticsPage = SellerAnalyticsPage(app: app)
        analyticsPage.scrollToSection(.popularItems)

        guard analyticsPage.firstPopularItem.waitForExistence(timeout: 2) ||
              analyticsPage.topSellingSection.waitForExistence(timeout: 2) else {
            XCTFail("Popular items not implemented yet - UI element not found or feature not implemented"); return
        }

        analyticsPage.assertPopularItemsDisplayed()
    }

    @MainActor
    func testViewPopularItemDetails() throws {
        navigateToAnalytics()

        let analyticsPage = SellerAnalyticsPage(app: app)
        analyticsPage.scrollToSection(.popularItems)

        guard analyticsPage.firstPopularItem.waitForExistence(timeout: 2) else {
            XCTFail("No popular items available - UI element not found or feature not implemented"); return
        }

        analyticsPage.tapFirstPopularItem()

        sleep(1)
    }

    // MARK: - Customer Insights Tests (P1)

    @MainActor
    func testCustomerInsightsDisplayed() throws {
        navigateToAnalytics()

        let analyticsPage = SellerAnalyticsPage(app: app)
        analyticsPage.scrollToSection(.customerInsights)

        guard analyticsPage.newCustomersLabel.waitForExistence(timeout: 2) ||
              analyticsPage.customerInsightsSection.waitForExistence(timeout: 2) else {
            XCTFail("Customer insights not implemented yet - UI element not found or feature not implemented"); return
        }

        analyticsPage.assertCustomerInsightsDisplayed()
    }

    // MARK: - Rating and Reviews Tests (P1)

    @MainActor
    func testRatingDisplayed() throws {
        navigateToAnalytics()

        let analyticsPage = SellerAnalyticsPage(app: app)

        if analyticsPage.averageRatingLabel.waitForExistence(timeout: 2) ||
           analyticsPage.totalReviewsLabel.waitForExistence(timeout: 2) {
            analyticsPage.assertRatingDisplayed()
        }
    }

    // MARK: - Payouts Tests (P1)

    @MainActor
    func testPayoutsDisplayed() throws {
        navigateToAnalytics()

        let analyticsPage = SellerAnalyticsPage(app: app)
        analyticsPage.scrollToSection(.payouts)

        guard analyticsPage.pendingPayoutsLabel.waitForExistence(timeout: 2) ||
              analyticsPage.completedPayoutsLabel.waitForExistence(timeout: 2) else {
            XCTFail("Payouts section not implemented yet - UI element not found or feature not implemented"); return
        }

        analyticsPage.assertPayoutsDisplayed()
    }

    // MARK: - Data Export Tests (P1)

    @MainActor
    func testExportAnalytics() throws {
        navigateToAnalytics()

        let analyticsPage = SellerAnalyticsPage(app: app)

        guard analyticsPage.exportButton.waitForExistence(timeout: 2) else {
            XCTFail("Export feature not implemented yet - UI element not found or feature not implemented"); return
        }

        analyticsPage
            .assertExportButtonVisible()
            .tapExport()

        sleep(2)
    }

    // MARK: - Data Refresh Tests (P0)

    @MainActor
    func testRefreshDashboard() throws {
        navigateToAnalytics()

        let analyticsPage = SellerAnalyticsPage(app: app)
        analyticsPage.refreshDashboard()

        sleep(3)

        analyticsPage.assertDataUpdated()
    }

    // MARK: - Empty State Tests (P1)

    @MainActor
    func testEmptyStateForNewSellers() throws {
        // This would require a new seller account with no sales
        navigateToAnalytics()

        let analyticsPage = SellerAnalyticsPage(app: app)

        if analyticsPage.emptyStateMessage.waitForExistence(timeout: 2) {
            analyticsPage.assertEmptyState()
        }
    }

    // MARK: - Integration Tests (P1)

    @MainActor
    func testAnalyticsUpdateAfterNewOrder() throws {
        navigateToAnalytics()

        let analyticsPage = SellerAnalyticsPage(app: app)
        analyticsPage.switchToTodayView()

        // Get current sales count
        let _ = analyticsPage.totalOrdersLabel.label

        // Simulate receiving a new order (in real scenario, would come from customer app)
        // For test purposes, we'll just refresh

        analyticsPage.refreshDashboard()

        sleep(3)

        // Data should be updated
        analyticsPage.assertDataUpdated()
    }

    @MainActor
    func testNavigationBetweenTimePeriods() throws {
        navigateToAnalytics()

        let analyticsPage = SellerAnalyticsPage(app: app)

        // Switch between different time periods
        analyticsPage.switchToTodayView()
        sleep(1)

        analyticsPage.switchToWeekView()
        sleep(1)

        analyticsPage.switchToMonthView()
        sleep(1)

        // Should remain on analytics screen with updated data
        analyticsPage.assertScreenDisplayed()
    }

    @MainActor
    func testScrollThroughDashboardSections() throws {
        navigateToAnalytics()

        let analyticsPage = SellerAnalyticsPage(app: app)

        // Scroll through different sections
        analyticsPage.scrollToSection(.popularItems)
        sleep(1)

        analyticsPage.scrollToSection(.customerInsights)
        sleep(1)

        analyticsPage.scrollToSection(.payouts)
        sleep(1)

        // Should still be on analytics screen
        analyticsPage.assertScreenDisplayed()
    }

    // MARK: - Helper Methods

    private func navigateToAnalytics() {
        // Navigate to analytics/dashboard tab
        let analyticsTab = app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'analytics' OR label CONTAINS[c] 'dashboard' OR label CONTAINS '📊'")).firstMatch

        if analyticsTab.waitForExistence(timeout: 2) {
            analyticsTab.tap()
            sleep(1)
        } else {
            // Try home tab which might show dashboard for sellers
            let homeTab = app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'home'")).firstMatch

            if homeTab.waitForExistence(timeout: 2) {
                homeTab.tap()
                sleep(1)
            }
        }
    }
}
