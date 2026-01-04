package com.menumaker.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.NotificationDto
import com.menumaker.data.remote.models.NotificationListData
import com.menumaker.data.repository.NotificationRepository
import com.menumaker.services.AnalyticsService
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel for managing user notifications
 */
@HiltViewModel
class NotificationViewModel @Inject constructor(
    private val repository: NotificationRepository,
    private val analyticsService: AnalyticsService
) : ViewModel() {

    // Resource state for screen
    private val _notificationsState = MutableStateFlow<Resource<NotificationListData>>(Resource.Loading)
    val notificationsState: StateFlow<Resource<NotificationListData>> = _notificationsState.asStateFlow()

    private val _notifications = MutableStateFlow<List<NotificationDto>>(emptyList())
    val notifications: StateFlow<List<NotificationDto>> = _notifications.asStateFlow()

    private val _unreadCount = MutableStateFlow(0)
    val unreadCount: StateFlow<Int> = _unreadCount.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    // Notification settings
    private val _orderNotificationsEnabled = MutableStateFlow(true)
    val orderNotificationsEnabled: StateFlow<Boolean> = _orderNotificationsEnabled.asStateFlow()

    private val _promotionNotificationsEnabled = MutableStateFlow(true)
    val promotionNotificationsEnabled: StateFlow<Boolean> = _promotionNotificationsEnabled.asStateFlow()

    private val _reviewNotificationsEnabled = MutableStateFlow(true)
    val reviewNotificationsEnabled: StateFlow<Boolean> = _reviewNotificationsEnabled.asStateFlow()

    private val _pushNotificationsEnabled = MutableStateFlow(true)
    val pushNotificationsEnabled: StateFlow<Boolean> = _pushNotificationsEnabled.asStateFlow()

    private val _emailNotificationsEnabled = MutableStateFlow(false)
    val emailNotificationsEnabled: StateFlow<Boolean> = _emailNotificationsEnabled.asStateFlow()

    init {
        loadNotifications()
    }

    /**
     * Load all user notifications
     */
    fun loadNotifications() {
        viewModelScope.launch {
            repository.getNotifications().collect { result ->
                when (result) {
                    is Resource.Loading -> {
                        _isLoading.value = true
                        _errorMessage.value = null
                        _notificationsState.value = Resource.Loading
                    }
                    is Resource.Success -> {
                        _isLoading.value = false
                        _notifications.value = result.data.notifications
                        _unreadCount.value = result.data.unreadCount
                        _notificationsState.value = Resource.Success(result.data)
                        analyticsService.trackScreen("Notifications")
                    }
                    is Resource.Error -> {
                        _isLoading.value = false
                        _errorMessage.value = result.message
                        _notificationsState.value = Resource.Error(result.message ?: "Failed to load notifications")
                    }
                }
            }
        }
    }

    /**
     * Refresh notifications list
     */
    fun refreshNotifications() {
        loadNotifications()
    }

    /**
     * Mark a notification as read
     */
    fun markAsRead(notificationId: String) {
        viewModelScope.launch {
            repository.markNotificationAsRead(notificationId).collect { result ->
                when (result) {
                    is Resource.Loading -> {
                        // Don't show loading for individual mark as read
                    }
                    is Resource.Success -> {
                        // Update local state
                        _notifications.value = _notifications.value.map { notification ->
                            if (notification.id == notificationId) {
                                notification.copy(isRead = true)
                            } else {
                                notification
                            }
                        }
                        _unreadCount.value = maxOf(0, _unreadCount.value - 1)
                        
                        // Update notificationsState
                        val currentState = _notificationsState.value
                        if (currentState is Resource.Success) {
                            _notificationsState.value = Resource.Success(
                                currentState.data.copy(
                                    notifications = _notifications.value
                                )
                            )
                        }
                        
                        analyticsService.track("notification_read", mapOf("notification_id" to notificationId))
                    }
                    is Resource.Error -> {
                        _errorMessage.value = result.message
                    }
                }
            }
        }
    }

    /**
     * Mark all notifications as read
     */
    fun markAllAsRead() {
        viewModelScope.launch {
            repository.markAllNotificationsAsRead().collect { result ->
                when (result) {
                    is Resource.Loading -> {
                        _isLoading.value = true
                    }
                    is Resource.Success -> {
                        _isLoading.value = false
                        // Update all notifications to read
                        _notifications.value = _notifications.value.map { it.copy(isRead = true) }
                        _unreadCount.value = 0
                        
                        // Update notificationsState
                        val currentState = _notificationsState.value
                        if (currentState is Resource.Success) {
                            _notificationsState.value = Resource.Success(
                                currentState.data.copy(
                                    notifications = _notifications.value
                                )
                            )
                        }
                        
                        analyticsService.track("notifications_mark_all_read", emptyMap())
                    }
                    is Resource.Error -> {
                        _isLoading.value = false
                        _errorMessage.value = result.message
                    }
                }
            }
        }
    }

    /**
     * Notification settings setter methods (used by UI)
     */
    fun setOrderNotificationsEnabled(enabled: Boolean) {
        _orderNotificationsEnabled.value = enabled
        // TODO: Save to preferences or API
    }

    fun setPromotionNotificationsEnabled(enabled: Boolean) {
        _promotionNotificationsEnabled.value = enabled
        // TODO: Save to preferences or API
    }

    fun setReviewNotificationsEnabled(enabled: Boolean) {
        _reviewNotificationsEnabled.value = enabled
        // TODO: Save to preferences or API
    }

    fun setPushNotificationsEnabled(enabled: Boolean) {
        _pushNotificationsEnabled.value = enabled
        // TODO: Save to preferences or API
    }

    fun setEmailNotificationsEnabled(enabled: Boolean) {
        _emailNotificationsEnabled.value = enabled
        // TODO: Save to preferences or API
    }

    /**
     * Toggle notification settings (deprecated - use set* methods)
     */
    @Deprecated("Use set* methods instead", ReplaceWith("setOrderNotificationsEnabled(enabled)"))
    fun toggleOrderNotifications(enabled: Boolean) = setOrderNotificationsEnabled(enabled)

    @Deprecated("Use set* methods instead", ReplaceWith("setPromotionNotificationsEnabled(enabled)"))
    fun togglePromotionNotifications(enabled: Boolean) = setPromotionNotificationsEnabled(enabled)

    @Deprecated("Use set* methods instead", ReplaceWith("setReviewNotificationsEnabled(enabled)"))
    fun toggleReviewNotifications(enabled: Boolean) = setReviewNotificationsEnabled(enabled)

    @Deprecated("Use set* methods instead", ReplaceWith("setPushNotificationsEnabled(enabled)"))
    fun togglePushNotifications(enabled: Boolean) = setPushNotificationsEnabled(enabled)

    @Deprecated("Use set* methods instead", ReplaceWith("setEmailNotificationsEnabled(enabled)"))
    fun toggleEmailNotifications(enabled: Boolean) = setEmailNotificationsEnabled(enabled)

    /**
     * Clear error message
     */
    fun clearError() {
        _errorMessage.value = null
    }
}
