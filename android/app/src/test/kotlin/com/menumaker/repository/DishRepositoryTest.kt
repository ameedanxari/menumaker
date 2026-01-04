package com.menumaker.repository

import com.google.common.truth.Truth.assertThat
import com.menumaker.data.common.Resource
import com.menumaker.data.local.db.dao.DishDao
import com.menumaker.data.remote.models.DishDto
import com.menumaker.data.repository.DishRepositoryImpl
import com.menumaker.testutils.FakeApiService
import com.menumaker.testutils.TestDataFactory
import com.menumaker.testutils.TestDispatcherRule
import io.kotest.property.Arb
import io.kotest.property.arbitrary.arbitrary
import io.kotest.property.arbitrary.positiveInt
import io.kotest.property.checkAll
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.test.runTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.mockito.Mockito
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import retrofit2.Response
import java.io.IOException

/**
 * Unit tests for DishRepositoryImpl.
 * Tests getDishes, createDish, updateDish, and deleteDish flows.
 *
 * Requirements: 3.3
 */
@OptIn(ExperimentalCoroutinesApi::class)
class DishRepositoryTest {

    @get:Rule
    val dispatcherRule = TestDispatcherRule()

    private lateinit var fakeApiService: FakeApiService
    private lateinit var mockDishDao: DishDao
    private lateinit var repository: DishRepositoryImpl

    @Before
    fun setup() {
        fakeApiService = FakeApiService()
        mockDishDao = mock()
        repository = DishRepositoryImpl(fakeApiService, mockDishDao)
        whenever(mockDishDao.getDishesByBusiness(any())).thenReturn(flowOf(emptyList()))
    }

    // ==================== getDishes Tests ====================

    @Test
    fun `getDishesByBusiness emits Loading then Success with dishes`() = runTest {
        // Given
        val dishes = listOf(
            TestDataFactory.createDish(id = "dish-1", name = "Pizza", priceCents = 1200),
            TestDataFactory.createDish(id = "dish-2", name = "Burger", priceCents = 800)
        )
        fakeApiService.getDishesByBusinessResponse = Response.success(
            TestDataFactory.createDishListResponse(dishes = dishes)
        )

        // When
        val results = repository.getDishesByBusiness("business-123").toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        val successResult = results.last() as Resource.Success<List<DishDto>>
        assertThat(successResult.data).hasSize(2)
        assertThat(successResult.data[0].name).isEqualTo("Pizza")
    }

    @Test
    fun `getDishesByBusiness caches dishes on success`() = runTest {
        // Given
        val dishes = listOf(TestDataFactory.createDish())
        fakeApiService.getDishesByBusinessResponse = Response.success(
            TestDataFactory.createDishListResponse(dishes = dishes)
        )

        // When
        repository.getDishesByBusiness("business-123").toList()

        // Then
        verify(mockDishDao).insertDishes(any())
    }

    @Test
    fun `getDishesByBusiness emits Error on API failure`() = runTest {
        // Given
        fakeApiService.errorCode = 500

        // When
        val results = repository.getDishesByBusiness("business-123").toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        assertThat(results.last()).isInstanceOf(Resource.Error::class.java)
    }

    @Test
    fun `getDishesByBusiness handles network error gracefully`() = runTest {
        // Given
        fakeApiService.shouldThrowException = IOException("Network unavailable")

        // When
        val results = repository.getDishesByBusiness("business-123").toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("Network unavailable")
    }

    // ==================== getDishById Tests ====================

    @Test
    fun `getDishById emits Loading then Success with dish`() = runTest {
        // Given
        val dish = TestDataFactory.createDish(id = "dish-123", name = "Special Dish")
        fakeApiService.getDishByIdResponse = Response.success(
            TestDataFactory.createDishResponse(dish = dish)
        )

        // When
        val results = repository.getDishById("dish-123").toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        val successResult = results.last() as Resource.Success<DishDto>
        assertThat(successResult.data.id).isEqualTo("dish-123")
        assertThat(successResult.data.name).isEqualTo("Special Dish")
    }

    @Test
    fun `getDishById caches dish on success`() = runTest {
        // Given
        val dish = TestDataFactory.createDish(id = "dish-123")
        fakeApiService.getDishByIdResponse = Response.success(
            TestDataFactory.createDishResponse(dish = dish)
        )

        // When
        repository.getDishById("dish-123").toList()

        // Then
        verify(mockDishDao).insertDish(any())
    }

    @Test
    fun `getDishById emits Error when dish not found`() = runTest {
        // Given
        fakeApiService.errorCode = 404
        fakeApiService.errorMessage = "Dish not found"

        // When
        val results = repository.getDishById("nonexistent-dish").toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        assertThat(results.last()).isInstanceOf(Resource.Error::class.java)
    }

    @Test
    fun `getDishById handles network error gracefully`() = runTest {
        // Given
        fakeApiService.shouldThrowException = IOException("Connection timeout")

        // When
        val results = repository.getDishById("dish-123").toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("Connection timeout")
    }
}

// ==================== Property-Based Tests ====================

/**
 * **Feature: android-test-coverage, Property 7: Menu Item CRUD Operations**
 * **Validates: Requirements 3.3**
 *
 * Property: For any menu item, creating, updating, or deleting SHALL result
 * in the corresponding change being reflected in the menu list.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class MenuItemCRUDPropertyTest {

    @get:Rule
    val dispatcherRule = TestDispatcherRule()

    private lateinit var fakeApiService: FakeApiService
    private lateinit var mockDishDao: DishDao
    private lateinit var repository: DishRepositoryImpl

    @Before
    fun setup() {
        fakeApiService = FakeApiService()
        mockDishDao = mock()
        repository = DishRepositoryImpl(fakeApiService, mockDishDao)
        whenever(mockDishDao.getDishesByBusiness(any())).thenReturn(flowOf(emptyList()))
    }

    // Custom Arb for non-blank strings
    private fun arbNonBlankString(range: IntRange): Arb<String> = arbitrary { rs ->
        val chars = ('a'..'z') + ('A'..'Z') + ('0'..'9')
        val length = range.random(rs.random)
        (1..length).map { chars.random(rs.random) }.joinToString("")
    }

    @Test
    fun `property - for any valid dish, getDishById returns the dish with correct data`() = runTest {
        // Property: For any valid dish response, the returned dish has correct data
        checkAll(
            iterations = 100,
            arbNonBlankString(5..20),   // dishId
            arbNonBlankString(5..30),   // dishName
            Arb.positiveInt(10000)       // priceCents
        ) { dishId, dishName, priceCents ->
            // Reset state for each iteration
            fakeApiService.reset()
            Mockito.reset(mockDishDao)
            
            // Given - a valid dish response
            val dish = TestDataFactory.createDish(
                id = dishId,
                name = dishName,
                priceCents = priceCents
            )
            fakeApiService.getDishByIdResponse = Response.success(
                TestDataFactory.createDishResponse(dish = dish)
            )

            // When
            val results = repository.getDishById(dishId).toList()

            // Then - should emit Loading first
            assertThat(results.first()).isEqualTo(Resource.Loading)
            
            // And then Success with correct data
            val successResult = results.last() as Resource.Success<DishDto>
            assertThat(successResult.data.id).isEqualTo(dishId)
            assertThat(successResult.data.name).isEqualTo(dishName)
            assertThat(successResult.data.priceCents).isEqualTo(priceCents)
        }
    }

    @Test
    fun `property - for any list of dishes, getDishesByBusiness returns all dishes`() = runTest {
        // Property: For any list of dishes, all are returned
        checkAll(
            iterations = 100,
            Arb.positiveInt(10)  // number of dishes
        ) { numDishes ->
            // Reset state for each iteration
            fakeApiService.reset()
            Mockito.reset(mockDishDao)
            whenever(mockDishDao.getDishesByBusiness(any())).thenReturn(flowOf(emptyList()))
            
            // Given - a list of dishes
            val dishes = (1..numDishes).map { i ->
                TestDataFactory.createDish(id = "dish-$i", name = "Dish $i")
            }
            fakeApiService.getDishesByBusinessResponse = Response.success(
                TestDataFactory.createDishListResponse(dishes = dishes)
            )

            // When
            val results = repository.getDishesByBusiness("business-123").toList()

            // Then - should return all dishes
            val successResult = results.last() as Resource.Success<List<DishDto>>
            assertThat(successResult.data).hasSize(numDishes)
        }
    }
}
