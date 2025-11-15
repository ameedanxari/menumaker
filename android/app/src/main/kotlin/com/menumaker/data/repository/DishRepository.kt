package com.menumaker.data.repository

import com.menumaker.data.common.Resource
import com.menumaker.data.local.db.dao.DishDao
import com.menumaker.data.local.entities.DishEntity
import com.menumaker.data.remote.api.ApiService
import com.menumaker.data.remote.models.DishDto
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import javax.inject.Inject

interface DishRepository {
    fun getDishesByBusiness(businessId: String): Flow<Resource<List<DishDto>>>
    fun getDishById(id: String): Flow<Resource<DishDto>>
}

class DishRepositoryImpl @Inject constructor(
    private val apiService: ApiService,
    private val dishDao: DishDao
) : DishRepository {

    override fun getDishesByBusiness(businessId: String): Flow<Resource<List<DishDto>>> = flow {
        emit(Resource.Loading)
        try {
            // First emit cached data
            dishDao.getDishesByBusiness(businessId).collect { cached ->
                if (cached.isNotEmpty()) {
                    emit(Resource.Success(cached.map { it.toDto() }))
                }
            }

            // Then fetch fresh data
            val response = apiService.getDishesByBusiness(businessId)
            if (response.isSuccessful && response.body() != null) {
                val dishes = response.body()!!.data.dishes
                dishDao.insertDishes(dishes.map { it.toEntity() })
                emit(Resource.Success(dishes))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to load dishes"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }

    override fun getDishById(id: String): Flow<Resource<DishDto>> = flow {
        emit(Resource.Loading)
        try {
            val response = apiService.getDishById(id)
            if (response.isSuccessful && response.body() != null) {
                val dish = response.body()!!.data.dish
                dishDao.insertDish(dish.toEntity())
                emit(Resource.Success(dish))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to load dish"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }

    private fun DishDto.toEntity() = DishEntity(
        id = id,
        businessId = businessId,
        name = name,
        description = description,
        priceCents = priceCents,
        imageUrl = imageUrl,
        category = category,
        isVegetarian = isVegetarian,
        isAvailable = isAvailable,
        createdAt = createdAt,
        updatedAt = updatedAt
    )

    private fun DishEntity.toDto() = DishDto(
        id = id,
        businessId = businessId,
        name = name,
        description = description,
        priceCents = priceCents,
        imageUrl = imageUrl,
        category = category,
        isVegetarian = isVegetarian,
        isAvailable = isAvailable,
        createdAt = createdAt,
        updatedAt = updatedAt
    )
}
