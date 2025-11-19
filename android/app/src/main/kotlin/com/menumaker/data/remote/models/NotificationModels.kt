package com.menumaker.data.remote.models

import com.google.gson.annotations.SerializedName

/**
 * Notification type enumeration
 */
enum class NotificationType(val value: String) {
    @SerializedName("order_update")
    ORDER_UPDATE("order_update"),

    @SerializedName("promotion")
    PROMOTION("promotion"),

    @SerializedName("review")
    REVIEW("review"),

    @SerializedName("system")
    SYSTEM("system");

    companion object {
        fun fromString(value: String): NotificationType {
            return values().find { it.value == value } ?: SYSTEM
        }
    }
}

/**
 * Data Transfer Object for Notification
 * Represents a user notification
 */
data class NotificationDto(
    @SerializedName("id") val id: String,
    @SerializedName("user_id") val userId: String,
    @SerializedName("type") val type: NotificationType,
    @SerializedName("title") val title: String,
    @SerializedName("message") val message: String,
    @SerializedName("is_read") val isRead: Boolean,
    @SerializedName("created_at") val createdAt: String,
    @SerializedName("data") val data: Map<String, String>?
)

/**
 * API Response for notification list
 */
data class NotificationListResponse(
    @SerializedName("data") val data: NotificationListData
)

data class NotificationListData(
    @SerializedName("notifications") val notifications: List<NotificationDto>,
    @SerializedName("unread_count") val unreadCount: Int
)

/**
 * API Response for a single notification
 */
data class NotificationResponse(
    @SerializedName("data") val data: NotificationData
)

data class NotificationData(
    @SerializedName("notification") val notification: NotificationDto
)

/**
 * Request to mark notification as read
 */
data class MarkNotificationReadRequest(
    @SerializedName("notification_id") val notificationId: String
)

/**
 * Request to mark all notifications as read
 */
data class MarkAllNotificationsReadRequest(
    @SerializedName("user_id") val userId: String
)
