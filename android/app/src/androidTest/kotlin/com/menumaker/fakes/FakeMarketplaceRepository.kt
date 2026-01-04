package com.menumaker.fakes

import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.MarketplaceSellerDto
import com.menumaker.data.repository.MarketplaceRepository
import com.menumaker.fixtures.SharedFixtures
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

/**
 * Fake implementation of MarketplaceRepository for UI tests.
 * Provides configurable responses for deterministic testing.
 */
class FakeMarketplaceRepository : MarketplaceRepository {

    // Configurable response
    var searchResponse: Resource<List<MarketplaceSellerDto>>? = null

    // In-memory storage for sellers
    private val sellers = mutableListOf<MarketplaceSellerDto>()

    // Track method calls for verification
    var searchCallCount = 0
    var lastLatitude: Double? = null
    var lastLongitude: Double? = null
    var lastCuisine: String? = null
    var lastRatingMin: Double? = null
    var lastDistanceKm: Double? = null

    // Default test data
    private val defaultSellers: List<MarketplaceSellerDto>
        get() = SharedFixtures.marketplaceSellers

    init {
        sellers.addAll(defaultSellers)
    }

    override fun searchSellers(
        latitude: Double?,
        longitude: Double?,
        cuisine: String?,
        ratingMin: Double?,
        distanceKm: Double?
    ): Flow<Resource<List<MarketplaceSellerDto>>> = flow {
        emit(Resource.Loading)
        searchCallCount++
        lastLatitude = latitude
        lastLongitude = longitude
        lastCuisine = cuisine
        lastRatingMin = ratingMin
        lastDistanceKm = distanceKm

        if (searchResponse != null) {
            emit(searchResponse!!)
        } else {
            // Apply filters to in-memory sellers
            var filteredSellers = sellers.toList()

            cuisine?.let { c ->
                filteredSellers = filteredSellers.filter { 
                    it.cuisineType?.contains(c, ignoreCase = true) == true 
                }
            }

            ratingMin?.let { r ->
                filteredSellers = filteredSellers.filter { it.rating >= r }
            }

            distanceKm?.let { d ->
                filteredSellers = filteredSellers.filter { 
                    (it.distanceKm ?: Double.MAX_VALUE) <= d 
                }
            }

            emit(Resource.Success(filteredSellers))
        }
    }

    /**
     * Reset all state for clean test setup
     */
    fun reset() {
        searchResponse = null
        sellers.clear()
        sellers.addAll(defaultSellers)
        searchCallCount = 0
        lastLatitude = null
        lastLongitude = null
        lastCuisine = null
        lastRatingMin = null
        lastDistanceKm = null
    }

    /**
     * Set sellers directly for test setup
     */
    fun setSellers(newSellers: List<MarketplaceSellerDto>) {
        sellers.clear()
        sellers.addAll(newSellers)
    }

    /**
     * Add a seller to the in-memory storage
     */
    fun addSeller(seller: MarketplaceSellerDto) {
        sellers.add(seller)
    }

    /**
     * Get all sellers in storage
     */
    fun getAllSellers(): List<MarketplaceSellerDto> = sellers.toList()

    /**
     * Configure for empty results scenario
     */
    fun configureEmptyResults() {
        sellers.clear()
        searchResponse = Resource.Success(emptyList())
    }

    /**
     * Configure for error scenario
     */
    fun configureError(errorMessage: String = "Failed to search sellers") {
        searchResponse = Resource.Error(errorMessage)
    }

    /**
     * Configure with specific sellers
     */
    fun configureWithSellers(sellerList: List<MarketplaceSellerDto>) {
        sellers.clear()
        sellers.addAll(sellerList)
        searchResponse = null // Use filtering logic
    }
}
