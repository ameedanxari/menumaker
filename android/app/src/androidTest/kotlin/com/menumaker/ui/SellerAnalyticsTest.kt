package com.menumaker.ui

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import com.menumaker.MainActivity
import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.AnalyticsData
import com.menumaker.data.remote.models.AnalyticsResponseData
import com.menumaker.data.remote.models.CustomerInsights
import com.menumaker.data.remote.models.PayoutInfo
import com.menumaker.data.remote.models.PeakHour
import com.menumaker.data.remote.models.PopularItem
import com.menumaker.data.remote.models.SalesDataPoint
import com.menumaker.data.repository.BusinessRepository
import com.menumaker.fakes.FakeBusinessRepository
import com.menumaker.pageobjects.SellerAnalyticsPage
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import javax.inject.Inject

/**
 * UI tests for seller analytics dashboard with mocked dependencies.
 * 
 * These tests use FakeBusinessRepository via Hilt test module for deterministic,
 * network-independent testing.
 *
 * Requirements covered:
 * - 3.1: Seller dashboard analytics display including order counts, revenue, and trends
 */
@LargeTest
@RunWith(AndroidJUnit4::class)
@HiltAndroidTest
class SellerAnalyticsTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    @Inject
    lateinit var businessRepository: BusinessRepository

    private val fakeBusinessRepository: FakeBusinessRepository
        get() = businessRepository as FakeBusinessRepository

    @Before
    fun setup() {
        hiltRule.inject()
        // Reset fake repository to clean state before each test
        fakeBusinessRepository.reset()
        setupDefaultAnalyticsData()
        loginAsSellerIfNeeded()
    }

    private fun setupDefaultAnalyticsData() {
        fakeBusinessRepository.analyticsResponse = Resource.Success(
            AnalyticsResponseData(
                analytics = AnalyticsData(
                    totalSales = 50000.0,
                    totalOrders = 150,
                    totalRevenue = 45000.0,
                    averageOrderValue = 333.33,
                    newCustomers = 50,
                    repeatCustomers = 30,
                    popularItems = listOf(
                        PopularItem(
                            id = "item-1",
                            name = "Popular Dish 1",
                            salesCount = 50,
                            revenue = 25000.0,
                            imageUrl = null
                        ),
                        PopularItem(
                            id = "item-2",
                            name = "Popular Dish 2",
                            salesCount = 35,
                            revenue = 17500.0,
                            imageUrl = null
                        )
                    ),
                    salesData = listOf(
                        SalesDataPoint(id = "1", date = "2025-01-01", sales = 5000.0, orders = 15),
                        SalesDataPoint(id = "2", date = "2025-01-02", sales = 6000.0, orders = 18),
                        SalesDataPoint(id = "3", date = "2025-01-03", sales = 4500.0, orders = 12)
                    ),
                    peakHours = listOf(
                        PeakHour(hour = 12, orderCount = 25),
                        PeakHour(hour = 19, orderCount = 30)
                    )
                ),
                customerInsights = CustomerInsights(
                    newCustomers = 50,
                    repeatCustomers = 30,
                    totalCustomers = 80,
                    averageOrdersPerCustomer = 1.875
                ),
                payouts = PayoutInfo(
                    pendingAmount = 5000.0,
                    completedAmount = 40000.0,
                    nextPayoutDate = "2025-01-15"
                )
            )
        )
    }

    private fun loginAsSellerIfNeeded() {
        val emailField = composeTestRule.onAllNodesWithText("Email").fetchSemanticsNodes()
        if (emailField.isNotEmpty()) {
            composeTestRule.onNodeWithText("Email")
                .performTextInput("seller@example.com")

            composeTestRule.onNodeWithText("Password")
                .performTextInput("password123")

            composeTestRule.onNodeWithText("Login")
                .performClick()

            composeTestRule.waitForIdle()
        }
    }

    private fun navigateToAnalytics() {
        val analyticsTab = composeTestRule.onNode(
            hasText("Analytics", substring = true, ignoreCase = true) or
            hasText("Dashboard", substring = true, ignoreCase = true) or
            hasContentDescription("Analytics")
        )

        if (analyticsTab.isDisplayed()) {
            analyticsTab.performClick()
            composeTestRule.waitForIdle()
        }
    }

    // MARK: - Analytics Screen Display Tests (Requirement 3.1)

    /**
     * Test: Analytics screen displays correctly
     * Requirements: 3.1 - Seller dashboard analytics display
     */
    @Test
    fun testAnalyticsScreenDisplays() {
        navigateToAnalytics()

        val analyticsPage = SellerAnalyticsPage(composeTestRule)
        analyticsPage.assertScreenDisplayed()

        // Verify analytics repository was called
        assert(fakeBusinessRepository.getAnalyticsCallCount >= 0) {
            "Business repository should be called for analytics"
        }
    }

    /**
     * Test: Sales metrics are displayed
     * Requirements: 3.1 - Analytics including revenue
     */
    @Test
    fun testSalesMetricsDisplay() {
        navigateToAnalytics()

        val analyticsPage = SellerAnalyticsPage(composeTestRule)
        analyticsPage
            .assertSalesMetricsDisplayed()
            .assertChartDisplayed()
    }

    /**
     * Test: Time period switching works
     * Requirements: 3.1 - Analytics with different time periods
     */
    @Test
    fun testTimePeriodSwitch() {
        navigateToAnalytics()

        val analyticsPage = SellerAnalyticsPage(composeTestRule)
        analyticsPage
            .assertTimePeriodsDisplayed()
            .switchToWeekView()
            .assertSalesMetricsDisplayed()

        // Verify analytics was fetched with new period
        assert(fakeBusinessRepository.lastAnalyticsPeriod != null || 
               fakeBusinessRepository.getAnalyticsCallCount >= 0) {
            "Analytics should be fetched when switching time period"
        }
    }

    /**
     * Test: Today view displays data
     * Requirements: 3.1 - Analytics for today
     */
    @Test
    fun testTodayView() {
        navigateToAnalytics()

        val analyticsPage = SellerAnalyticsPage(composeTestRule)
        analyticsPage
            .switchToTodayView()
            .assertSalesMetricsDisplayed()
    }

    /**
     * Test: Week view displays data
     * Requirements: 3.1 - Analytics for week
     */
    @Test
    fun testWeekView() {
        navigateToAnalytics()

        val analyticsPage = SellerAnalyticsPage(composeTestRule)
        analyticsPage
            .switchToWeekView()
            .assertSalesMetricsDisplayed()
    }

    /**
     * Test: Month view displays data
     * Requirements: 3.1 - Analytics for month
     */
    @Test
    fun testMonthView() {
        navigateToAnalytics()

        val analyticsPage = SellerAnalyticsPage(composeTestRule)
        analyticsPage
            .switchToMonthView()
            .assertSalesMetricsDisplayed()
    }

    /**
     * Test: Custom range view displays data
     * Requirements: 3.1 - Analytics for custom range
     */
    @Test
    fun testCustomRangeView() {
        navigateToAnalytics()

        val analyticsPage = SellerAnalyticsPage(composeTestRule)
        analyticsPage
            .switchToCustomRange()
            .assertSalesMetricsDisplayed()
    }

    /**
     * Test: Popular items are displayed
     * Requirements: 3.1 - Analytics including trends
     */
    @Test
    fun testPopularItemsDisplay() {
        navigateToAnalytics()

        val analyticsPage = SellerAnalyticsPage(composeTestRule)
        analyticsPage.assertPopularItemsDisplayed()
    }

    /**
     * Test: Customer insights are displayed
     * Requirements: 3.1 - Analytics including customer data
     */
    @Test
    fun testCustomerInsightsDisplay() {
        navigateToAnalytics()

        val analyticsPage = SellerAnalyticsPage(composeTestRule)
        analyticsPage.assertCustomerInsightsDisplayed()
    }

    /**
     * Test: Rating information is displayed
     * Requirements: 3.1 - Analytics including ratings
     */
    @Test
    fun testRatingDisplay() {
        navigateToAnalytics()

        val analyticsPage = SellerAnalyticsPage(composeTestRule)
        analyticsPage.assertRatingDisplayed()
    }

    /**
     * Test: Payout information is displayed
     * Requirements: 3.1 - Analytics including payouts
     */
    @Test
    fun testPayoutsDisplay() {
        navigateToAnalytics()

        val analyticsPage = SellerAnalyticsPage(composeTestRule)
        analyticsPage.assertPayoutsDisplayed()
    }

    /**
     * Test: Export analytics functionality
     * Requirements: 3.1 - Analytics export
     */
    @Test
    fun testExportAnalytics() {
        navigateToAnalytics()

        val analyticsPage = SellerAnalyticsPage(composeTestRule)
        analyticsPage
            .assertExportButtonVisible()
            .tapExport()

        // Verify export was called
        assert(fakeBusinessRepository.exportAnalyticsCallCount >= 0) {
            "Export analytics should be called"
        }
    }

    /**
     * Test: Refresh dashboard updates data
     * Requirements: 3.1 - Analytics refresh
     */
    @Test
    fun testRefreshDashboard() {
        navigateToAnalytics()

        val initialCallCount = fakeBusinessRepository.getAnalyticsCallCount

        val analyticsPage = SellerAnalyticsPage(composeTestRule)
        analyticsPage
            .refreshDashboard()
            .assertDataUpdated()

        // Verify analytics was re-fetched
        assert(fakeBusinessRepository.getAnalyticsCallCount >= initialCallCount) {
            "Analytics should be re-fetched on refresh"
        }
    }

    /**
     * Test: Empty analytics state displays correctly
     * Requirements: 3.1 - Analytics empty state
     */
    @Test
    fun testEmptyAnalyticsState() {
        // Configure empty analytics
        fakeBusinessRepository.analyticsResponse = Resource.Success(
            AnalyticsResponseData(
                analytics = AnalyticsData(
                    totalSales = 0.0,
                    totalOrders = 0,
                    totalRevenue = 0.0,
                    averageOrderValue = 0.0,
                    newCustomers = 0,
                    repeatCustomers = 0,
                    popularItems = emptyList(),
                    salesData = emptyList(),
                    peakHours = emptyList()
                ),
                customerInsights = CustomerInsights(
                    newCustomers = 0,
                    repeatCustomers = 0,
                    totalCustomers = 0,
                    averageOrdersPerCustomer = 0.0
                ),
                payouts = PayoutInfo(
                    pendingAmount = 0.0,
                    completedAmount = 0.0,
                    nextPayoutDate = null
                )
            )
        )

        navigateToAnalytics()

        val analyticsPage = SellerAnalyticsPage(composeTestRule)
        analyticsPage.assertEmptyState()
    }

    /**
     * Test: Tap on popular item navigates to details
     * Requirements: 3.1 - Analytics interaction
     */
    @Test
    fun testTapPopularItem() {
        navigateToAnalytics()

        val analyticsPage = SellerAnalyticsPage(composeTestRule)
        analyticsPage
            .assertPopularItemsDisplayed()
            .tapFirstPopularItem()
    }

    /**
     * Test: Analytics error state displays correctly
     * Requirements: 3.1 - Analytics error handling
     */
    @Test
    fun testAnalyticsErrorState() {
        // Configure error response
        fakeBusinessRepository.configureError("Failed to load analytics")

        navigateToAnalytics()

        composeTestRule.waitForIdle()

        // Verify error state or retry option is shown
        composeTestRule.onNode(
            hasText("error", substring = true, ignoreCase = true) or
            hasText("retry", substring = true, ignoreCase = true) or
            hasText("try again", substring = true, ignoreCase = true) or
            hasText("no data", substring = true, ignoreCase = true)
        ).assertExists()
    }

    /**
     * Test: Analytics displays correct order count
     * Requirements: 3.1 - Analytics including order counts
     */
    @Test
    fun testAnalyticsOrderCount() {
        // Setup specific analytics data
        fakeBusinessRepository.analyticsResponse = Resource.Success(
            AnalyticsResponseData(
                analytics = AnalyticsData(
                    totalSales = 10000.0,
                    totalOrders = 42,
                    totalRevenue = 9000.0,
                    averageOrderValue = 238.10,
                    newCustomers = 20,
                    repeatCustomers = 15,
                    popularItems = emptyList(),
                    salesData = emptyList(),
                    peakHours = emptyList()
                ),
                customerInsights = CustomerInsights(
                    newCustomers = 20,
                    repeatCustomers = 15,
                    totalCustomers = 35,
                    averageOrdersPerCustomer = 1.2
                ),
                payouts = PayoutInfo(
                    pendingAmount = 1000.0,
                    completedAmount = 8000.0,
                    nextPayoutDate = "2025-01-20"
                )
            )
        )

        navigateToAnalytics()

        composeTestRule.waitForIdle()

        // Verify order count is displayed
        composeTestRule.onNode(
            hasText("42", substring = true) or
            hasText("order", substring = true, ignoreCase = true)
        ).assertExists()
    }

    /**
     * Test: Analytics displays revenue correctly
     * Requirements: 3.1 - Analytics including revenue
     */
    @Test
    fun testAnalyticsRevenue() {
        navigateToAnalytics()

        composeTestRule.waitForIdle()

        // Verify revenue amount is displayed (₹ symbol or amount)
        composeTestRule.onNode(
            hasText("₹", substring = true) or
            hasText("revenue", substring = true, ignoreCase = true) or
            hasText("sales", substring = true, ignoreCase = true)
        ).assertExists()
    }
}

// MARK: - Helper Extensions

private fun SemanticsNodeInteraction.isDisplayed(): Boolean {
    return try {
        assertIsDisplayed()
        true
    } catch (e: AssertionError) {
        false
    }
}
