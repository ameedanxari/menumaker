package com.menumaker.data.repository

import com.menumaker.data.common.Resource
import com.menumaker.data.remote.api.ApiService
import com.menumaker.data.remote.models.MarketplaceSellerDto
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import javax.inject.Inject

interface MarketplaceRepository {
    fun searchSellers(
        latitude: Double?,
        longitude: Double?,
        cuisine: String?,
        ratingMin: Double?,
        distanceKm: Double?
    ): Flow<Resource<List<MarketplaceSellerDto>>>
}

class MarketplaceRepositoryImpl @Inject constructor(
    private val apiService: ApiService
) : MarketplaceRepository {

    override fun searchSellers(
        latitude: Double?,
        longitude: Double?,
        cuisine: String?,
        ratingMin: Double?,
        distanceKm: Double?
    ): Flow<Resource<List<MarketplaceSellerDto>>> = flow {
        emit(Resource.Loading)
        try {
            val response = apiService.searchSellers(
                latitude, longitude, cuisine, ratingMin, distanceKm
            )
            if (response.isSuccessful && response.body() != null) {
                val sellers = response.body()!!.data.sellers
                emit(Resource.Success(sellers))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to search sellers"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }
}
