package com.menumaker.ui

import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import com.menumaker.MainActivity
import com.menumaker.pageobjects.NotificationPage
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * UI tests for notification system
 */
@LargeTest
@RunWith(AndroidJUnit4::class)
@HiltAndroidTest
class NotificationFlowTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    @Before
    fun setup() {
        hiltRule.inject()
    }

    @Test
    fun testNotificationScreenDisplays() {
        val notificationPage = NotificationPage(composeTestRule)
        notificationPage.assertScreenDisplayed()
    }

    @Test
    fun testViewNotifications() {
        val notificationPage = NotificationPage(composeTestRule)
        notificationPage
            .assertNotificationsDisplayed()
            .tapFirstNotification()
    }

    @Test
    fun testMarkNotificationAsRead() {
        val notificationPage = NotificationPage(composeTestRule)
        notificationPage
            .assertUnreadNotificationsExist()
            .tapFirstNotification()
            .assertNotificationCount(4)
    }

    @Test
    fun testMarkAllAsRead() {
        val notificationPage = NotificationPage(composeTestRule)
        notificationPage
            .assertUnreadNotificationsExist()
            .markAllAsRead()
            .assertFilterOptionsDisplayed()
    }

    @Test
    fun testDeleteNotification() {
        val notificationPage = NotificationPage(composeTestRule)
        notificationPage
            .assertNotificationsDisplayed()
            .swipeToDeleteNotification(0)
            .assertNotificationCount(4)
    }

    @Test
    fun testClearAllNotifications() {
        val notificationPage = NotificationPage(composeTestRule)
        notificationPage
            .assertNotificationsDisplayed()
            .clearAllNotifications()
            .assertEmptyState()
    }

    @Test
    fun testFilterByUnread() {
        val notificationPage = NotificationPage(composeTestRule)
        notificationPage
            .filterByUnread()
            .assertUnreadNotificationsExist()
    }

    @Test
    fun testFilterByOrders() {
        val notificationPage = NotificationPage(composeTestRule)
        notificationPage
            .filterByOrders()
            .assertOrderNotificationsExist()
    }

    @Test
    fun testFilterByAll() {
        val notificationPage = NotificationPage(composeTestRule)
        notificationPage
            .filterByAll()
            .assertNotificationsDisplayed()
    }

    @Test
    fun testOpenNotificationSettings() {
        val notificationPage = NotificationPage(composeTestRule)
        notificationPage
            .tapSettings()
            .assertScreenDisplayed()
    }
}
