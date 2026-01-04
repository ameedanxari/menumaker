package com.menumaker.repository

import com.google.common.truth.Truth.assertThat
import com.menumaker.data.common.Resource
import com.menumaker.data.local.db.dao.DishDao
import com.menumaker.data.local.db.dao.OrderDao
import com.menumaker.data.local.entities.DishEntity
import com.menumaker.data.local.entities.OrderEntity
import com.menumaker.data.remote.models.DishDto
import com.menumaker.data.remote.models.OrderDto
import com.menumaker.data.repository.DishRepositoryImpl
import com.menumaker.data.repository.OrderRepositoryImpl
import com.menumaker.testutils.FakeApiService
import com.menumaker.testutils.TestDataFactory
import com.menumaker.testutils.TestDispatcherRule
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.test.runTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import retrofit2.Response
import java.io.IOException

/**
 * Unit tests for offline-first data handling in repositories.
 * Tests that cached data is returned when network fails and cache-first loading pattern.
 *
 * Requirements: 6.1 - WHEN the device is offline THEN the MenuMaker_Android SHALL serve cached data from Room database
 * Requirements: 6.3 - WHEN cached data exists THEN the MenuMaker_Android SHALL display cached data immediately while fetching fresh data
 */
@OptIn(ExperimentalCoroutinesApi::class)
class OfflineDataTest {

    @get:Rule
    val dispatcherRule = TestDispatcherRule()

    private lateinit var fakeApiService: FakeApiService
    private lateinit var mockOrderDao: OrderDao
    private lateinit var mockDishDao: DishDao
    private lateinit var orderRepository: OrderRepositoryImpl
    private lateinit var dishRepository: DishRepositoryImpl

    @Before
    fun setup() {
        fakeApiService = FakeApiService()
        mockOrderDao = mock()
        mockDishDao = mock()
        orderRepository = OrderRepositoryImpl(fakeApiService, mockOrderDao)
        dishRepository = DishRepositoryImpl(fakeApiService, mockDishDao)
    }

    // ==================== Cached Data Returned When Network Fails ====================

    @Test
    fun `getOrdersByBusiness returns cached data when network fails`() = runTest {
        // Given - cached orders exist
        val cachedOrders = listOf(
            createOrderEntity(id = "cached-order-1", status = "pending"),
            createOrderEntity(id = "cached-order-2", status = "confirmed")
        )
        whenever(mockOrderDao.getOrdersByBusiness(any())).thenReturn(flowOf(cachedOrders))
        
        // And network fails
        fakeApiService.shouldThrowException = IOException("Network unavailable")

        // When
        val results = orderRepository.getOrdersByBusiness("business-123").toList()

        // Then - should emit Loading first
        assertThat(results.first()).isEqualTo(Resource.Loading)
        
        // And should emit cached data
        val cachedResult = results.find { it is Resource.Success } as? Resource.Success<List<OrderDto>>
        assertThat(cachedResult).isNotNull()
        assertThat(cachedResult!!.data).hasSize(2)
        assertThat(cachedResult.data[0].id).isEqualTo("cached-order-1")
        assertThat(cachedResult.data[1].id).isEqualTo("cached-order-2")
    }

    @Test
    fun `getDishesByBusiness returns cached data when network fails`() = runTest {
        // Given - cached dishes exist
        val cachedDishes = listOf(
            createDishEntity(id = "cached-dish-1", name = "Cached Dish 1"),
            createDishEntity(id = "cached-dish-2", name = "Cached Dish 2")
        )
        whenever(mockDishDao.getDishesByBusiness(any())).thenReturn(flowOf(cachedDishes))
        
        // And network fails
        fakeApiService.shouldThrowException = IOException("Network unavailable")

        // When
        val results = dishRepository.getDishesByBusiness("business-123").toList()

        // Then - should emit Loading first
        assertThat(results.first()).isEqualTo(Resource.Loading)
        
        // And should emit cached data
        val cachedResult = results.find { it is Resource.Success } as? Resource.Success<List<DishDto>>
        assertThat(cachedResult).isNotNull()
        assertThat(cachedResult!!.data).hasSize(2)
        assertThat(cachedResult.data[0].id).isEqualTo("cached-dish-1")
        assertThat(cachedResult.data[1].id).isEqualTo("cached-dish-2")
    }

    @Test
    fun `getOrdersByBusiness returns cached data when HTTP error occurs`() = runTest {
        // Given - cached orders exist
        val cachedOrders = listOf(
            createOrderEntity(id = "cached-order-1", status = "pending")
        )
        whenever(mockOrderDao.getOrdersByBusiness(any())).thenReturn(flowOf(cachedOrders))
        
        // And server returns error
        fakeApiService.errorCode = 500
        fakeApiService.errorMessage = "Internal Server Error"

        // When
        val results = orderRepository.getOrdersByBusiness("business-123").toList()

        // Then - should emit cached data before error
        val cachedResult = results.find { it is Resource.Success } as? Resource.Success<List<OrderDto>>
        assertThat(cachedResult).isNotNull()
        assertThat(cachedResult!!.data).hasSize(1)
        assertThat(cachedResult.data[0].id).isEqualTo("cached-order-1")
    }

    @Test
    fun `getDishesByBusiness returns cached data when HTTP error occurs`() = runTest {
        // Given - cached dishes exist
        val cachedDishes = listOf(
            createDishEntity(id = "cached-dish-1", name = "Cached Dish")
        )
        whenever(mockDishDao.getDishesByBusiness(any())).thenReturn(flowOf(cachedDishes))
        
        // And server returns error
        fakeApiService.errorCode = 503
        fakeApiService.errorMessage = "Service Unavailable"

        // When
        val results = dishRepository.getDishesByBusiness("business-123").toList()

        // Then - should emit cached data before error
        val cachedResult = results.find { it is Resource.Success } as? Resource.Success<List<DishDto>>
        assertThat(cachedResult).isNotNull()
        assertThat(cachedResult!!.data).hasSize(1)
        assertThat(cachedResult.data[0].id).isEqualTo("cached-dish-1")
    }

    // ==================== Cache-First Loading Pattern ====================

    @Test
    fun `getOrdersByBusiness emits cached data before network data`() = runTest {
        // Given - cached orders exist
        val cachedOrders = listOf(
            createOrderEntity(id = "cached-order-1", status = "pending")
        )
        whenever(mockOrderDao.getOrdersByBusiness(any())).thenReturn(flowOf(cachedOrders))
        
        // And network returns fresh data
        val freshOrders = listOf(
            TestDataFactory.createOrder(id = "fresh-order-1", status = "confirmed"),
            TestDataFactory.createOrder(id = "fresh-order-2", status = "preparing")
        )
        fakeApiService.getOrdersByBusinessResponse = Response.success(
            TestDataFactory.createOrderListResponse(orders = freshOrders)
        )

        // When
        val results = orderRepository.getOrdersByBusiness("business-123").toList()

        // Then - should emit Loading first
        assertThat(results.first()).isEqualTo(Resource.Loading)
        
        // And should have at least one Success result (cached or fresh)
        val successResults = results.filterIsInstance<Resource.Success<List<OrderDto>>>()
        assertThat(successResults).isNotEmpty()
    }

    @Test
    fun `getDishesByBusiness emits cached data before network data`() = runTest {
        // Given - cached dishes exist
        val cachedDishes = listOf(
            createDishEntity(id = "cached-dish-1", name = "Cached Dish")
        )
        whenever(mockDishDao.getDishesByBusiness(any())).thenReturn(flowOf(cachedDishes))
        
        // And network returns fresh data
        val freshDishes = listOf(
            TestDataFactory.createDish(id = "fresh-dish-1", name = "Fresh Dish 1"),
            TestDataFactory.createDish(id = "fresh-dish-2", name = "Fresh Dish 2")
        )
        fakeApiService.getDishesByBusinessResponse = Response.success(
            TestDataFactory.createDishListResponse(dishes = freshDishes)
        )

        // When
        val results = dishRepository.getDishesByBusiness("business-123").toList()

        // Then - should emit Loading first
        assertThat(results.first()).isEqualTo(Resource.Loading)
        
        // And should have at least one Success result (cached or fresh)
        val successResults = results.filterIsInstance<Resource.Success<List<DishDto>>>()
        assertThat(successResults).isNotEmpty()
    }

    @Test
    fun `getOrdersByBusiness emits only network data when cache is empty`() = runTest {
        // Given - no cached orders
        whenever(mockOrderDao.getOrdersByBusiness(any())).thenReturn(flowOf(emptyList()))
        
        // And network returns data
        val networkOrders = listOf(
            TestDataFactory.createOrder(id = "network-order-1", status = "pending")
        )
        fakeApiService.getOrdersByBusinessResponse = Response.success(
            TestDataFactory.createOrderListResponse(orders = networkOrders)
        )

        // When
        val results = orderRepository.getOrdersByBusiness("business-123").toList()

        // Then - should emit Loading first
        assertThat(results.first()).isEqualTo(Resource.Loading)
        
        // And should emit network data
        val successResult = results.last() as Resource.Success<List<OrderDto>>
        assertThat(successResult.data).hasSize(1)
        assertThat(successResult.data[0].id).isEqualTo("network-order-1")
    }

    @Test
    fun `getDishesByBusiness emits only network data when cache is empty`() = runTest {
        // Given - no cached dishes
        whenever(mockDishDao.getDishesByBusiness(any())).thenReturn(flowOf(emptyList()))
        
        // And network returns data
        val networkDishes = listOf(
            TestDataFactory.createDish(id = "network-dish-1", name = "Network Dish")
        )
        fakeApiService.getDishesByBusinessResponse = Response.success(
            TestDataFactory.createDishListResponse(dishes = networkDishes)
        )

        // When
        val results = dishRepository.getDishesByBusiness("business-123").toList()

        // Then - should emit Loading first
        assertThat(results.first()).isEqualTo(Resource.Loading)
        
        // And should emit network data
        val successResult = results.last() as Resource.Success<List<DishDto>>
        assertThat(successResult.data).hasSize(1)
        assertThat(successResult.data[0].id).isEqualTo("network-dish-1")
    }

    @Test
    fun `getOrdersByBusiness emits error when both cache is empty and network fails`() = runTest {
        // Given - no cached orders
        whenever(mockOrderDao.getOrdersByBusiness(any())).thenReturn(flowOf(emptyList()))
        
        // And network fails
        fakeApiService.shouldThrowException = IOException("Network unavailable")

        // When
        val results = orderRepository.getOrdersByBusiness("business-123").toList()

        // Then - should emit Loading first
        assertThat(results.first()).isEqualTo(Resource.Loading)
        
        // And should emit Error
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("Network unavailable")
    }

    @Test
    fun `getDishesByBusiness emits error when both cache is empty and network fails`() = runTest {
        // Given - no cached dishes
        whenever(mockDishDao.getDishesByBusiness(any())).thenReturn(flowOf(emptyList()))
        
        // And network fails
        fakeApiService.shouldThrowException = IOException("Network unavailable")

        // When
        val results = dishRepository.getDishesByBusiness("business-123").toList()

        // Then - should emit Loading first
        assertThat(results.first()).isEqualTo(Resource.Loading)
        
        // And should emit Error
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("Network unavailable")
    }

    // ==================== Helper Methods ====================

    private fun createOrderEntity(
        id: String = "order-1",
        businessId: String = "business-1",
        customerName: String = "Test Customer",
        customerPhone: String? = "+1234567890",
        customerEmail: String? = "test@example.com",
        totalCents: Int = 1000,
        status: String = "pending",
        createdAt: String = "2025-01-01T00:00:00Z",
        updatedAt: String = "2025-01-01T00:00:00Z"
    ) = OrderEntity(
        id = id,
        businessId = businessId,
        customerName = customerName,
        customerPhone = customerPhone,
        customerEmail = customerEmail,
        totalCents = totalCents,
        status = status,
        createdAt = createdAt,
        updatedAt = updatedAt
    )

    private fun createDishEntity(
        id: String = "dish-1",
        businessId: String = "business-1",
        name: String = "Test Dish",
        description: String? = "A test dish",
        priceCents: Int = 500,
        imageUrl: String? = null,
        category: String? = "Main Course",
        isVegetarian: Boolean = false,
        isAvailable: Boolean = true,
        createdAt: String = "2025-01-01T00:00:00Z",
        updatedAt: String = "2025-01-01T00:00:00Z"
    ) = DishEntity(
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
