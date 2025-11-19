package com.menumaker.ui

import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import com.menumaker.MainActivity
import com.menumaker.pageobjects.SellerAnalyticsPage
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * UI tests for seller analytics dashboard
 */
@LargeTest
@RunWith(AndroidJUnit4::class)
@HiltAndroidTest
class SellerAnalyticsTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    @Before
    fun setup() {
        hiltRule.inject()
    }

    @Test
    fun testAnalyticsScreenDisplays() {
        val analyticsPage = SellerAnalyticsPage(composeTestRule)
        analyticsPage.assertScreenDisplayed()
    }

    @Test
    fun testSalesMetricsDisplay() {
        val analyticsPage = SellerAnalyticsPage(composeTestRule)
        analyticsPage
            .assertSalesMetricsDisplayed()
            .assertChartDisplayed()
    }

    @Test
    fun testTimePeriodSwitch() {
        val analyticsPage = SellerAnalyticsPage(composeTestRule)
        analyticsPage
            .assertTimePeriodsDisplayed()
            .switchToWeekView()
            .assertSalesMetricsDisplayed()
    }

    @Test
    fun testTodayView() {
        val analyticsPage = SellerAnalyticsPage(composeTestRule)
        analyticsPage
            .switchToTodayView()
            .assertSalesMetricsDisplayed()
    }

    @Test
    fun testWeekView() {
        val analyticsPage = SellerAnalyticsPage(composeTestRule)
        analyticsPage
            .switchToWeekView()
            .assertSalesMetricsDisplayed()
    }

    @Test
    fun testMonthView() {
        val analyticsPage = SellerAnalyticsPage(composeTestRule)
        analyticsPage
            .switchToMonthView()
            .assertSalesMetricsDisplayed()
    }

    @Test
    fun testCustomRangeView() {
        val analyticsPage = SellerAnalyticsPage(composeTestRule)
        analyticsPage
            .switchToCustomRange()
            .assertSalesMetricsDisplayed()
    }

    @Test
    fun testPopularItemsDisplay() {
        val analyticsPage = SellerAnalyticsPage(composeTestRule)
        analyticsPage
            .assertPopularItemsDisplayed()
    }

    @Test
    fun testCustomerInsightsDisplay() {
        val analyticsPage = SellerAnalyticsPage(composeTestRule)
        analyticsPage
            .assertCustomerInsightsDisplayed()
    }

    @Test
    fun testRatingDisplay() {
        val analyticsPage = SellerAnalyticsPage(composeTestRule)
        analyticsPage
            .assertRatingDisplayed()
    }

    @Test
    fun testPayoutsDisplay() {
        val analyticsPage = SellerAnalyticsPage(composeTestRule)
        analyticsPage
            .assertPayoutsDisplayed()
    }

    @Test
    fun testExportAnalytics() {
        val analyticsPage = SellerAnalyticsPage(composeTestRule)
        analyticsPage
            .assertExportButtonVisible()
            .tapExport()
    }

    @Test
    fun testRefreshDashboard() {
        val analyticsPage = SellerAnalyticsPage(composeTestRule)
        analyticsPage
            .refreshDashboard()
            .assertDataUpdated()
    }

    @Test
    fun testEmptyAnalyticsState() {
        val analyticsPage = SellerAnalyticsPage(composeTestRule)
        analyticsPage
            .assertEmptyState()
    }

    @Test
    fun testTapPopularItem() {
        val analyticsPage = SellerAnalyticsPage(composeTestRule)
        analyticsPage
            .assertPopularItemsDisplayed()
            .tapFirstPopularItem()
    }
}
