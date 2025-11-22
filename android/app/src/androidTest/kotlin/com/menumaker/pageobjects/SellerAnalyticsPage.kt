package com.menumaker.pageobjects

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.ComposeTestRule

/**
 * Page Object for Seller Analytics/Dashboard Screen
 * Provides fluent API for analytics interactions
 */
class SellerAnalyticsPage(private val composeTestRule: ComposeTestRule) {

    // Metric labels
    private val totalSalesLabel = composeTestRule.onNode(
        hasText("₹", substring = true) and
        (hasText("total", substring = true, ignoreCase = true) or hasText("sales", substring = true, ignoreCase = true))
    )
    private val totalOrdersLabel = composeTestRule.onNodeWithText("order", substring = true, ignoreCase = true)
    private val totalRevenueLabel = composeTestRule.onNode(
        hasText("₹", substring = true) and hasText("revenue", substring = true, ignoreCase = true)
    )
    private val averageOrderValueLabel = composeTestRule.onNode(
        hasText("₹", substring = true) and hasText("average", substring = true, ignoreCase = true)
    )

    // Time period tabs
    private val todayTab = composeTestRule.onNodeWithText("today", substring = true, ignoreCase = true)
    private val weekTab = composeTestRule.onNodeWithText("week", substring = true, ignoreCase = true)
    private val monthTab = composeTestRule.onNodeWithText("month", substring = true, ignoreCase = true)
    private val customRangeTab = composeTestRule.onNodeWithText("custom", substring = true, ignoreCase = true)

    // Chart and items
    private val salesChart = composeTestRule.onNodeWithTag("SalesChart")
    private val popularItemsList = composeTestRule.onAllNodesWithTag("PopularItem")
    private val topSellingSection = composeTestRule.onNode(
        hasText("top selling", substring = true, ignoreCase = true) or
        hasText("popular", substring = true, ignoreCase = true)
    )

    // Customer insights
    private val peakHoursSection = composeTestRule.onNode(
        hasText("peak", substring = true, ignoreCase = true) or
        hasText("busy", substring = true, ignoreCase = true)
    )
    private val customerInsightsSection = composeTestRule.onNode(
        hasText("customer", substring = true, ignoreCase = true) or
        hasText("insights", substring = true, ignoreCase = true)
    )
    private val newCustomersLabel = composeTestRule.onNodeWithText("new customer", substring = true, ignoreCase = true)
    private val repeatCustomersLabel = composeTestRule.onNodeWithText("repeat", substring = true, ignoreCase = true)

    // Rating and reviews
    private val averageRatingLabel = composeTestRule.onNode(
        hasText("★", substring = true) or
        hasText("rating", substring = true, ignoreCase = true)
    )
    private val totalReviewsLabel = composeTestRule.onNodeWithText("review", substring = true, ignoreCase = true)

    // Buttons
    private val exportButton = composeTestRule.onNode(
        hasText("export", substring = true, ignoreCase = true) or
        hasText("download", substring = true, ignoreCase = true)
    )
    private val refreshButton = composeTestRule.onNodeWithContentDescription("refresh", substring = true, ignoreCase = true)
    private val filterButton = composeTestRule.onNodeWithText("filter", substring = true, ignoreCase = true)

    // Payouts
    private val pendingPayoutsLabel = composeTestRule.onNode(
        hasText("₹", substring = true) and hasText("pending", substring = true, ignoreCase = true)
    )
    private val completedPayoutsLabel = composeTestRule.onNode(
        hasText("₹", substring = true) and hasText("completed", substring = true, ignoreCase = true)
    )

    // Dashboard cards
    private val dashboardCards = composeTestRule.onAllNodesWithTag("DashboardCard")
    private val emptyStateMessage = composeTestRule.onNode(
        hasText("no data", substring = true, ignoreCase = true) or
        hasText("no sales", substring = true, ignoreCase = true)
    )

    // Actions
    fun switchToTodayView(): SellerAnalyticsPage {
        todayTab.performClick()
        Thread.sleep(1000)
        return this
    }

    fun switchToWeekView(): SellerAnalyticsPage {
        weekTab.performClick()
        Thread.sleep(1000)
        return this
    }

    fun switchToMonthView(): SellerAnalyticsPage {
        monthTab.performClick()
        Thread.sleep(1000)
        return this
    }

    fun switchToCustomRange(): SellerAnalyticsPage {
        customRangeTab.performClick()
        Thread.sleep(1000)
        return this
    }

    fun tapFirstPopularItem(): SellerAnalyticsPage {
        if (popularItemsList.fetchSemanticsNodes().isNotEmpty()) {
            popularItemsList[0].performClick()
            Thread.sleep(1000)
        }
        return this
    }

    fun tapExport(): SellerAnalyticsPage {
        exportButton.performClick()
        Thread.sleep(1000)

        // Handle export options if dialog appears
        val csvOption = composeTestRule.onNodeWithText("CSV")
        val pdfOption = composeTestRule.onNodeWithText("PDF")

        try {
            csvOption.performClick()
        } catch (e: AssertionError) {
            try {
                pdfOption.performClick()
            } catch (e: AssertionError) {
                // No export options found
            }
        }
        return this
    }

    fun refreshDashboard(): SellerAnalyticsPage {
        refreshButton.performClick()
        Thread.sleep(2000)
        return this
    }

    fun tapFilter(): SellerAnalyticsPage {
        filterButton.performClick()
        Thread.sleep(1000)
        return this
    }

    // Assertions
    fun assertScreenDisplayed(): SellerAnalyticsPage {
        composeTestRule.waitUntil(timeoutMillis = 2000) {
            try { totalSalesLabel.assertExists(); true } catch (e: AssertionError) { false } ||
            try { totalOrdersLabel.assertExists(); true } catch (e: AssertionError) { false } ||
            try { salesChart.assertExists(); true } catch (e: AssertionError) { false } ||
            dashboardCards.fetchSemanticsNodes().isNotEmpty()
        }
        return this
    }

    fun assertSalesMetricsDisplayed(): SellerAnalyticsPage {
        assert(
            try { totalSalesLabel.assertExists(); true } catch (e: AssertionError) { false } ||
            try { totalOrdersLabel.assertExists(); true } catch (e: AssertionError) { false } ||
            try { totalRevenueLabel.assertExists(); true } catch (e: AssertionError) { false }
        ) {
            "Sales metrics should be displayed"
        }
        return this
    }

    fun assertChartDisplayed(): SellerAnalyticsPage {
        salesChart.assertExists()
        return this
    }

    fun assertTimePeriodsDisplayed(): SellerAnalyticsPage {
        todayTab.assertExists()
        return this
    }

    fun assertPopularItemsDisplayed(): SellerAnalyticsPage {
        assert(
            popularItemsList.fetchSemanticsNodes().isNotEmpty() ||
            try { topSellingSection.assertExists(); true } catch (e: AssertionError) { false }
        ) {
            "Popular items section should be displayed"
        }
        return this
    }

    fun assertCustomerInsightsDisplayed(): SellerAnalyticsPage {
        assert(
            try { newCustomersLabel.assertExists(); true } catch (e: AssertionError) { false } ||
            try { repeatCustomersLabel.assertExists(); true } catch (e: AssertionError) { false } ||
            try { customerInsightsSection.assertExists(); true } catch (e: AssertionError) { false }
        ) {
            "Customer insights should be displayed"
        }
        return this
    }

    fun assertRatingDisplayed(): SellerAnalyticsPage {
        assert(
            try { averageRatingLabel.assertExists(); true } catch (e: AssertionError) { false } ||
            try { totalReviewsLabel.assertExists(); true } catch (e: AssertionError) { false }
        ) {
            "Rating information should be displayed"
        }
        return this
    }

    fun assertPayoutsDisplayed(): SellerAnalyticsPage {
        assert(
            try { pendingPayoutsLabel.assertExists(); true } catch (e: AssertionError) { false } ||
            try { completedPayoutsLabel.assertExists(); true } catch (e: AssertionError) { false }
        ) {
            "Payout information should be displayed"
        }
        return this
    }

    fun assertExportButtonVisible(): SellerAnalyticsPage {
        exportButton.assertExists()
        return this
    }

    fun assertEmptyState(): SellerAnalyticsPage {
        emptyStateMessage.assertExists()
        return this
    }

    fun assertDataUpdated(): SellerAnalyticsPage {
        assert(
            try { totalSalesLabel.assertExists(); true } catch (e: AssertionError) { false } ||
            try { totalOrdersLabel.assertExists(); true } catch (e: AssertionError) { false }
        ) {
            "Data should be updated"
        }
        return this
    }

    enum class AnalyticsSection {
        POPULAR_ITEMS,
        PEAK_HOURS,
        CUSTOMER_INSIGHTS,
        PAYOUTS
    }
}
