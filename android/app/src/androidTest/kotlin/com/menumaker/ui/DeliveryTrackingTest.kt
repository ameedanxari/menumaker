package com.menumaker.ui

import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import com.menumaker.MainActivity
import com.menumaker.pageobjects.DeliveryTrackingPage
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * UI tests for delivery tracking functionality
 */
@LargeTest
@RunWith(AndroidJUnit4::class)
@HiltAndroidTest
class DeliveryTrackingTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    @Before
    fun setup() {
        hiltRule.inject()
    }

    @Test
    fun testDeliveryTrackingScreenDisplays() {
        val trackingPage = DeliveryTrackingPage(composeTestRule)
        trackingPage.assertScreenDisplayed()
    }

    @Test
    fun testViewOrderDetails() {
        val trackingPage = DeliveryTrackingPage(composeTestRule)
        trackingPage
            .assertOrderDetailsDisplayed()
            .assertOrderIdDisplayed()
            .assertDeliveryAddressDisplayed()
    }

    @Test
    fun testTrackingStatusDisplays() {
        val trackingPage = DeliveryTrackingPage(composeTestRule)
        trackingPage
            .assertTrackingStatusDisplayed()
            .assertStatusStepsDisplayed()
    }

    @Test
    fun testDeliveryPersonInfoDisplays() {
        val trackingPage = DeliveryTrackingPage(composeTestRule)
        trackingPage
            .assertDeliveryPersonInfoDisplayed()
            .assertDeliveryPersonNameDisplayed()
            .assertDeliveryPersonPhoneDisplayed()
    }

    @Test
    fun testCallDeliveryPerson() {
        val trackingPage = DeliveryTrackingPage(composeTestRule)
        trackingPage
            .assertDeliveryPersonInfoDisplayed()
            .tapCallDeliveryPerson()
    }

    @Test
    fun testViewMapLocation() {
        val trackingPage = DeliveryTrackingPage(composeTestRule)
        trackingPage
            .assertMapDisplayed()
            .tapMapForFullScreen()
    }

    @Test
    fun testEstimatedTimeDisplays() {
        val trackingPage = DeliveryTrackingPage(composeTestRule)
        trackingPage
            .assertEstimatedTimeDisplayed()
    }

    @Test
    fun testRefreshTracking() {
        val trackingPage = DeliveryTrackingPage(composeTestRule)
        trackingPage
            .refreshTracking()
            .assertTrackingStatusDisplayed()
    }

    @Test
    fun testCancelOrder() {
        val trackingPage = DeliveryTrackingPage(composeTestRule)
        trackingPage
            .tapCancelOrder()
            .confirmCancellation("Changed my mind")
            .assertOrderCancelled()
    }

    @Test
    fun testReportIssue() {
        val trackingPage = DeliveryTrackingPage(composeTestRule)
        trackingPage
            .tapReportIssue()
            .selectIssue("Order not delivered")
            .submitIssue()
            .assertIssueReported()
    }
}
