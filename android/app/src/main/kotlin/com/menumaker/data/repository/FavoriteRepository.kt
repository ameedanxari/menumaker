package com.menumaker.data.repository

import com.menumaker.data.common.Resource
import com.menumaker.data.remote.api.ApiService
import com.menumaker.data.remote.models.AddFavoriteRequest
import com.menumaker.data.remote.models.FavoriteDto
import com.menumaker.data.remote.models.FavoriteListData
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import javax.inject.Inject

/**
 * Repository interface for managing user favorites
 */
interface FavoriteRepository {
    fun getFavorites(): Flow<Resource<FavoriteListData>>
    fun addFavorite(businessId: String): Flow<Resource<FavoriteDto>>
    fun removeFavorite(favoriteId: String): Flow<Resource<Unit>>
    fun removeFavoriteByBusinessId(businessId: String): Flow<Resource<Unit>>
}

/**
 * Implementation of FavoriteRepository
 */
class FavoriteRepositoryImpl @Inject constructor(
    private val apiService: ApiService
) : FavoriteRepository {

    override fun getFavorites(): Flow<Resource<FavoriteListData>> = flow {
        emit(Resource.Loading)
        try {
            val response = apiService.getFavorites()
            if (response.isSuccessful && response.body() != null) {
                val data = response.body()!!.data
                emit(Resource.Success(data))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to load favorites"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }

    override fun addFavorite(businessId: String): Flow<Resource<FavoriteDto>> = flow {
        emit(Resource.Loading)
        try {
            val request = AddFavoriteRequest(businessId)
            val response = apiService.addFavorite(request)
            if (response.isSuccessful && response.body() != null) {
                val favorite = response.body()!!.data.favorite
                emit(Resource.Success(favorite))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to add favorite"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }

    override fun removeFavorite(favoriteId: String): Flow<Resource<Unit>> = flow {
        emit(Resource.Loading)
        try {
            val response = apiService.removeFavorite(favoriteId)
            if (response.isSuccessful) {
                emit(Resource.Success(Unit))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to remove favorite"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }

    override fun removeFavoriteByBusinessId(businessId: String): Flow<Resource<Unit>> = flow {
        emit(Resource.Loading)
        try {
            val response = apiService.removeFavoriteByBusinessId(businessId)
            if (response.isSuccessful) {
                emit(Resource.Success(Unit))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to remove favorite"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }
}
