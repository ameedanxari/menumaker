package com.menumaker.fakes

import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.NotificationDto
import com.menumaker.data.remote.models.NotificationListData
import com.menumaker.data.remote.models.NotificationType
import com.menumaker.data.repository.NotificationRepository
import com.menumaker.fixtures.SharedFixtures
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

/**
 * Fake implementation of NotificationRepository for UI tests.
 * Provides configurable responses for deterministic testing.
 */
class FakeNotificationRepository : NotificationRepository {

    // Configurable responses
    var notificationsResponse: Resource<NotificationListData>? = null
    var markAsReadResponse: Resource<NotificationDto>? = null
    var markAllAsReadResponse: Resource<Unit> = Resource.Success(Unit)

    // In-memory storage for notifications
    private val notifications = mutableListOf<NotificationDto>()

    // Track method calls for verification
    var getNotificationsCallCount = 0
    var markAsReadCallCount = 0
    var markAllAsReadCallCount = 0
    var lastMarkedNotificationId: String? = null

    // Default test data
    private val defaultNotifications: List<NotificationDto>
        get() = SharedFixtures.notifications.notifications

    init {
        notifications.addAll(defaultNotifications)
    }

    override fun getNotifications(): Flow<Resource<NotificationListData>> = flow {
        emit(Resource.Loading)
        getNotificationsCallCount++

        val response = notificationsResponse ?: Resource.Success(
            NotificationListData(
                notifications = notifications.toList(),
                total = notifications.size,
                limit = 20,
                offset = 0
            )
        )
        emit(response)
    }

    override fun markNotificationAsRead(notificationId: String): Flow<Resource<NotificationDto>> = flow {
        emit(Resource.Loading)
        markAsReadCallCount++
        lastMarkedNotificationId = notificationId

        if (markAsReadResponse != null) {
            emit(markAsReadResponse!!)
        } else {
            val index = notifications.indexOfFirst { it.id == notificationId }
            if (index >= 0) {
                val updatedNotification = notifications[index].copy(isRead = true)
                notifications[index] = updatedNotification
                emit(Resource.Success(updatedNotification))
            } else {
                emit(Resource.Error("Notification not found"))
            }
        }
    }

    override fun markAllNotificationsAsRead(): Flow<Resource<Unit>> = flow {
        emit(Resource.Loading)
        markAllAsReadCallCount++

        // Mark all notifications as read
        val updatedNotifications = notifications.map { it.copy(isRead = true) }
        notifications.clear()
        notifications.addAll(updatedNotifications)

        emit(markAllAsReadResponse)
    }

    /**
     * Reset all state for clean test setup
     */
    fun reset() {
        notificationsResponse = null
        markAsReadResponse = null
        markAllAsReadResponse = Resource.Success(Unit)
        notifications.clear()
        notifications.addAll(defaultNotifications)
        getNotificationsCallCount = 0
        markAsReadCallCount = 0
        markAllAsReadCallCount = 0
        lastMarkedNotificationId = null
    }

    /**
     * Set notifications directly for test setup
     */
    fun setNotifications(newNotifications: List<NotificationDto>) {
        notifications.clear()
        notifications.addAll(newNotifications)
    }

    /**
     * Get unread count
     */
    fun getUnreadCount(): Int = notifications.count { !it.isRead }

    /**
     * Configure for empty results scenario
     */
    fun configureEmptyResults() {
        notifications.clear()
        notificationsResponse = Resource.Success(
            NotificationListData(
                notifications = emptyList(),
                total = 0,
                limit = 20,
                offset = 0
            )
        )
    }

    /**
     * Configure for error scenario
     */
    fun configureError(errorMessage: String = "Failed to load notifications") {
        notificationsResponse = Resource.Error(errorMessage)
    }
}
