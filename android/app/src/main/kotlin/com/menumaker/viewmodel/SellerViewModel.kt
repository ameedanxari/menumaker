package com.menumaker.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.*
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
 * ViewModel for seller dashboard and management with analytics
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

    // Analytics state
    private val _selectedPeriod = MutableStateFlow(TimePeriod.TODAY)
    val selectedPeriod: StateFlow<TimePeriod> = _selectedPeriod.asStateFlow()

    private val _analyticsData = MutableStateFlow<AnalyticsData?>(null)
    val analyticsData: StateFlow<AnalyticsData?> = _analyticsData.asStateFlow()

    private val _customerInsights = MutableStateFlow<CustomerInsights?>(null)
    val customerInsights: StateFlow<CustomerInsights?> = _customerInsights.asStateFlow()

    private val _payoutInfo = MutableStateFlow<PayoutInfo?>(null)
    val payoutInfo: StateFlow<PayoutInfo?> = _payoutInfo.asStateFlow()

    init {
        loadDashboardData()
    }

    // MARK: - Data Loading

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
     * Refresh dashboard data including analytics
     */
    fun refreshData() {
        loadDashboardData()
        loadAnalytics(_selectedPeriod.value)
    }

    private fun updateStatistics() {
        // TODO: Implement statistics calculation from repository data
        // For now, these would be populated from API responses
    }

    // MARK: - Analytics

    /**
     * Load analytics data for a specific time period
     */
    fun loadAnalytics(period: TimePeriod) {
        val businessId = _business.value?.id ?: return

        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null

            try {
                val response = businessRepository.getAnalytics(businessId, period.displayName.lowercase())

                response.collect { result ->
                    when (result) {
                        is Resource.Loading -> {
                            _isLoading.value = true
                        }
                        is Resource.Success -> {
                            result.data?.let { analyticsResponse ->
                                _analyticsData.value = analyticsResponse.analytics
                                _customerInsights.value = analyticsResponse.customerInsights
                                _payoutInfo.value = analyticsResponse.payouts
                            }
                            analyticsService.track("analytics_loaded", mapOf("period" to period.displayName))
                            _isLoading.value = false
                        }
                        is Resource.Error -> {
                            _errorMessage.value = result.message
                            _isLoading.value = false
                        }
                    }
                }
            } catch (e: Exception) {
                _errorMessage.value = e.message
                _isLoading.value = false
            }
        }
    }

    /**
     * Switch to a different analytics time period
     */
    fun switchPeriod(period: TimePeriod) {
        _selectedPeriod.value = period
        loadAnalytics(period)
    }

    /**
     * Export analytics in specified format
     */
    fun exportAnalytics(format: ExportFormat) {
        val businessId = _business.value?.id ?: return

        viewModelScope.launch {
            try {
                val request = ExportRequest(
                    businessId = businessId,
                    period = _selectedPeriod.value.displayName.lowercase(),
                    format = format.displayName,
                    startDate = null,
                    endDate = null
                )

                businessRepository.exportAnalytics(request).collect { result ->
                    when (result) {
                        is Resource.Success -> {
                            analyticsService.track("analytics_exported", mapOf(
                                "format" to format.displayName,
                                "period" to _selectedPeriod.value.displayName
                            ))
                        }
                        is Resource.Error -> {
                            _errorMessage.value = result.message
                        }
                        else -> {}
                    }
                }
            } catch (e: Exception) {
                _errorMessage.value = e.message
            }
        }
    }

    // MARK: - Analytics Helpers

    /**
     * Get popular items from analytics data
     */
    fun getPopularItems(): List<PopularItem> {
        return _analyticsData.value?.popularItems ?: emptyList()
    }

    /**
     * Get sales data points
     */
    fun getSalesData(): List<SalesDataPoint> {
        return _analyticsData.value?.salesData ?: emptyList()
    }

    /**
     * Get peak hours data
     */
    fun getPeakHours(): List<PeakHour> {
        return _analyticsData.value?.peakHours ?: emptyList()
    }

    // MARK: - Business Management

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

    // MARK: - Statistics

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
     * Get average rating
     */
    fun getAverageRating(): Double {
        // TODO: Calculate from review repository
        return 0.0
    }

    /**
     * Get formatted average rating
     */
    fun getFormattedAverageRating(): String {
        return String.format("%.1f", getAverageRating())
    }

    /**
     * Get total reviews count
     */
    fun getTotalReviews(): Int {
        return _recentReviews.value.size
    }

    /**
     * Get pending orders count
     */
    fun getPendingOrders(): Int {
        return _pendingOrders.value
    }

    // MARK: - Quick Actions

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
                        updateStatistics()
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
                        updateStatistics()
                    }
                    is Resource.Error -> {
                        _errorMessage.value = result.message
                    }
                    else -> {}
                }
            }
        }
    }

    // MARK: - Error Handling

    /**
     * Clear error message
     */
    fun clearError() {
        _errorMessage.value = null
    }
}
