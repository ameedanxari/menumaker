package com.menumaker.fakes

import com.menumaker.data.common.Resource
import com.menumaker.data.local.entities.MenuEntity
import com.menumaker.data.repository.MenuRepository
import com.menumaker.fixtures.SharedFixtures
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

/**
 * Fake implementation of MenuRepository for UI tests.
 * Provides configurable responses for deterministic testing.
 */
class FakeMenuRepository : MenuRepository {

    // Configurable response
    var menusResponse: Resource<List<MenuEntity>>? = null

    // In-memory storage for menus
    private val menus = mutableListOf<MenuEntity>()

    // Track method calls for verification
    var getMenusByBusinessCallCount = 0
    var lastBusinessId: String? = null

    // Default test data
    private val defaultMenus: List<MenuEntity>
        get() = SharedFixtures.menus.map {
            MenuEntity(
                id = it.id,
                businessId = it.businessId,
                name = it.name,
                description = it.description,
                isActive = it.isActive,
                createdAt = it.createdAt,
                updatedAt = it.updatedAt
            )
        }

    init {
        menus.addAll(defaultMenus)
    }

    override fun getMenusByBusiness(businessId: String): Flow<Resource<List<MenuEntity>>> = flow {
        emit(Resource.Loading)
        getMenusByBusinessCallCount++
        lastBusinessId = businessId

        val response = menusResponse 
            ?: Resource.Success(menus.filter { it.businessId == businessId })
        emit(response)
    }

    /**
     * Reset all state for clean test setup
     */
    fun reset() {
        menusResponse = null
        menus.clear()
        menus.addAll(defaultMenus)
        getMenusByBusinessCallCount = 0
        lastBusinessId = null
    }

    /**
     * Set menus directly for test setup
     */
    fun setMenus(newMenus: List<MenuEntity>) {
        menus.clear()
        menus.addAll(newMenus)
    }

    /**
     * Configure for empty results scenario
     */
    fun configureEmptyResults() {
        menus.clear()
        menusResponse = Resource.Success(emptyList())
    }

    /**
     * Configure for error scenario
     */
    fun configureError(errorMessage: String = "Failed to load menus") {
        menusResponse = Resource.Error(errorMessage)
    }
}
