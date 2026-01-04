package com.menumaker.data.remote.models

import com.google.gson.annotations.SerializedName

data class DeviceRegistrationRequest(
    @SerializedName("device_token") val deviceToken: String,
    @SerializedName("platform") val platform: String,
    @SerializedName("locale") val locale: String? = null,
    @SerializedName("app_version") val appVersion: String? = null,
    @SerializedName("device_model") val deviceModel: String? = null
)

data class DeviceRegistrationResponse(
    @SerializedName("success") val success: Boolean
)

// Notification List Response
data class NotificationListResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: NotificationListData
)

data class NotificationListData(
    @SerializedName("notifications") val notifications: List<NotificationDto>,
    @SerializedName("total") val total: Int,
    @SerializedName("limit") val limit: Int,
    @SerializedName("offset") val offset: Int
) {
    val unreadCount: Int
        get() = notifications.count { !it.isRead }
}

// Single Notification Response
data class NotificationResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: NotificationData
)

data class NotificationData(
    @SerializedName("notification") val notification: NotificationDto
)

data class NotificationDto(
    @SerializedName("id") val id: String,
    @SerializedName("user_id") val userId: String,
    @SerializedName("type") val type: NotificationType,
    @SerializedName("title") val title: String,
    @SerializedName("message") val message: String,
    @SerializedName("data") val data: Map<String, Any>?,
    @SerializedName("is_read") val isRead: Boolean,
    @SerializedName("created_at") val createdAt: String
)

enum class NotificationType {
    @SerializedName("order_placed")
    ORDER_PLACED,
    @SerializedName("order_confirmed")
    ORDER_CONFIRMED,
    @SerializedName("order_ready")
    ORDER_READY,
    @SerializedName("order_delivered")
    ORDER_DELIVERED,
    @SerializedName("order_cancelled")
    ORDER_CANCELLED,
    @SerializedName("order_update")
    ORDER_UPDATE,
    @SerializedName("payment_received")
    PAYMENT_RECEIVED,
    @SerializedName("payout_completed")
    PAYOUT_COMPLETED,
    @SerializedName("review_received")
    REVIEW_RECEIVED,
    @SerializedName("review")
    REVIEW,
    @SerializedName("promotion")
    PROMOTION,
    @SerializedName("system")
    SYSTEM
}
