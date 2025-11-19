package com.menumaker.pageobjects

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.ComposeTestRule

/**
 * Page Object for Notifications Screen
 * Provides fluent API for notification interactions
 */
class NotificationPage(private val composeTestRule: ComposeTestRule) {

    // Elements
    private val notificationsList = composeTestRule.onAllNodesWithTag("NotificationItem")
    private val unreadNotifications = composeTestRule.onAllNodes(
        hasTestTag("NotificationItem") and hasText("•", substring = true)
    )
    private val emptyStateMessage = composeTestRule.onNodeWithText("no notification", substring = true, ignoreCase = true)
    private val markAllReadButton = composeTestRule.onNode(
        hasText("mark all", substring = true, ignoreCase = true) or
        hasText("read all", substring = true, ignoreCase = true)
    )
    private val clearAllButton = composeTestRule.onNode(
        hasText("clear", substring = true, ignoreCase = true) or
        hasText("delete all", substring = true, ignoreCase = true)
    )
    private val settingsButton = composeTestRule.onNodeWithContentDescription("Settings", substring = true)
    private val backButton = composeTestRule.onNodeWithContentDescription("Back", substring = true)

    // Filter tabs
    private val allFilter = composeTestRule.onNodeWithText("all", ignoreCase = true)
    private val unreadFilter = composeTestRule.onNodeWithText("unread", ignoreCase = true)
    private val ordersFilter = composeTestRule.onNodeWithText("order", substring = true, ignoreCase = true)

    // Actions
    fun tapFirstNotification(): NotificationPage {
        if (notificationsList.fetchSemanticsNodes().isNotEmpty()) {
            notificationsList[0].performClick()
            Thread.sleep(1000)
        }
        return this
    }

    fun tapNotification(index: Int): NotificationPage {
        if (notificationsList.fetchSemanticsNodes().size > index) {
            notificationsList[index].performClick()
            Thread.sleep(1000)
        }
        return this
    }

    fun swipeToDeleteNotification(index: Int = 0): NotificationPage {
        if (notificationsList.fetchSemanticsNodes().size > index) {
            notificationsList[index].performTouchInput {
                swipeLeft()
            }
            val deleteButton = composeTestRule.onNodeWithText("Delete", ignoreCase = true)
            if (deleteButton.fetchSemanticsNode(false) != null) {
                deleteButton.performClick()
                Thread.sleep(1000)
            }
        }
        return this
    }

    fun markAllAsRead(): NotificationPage {
        markAllReadButton.performClick()
        Thread.sleep(1000)
        return this
    }

    fun clearAllNotifications(): NotificationPage {
        clearAllButton.performClick()
        Thread.sleep(1000)

        // Confirm if dialog appears
        val confirmButton = composeTestRule.onNode(
            hasText("confirm", substring = true, ignoreCase = true) or
            hasText("yes", ignoreCase = true)
        )
        if (confirmButton.fetchSemanticsNode(false) != null) {
            confirmButton.performClick()
            Thread.sleep(1000)
        }
        return this
    }

    fun filterByAll(): NotificationPage {
        allFilter.performClick()
        Thread.sleep(1000)
        return this
    }

    fun filterByUnread(): NotificationPage {
        unreadFilter.performClick()
        Thread.sleep(1000)
        return this
    }

    fun filterByOrders(): NotificationPage {
        ordersFilter.performClick()
        Thread.sleep(1000)
        return this
    }

    fun tapSettings(): NotificationPage {
        settingsButton.performClick()
        Thread.sleep(1000)
        return this
    }

    fun goBack(): NotificationPage {
        backButton.performClick()
        return this
    }

    // Assertions
    fun assertScreenDisplayed(): NotificationPage {
        composeTestRule.waitUntil(timeoutMillis = 2000) {
            notificationsList.fetchSemanticsNodes().isNotEmpty() ||
            emptyStateMessage.fetchSemanticsNode(false) != null ||
            markAllReadButton.fetchSemanticsNode(false) != null
        }
        return this
    }

    fun assertNotificationsDisplayed(): NotificationPage {
        assert(notificationsList.fetchSemanticsNodes().isNotEmpty()) {
            "Notifications should be displayed"
        }
        return this
    }

    fun assertEmptyState(): NotificationPage {
        emptyStateMessage.assertExists()
        return this
    }

    fun assertUnreadNotificationsExist(): NotificationPage {
        assert(unreadNotifications.fetchSemanticsNodes().isNotEmpty()) {
            "Unread notifications should exist"
        }
        return this
    }

    fun assertNotificationCount(expectedCount: Int): NotificationPage {
        val actualCount = notificationsList.fetchSemanticsNodes().size
        assert(actualCount == expectedCount) {
            "Should have $expectedCount notifications, found $actualCount"
        }
        return this
    }

    fun assertOrderNotificationsExist(): NotificationPage {
        val orderNotifs = composeTestRule.onAllNodes(
            hasText("order", substring = true, ignoreCase = true)
        )
        assert(orderNotifs.fetchSemanticsNodes().isNotEmpty()) {
            "Order notifications should exist"
        }
        return this
    }

    fun assertFilterOptionsDisplayed(): NotificationPage {
        allFilter.assertExists()
        return this
    }

    fun assertMarkAllReadButtonVisible(): NotificationPage {
        markAllReadButton.assertExists()
        return this
    }

    fun assertNotificationBadgeCount(count: Int): NotificationPage {
        val badge = composeTestRule.onNodeWithTag("notification-badge")
        if (count > 0) {
            badge.assertExists()
        } else {
            badge.assertDoesNotExist()
        }
        return this
    }
}
