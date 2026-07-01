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
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import javax.inject.Inject

enum class SellerDashboardStatus {
    Idle,
    Loading,
    Content,
    Empty,
    StaleOffline,
    PartialError,
    FatalError
}

data class SellerDashboardSectionError(
    val source: String,
    val message: String
)

data class SellerDashboardFreshness(
    val loadedAtMillis: Long,
    val stale: Boolean
)

data class SellerDashboardUiState(
    val status: SellerDashboardStatus = SellerDashboardStatus.Idle,
    val business: BusinessDto? = null,
    val orders: List<OrderDto> = emptyList(),
    val dishes: List<DishDto> = emptyList(),
    val reviews: List<ReviewDto> = emptyList(),
    val todayRevenue: Double = 0.0,
    val pendingOrders: Int = 0,
    val availableDishes: Int = 0,
    val averageRating: Double = 0.0,
    val freshness: SellerDashboardFreshness? = null,
    val sectionErrors: List<SellerDashboardSectionError> = emptyList(),
    val retryableSources: Set<String> = emptySet()
) {
    val isLoading: Boolean = status == SellerDashboardStatus.Loading
    val hasContent: Boolean = orders.isNotEmpty() || dishes.isNotEmpty() || reviews.isNotEmpty()
}

private data class DashboardSection<T>(
    val source: String,
    val data: T?,
    val error: SellerDashboardSectionError?,
    val stale: Boolean
)

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

    private val _dashboardState = MutableStateFlow(SellerDashboardUiState())
    val dashboardState: StateFlow<SellerDashboardUiState> = _dashboardState.asStateFlow()

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
            _dashboardState.value = _dashboardState.value.copy(
                status = SellerDashboardStatus.Loading,
                sectionErrors = emptyList(),
                retryableSources = emptySet()
            )

            val businessSection = collectDashboardSection("business") {
                businessRepository.getBusinesses()
            }
            val selectedBusiness = businessSection.data?.firstOrNull { it.isActive }
                ?: businessSection.data?.firstOrNull()

            if (selectedBusiness == null) {
                val status = if (businessSection.error == null) {
                    SellerDashboardStatus.Empty
                } else {
                    SellerDashboardStatus.FatalError
                }
                val errors = listOfNotNull(businessSection.error)
                _business.value = null
                _todayOrders.value = emptyList()
                _dishes.value = emptyList()
                _recentReviews.value = emptyList()
                _todayRevenue.value = 0.0
                _pendingOrders.value = 0
                _dashboardState.value = SellerDashboardUiState(
                    status = status,
                    sectionErrors = errors,
                    retryableSources = errors.map { it.source }.toSet()
                )
                _errorMessage.value = errors.firstOrNull()?.message
                _isLoading.value = false
                return@launch
            }

            _business.value = selectedBusiness

            val ordersDeferred = async {
                collectDashboardSection("orders") {
                    orderRepository.getOrdersByBusiness(selectedBusiness.id)
                }
            }
            val dishesDeferred = async {
                collectDashboardSection("dishes") {
                    dishRepository.getDishesByBusiness(selectedBusiness.id)
                }
            }
            val reviewsDeferred = async {
                collectDashboardSection("reviews") {
                    reviewRepository.getReviews(selectedBusiness.id)
                }
            }
            val analyticsDeferred = async {
                collectDashboardSection("analytics") {
                    businessRepository.getAnalytics(selectedBusiness.id, _selectedPeriod.value.displayName.lowercase())
                }
            }

            val ordersSection = ordersDeferred.await()
            val dishesSection = dishesDeferred.await()
            val reviewsSection = reviewsDeferred.await()
            val analyticsSection = analyticsDeferred.await()

            val orders = ordersSection.data.orEmpty()
            val dishes = dishesSection.data.orEmpty()
            val reviewData = reviewsSection.data
            val reviews = reviewData?.reviews.orEmpty()
            val analytics = analyticsSection.data

            _todayOrders.value = orders
            _dishes.value = dishes
            _recentReviews.value = reviews
            _todayRevenue.value = analytics?.analytics?.totalRevenue ?: (orders.sumOf { it.totalCents } / 100.0)
            _pendingOrders.value = orders.count { it.status.equals("pending", ignoreCase = true) }
            _analyticsData.value = analytics?.analytics
            _customerInsights.value = analytics?.customerInsights
            _payoutInfo.value = analytics?.payouts

            val errors = listOfNotNull(
                businessSection.error,
                ordersSection.error,
                dishesSection.error,
                reviewsSection.error,
                analyticsSection.error
            )
            val stale = listOf(businessSection, ordersSection, dishesSection, reviewsSection, analyticsSection)
                .any { it.stale }
            val hasContent = orders.isNotEmpty() || dishes.isNotEmpty() || reviews.isNotEmpty()
            val status = when {
                errors.isNotEmpty() && !hasContent -> SellerDashboardStatus.FatalError
                errors.isNotEmpty() && stale -> SellerDashboardStatus.StaleOffline
                errors.isNotEmpty() -> SellerDashboardStatus.PartialError
                !hasContent -> SellerDashboardStatus.Empty
                else -> SellerDashboardStatus.Content
            }

            _dashboardState.value = SellerDashboardUiState(
                status = status,
                business = selectedBusiness,
                orders = orders,
                dishes = dishes,
                reviews = reviews,
                todayRevenue = _todayRevenue.value,
                pendingOrders = _pendingOrders.value,
                availableDishes = dishes.count { it.isAvailable },
                averageRating = reviewData?.averageRating ?: reviews.map { it.rating }.averageOrZero(),
                freshness = SellerDashboardFreshness(
                    loadedAtMillis = System.currentTimeMillis(),
                    stale = stale
                ),
                sectionErrors = errors,
                retryableSources = errors.map { it.source }.toSet()
            )
            _errorMessage.value = errors.firstOrNull()?.message
            analyticsService.track("seller_dashboard_loaded", mapOf("status" to status.name.lowercase()))
            _isLoading.value = false
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
        val orders = _todayOrders.value
        val dishes = _dishes.value
        _todayRevenue.value = orders.sumOf { it.totalCents } / 100.0
        _pendingOrders.value = orders.count { it.status.equals("pending", ignoreCase = true) }
        _dashboardState.value = _dashboardState.value.copy(
            todayRevenue = _todayRevenue.value,
            pendingOrders = _pendingOrders.value,
            availableDishes = dishes.count { it.isAvailable },
            averageRating = getAverageRating()
        )
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
        return _dashboardState.value.averageRating.takeIf { it > 0.0 }
            ?: _recentReviews.value.map { it.rating }.averageOrZero()
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
            orderRepository.updateOrderStatus(orderId, "ready").collect { result ->
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
            orderRepository.updateOrderStatus(orderId, "fulfilled").collect { result ->
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
        _dashboardState.value = _dashboardState.value.copy(sectionErrors = emptyList(), retryableSources = emptySet())
    }

    fun retryDashboardSection(source: String? = null) {
        analyticsService.track("seller_dashboard_retry", mapOf("source" to (source ?: "all")))
        loadDashboardData()
    }

    private suspend fun <T> collectDashboardSection(
        source: String,
        loader: () -> kotlinx.coroutines.flow.Flow<Resource<T>>
    ): DashboardSection<T> {
        var latest: T? = null
        var latestError: SellerDashboardSectionError? = null
        val completed = withTimeoutOrNull(DASHBOARD_LOAD_TIMEOUT_MS) {
            loader().collect { result ->
                when (result) {
                    is Resource.Loading -> Unit
                    is Resource.Success -> latest = result.data
                    is Resource.Error -> latestError = SellerDashboardSectionError(source, result.message)
                }
            }
            true
        } ?: false

        if (!completed && latest == null && latestError == null) {
            latestError = SellerDashboardSectionError(source, "Timed out loading $source")
        }

        return DashboardSection(
            source = source,
            data = latest,
            error = latestError,
            stale = latest != null && (latestError != null || !completed)
        )
    }

    private fun List<Int>.averageOrZero(): Double = if (isEmpty()) 0.0 else average()

    companion object {
        private const val DASHBOARD_LOAD_TIMEOUT_MS = 1_500L
    }
}
