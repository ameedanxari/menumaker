package com.menumaker.fakes

import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.DishDto
import com.menumaker.data.repository.DishRepository
import com.menumaker.fixtures.SharedFixtures
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

/**
 * Fake implementation of DishRepository for UI tests.
 * Provides configurable responses for deterministic testing.
 * Supports CRUD operations for menu management testing.
 */
class FakeDishRepository : DishRepository {

    // Configurable responses
    var dishesResponse: Resource<List<DishDto>>? = null
    var dishByIdResponse: Resource<DishDto>? = null
    var createDishResponse: Resource<DishDto>? = null
    var updateDishResponse: Resource<DishDto>? = null
    var deleteDishResponse: Resource<Unit> = Resource.Success(Unit)

    // In-memory storage for dishes
    private val dishes = mutableListOf<DishDto>()

    // Track method calls for verification
    var getDishesByBusinessCallCount = 0
    var getDishByIdCallCount = 0
    var createDishCallCount = 0
    var updateDishCallCount = 0
    var deleteDishCallCount = 0
    var lastBusinessId: String? = null
    var lastDishId: String? = null
    var lastCreatedDish: DishDto? = null
    var lastUpdatedDish: DishDto? = null
    var lastDeletedDishId: String? = null

    private val defaultDishes: List<DishDto>
        get() = SharedFixtures.dishes

    init {
        dishes.addAll(defaultDishes)
    }

    override fun getDishesByBusiness(businessId: String): Flow<Resource<List<DishDto>>> = flow {
        emit(Resource.Loading)
        getDishesByBusinessCallCount++
        lastBusinessId = businessId

        val response = dishesResponse 
            ?: Resource.Success(dishes.filter { it.businessId == businessId })
        emit(response)
    }

    override fun getDishById(id: String): Flow<Resource<DishDto>> = flow {
        emit(Resource.Loading)
        getDishByIdCallCount++
        lastDishId = id

        if (dishByIdResponse != null) {
            emit(dishByIdResponse!!)
        } else {
            val dish = dishes.find { it.id == id }
            if (dish != null) {
                emit(Resource.Success(dish))
            } else {
                emit(Resource.Error("Dish not found"))
            }
        }
    }

    /**
     * Create a new dish (for menu management testing)
     */
    fun createDish(dish: Map<String, Any>): Flow<Resource<DishDto>> = flow {
        emit(Resource.Loading)
        createDishCallCount++

        if (createDishResponse != null) {
            emit(createDishResponse!!)
        } else {
            val newDish = DishDto(
                id = "dish-${System.currentTimeMillis()}",
                businessId = dish["business_id"] as? String ?: "business-1",
                name = dish["name"] as? String ?: "New Dish",
                description = dish["description"] as? String ?: "",
                priceCents = (dish["price_cents"] as? Number)?.toInt() ?: 0,
                imageUrl = dish["image_url"] as? String,
                category = dish["category"] as? String ?: "Main Course",
                isVegetarian = dish["is_vegetarian"] as? Boolean ?: false,
                isAvailable = dish["is_available"] as? Boolean ?: true,
                createdAt = "2025-01-01T00:00:00Z",
                updatedAt = "2025-01-01T00:00:00Z"
            )
            dishes.add(newDish)
            lastCreatedDish = newDish
            emit(Resource.Success(newDish))
        }
    }

    /**
     * Update an existing dish (for menu management testing)
     */
    fun updateDish(id: String, updates: Map<String, Any>): Flow<Resource<DishDto>> = flow {
        emit(Resource.Loading)
        updateDishCallCount++
        lastDishId = id

        if (updateDishResponse != null) {
            emit(updateDishResponse!!)
        } else {
            val index = dishes.indexOfFirst { it.id == id }
            if (index >= 0) {
                val current = dishes[index]
                val updated = current.copy(
                    name = updates["name"] as? String ?: current.name,
                    description = updates["description"] as? String ?: current.description,
                    priceCents = (updates["price_cents"] as? Number)?.toInt() ?: current.priceCents,
                    category = updates["category"] as? String ?: current.category,
                    isVegetarian = updates["is_vegetarian"] as? Boolean ?: current.isVegetarian,
                    isAvailable = updates["is_available"] as? Boolean ?: current.isAvailable,
                    updatedAt = "2025-01-01T00:00:00Z"
                )
                dishes[index] = updated
                lastUpdatedDish = updated
                emit(Resource.Success(updated))
            } else {
                emit(Resource.Error("Dish not found"))
            }
        }
    }

    /**
     * Delete a dish (for menu management testing)
     */
    fun deleteDish(id: String): Flow<Resource<Unit>> = flow {
        emit(Resource.Loading)
        deleteDishCallCount++
        lastDeletedDishId = id

        dishes.removeAll { it.id == id }
        emit(deleteDishResponse)
    }

    /**
     * Reset all state for clean test setup
     */
    fun reset() {
        dishesResponse = null
        dishByIdResponse = null
        createDishResponse = null
        updateDishResponse = null
        deleteDishResponse = Resource.Success(Unit)
        dishes.clear()
        dishes.addAll(defaultDishes)
        getDishesByBusinessCallCount = 0
        getDishByIdCallCount = 0
        createDishCallCount = 0
        updateDishCallCount = 0
        deleteDishCallCount = 0
        lastBusinessId = null
        lastDishId = null
        lastCreatedDish = null
        lastUpdatedDish = null
        lastDeletedDishId = null
    }

    /**
     * Set dishes directly for test setup
     */
    fun setDishes(newDishes: List<DishDto>) {
        dishes.clear()
        dishes.addAll(newDishes)
    }

    /**
     * Add a dish to the in-memory storage
     */
    fun addDish(dish: DishDto) {
        dishes.add(dish)
    }

    /**
     * Get all dishes in storage
     */
    fun getAllDishes(): List<DishDto> = dishes.toList()

    /**
     * Configure for empty results scenario
     */
    fun configureEmptyResults() {
        dishes.clear()
        dishesResponse = Resource.Success(emptyList())
    }

    /**
     * Configure for error scenario
     */
    fun configureError(errorMessage: String = "Failed to load dishes") {
        dishesResponse = Resource.Error(errorMessage)
    }
}
