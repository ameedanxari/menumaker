package com.menumaker.data.repository

import com.menumaker.data.common.Resource
import com.menumaker.data.remote.api.ApiService
import com.menumaker.data.remote.models.NotificationDto
import com.menumaker.data.remote.models.NotificationListData
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import javax.inject.Inject

/**
 * Repository interface for managing user notifications
 */
interface NotificationRepository {
    fun getNotifications(): Flow<Resource<NotificationListData>>
    fun markNotificationAsRead(notificationId: String): Flow<Resource<NotificationDto>>
    fun markAllNotificationsAsRead(): Flow<Resource<Unit>>
    fun getNotificationPreferences(): Flow<Resource<NotificationPreferences>>
    fun updateNotificationPreferences(preferences: NotificationPreferences): Flow<Resource<NotificationPreferences>>
}

data class NotificationPreferences(
    val orderNotificationsEnabled: Boolean = true,
    val promotionNotificationsEnabled: Boolean = true,
    val reviewNotificationsEnabled: Boolean = true,
    val pushNotificationsEnabled: Boolean = true,
    val emailNotificationsEnabled: Boolean = false
)

/**
 * Implementation of NotificationRepository
 */
class NotificationRepositoryImpl @Inject constructor(
    private val apiService: ApiService
) : NotificationRepository {

    override fun getNotifications(): Flow<Resource<NotificationListData>> = flow {
        emit(Resource.Loading)
        try {
            val response = apiService.getNotifications()
            if (response.isSuccessful && response.body() != null) {
                val data = response.body()!!.data
                emit(Resource.Success(data))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to load notifications"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }

    override fun markNotificationAsRead(notificationId: String): Flow<Resource<NotificationDto>> = flow {
        emit(Resource.Loading)
        try {
            val response = apiService.markNotificationAsRead(notificationId)
            if (response.isSuccessful && response.body() != null) {
                val notification = response.body()!!.data.notification
                emit(Resource.Success(notification))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to mark notification as read"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }

    override fun markAllNotificationsAsRead(): Flow<Resource<Unit>> = flow {
        emit(Resource.Loading)
        try {
            val response = apiService.markAllNotificationsAsRead()
            if (response.isSuccessful) {
                emit(Resource.Success(Unit))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to mark all notifications as read"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }

    override fun getNotificationPreferences(): Flow<Resource<NotificationPreferences>> = flow {
        emit(Resource.Loading)
        try {
            val response = apiService.getUserSettings()
            if (response.isSuccessful && response.body() != null) {
                emit(Resource.Success(parsePreferences(response.body()!!)))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to load notification preferences"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }

    override fun updateNotificationPreferences(preferences: NotificationPreferences): Flow<Resource<NotificationPreferences>> = flow {
        emit(Resource.Loading)
        try {
            val response = apiService.updateUserSettings(
                mapOf(
                    "notifications_enabled" to preferences.pushNotificationsEnabled,
                    "order_notifications" to preferences.orderNotificationsEnabled,
                    "promotion_notifications" to preferences.promotionNotificationsEnabled,
                    "review_notifications" to preferences.reviewNotificationsEnabled
                )
            )
            if (response.isSuccessful) {
                emit(Resource.Success(preferences))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to update notification preferences"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }

    private fun parsePreferences(response: Map<String, Any>): NotificationPreferences {
        val settings = ((response["data"] as? Map<*, *>)?.get("settings") as? Map<*, *>) ?: response
        return NotificationPreferences(
            orderNotificationsEnabled = settings.booleanValue("order_notifications", true),
            promotionNotificationsEnabled = settings.booleanValue("promotion_notifications", true),
            reviewNotificationsEnabled = settings.booleanValue("review_notifications", true),
            pushNotificationsEnabled = settings.booleanValue("notifications_enabled", true),
            emailNotificationsEnabled = settings.booleanValue("email_notifications", false)
        )
    }

    private fun Map<*, *>.booleanValue(key: String, defaultValue: Boolean): Boolean {
        return when (val value = this[key]) {
            is Boolean -> value
            is String -> value.equals("true", ignoreCase = true)
            else -> defaultValue
        }
    }
}
