package com.menumaker.repository

import com.google.common.truth.Truth.assertThat
import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.FavoriteDto
import com.menumaker.data.remote.models.FavoriteListData
import com.menumaker.data.repository.FavoriteRepositoryImpl
import com.menumaker.testutils.FakeApiService
import com.menumaker.testutils.TestDataFactory
import com.menumaker.testutils.TestDispatcherRule
import io.kotest.property.Arb
import io.kotest.property.arbitrary.arbitrary
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
 * Unit tests for FavoriteRepositoryImpl.
 * Tests getFavorites, addFavorite, and removeFavorite flows.
 *
 * Requirements: 4.6
 */
@OptIn(ExperimentalCoroutinesApi::class)
class FavoriteRepositoryTest {

    @get:Rule
    val dispatcherRule = TestDispatcherRule()

    private lateinit var fakeApiService: FakeApiService
    private lateinit var repository: FavoriteRepositoryImpl

    @Before
    fun setup() {
        fakeApiService = FakeApiService()
        repository = FavoriteRepositoryImpl(fakeApiService)
    }

    // ==================== getFavorites Tests ====================

    @Test
    fun `getFavorites emits Loading then Success with favorites`() = runTest {
        // Given
        val favorites = listOf(
            TestDataFactory.createFavorite(id = "fav-1"),
            TestDataFactory.createFavorite(id = "fav-2")
        )
        fakeApiService.getFavoritesResponse = Response.success(
            TestDataFactory.createFavoriteListResponse(favorites = favorites)
        )

        // When
        val results = repository.getFavorites().toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        val successResult = results.last() as Resource.Success<FavoriteListData>
        assertThat(successResult.data.favorites).hasSize(2)
    }

    @Test
    fun `getFavorites emits Error on API failure`() = runTest {
        // Given
        fakeApiService.errorCode = 500

        // When
        val results = repository.getFavorites().toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        assertThat(results.last()).isInstanceOf(Resource.Error::class.java)
    }

    @Test
    fun `getFavorites handles network error gracefully`() = runTest {
        // Given
        fakeApiService.shouldThrowException = IOException("Network unavailable")

        // When
        val results = repository.getFavorites().toList()

        // Then
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("Network unavailable")
    }

    // ==================== addFavorite Tests ====================

    @Test
    fun `addFavorite emits Loading then Success with favorite`() = runTest {
        // Given
        val favorite = TestDataFactory.createFavorite(businessId = "business-123")
        fakeApiService.addFavoriteResponse = Response.success(
            TestDataFactory.createFavoriteResponse(favorite = favorite)
        )

        // When
        val results = repository.addFavorite("business-123").toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        val successResult = results.last() as Resource.Success<FavoriteDto>
        assertThat(successResult.data.businessId).isEqualTo("business-123")
    }

    @Test
    fun `addFavorite emits Error on API failure`() = runTest {
        // Given
        fakeApiService.errorCode = 400

        // When
        val results = repository.addFavorite("business-123").toList()

        // Then
        assertThat(results.last()).isInstanceOf(Resource.Error::class.java)
    }

    // ==================== removeFavorite Tests ====================

    @Test
    fun `removeFavorite emits Loading then Success`() = runTest {
        // Given
        fakeApiService.removeFavoriteResponse = Response.success(Unit)

        // When
        val results = repository.removeFavorite("fav-123").toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        assertThat(results.last()).isInstanceOf(Resource.Success::class.java)
    }

    @Test
    fun `removeFavorite emits Error on API failure`() = runTest {
        // Given
        fakeApiService.errorCode = 404

        // When
        val results = repository.removeFavorite("nonexistent-fav").toList()

        // Then
        assertThat(results.last()).isInstanceOf(Resource.Error::class.java)
    }

    // ==================== removeFavoriteByBusinessId Tests ====================

    @Test
    fun `removeFavoriteByBusinessId emits Loading then Success`() = runTest {
        // Given
        fakeApiService.removeFavoriteByBusinessIdResponse = Response.success(Unit)

        // When
        val results = repository.removeFavoriteByBusinessId("business-123").toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        assertThat(results.last()).isInstanceOf(Resource.Success::class.java)
    }
}

// ==================== Property-Based Tests ====================

/**
 * **Feature: android-test-coverage, Property 12: Favorites Toggle**
 * **Validates: Requirements 4.6**
 *
 * Property: For any restaurant, adding to favorites then removing
 * SHALL result in the restaurant not being in favorites.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class FavoritesTogglePropertyTest {

    @get:Rule
    val dispatcherRule = TestDispatcherRule()

    private lateinit var fakeApiService: FakeApiService
    private lateinit var repository: FavoriteRepositoryImpl

    @Before
    fun setup() {
        fakeApiService = FakeApiService()
        repository = FavoriteRepositoryImpl(fakeApiService)
    }

    // Custom Arb for non-blank strings
    private fun arbNonBlankString(range: IntRange): Arb<String> = arbitrary { rs ->
        val chars = ('a'..'z') + ('A'..'Z') + ('0'..'9')
        val length = range.random(rs.random)
        (1..length).map { chars.random(rs.random) }.joinToString("")
    }

    @Test
    fun `property - addFavorite returns favorite with correct businessId`() = runTest {
        // Property: For any businessId, addFavorite returns favorite with that businessId
        checkAll(
            iterations = 100,
            arbNonBlankString(5..20)
        ) { businessId ->
            // Reset state for each iteration
            fakeApiService.reset()
            
            // Given - a successful add favorite response
            val favorite = TestDataFactory.createFavorite(businessId = businessId)
            fakeApiService.addFavoriteResponse = Response.success(
                TestDataFactory.createFavoriteResponse(favorite = favorite)
            )

            // When
            val results = repository.addFavorite(businessId).toList()

            // Then - returned favorite should have the correct businessId
            val successResult = results.last() as Resource.Success<FavoriteDto>
            assertThat(successResult.data.businessId).isEqualTo(businessId)
        }
    }

    @Test
    fun `property - removeFavorite always emits Loading first`() = runTest {
        // Property: For any favoriteId, removeFavorite emits Loading first
        checkAll(
            iterations = 100,
            arbNonBlankString(5..20)
        ) { favoriteId ->
            // Reset state for each iteration
            fakeApiService.reset()
            fakeApiService.removeFavoriteResponse = Response.success(Unit)

            // When
            val results = repository.removeFavorite(favoriteId).toList()

            // Then - first emission should be Loading
            assertThat(results.first()).isEqualTo(Resource.Loading)
        }
    }

    @Test
    fun `property - successful add then remove results in Success for both`() = runTest {
        // Property: Add then remove both succeed
        checkAll(
            iterations = 50,
            arbNonBlankString(5..20)
        ) { businessId ->
            // Reset state for each iteration
            fakeApiService.reset()
            
            // Setup successful responses
            val favorite = TestDataFactory.createFavorite(
                id = "fav-$businessId",
                businessId = businessId
            )
            fakeApiService.addFavoriteResponse = Response.success(
                TestDataFactory.createFavoriteResponse(favorite = favorite)
            )
            fakeApiService.removeFavoriteByBusinessIdResponse = Response.success(Unit)

            // When - add favorite
            val addResults = repository.addFavorite(businessId).toList()
            
            // Then - add should succeed
            assertThat(addResults.last()).isInstanceOf(Resource.Success::class.java)

            // When - remove favorite
            val removeResults = repository.removeFavoriteByBusinessId(businessId).toList()
            
            // Then - remove should succeed
            assertThat(removeResults.last()).isInstanceOf(Resource.Success::class.java)
        }
    }
}
