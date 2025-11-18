package com.menumaker.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.BusinessDto
import com.menumaker.data.remote.models.DishDto
import com.menumaker.data.remote.models.OrderDto
import com.menumaker.data.remote.models.ReviewDto
import com.menumaker.data.repository.BusinessRepository
import com.menumaker.data.repository.DishRepository
import com.menumaker.data.repository.OrderRepository
import com.menumaker.data.repository.ReviewRepository
import com.menumaker.services.AnalyticsService
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel for seller dashboard and management
 */
@HiltViewModel
class SellerViewModel @Inject constructor(
    private val businessRepository: BusinessRepository,
    private val orderRepository: OrderRepository,
    private val dishRepository: DishRepository,
    private val reviewRepository: ReviewRepository,
    private val analyticsService: AnalyticsService
) : ViewModel() {

    private val _business = MutableStateFlow<BusinessDto?>(null)
    val business: StateFlow<BusinessDto?> = _business.asStateFlow()

    private val _todayOrders = MutableStateFlow<List<OrderDto>>(emptyList())
    val todayOrders: StateFlow<List<OrderDto>> = _todayOrders.asStateFlow()

    private val _todayRevenue = MutableStateFlow(0.0)
    val todayRevenue: StateFlow<Double> = _todayRevenue.asStateFlow()

    private val _pendingOrders = MutableStateFlow(0)
    val pendingOrders: StateFlow<Int> = _pendingOrders.asStateFlow()

    private val _dishes = MutableStateFlow<List<DishDto>>(emptyList())
    val dishes: StateFlow<List<DishDto>> = _dishes.asStateFlow()

    private val _recentReviews = MutableStateFlow<List<ReviewDto>>(emptyList())
    val recentReviews: StateFlow<List<ReviewDto>> = _recentReviews.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    init {
        loadDashboardData()
    }

    /**
     * Load all dashboard data
     */
    fun loadDashboardData() {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null

            try {
                // Load business first
                // TODO: Implement getCurrentBusiness() method
                // For now, we'll skip this and assume businessId is available

                // In production, you would:
                // 1. Get current business
                // 2. Load data in parallel
                // 3. Update statistics

                _isLoading.value = false
            } catch (e: Exception) {
                _errorMessage.value = e.message
                _isLoading.value = false
            }
        }
    }

    /**
     * Refresh dashboard data
     */
    fun refreshData() {
        loadDashboardData()
    }

    /**
     * Update business information
     */
    fun updateBusiness(
        businessId: String,
        name: String?,
        description: String?,
        logoUrl: String?
    ) {
        viewModelScope.launch {
            _isLoading.value = true

            val updates = mutableMapOf<String, Any>()
            name?.let { updates["name"] = it }
            description?.let { updates["description"] = it }
            logoUrl?.let { updates["logo_url"] = it }

            businessRepository.updateBusiness(businessId, updates).collect { result ->
                when (result) {
                    is Resource.Loading -> {
                        _isLoading.value = true
                    }
                    is Resource.Success -> {
                        _business.value = result.data
                        analyticsService.track("business_updated", emptyMap())
                        _isLoading.value = false
                    }
                    is Resource.Error -> {
                        _errorMessage.value = result.message
                        _isLoading.value = false
                    }
                }
            }
        }
    }

    /**
     * Get formatted revenue
     */
    fun getFormattedRevenue(): String {
        return String.format("₹%.2f", _todayRevenue.value)
    }

    /**
     * Get total dishes count
     */
    fun getTotalDishes(): Int {
        return _dishes.value.size
    }

    /**
     * Get available dishes count
     */
    fun getAvailableDishes(): Int {
        return _dishes.value.count { it.isAvailable }
    }

    /**
     * Mark order as ready
     */
    fun markOrderAsReady(orderId: String) {
        viewModelScope.launch {
            orderRepository.updateOrderStatus(orderId, mapOf("status" to "ready")).collect { result ->
                when (result) {
                    is Resource.Success -> {
                        analyticsService.track("order_status_changed", mapOf(
                            "order_id" to orderId,
                            "new_status" to "ready"
                        ))
                        loadDashboardData()
                    }
                    is Resource.Error -> {
                        _errorMessage.value = result.message
                    }
                    else -> {}
                }
            }
        }
    }

    /**
     * Mark order as fulfilled
     */
    fun markOrderAsFulfilled(orderId: String) {
        viewModelScope.launch {
            orderRepository.updateOrderStatus(orderId, mapOf("status" to "fulfilled")).collect { result ->
                when (result) {
                    is Resource.Success -> {
                        analyticsService.track("order_completed", mapOf("order_id" to orderId))
                        loadDashboardData()
                    }
                    is Resource.Error -> {
                        _errorMessage.value = result.message
                    }
                    else -> {}
                }
            }
        }
    }

    /**
     * Clear error message
     */
    fun clearError() {
        _errorMessage.value = null
    }
}
