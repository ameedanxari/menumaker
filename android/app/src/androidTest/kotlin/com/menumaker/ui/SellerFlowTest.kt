package com.menumaker.ui

import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import com.menumaker.MainActivity
import com.menumaker.pageobjects.SellerOrdersPage
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * UI tests for seller order management workflows
 */
@LargeTest
@RunWith(AndroidJUnit4::class)
@HiltAndroidTest
class SellerFlowTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    @Before
    fun setup() {
        hiltRule.inject()
    }

    @Test
    fun testSellerOrdersScreenDisplays() {
        val ordersPage = SellerOrdersPage(composeTestRule)
        ordersPage.assertScreenDisplayed()
    }

    @Test
    fun testViewNewOrders() {
        val ordersPage = SellerOrdersPage(composeTestRule)
        ordersPage
            .switchToNewOrders()
            .assertOrdersDisplayed()
    }

    @Test
    fun testAcceptOrder() {
        val ordersPage = SellerOrdersPage(composeTestRule)
        ordersPage
            .switchToNewOrders()
            .tapFirstOrder()
            .assertAcceptButtonVisible()
            .acceptOrder()
            .assertOrderDetailDisplayed()
    }

    @Test
    fun testRejectOrder() {
        val ordersPage = SellerOrdersPage(composeTestRule)
        ordersPage
            .switchToNewOrders()
            .tapFirstOrder()
            .rejectOrder("Out of ingredients")
            .assertEmptyState()
    }

    @Test
    fun testMarkOrderAsPreparing() {
        val ordersPage = SellerOrdersPage(composeTestRule)
        ordersPage
            .switchToActiveOrders()
            .tapFirstOrder()
            .assertMarkPreparingButtonVisible()
            .markAsPreparing()
            .assertOrderDetailDisplayed()
    }

    @Test
    fun testMarkOrderAsReady() {
        val ordersPage = SellerOrdersPage(composeTestRule)
        ordersPage
            .switchToActiveOrders()
            .tapFirstOrder()
            .assertMarkReadyButtonVisible()
            .markAsReady()
            .assertOrderDetailDisplayed()
    }

    @Test
    fun testViewCompletedOrders() {
        val ordersPage = SellerOrdersPage(composeTestRule)
        ordersPage
            .switchToCompletedOrders()
            .assertOrdersDisplayed()
    }

    @Test
    fun testOrderDetailsDisplay() {
        val ordersPage = SellerOrdersPage(composeTestRule)
        ordersPage
            .tapFirstOrder()
            .assertOrderDetailDisplayed()
    }

    @Test
    fun testOrderCount() {
        val ordersPage = SellerOrdersPage(composeTestRule)
        ordersPage
            .assertOrdersDisplayed()
            .assertOrderCount(3)
    }

    @Test
    fun testEmptyOrderState() {
        val ordersPage = SellerOrdersPage(composeTestRule)
        ordersPage
            .switchToNewOrders()
            .assertEmptyState()
    }
}
