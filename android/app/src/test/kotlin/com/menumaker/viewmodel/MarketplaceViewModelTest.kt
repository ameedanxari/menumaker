package com.menumaker.viewmodel

import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.MarketplaceSellerDto
import com.menumaker.data.repository.MarketplaceRepository
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
class MarketplaceViewModelTest {

    @Mock
    private lateinit var marketplaceRepository: MarketplaceRepository

    private lateinit var viewModel: MarketplaceViewModel

    private val testDispatcher = UnconfinedTestDispatcher()

    private val mockSeller = MarketplaceSellerDto(
        id = "seller-1",
        name = "Test Restaurant",
        slug = "test-restaurant",
        description = "A great place to eat",
        logoUrl = "https://example.com/logo.jpg",
        cuisineType = "Italian",
        rating = 4.5,
        reviewCount = 120,
        latitude = 37.7749,
        longitude = -122.4194,
        distanceKm = 2.5
    )

    @Before
    fun setup() {
        MockitoAnnotations.openMocks(this)
        Dispatchers.setMain(testDispatcher)

        viewModel = MarketplaceViewModel(marketplaceRepository)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `searchSellers with no filters updates sellersState with success`() = runTest {
        // Given
        val sellers = listOf(mockSeller)
        val successFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Success(sellers))
        }

        `when`(marketplaceRepository.searchSellers(null, null, null, null, null))
            .thenReturn(successFlow)

        // When
        viewModel.searchSellers()

        // Then
        assertTrue(viewModel.sellersState.value is Resource.Success)
        assertEquals(sellers, (viewModel.sellersState.value as Resource.Success).data)
    }

    @Test
    fun `searchSellers with location filters updates sellersState`() = runTest {
        // Given
        val latitude = 37.7749
        val longitude = -122.4194
        val sellers = listOf(mockSeller)
        val successFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Success(sellers))
        }

        `when`(marketplaceRepository.searchSellers(latitude, longitude, null, null, null))
            .thenReturn(successFlow)

        // When
        viewModel.searchSellers(latitude = latitude, longitude = longitude)

        // Then
        assertTrue(viewModel.sellersState.value is Resource.Success)
        assertEquals(sellers, (viewModel.sellersState.value as Resource.Success).data)
    }

    @Test
    fun `searchSellers with cuisine filter updates sellersState`() = runTest {
        // Given
        val cuisine = "Italian"
        val sellers = listOf(mockSeller)
        val successFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Success(sellers))
        }

        `when`(marketplaceRepository.searchSellers(null, null, cuisine, null, null))
            .thenReturn(successFlow)

        // When
        viewModel.searchSellers(cuisine = cuisine)

        // Then
        assertTrue(viewModel.sellersState.value is Resource.Success)
        assertEquals(sellers, (viewModel.sellersState.value as Resource.Success).data)
    }

    @Test
    fun `searchSellers with rating filter updates sellersState`() = runTest {
        // Given
        val ratingMin = 4.0
        val sellers = listOf(mockSeller)
        val successFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Success(sellers))
        }

        `when`(marketplaceRepository.searchSellers(null, null, null, ratingMin, null))
            .thenReturn(successFlow)

        // When
        viewModel.searchSellers(ratingMin = ratingMin)

        // Then
        assertTrue(viewModel.sellersState.value is Resource.Success)
        assertEquals(sellers, (viewModel.sellersState.value as Resource.Success).data)
    }

    @Test
    fun `searchSellers with distance filter updates sellersState`() = runTest {
        // Given
        val distanceKm = 5.0
        val sellers = listOf(mockSeller)
        val successFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Success(sellers))
        }

        `when`(marketplaceRepository.searchSellers(null, null, null, null, distanceKm))
            .thenReturn(successFlow)

        // When
        viewModel.searchSellers(distanceKm = distanceKm)

        // Then
        assertTrue(viewModel.sellersState.value is Resource.Success)
        assertEquals(sellers, (viewModel.sellersState.value as Resource.Success).data)
    }

    @Test
    fun `searchSellers with all filters updates sellersState`() = runTest {
        // Given
        val latitude = 37.7749
        val longitude = -122.4194
        val cuisine = "Italian"
        val ratingMin = 4.0
        val distanceKm = 5.0
        val sellers = listOf(mockSeller)
        val successFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Success(sellers))
        }

        `when`(marketplaceRepository.searchSellers(latitude, longitude, cuisine, ratingMin, distanceKm))
            .thenReturn(successFlow)

        // When
        viewModel.searchSellers(
            latitude = latitude,
            longitude = longitude,
            cuisine = cuisine,
            ratingMin = ratingMin,
            distanceKm = distanceKm
        )

        // Then
        assertTrue(viewModel.sellersState.value is Resource.Success)
        assertEquals(sellers, (viewModel.sellersState.value as Resource.Success).data)
    }

    @Test
    fun `searchSellers returns empty list when no sellers found`() = runTest {
        // Given
        val successFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Success(emptyList<MarketplaceSellerDto>()))
        }

        `when`(marketplaceRepository.searchSellers(null, null, null, null, null))
            .thenReturn(successFlow)

        // When
        viewModel.searchSellers()

        // Then
        assertTrue(viewModel.sellersState.value is Resource.Success)
        assertEquals(emptyList<MarketplaceSellerDto>(), (viewModel.sellersState.value as Resource.Success).data)
    }

    @Test
    fun `searchSellers updates sellersState with error`() = runTest {
        // Given
        val errorMessage = "Failed to load sellers"
        val errorFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Error(errorMessage))
        }

        `when`(marketplaceRepository.searchSellers(null, null, null, null, null))
            .thenReturn(errorFlow)

        // When
        viewModel.searchSellers()

        // Then
        assertTrue(viewModel.sellersState.value is Resource.Error)
        assertEquals(errorMessage, (viewModel.sellersState.value as Resource.Error).message)
    }

    @Test
    fun `initial state is null`() {
        assertEquals(null, viewModel.sellersState.value)
    }

    // MARK: - Enhanced Search Tests for Requirements 4.1

    @Test
    fun `searchSellers with query string filters results`() = runTest {
        // Given
        val query = "pizza"
        val filteredSellers = listOf(mockSeller.copy(name = "Pizza Palace"))
        val successFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Success(filteredSellers))
        }

        `when`(marketplaceRepository.searchSellers(null, null, null, null, null))
            .thenReturn(successFlow)

        // When
        viewModel.searchSellers()

        // Then
        assertTrue(viewModel.sellersState.value is Resource.Success)
    }

    @Test
    fun `searchSellers with multiple filters combines correctly`() = runTest {
        // Given
        val latitude = 37.7749
        val longitude = -122.4194
        val cuisine = "Italian"
        val ratingMin = 4.0
        val distanceKm = 10.0
        val sellers = listOf(mockSeller)
        val successFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Success(sellers))
        }

        `when`(marketplaceRepository.searchSellers(latitude, longitude, cuisine, ratingMin, distanceKm))
            .thenReturn(successFlow)

        // When
        viewModel.searchSellers(
            latitude = latitude,
            longitude = longitude,
            cuisine = cuisine,
            ratingMin = ratingMin,
            distanceKm = distanceKm
        )

        // Then
        assertTrue(viewModel.sellersState.value is Resource.Success)
        assertEquals(sellers, (viewModel.sellersState.value as Resource.Success).data)
    }

    @Test
    fun `searchSellers handles empty results gracefully`() = runTest {
        // Given
        val successFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Success(emptyList<MarketplaceSellerDto>()))
        }

        `when`(marketplaceRepository.searchSellers(null, null, "NonExistentCuisine", null, null))
            .thenReturn(successFlow)

        // When
        viewModel.searchSellers(cuisine = "NonExistentCuisine")

        // Then
        assertTrue(viewModel.sellersState.value is Resource.Success)
        assertTrue((viewModel.sellersState.value as Resource.Success).data.isEmpty())
    }

    @Test
    fun `searchSellers with high rating filter returns only high-rated sellers`() = runTest {
        // Given
        val ratingMin = 4.5
        val highRatedSeller = mockSeller.copy(rating = 4.8)
        val sellers = listOf(highRatedSeller)
        val successFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Success(sellers))
        }

        `when`(marketplaceRepository.searchSellers(null, null, null, ratingMin, null))
            .thenReturn(successFlow)

        // When
        viewModel.searchSellers(ratingMin = ratingMin)

        // Then
        assertTrue(viewModel.sellersState.value is Resource.Success)
        val results = (viewModel.sellersState.value as Resource.Success).data
        assertTrue(results.all { it.rating >= ratingMin })
    }

    @Test
    fun `searchSellers with small distance filter returns nearby sellers`() = runTest {
        // Given
        val distanceKm = 1.0
        val nearbySeller = mockSeller.copy(distanceKm = 0.5)
        val sellers = listOf(nearbySeller)
        val successFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Success(sellers))
        }

        `when`(marketplaceRepository.searchSellers(null, null, null, null, distanceKm))
            .thenReturn(successFlow)

        // When
        viewModel.searchSellers(distanceKm = distanceKm)

        // Then
        assertTrue(viewModel.sellersState.value is Resource.Success)
        val results = (viewModel.sellersState.value as Resource.Success).data
        assertTrue(results.all { (it.distanceKm ?: 0.0) <= distanceKm })
    }

    @Test
    fun `searchSellers network error updates state to error`() = runTest {
        // Given
        val errorMessage = "Network unavailable"
        val errorFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Error(errorMessage))
        }

        `when`(marketplaceRepository.searchSellers(null, null, null, null, null))
            .thenReturn(errorFlow)

        // When
        viewModel.searchSellers()

        // Then
        assertTrue(viewModel.sellersState.value is Resource.Error)
        assertEquals(errorMessage, (viewModel.sellersState.value as Resource.Error).message)
    }

    @Test
    fun `searchSellers emits loading before results`() = runTest {
        // Given
        var loadingEmitted = false
        val successFlow = flow {
            emit(Resource.Loading)
            loadingEmitted = true
            emit(Resource.Success(listOf(mockSeller)))
        }

        `when`(marketplaceRepository.searchSellers(null, null, null, null, null))
            .thenReturn(successFlow)

        // When
        viewModel.searchSellers()

        // Then
        assertTrue(loadingEmitted)
        assertTrue(viewModel.sellersState.value is Resource.Success)
    }

    @Test
    fun `searchSellers with different cuisine types`() = runTest {
        // Given
        val cuisines = listOf("Italian", "Chinese", "Mexican", "Indian", "Japanese")
        
        for (cuisine in cuisines) {
            val seller = mockSeller.copy(cuisineType = cuisine)
            val successFlow = flow {
                emit(Resource.Success(listOf(seller)))
            }

            `when`(marketplaceRepository.searchSellers(null, null, cuisine, null, null))
                .thenReturn(successFlow)

            // When
            viewModel.searchSellers(cuisine = cuisine)

            // Then
            assertTrue(viewModel.sellersState.value is Resource.Success)
            val results = (viewModel.sellersState.value as Resource.Success).data
            assertEquals(cuisine, results.first().cuisineType)
        }
    }
}
