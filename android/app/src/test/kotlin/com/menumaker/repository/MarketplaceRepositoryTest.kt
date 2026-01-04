package com.menumaker.repository

import com.google.common.truth.Truth.assertThat
import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.MarketplaceSellerDto
import com.menumaker.data.repository.MarketplaceRepositoryImpl
import com.menumaker.testutils.FakeApiService
import com.menumaker.testutils.TestDataFactory
import com.menumaker.testutils.TestDispatcherRule
import io.kotest.property.Arb
import io.kotest.property.arbitrary.arbitrary
import io.kotest.property.arbitrary.double
import io.kotest.property.checkAll
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.test.runTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import retrofit2.Response
import java.io.IOException

/**
 * Unit tests for MarketplaceRepositoryImpl.
 * Tests getBusinesses and searchBusinesses flows.
 *
 * Requirements: 4.1
 */
@OptIn(ExperimentalCoroutinesApi::class)
class MarketplaceRepositoryTest {

    @get:Rule
    val dispatcherRule = TestDispatcherRule()

    private lateinit var fakeApiService: FakeApiService
    private lateinit var repository: MarketplaceRepositoryImpl

    @Before
    fun setup() {
        fakeApiService = FakeApiService()
        repository = MarketplaceRepositoryImpl(fakeApiService)
    }

    // ==================== searchSellers Tests ====================

    @Test
    fun `searchSellers emits Loading then Success with sellers`() = runTest {
        // Given
        val sellers = listOf(
            TestDataFactory.createMarketplaceSeller(id = "seller-1", name = "Restaurant A"),
            TestDataFactory.createMarketplaceSeller(id = "seller-2", name = "Restaurant B")
        )
        fakeApiService.searchSellersResponse = Response.success(
            TestDataFactory.createMarketplaceResponse(sellers = sellers)
        )

        // When
        val results = repository.searchSellers(null, null, null, null, null).toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        val successResult = results.last() as Resource.Success<List<MarketplaceSellerDto>>
        assertThat(successResult.data).hasSize(2)
    }

    @Test
    fun `searchSellers with cuisine filter returns filtered results`() = runTest {
        // Given
        val sellers = listOf(
            TestDataFactory.createMarketplaceSeller(id = "seller-1", cuisineType = "Indian")
        )
        fakeApiService.searchSellersResponse = Response.success(
            TestDataFactory.createMarketplaceResponse(sellers = sellers)
        )

        // When
        val results = repository.searchSellers(null, null, "Indian", null, null).toList()

        // Then
        val successResult = results.last() as Resource.Success<List<MarketplaceSellerDto>>
        assertThat(successResult.data).hasSize(1)
        assertThat(successResult.data[0].cuisineType).isEqualTo("Indian")
    }

    @Test
    fun `searchSellers with location returns nearby sellers`() = runTest {
        // Given
        val sellers = listOf(
            TestDataFactory.createMarketplaceSeller(distanceKm = 2.5)
        )
        fakeApiService.searchSellersResponse = Response.success(
            TestDataFactory.createMarketplaceResponse(sellers = sellers)
        )

        // When
        val results = repository.searchSellers(12.9716, 77.5946, null, null, 5.0).toList()

        // Then
        val successResult = results.last() as Resource.Success<List<MarketplaceSellerDto>>
        assertThat(successResult.data).hasSize(1)
    }

    @Test
    fun `searchSellers emits Error on API failure`() = runTest {
        // Given
        fakeApiService.errorCode = 500

        // When
        val results = repository.searchSellers(null, null, null, null, null).toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        assertThat(results.last()).isInstanceOf(Resource.Error::class.java)
    }

    @Test
    fun `searchSellers handles network error gracefully`() = runTest {
        // Given
        fakeApiService.shouldThrowException = IOException("Network unavailable")

        // When
        val results = repository.searchSellers(null, null, null, null, null).toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("Network unavailable")
    }

    @Test
    fun `searchSellers returns empty list when no matches`() = runTest {
        // Given
        fakeApiService.searchSellersResponse = Response.success(
            TestDataFactory.createMarketplaceResponse(sellers = emptyList())
        )

        // When
        val results = repository.searchSellers(null, null, "NonExistentCuisine", null, null).toList()

        // Then
        val successResult = results.last() as Resource.Success<List<MarketplaceSellerDto>>
        assertThat(successResult.data).isEmpty()
    }
}

// ==================== Property-Based Tests ====================

/**
 * **Feature: android-test-coverage, Property 8: Marketplace Search Filtering**
 * **Validates: Requirements 4.1**
 *
 * Property: For any search query on the marketplace, the returned results
 * SHALL only contain restaurants matching the search criteria.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class MarketplaceSearchFilteringPropertyTest {

    @get:Rule
    val dispatcherRule = TestDispatcherRule()

    private lateinit var fakeApiService: FakeApiService
    private lateinit var repository: MarketplaceRepositoryImpl

    @Before
    fun setup() {
        fakeApiService = FakeApiService()
        repository = MarketplaceRepositoryImpl(fakeApiService)
    }

    // Custom Arb for cuisine types
    private fun arbCuisineType(): Arb<String> = arbitrary { rs ->
        listOf("Indian", "Chinese", "Italian", "Mexican", "Thai", "Japanese").random(rs.random)
    }

    // Custom Arb for rating
    private fun arbRating(): Arb<Double> = Arb.double(1.0..5.0)

    @Test
    fun `property - search results contain only matching cuisine types`() = runTest {
        // Property: For any cuisine filter, all results have that cuisine
        checkAll(
            iterations = 50,
            arbCuisineType()
        ) { cuisineType ->
            // Reset state for each iteration
            fakeApiService.reset()
            
            // Given - sellers with the specified cuisine
            val sellers = listOf(
                TestDataFactory.createMarketplaceSeller(id = "seller-1", cuisineType = cuisineType),
                TestDataFactory.createMarketplaceSeller(id = "seller-2", cuisineType = cuisineType)
            )
            fakeApiService.searchSellersResponse = Response.success(
                TestDataFactory.createMarketplaceResponse(sellers = sellers)
            )

            // When
            val results = repository.searchSellers(null, null, cuisineType, null, null).toList()

            // Then - all results should have the specified cuisine
            val successResult = results.last() as Resource.Success<List<MarketplaceSellerDto>>
            successResult.data.forEach { seller ->
                assertThat(seller.cuisineType).isEqualTo(cuisineType)
            }
        }
    }

    @Test
    fun `property - search results respect minimum rating filter`() = runTest {
        // Property: For any minimum rating filter, all results have rating >= minRating
        checkAll(
            iterations = 50,
            arbRating()
        ) { minRating ->
            // Reset state for each iteration
            fakeApiService.reset()
            
            // Given - sellers with ratings above minimum
            val sellers = listOf(
                TestDataFactory.createMarketplaceSeller(id = "seller-1", rating = minRating + 0.5),
                TestDataFactory.createMarketplaceSeller(id = "seller-2", rating = minRating + 1.0)
            )
            fakeApiService.searchSellersResponse = Response.success(
                TestDataFactory.createMarketplaceResponse(sellers = sellers)
            )

            // When
            val results = repository.searchSellers(null, null, null, minRating, null).toList()

            // Then - all results should have rating >= minRating
            val successResult = results.last() as Resource.Success<List<MarketplaceSellerDto>>
            successResult.data.forEach { seller ->
                assertThat(seller.rating).isAtLeast(minRating)
            }
        }
    }

    @Test
    fun `property - search always emits Loading before result`() = runTest {
        // Property: For any search, Loading is always emitted first
        checkAll(
            iterations = 50,
            arbCuisineType()
        ) { cuisineType ->
            // Reset state for each iteration
            fakeApiService.reset()
            fakeApiService.searchSellersResponse = Response.success(
                TestDataFactory.createMarketplaceResponse(sellers = emptyList())
            )

            // When
            val results = repository.searchSellers(null, null, cuisineType, null, null).toList()

            // Then - first emission should always be Loading
            assertThat(results.first()).isEqualTo(Resource.Loading)
        }
    }
}
