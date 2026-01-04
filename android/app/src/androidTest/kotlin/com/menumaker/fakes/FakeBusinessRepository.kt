package com.menumaker.fakes

import com.menumaker.data.common.Resource
import com.menumaker.data.local.entities.BusinessEntity
import com.menumaker.data.remote.models.AnalyticsData
import com.menumaker.data.remote.models.AnalyticsResponseData
import com.menumaker.data.remote.models.BusinessDto
import com.menumaker.data.remote.models.CustomerInsights
import com.menumaker.data.remote.models.ExportRequest
import com.menumaker.data.remote.models.PayoutInfo
import com.menumaker.data.remote.models.PeakHour
import com.menumaker.data.remote.models.PopularItem
import com.menumaker.data.remote.models.SalesDataPoint
import com.menumaker.data.repository.BusinessRepository
import com.menumaker.fixtures.SharedFixtures
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.flow

/**
 * Fake implementation of BusinessRepository for UI tests.
 * Provides configurable responses for deterministic testing.
 */
class FakeBusinessRepository : BusinessRepository {

    // Configurable responses
    var businessesResponse: Resource<List<BusinessDto>>? = null
    var businessByIdResponse: Resource<BusinessDto>? = null
    var updateBusinessResponse: Resource<BusinessDto>? = null
    var analyticsResponse: Resource<AnalyticsResponseData>? = null
    var exportAnalyticsResponse: Resource<Unit> = Resource.Success(Unit)

    // In-memory storage
    private val businesses = mutableListOf<BusinessDto>()
    private val cachedBusinesses = MutableStateFlow<List<BusinessEntity>>(emptyList())

    // Track method calls for verification
    var getBusinessesCallCount = 0
    var getBusinessByIdCallCount = 0
    var updateBusinessCallCount = 0
    var getAnalyticsCallCount = 0
    var exportAnalyticsCallCount = 0
    var lastBusinessId: String? = null
    var lastAnalyticsPeriod: String? = null
    var lastExportRequest: ExportRequest? = null

    // Default test data
    private val defaultBusinesses: List<BusinessDto>
        get() = SharedFixtures.businesses

    private val defaultAnalytics = AnalyticsResponseData(
        analytics = AnalyticsData(
            totalSales = 50000.0,
            totalOrders = 150,
            totalRevenue = 45000.0,
            averageOrderValue = 333.33,
            newCustomers = 50,
            repeatCustomers = 30,
            popularItems = listOf(
                PopularItem(
                    id = "item-1",
                    name = "Popular Dish",
                    salesCount = 50,
                    revenue = 25000.0,
                    imageUrl = null
                )
            ),
            salesData = listOf(
                SalesDataPoint(id = "1", date = "2025-01-01", sales = 5000.0, orders = 15),
                SalesDataPoint(id = "2", date = "2025-01-02", sales = 6000.0, orders = 18)
            ),
            peakHours = listOf(
                PeakHour(hour = 12, orderCount = 25),
                PeakHour(hour = 19, orderCount = 30)
            )
        ),
        customerInsights = CustomerInsights(
            newCustomers = 50,
            repeatCustomers = 30,
            totalCustomers = 80,
            averageOrdersPerCustomer = 1.875
        ),
        payouts = PayoutInfo(
            pendingAmount = 5000.0,
            completedAmount = 40000.0,
            nextPayoutDate = "2025-01-15"
        )
    )

    init {
        businesses.addAll(defaultBusinesses)
        cachedBusinesses.value = defaultBusinesses.map { it.toEntity() }
    }

    override fun getBusinesses(): Flow<Resource<List<BusinessDto>>> = flow {
        emit(Resource.Loading)
        getBusinessesCallCount++

        val response = businessesResponse ?: Resource.Success(businesses.toList())
        emit(response)
    }

    override fun getBusinessById(id: String): Flow<Resource<BusinessDto>> = flow {
        emit(Resource.Loading)
        getBusinessByIdCallCount++
        lastBusinessId = id

        if (businessByIdResponse != null) {
            emit(businessByIdResponse!!)
        } else {
            val business = businesses.find { it.id == id }
            if (business != null) {
                emit(Resource.Success(business))
            } else {
                emit(Resource.Error("Business not found"))
            }
        }
    }

    override fun getCachedBusinesses(): Flow<List<BusinessEntity>> {
        return cachedBusinesses
    }

    override fun updateBusiness(businessId: String, updates: Map<String, Any>): Flow<Resource<BusinessDto>> = flow {
        emit(Resource.Loading)
        updateBusinessCallCount++
        lastBusinessId = businessId

        if (updateBusinessResponse != null) {
            emit(updateBusinessResponse!!)
        } else {
            val index = businesses.indexOfFirst { it.id == businessId }
            if (index >= 0) {
                val current = businesses[index]
                val updated = current.copy(
                    name = updates["name"] as? String ?: current.name,
                    description = updates["description"] as? String ?: current.description
                )
                businesses[index] = updated
                emit(Resource.Success(updated))
            } else {
                emit(Resource.Error("Business not found"))
            }
        }
    }

    override fun getAnalytics(businessId: String, period: String): Flow<Resource<AnalyticsResponseData>> = flow {
        emit(Resource.Loading)
        getAnalyticsCallCount++
        lastBusinessId = businessId
        lastAnalyticsPeriod = period

        val response = analyticsResponse ?: Resource.Success(defaultAnalytics)
        emit(response)
    }

    override fun exportAnalytics(request: ExportRequest): Flow<Resource<Unit>> = flow {
        emit(Resource.Loading)
        exportAnalyticsCallCount++
        lastExportRequest = request

        emit(exportAnalyticsResponse)
    }

    /**
     * Reset all state for clean test setup
     */
    fun reset() {
        businessesResponse = null
        businessByIdResponse = null
        updateBusinessResponse = null
        analyticsResponse = null
        exportAnalyticsResponse = Resource.Success(Unit)
        businesses.clear()
        businesses.addAll(defaultBusinesses)
        cachedBusinesses.value = defaultBusinesses.map { it.toEntity() }
        getBusinessesCallCount = 0
        getBusinessByIdCallCount = 0
        updateBusinessCallCount = 0
        getAnalyticsCallCount = 0
        exportAnalyticsCallCount = 0
        lastBusinessId = null
        lastAnalyticsPeriod = null
        lastExportRequest = null
    }

    /**
     * Set businesses directly for test setup
     */
    fun setBusinesses(newBusinesses: List<BusinessDto>) {
        businesses.clear()
        businesses.addAll(newBusinesses)
        cachedBusinesses.value = newBusinesses.map { it.toEntity() }
    }

    /**
     * Configure for error scenario
     */
    fun configureError(errorMessage: String = "Failed to load businesses") {
        businessesResponse = Resource.Error(errorMessage)
        analyticsResponse = Resource.Error(errorMessage)
    }

    private fun BusinessDto.toEntity() = BusinessEntity(
        id = id,
        name = name,
        slug = slug,
        description = description,
        logoUrl = logoUrl,
        ownerId = ownerId,
        isActive = isActive,
        createdAt = createdAt,
        updatedAt = updatedAt
    )
}
