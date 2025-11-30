package com.menumaker.viewmodel

import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.DishDto
import com.menumaker.data.repository.DishRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.mockito.Mock
import org.mockito.Mockito.`when`
import org.mockito.MockitoAnnotations

@ExperimentalCoroutinesApi
class DishViewModelTest {

    @Mock
    private lateinit var dishRepository: DishRepository

    private lateinit var viewModel: DishViewModel

    private val testDispatcher = UnconfinedTestDispatcher()

    private val mockDish = DishDto(
        id = "dish-1",
        businessId = "business-1",
        name = "Margherita Pizza",
        description = "Classic tomato and mozzarella",
        priceCents = 1299,
        imageUrl = "https://example.com/pizza.jpg",
        category = "Pizza",
        isVegetarian = true,
        isAvailable = true,
        createdAt = "2024-01-01T00:00:00Z",
        updatedAt = "2024-01-01T00:00:00Z"
    )

    @Before
    fun setup() {
        MockitoAnnotations.openMocks(this)
        Dispatchers.setMain(testDispatcher)

        viewModel = DishViewModel(dishRepository)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `loadDishes updates dishesState with success`() = runTest {
        // Given
        val businessId = "business-1"
        val dishes = listOf(mockDish)
        val successFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Success(dishes))
        }

        `when`(dishRepository.getDishesByBusiness(businessId)).thenReturn(successFlow)

        // When
        viewModel.loadDishes(businessId)

        // Then
        assertTrue(viewModel.dishesState.value is Resource.Success)
        assertEquals(dishes, (viewModel.dishesState.value as Resource.Success).data)
    }

    @Test
    fun `loadDishes updates dishesState with error`() = runTest {
        // Given
        val businessId = "business-1"
        val errorMessage = "Failed to load dishes"
        val errorFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Error(errorMessage))
        }

        `when`(dishRepository.getDishesByBusiness(businessId)).thenReturn(errorFlow)

        // When
        viewModel.loadDishes(businessId)

        // Then
        assertTrue(viewModel.dishesState.value is Resource.Error)
        assertEquals(errorMessage, (viewModel.dishesState.value as Resource.Error).message)
    }

    @Test
    fun `loadDishDetail updates dishDetailState with success`() = runTest {
        // Given
        val dishId = "dish-1"
        val successFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Success(mockDish))
        }

        `when`(dishRepository.getDishById(dishId)).thenReturn(successFlow)

        // When
        viewModel.loadDishDetail(dishId)

        // Then
        assertTrue(viewModel.dishDetailState.value is Resource.Success)
        assertEquals(mockDish, (viewModel.dishDetailState.value as Resource.Success).data)
    }

    @Test
    fun `loadDishDetail updates dishDetailState with error`() = runTest {
        // Given
        val dishId = "dish-1"
        val errorMessage = "Dish not found"
        val errorFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Error(errorMessage))
        }

        `when`(dishRepository.getDishById(dishId)).thenReturn(errorFlow)

        // When
        viewModel.loadDishDetail(dishId)

        // Then
        assertTrue(viewModel.dishDetailState.value is Resource.Error)
        assertEquals(errorMessage, (viewModel.dishDetailState.value as Resource.Error).message)
    }

    @Test
    fun `initial state is null`() {
        assertEquals(null, viewModel.dishesState.value)
        assertEquals(null, viewModel.dishDetailState.value)
    }
}
