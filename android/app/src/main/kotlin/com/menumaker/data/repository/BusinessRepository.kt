package com.menumaker.data.repository

import com.menumaker.data.common.Resource
import com.menumaker.data.local.db.dao.BusinessDao
import com.menumaker.data.local.entities.BusinessEntity
import com.menumaker.data.remote.api.ApiService
import com.menumaker.data.remote.models.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject

interface BusinessRepository {
    fun getBusinesses(): Flow<Resource<List<BusinessDto>>>
    fun getBusinessById(id: String): Flow<Resource<BusinessDto>>
    fun getCachedBusinesses(): Flow<List<BusinessEntity>>
    fun updateBusiness(businessId: String, updates: Map<String, Any>): Flow<Resource<BusinessDto>>
    fun getAnalytics(businessId: String, period: String): Flow<Resource<AnalyticsResponseData>>
    fun exportAnalytics(request: ExportRequest): Flow<Resource<Unit>>
}

class BusinessRepositoryImpl @Inject constructor(
    private val apiService: ApiService,
    private val businessDao: BusinessDao
) : BusinessRepository {

    override fun getBusinesses(): Flow<Resource<List<BusinessDto>>> = flow {
        emit(Resource.Loading)
        try {
            // First emit cached data
            businessDao.getAllBusinesses().collect { cached ->
                if (cached.isNotEmpty()) {
                    emit(Resource.Success(cached.map { it.toDto() }))
                }
            }

            // Then fetch fresh data
            val response = apiService.getBusinesses()
            if (response.isSuccessful && response.body() != null) {
                val businesses = response.body()!!.data.businesses
                // Cache to Room
                businessDao.insertBusinesses(businesses.map { it.toEntity() })
                emit(Resource.Success(businesses))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to load businesses"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }

    override fun getBusinessById(id: String): Flow<Resource<BusinessDto>> = flow {
        emit(Resource.Loading)
        try {
            val response = apiService.getBusinessById(id)
            if (response.isSuccessful && response.body() != null) {
                val business = response.body()!!.data.business
                businessDao.insertBusiness(business.toEntity())
                emit(Resource.Success(business))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to load business"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }

    override fun getCachedBusinesses(): Flow<List<BusinessEntity>> {
        return businessDao.getAllBusinesses()
    }

    override fun updateBusiness(businessId: String, updates: Map<String, Any>): Flow<Resource<BusinessDto>> = flow {
        emit(Resource.Loading)
        try {
            val response = apiService.updateBusiness(businessId, updates)
            if (response.isSuccessful && response.body() != null) {
                val business = response.body()!!.data.business
                businessDao.insertBusiness(business.toEntity())
                emit(Resource.Success(business))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to update business"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }

    override fun getAnalytics(businessId: String, period: String): Flow<Resource<AnalyticsResponseData>> = flow {
        emit(Resource.Loading)
        try {
            val response = apiService.getAnalytics(businessId, period)
            if (response.isSuccessful && response.body() != null) {
                val analyticsData = response.body()!!.data
                emit(Resource.Success(analyticsData))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to load analytics"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }

    override fun exportAnalytics(request: ExportRequest): Flow<Resource<Unit>> = flow {
        emit(Resource.Loading)
        try {
            val response = apiService.exportAnalytics(request)
            if (response.isSuccessful) {
                emit(Resource.Success(Unit))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to export analytics"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
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

    private fun BusinessEntity.toDto() = BusinessDto(
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
