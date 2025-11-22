package com.menumaker.pageobjects

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.ComposeTestRule

/**
 * Page Object for Order History Screen
 * Provides fluent API for order history interactions
 */
class OrderHistoryPage(private val composeTestRule: ComposeTestRule) {

    // Elements
    private val ordersList = composeTestRule.onAllNodesWithTag("OrderItem")
    private val emptyStateMessage = composeTestRule.onNodeWithText("no order", substring = true, ignoreCase = true)
    private val activeTab = composeTestRule.onNodeWithText("active", substring = true, ignoreCase = true)
    private val completedTab = composeTestRule.onNodeWithText("completed", substring = true, ignoreCase = true)
    private val cancelledTab = composeTestRule.onNodeWithText("cancelled", substring = true, ignoreCase = true)
    private val filterButton = composeTestRule.onNodeWithText("filter", substring = true, ignoreCase = true)
    private val searchBar = composeTestRule.onNodeWithTag("search-bar")
    private val helpButton = composeTestRule.onNodeWithText("help", substring = true, ignoreCase = true)

    // Actions
    fun tapFirstOrder(): OrderHistoryPage {
        ordersList[0].performClick()
        Thread.sleep(1000)
        return this
    }

    fun tapOrder(index: Int): OrderHistoryPage {
        if (ordersList.fetchSemanticsNodes().size > index) {
            ordersList[index].performClick()
            Thread.sleep(1000)
        }
        return this
    }

    fun switchToActiveOrders(): OrderHistoryPage {
        activeTab.performClick()
        Thread.sleep(1000)
        return this
    }

    fun switchToCompletedOrders(): OrderHistoryPage {
        completedTab.performClick()
        Thread.sleep(1000)
        return this
    }

    fun switchToCancelledOrders(): OrderHistoryPage {
        cancelledTab.performClick()
        Thread.sleep(1000)
        return this
    }

    fun searchOrders(query: String): OrderHistoryPage {
        searchBar.performTextInput(query)
        Thread.sleep(1000)
        return this
    }

    fun tapFilter(): OrderHistoryPage {
        filterButton.performClick()
        Thread.sleep(1000)
        return this
    }

    fun filterByDateRange(range: DateRange): OrderHistoryPage {
        tapFilter()
        when (range) {
            DateRange.LAST_7_DAYS -> composeTestRule.onNodeWithText("Last 7 Days").performClick()
            DateRange.LAST_30_DAYS -> composeTestRule.onNodeWithText("Last 30 Days").performClick()
            DateRange.LAST_3_MONTHS -> composeTestRule.onNodeWithText("Last 3 Months").performClick()
        }
        Thread.sleep(1000)
        return this
    }

    fun reorderFirst(): OrderHistoryPage {
        composeTestRule.onNode(
            hasText("reorder", substring = true, ignoreCase = true)
        ).performClick()
        Thread.sleep(1000)
        return this
    }

    fun trackFirstOrder(): OrderHistoryPage {
        composeTestRule.onNode(
            hasText("track", substring = true, ignoreCase = true)
        ).performClick()
        Thread.sleep(1000)
        return this
    }

    fun tapHelp(): OrderHistoryPage {
        helpButton.performClick()
        Thread.sleep(1000)
        return this
    }

    // Assertions
    fun assertScreenDisplayed(): OrderHistoryPage {
        composeTestRule.waitUntil(timeoutMillis = 2000) {
            ordersList.fetchSemanticsNodes().isNotEmpty() ||
            try { emptyStateMessage.assertExists(); true } catch (e: AssertionError) { false } ||
            try { activeTab.assertExists(); true } catch (e: AssertionError) { false }
        }
        return this
    }

    fun assertOrdersDisplayed(): OrderHistoryPage {
        assert(ordersList.fetchSemanticsNodes().isNotEmpty()) {
            "Orders should be displayed"
        }
        return this
    }

    fun assertEmptyState(): OrderHistoryPage {
        emptyStateMessage.assertExists()
        return this
    }

    fun assertOrderCount(expectedCount: Int): OrderHistoryPage {
        val actualCount = ordersList.fetchSemanticsNodes().size
        assert(actualCount == expectedCount) {
            "Should have $expectedCount orders, found $actualCount"
        }
        return this
    }

    fun assertTabsDisplayed(): OrderHistoryPage {
        activeTab.assertExists()
        return this
    }

    fun assertReorderButtonVisible(): OrderHistoryPage {
        composeTestRule.onNode(
            hasText("reorder", substring = true, ignoreCase = true)
        ).assertExists()
        return this
    }

    fun assertTrackButtonVisible(): OrderHistoryPage {
        composeTestRule.onNode(
            hasText("track", substring = true, ignoreCase = true)
        ).assertExists()
        return this
    }

    fun assertOrderDetailsDisplayed(): OrderHistoryPage {
        // Check if order details like ID, date, or total are displayed
        val hasOrderDetails = try {
            composeTestRule.onNode(hasText("₹", substring = true)).assertExists()
            true
        } catch (e: AssertionError) {
            false
        }
        assert(hasOrderDetails) {
            "Order details should be displayed"
        }
        return this
    }

    enum class DateRange {
        LAST_7_DAYS,
        LAST_30_DAYS,
        LAST_3_MONTHS
    }
}
