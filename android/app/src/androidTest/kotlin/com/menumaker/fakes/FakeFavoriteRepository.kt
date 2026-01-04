package com.menumaker.fakes

import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.FavoriteDto
import com.menumaker.data.remote.models.FavoriteListData
import com.menumaker.data.repository.FavoriteRepository
import com.menumaker.fixtures.SharedFixtures
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

/**
 * Fake implementation of FavoriteRepository for UI tests.
 * Provides configurable responses for deterministic testing.
 */
class FakeFavoriteRepository : FavoriteRepository {

    // Configurable responses
    var favoritesResponse: Resource<FavoriteListData>? = null
    var addFavoriteResponse: Resource<FavoriteDto>? = null
    var removeFavoriteResponse: Resource<Unit> = Resource.Success(Unit)
    var removeFavoriteByBusinessIdResponse: Resource<Unit> = Resource.Success(Unit)

    // In-memory storage for favorites
    private val favorites = mutableListOf<FavoriteDto>()

    // Track method calls for verification
    var getFavoritesCallCount = 0
    var addFavoriteCallCount = 0
    var removeFavoriteCallCount = 0
    var removeFavoriteByBusinessIdCallCount = 0
    var lastAddedBusinessId: String? = null
    var lastRemovedFavoriteId: String? = null
    var lastRemovedBusinessId: String? = null

    // Default test data
    private val defaultFavorites: List<FavoriteDto>
        get() = SharedFixtures.favorites.favorites

    init {
        favorites.addAll(defaultFavorites)
    }

    override fun getFavorites(): Flow<Resource<FavoriteListData>> = flow {
        emit(Resource.Loading)
        getFavoritesCallCount++

        val response = favoritesResponse 
            ?: Resource.Success(FavoriteListData(favorites = favorites.toList()))
        emit(response)
    }

    override fun addFavorite(businessId: String): Flow<Resource<FavoriteDto>> = flow {
        emit(Resource.Loading)
        addFavoriteCallCount++
        lastAddedBusinessId = businessId

        if (addFavoriteResponse != null) {
            emit(addFavoriteResponse!!)
        } else {
            val newFavorite = FavoriteDto(
                id = "fav-${System.currentTimeMillis()}",
                userId = "user-1",
                businessId = businessId,
                business = null,
                createdAt = "2025-01-01T00:00:00Z"
            )
            favorites.add(newFavorite)
            emit(Resource.Success(newFavorite))
        }
    }

    override fun removeFavorite(favoriteId: String): Flow<Resource<Unit>> = flow {
        emit(Resource.Loading)
        removeFavoriteCallCount++
        lastRemovedFavoriteId = favoriteId

        favorites.removeAll { it.id == favoriteId }
        emit(removeFavoriteResponse)
    }

    override fun removeFavoriteByBusinessId(businessId: String): Flow<Resource<Unit>> = flow {
        emit(Resource.Loading)
        removeFavoriteByBusinessIdCallCount++
        lastRemovedBusinessId = businessId

        favorites.removeAll { it.businessId == businessId }
        emit(removeFavoriteByBusinessIdResponse)
    }

    /**
     * Reset all state for clean test setup
     */
    fun reset() {
        favoritesResponse = null
        addFavoriteResponse = null
        removeFavoriteResponse = Resource.Success(Unit)
        removeFavoriteByBusinessIdResponse = Resource.Success(Unit)
        favorites.clear()
        favorites.addAll(defaultFavorites)
        getFavoritesCallCount = 0
        addFavoriteCallCount = 0
        removeFavoriteCallCount = 0
        removeFavoriteByBusinessIdCallCount = 0
        lastAddedBusinessId = null
        lastRemovedFavoriteId = null
        lastRemovedBusinessId = null
    }

    /**
     * Set favorites directly for test setup
     */
    fun setFavorites(newFavorites: List<FavoriteDto>) {
        favorites.clear()
        favorites.addAll(newFavorites)
    }

    /**
     * Check if a business is favorited
     */
    fun isFavorited(businessId: String): Boolean {
        return favorites.any { it.businessId == businessId }
    }

    /**
     * Configure for empty results scenario
     */
    fun configureEmptyResults() {
        favorites.clear()
        favoritesResponse = Resource.Success(FavoriteListData(favorites = emptyList()))
    }

    /**
     * Configure for error scenario
     */
    fun configureError(errorMessage: String = "Failed to load favorites") {
        favoritesResponse = Resource.Error(errorMessage)
    }
}
