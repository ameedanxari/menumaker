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
}

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
}
