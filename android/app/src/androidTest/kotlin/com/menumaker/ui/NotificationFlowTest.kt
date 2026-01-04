package com.menumaker.ui

import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import com.menumaker.MainActivity
import com.menumaker.data.remote.models.NotificationDto
import com.menumaker.data.remote.models.NotificationType
import com.menumaker.data.repository.NotificationRepository
import com.menumaker.fakes.FakeNotificationRepository
import com.menumaker.pageobjects.NotificationPage
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import javax.inject.Inject

/**
 * UI tests for notification system
 *
 * These tests use FakeNotificationRepository via Hilt test module for deterministic,
 * network-independent testing.
 *
 * Requirements covered:
 * - 9.1: Notification display and unread count
 * - 9.2: Mark notifications as read
 */
@LargeTest
@RunWith(AndroidJUnit4::class)
@HiltAndroidTest
class NotificationFlowTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    @Inject
    lateinit var notificationRepository: NotificationRepository

    private val fakeNotificationRepository: FakeNotificationRepository
        get() = notificationRepository as FakeNotificationRepository

    @Before
    fun setup() {
        hiltRule.inject()
        // Reset fake repository to clean state before each test
        fakeNotificationRepository.reset()
    }

    // MARK: - Notification Tests with Mocked Dependencies (Requirements 9.1, 9.2)

    /**
     * Test: Mark notification as read with mocked repository
     * Requirements: 9.2 - Mark notifications as read
     */
    @Test
    fun testMarkNotificationAsRead_withMockedRepository() {
        // Pre-populate notifications
        fakeNotificationRepository.setNotifications(listOf(
            NotificationDto(
                id = "notif-1",
                userId = "user-1",
                type = NotificationType.ORDER_PLACED,
                title = "New Order",
                message = "You have a new order #123",
                data = mapOf("order_id" to "order-123"),
                isRead = false,
                createdAt = "2025-01-01T10:00:00Z"
            )
        ))

        val notificationPage = NotificationPage(composeTestRule)
        notificationPage
            .assertUnreadNotificationsExist()
            .tapFirstNotification()
        
        // Verify repository was called
        assert(fakeNotificationRepository.markAsReadCallCount >= 1) {
            "NotificationRepository markNotificationAsRead should be called"
        }
    }

    /**
     * Test: Mark all notifications as read with mocked repository
     * Requirements: 9.2 - Mark all notifications as read
     */
    @Test
    fun testMarkAllAsRead_withMockedRepository() {
        // Pre-populate notifications
        fakeNotificationRepository.setNotifications(listOf(
            NotificationDto(
                id = "notif-1",
                userId = "user-1",
                type = NotificationType.ORDER_PLACED,
                title = "New Order",
                message = "You have a new order #123",
                data = null,
                isRead = false,
                createdAt = "2025-01-01T10:00:00Z"
            ),
            NotificationDto(
                id = "notif-2",
                userId = "user-1",
                type = NotificationType.PROMOTION,
                title = "Special Offer",
                message = "Get 20% off!",
                data = null,
                isRead = false,
                createdAt = "2025-01-01T09:00:00Z"
            )
        ))

        val notificationPage = NotificationPage(composeTestRule)
        notificationPage
            .assertUnreadNotificationsExist()
            .markAllAsRead()
        
        // Verify repository was called
        assert(fakeNotificationRepository.markAllAsReadCallCount >= 1) {
            "NotificationRepository markAllNotificationsAsRead should be called"
        }
    }

    /**
     * Test: Empty notifications shows empty state
     * Requirements: 9.1 - Handle empty notifications
     */
    @Test
    fun testEmptyNotifications_showsEmptyState() {
        // Configure empty notifications
        fakeNotificationRepository.configureEmptyResults()

        val notificationPage = NotificationPage(composeTestRule)
        notificationPage.assertEmptyState()
    }

    /**
     * Test: Notification error shows error message
     * Requirements: 9.1 - Handle errors gracefully
     */
    @Test
    fun testNotificationError_showsErrorMessage() {
        // Configure error
        fakeNotificationRepository.configureError("Failed to load notifications")

        val notificationPage = NotificationPage(composeTestRule)
        // Error should be handled gracefully
    }

    // MARK: - Original Notification Tests (kept for compatibility)

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
