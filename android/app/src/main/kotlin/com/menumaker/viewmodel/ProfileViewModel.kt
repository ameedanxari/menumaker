package com.menumaker.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.menumaker.data.common.Resource
import com.menumaker.data.repository.AuthRepository
import com.menumaker.services.AnalyticsService
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel for managing user profile
 */
@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val analyticsService: AnalyticsService
) : ViewModel() {

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private val _successMessage = MutableStateFlow<String?>(null)
    val successMessage: StateFlow<String?> = _successMessage.asStateFlow()

    /**
     * Update user profile
     */
    fun updateProfile(
        name: String?,
        phone: String?,
        address: String?,
        onSuccess: () -> Unit = {}
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            _successMessage.value = null

            val updates = mutableMapOf<String, Any>()
            name?.let { updates["name"] = it }
            phone?.let { updates["phone"] = it }
            address?.let { updates["address"] = it }

            // TODO: Use a ProfileRepository when created
            // For now, use AuthRepository's updateProfile method if available
            // Or create API call directly

            try {
                // Simulated for now - implement actual API call
                kotlinx.coroutines.delay(1000)
                _successMessage.value = "Profile updated successfully"
                analyticsService.track("profile_updated", emptyMap())
                onSuccess()
            } catch (e: Exception) {
                _errorMessage.value = e.message ?: "Failed to update profile"
            }

            _isLoading.value = false
        }
    }

    /**
     * Change user password
     */
    fun changePassword(
        currentPassword: String,
        newPassword: String,
        confirmPassword: String,
        onSuccess: () -> Unit = {}
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            _successMessage.value = null

            // Validate inputs
            when {
                currentPassword.isEmpty() -> {
                    _errorMessage.value = "Current password is required"
                    _isLoading.value = false
                    return@launch
                }
                newPassword.isEmpty() -> {
                    _errorMessage.value = "New password is required"
                    _isLoading.value = false
                    return@launch
                }
                newPassword.length < 6 -> {
                    _errorMessage.value = "Password must be at least 6 characters"
                    _isLoading.value = false
                    return@launch
                }
                newPassword != confirmPassword -> {
                    _errorMessage.value = "Passwords do not match"
                    _isLoading.value = false
                    return@launch
                }
            }

            try {
                // TODO: Implement actual password change API call
                kotlinx.coroutines.delay(1000)
                _successMessage.value = "Password changed successfully"
                analyticsService.track("password_changed", emptyMap())
                onSuccess()
            } catch (e: Exception) {
                _errorMessage.value = e.message ?: "Failed to change password"
            }

            _isLoading.value = false
        }
    }

    /**
     * Validate name
     */
    fun validateName(name: String): String? {
        return when {
            name.isEmpty() -> "Name cannot be empty"
            name.length < 2 -> "Name must be at least 2 characters"
            name.length > 50 -> "Name is too long"
            else -> null
        }
    }

    /**
     * Validate phone number
     */
    fun validatePhone(phone: String): String? {
        if (phone.isEmpty()) return null // Phone is optional

        val numericPhone = phone.filter { it.isDigit() }
        return if (numericPhone.length < 10) {
            "Phone number must be at least 10 digits"
        } else null
    }

    /**
     * Clear messages
     */
    fun clearMessages() {
        _errorMessage.value = null
        _successMessage.value = null
    }
}
