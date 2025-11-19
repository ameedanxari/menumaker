package com.menumaker.pageobjects

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.ComposeTestRule

/**
 * Page Object for Seller Orders Management Screen
 * Provides fluent API for seller order management interactions
 */
class SellerOrdersPage(private val composeTestRule: ComposeTestRule) {

    // Elements
    private val orderCards = composeTestRule.onAllNodesWithTag("OrderCard")
    private val newOrdersTab = composeTestRule.onNode(
        hasText("new", substring = true, ignoreCase = true) or
        hasText("pending", substring = true, ignoreCase = true)
    )
    private val activeOrdersTab = composeTestRule.onNode(
        hasText("active", substring = true, ignoreCase = true) or
        hasText("preparing", substring = true, ignoreCase = true)
    )
    private val completedOrdersTab = composeTestRule.onNode(
        hasText("completed", substring = true, ignoreCase = true) or
        hasText("history", substring = true, ignoreCase = true)
    )

    // Order action buttons
    private val acceptButton = composeTestRule.onNodeWithText("accept", substring = true, ignoreCase = true)
    private val rejectButton = composeTestRule.onNodeWithText("reject", substring = true, ignoreCase = true)
    private val markPreparingButton = composeTestRule.onNode(
        hasText("preparing", substring = true, ignoreCase = true) or
        hasText("start", substring = true, ignoreCase = true)
    )
    private val markReadyButton = composeTestRule.onNode(
        hasText("ready", substring = true, ignoreCase = true) or
        hasText("complete", substring = true, ignoreCase = true)
    )

    // Order detail elements
    private val orderIdLabel = composeTestRule.onNodeWithTag("order-id")
    private val customerNameLabel = composeTestRule.onNodeWithTag("CustomerName")
    private val orderTotalLabel = composeTestRule.onNode(hasText("₹", substring = true))
    private val emptyStateMessage = composeTestRule.onNode(
        hasText("no orders", substring = true, ignoreCase = true) or
        hasText("no new orders", substring = true, ignoreCase = true)
    )
    private val rejectionReasonField = composeTestRule.onNodeWithTag("rejection-reason-field")
    private val confirmRejectButton = composeTestRule.onNodeWithText("Reject") or composeTestRule.onNodeWithText("Confirm")

    // Actions
    fun tapFirstOrder(): SellerOrdersPage {
        if (orderCards.fetchSemanticsNodes().isNotEmpty()) {
            orderCards[0].performClick()
            Thread.sleep(1000)
        }
        return this
    }

    fun switchToNewOrders(): SellerOrdersPage {
        newOrdersTab.performClick()
        Thread.sleep(1000)
        return this
    }

    fun switchToActiveOrders(): SellerOrdersPage {
        activeOrdersTab.performClick()
        Thread.sleep(1000)
        return this
    }

    fun switchToCompletedOrders(): SellerOrdersPage {
        completedOrdersTab.performClick()
        Thread.sleep(1000)
        return this
    }

    fun acceptOrder(): SellerOrdersPage {
        acceptButton.performClick()
        Thread.sleep(1000)
        return this
    }

    fun rejectOrder(reason: String? = null): SellerOrdersPage {
        rejectButton.performClick()

        if (reason != null && rejectionReasonField.fetchSemanticsNode(false) != null) {
            rejectionReasonField.performTextInput(reason)
        }

        val confirmBtn = composeTestRule.onNode(
            hasText("reject", ignoreCase = true) or hasText("confirm", ignoreCase = true)
        )
        if (confirmBtn.fetchSemanticsNode(false) != null) {
            confirmBtn.performClick()
        }

        Thread.sleep(1000)
        return this
    }

    fun markAsPreparing(): SellerOrdersPage {
        markPreparingButton.performClick()
        Thread.sleep(1000)
        return this
    }

    fun markAsReady(): SellerOrdersPage {
        markReadyButton.performClick()
        Thread.sleep(1000)
        return this
    }

    // Assertions
    fun assertScreenDisplayed(): SellerOrdersPage {
        composeTestRule.waitUntil(timeoutMillis = 2000) {
            orderCards.fetchSemanticsNodes().isNotEmpty() ||
            emptyStateMessage.fetchSemanticsNode(false) != null
        }
        return this
    }

    fun assertOrdersDisplayed(): SellerOrdersPage {
        assert(orderCards.fetchSemanticsNodes().isNotEmpty()) {
            "Orders should be displayed"
        }
        return this
    }

    fun assertEmptyState(): SellerOrdersPage {
        emptyStateMessage.assertExists()
        return this
    }

    fun assertOrderCount(expectedCount: Int): SellerOrdersPage {
        val actualCount = orderCards.fetchSemanticsNodes().size
        assert(actualCount == expectedCount) {
            "Should have $expectedCount orders, found $actualCount"
        }
        return this
    }

    fun assertOrderDetailDisplayed(): SellerOrdersPage {
        orderIdLabel.assertExists() or orderTotalLabel.assertExists()
        return this
    }

    fun assertAcceptButtonVisible(): SellerOrdersPage {
        acceptButton.assertExists()
        return this
    }

    fun assertMarkPreparingButtonVisible(): SellerOrdersPage {
        markPreparingButton.assertExists()
        return this
    }

    fun assertMarkReadyButtonVisible(): SellerOrdersPage {
        markReadyButton.assertExists()
        return this
    }
}
