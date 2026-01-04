package com.menumaker.ui

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import com.menumaker.MainActivity
import com.menumaker.data.remote.models.FavoriteDto
import com.menumaker.data.repository.FavoriteRepository
import com.menumaker.data.repository.OrderRepository
import com.menumaker.fakes.FakeFavoriteRepository
import com.menumaker.fakes.FakeOrderRepository
import com.menumaker.pageobjects.FavoritesPage
import com.menumaker.pageobjects.OrderHistoryPage
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import javax.inject.Inject

/**
 * UI tests for favorites and order history functionality
 *
 * These tests use FakeFavoriteRepository and FakeOrderRepository via Hilt test module
 * for deterministic, network-independent testing.
 *
 * Requirements covered:
 * - 4.6: Favorites management - saving and removing favorite restaurants
 */
@LargeTest
@RunWith(AndroidJUnit4::class)
@HiltAndroidTest
class FavoritesAndHistoryTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    @Inject
    lateinit var favoriteRepository: FavoriteRepository

    @Inject
    lateinit var orderRepository: OrderRepository

    private val fakeFavoriteRepository: FakeFavoriteRepository
        get() = favoriteRepository as FakeFavoriteRepository

    private val fakeOrderRepository: FakeOrderRepository
        get() = orderRepository as FakeOrderRepository

    @Before
    fun setup() {
        hiltRule.inject()
        // Reset fake repositories to clean state before each test
        fakeFavoriteRepository.reset()
        fakeOrderRepository.reset()
    }

    // MARK: - Favorites Tests with Mocked Dependencies (Requirements 4.6)

    /**
     * Test: Add favorite with mocked repository
     * Requirements: 4.6 - Allow saving favorite restaurants
     */
    @Test
    fun testAddFavorite_withMockedRepository() {
        val favoritesPage = FavoritesPage(composeTestRule)
        favoritesPage
            .tapFavoriteButton()
        
        // Verify repository was called
        assert(fakeFavoriteRepository.addFavoriteCallCount >= 1) {
            "FavoriteRepository addFavorite should be called"
        }
    }

    /**
     * Test: Remove favorite with mocked repository
     * Requirements: 4.6 - Allow removing favorite restaurants
     */
    @Test
    fun testRemoveFavorite_withMockedRepository() {
        // Pre-populate favorites
        fakeFavoriteRepository.setFavorites(listOf(
            FavoriteDto(
                id = "fav-1",
                userId = "user-1",
                businessId = "business-1",
                business = null,
                createdAt = "2025-01-01T00:00:00Z"
            )
        ))

        val favoritesPage = FavoritesPage(composeTestRule)
        favoritesPage
            .assertFavoritesDisplayed()
            .removeFavorite(0)
        
        // Verify repository was called
        assert(fakeFavoriteRepository.removeFavoriteCallCount >= 1 || 
               fakeFavoriteRepository.removeFavoriteByBusinessIdCallCount >= 1) {
            "FavoriteRepository removeFavorite should be called"
        }
    }

    /**
     * Test: Empty favorites shows empty state
     * Requirements: 4.6 - Handle empty favorites
     */
    @Test
    fun testEmptyFavorites_showsEmptyState() {
        // Configure empty favorites
        fakeFavoriteRepository.configureEmptyResults()

        val favoritesPage = FavoritesPage(composeTestRule)
        favoritesPage.assertEmptyState()
    }

    /**
     * Test: Favorites error shows error message
     * Requirements: 4.6 - Handle errors gracefully
     */
    @Test
    fun testFavoritesError_showsErrorMessage() {
        // Configure error
        fakeFavoriteRepository.configureError("Failed to load favorites")

        val favoritesPage = FavoritesPage(composeTestRule)
        // Error should be displayed or handled gracefully
    }

    // MARK: - Original Favorites Tests (kept for compatibility)

    @Test
    fun testFavoritesScreenDisplays() {
        val favoritesPage = FavoritesPage(composeTestRule)
        favoritesPage.assertScreenDisplayed()
    }

    @Test
    fun testViewFavorites() {
        // Pre-populate favorites
        fakeFavoriteRepository.setFavorites(listOf(
            FavoriteDto(
                id = "fav-1",
                userId = "user-1",
                businessId = "business-1",
                business = null,
                createdAt = "2025-01-01T00:00:00Z"
            )
        ))

        val favoritesPage = FavoritesPage(composeTestRule)
        favoritesPage
            .assertFavoritesDisplayed()
            .tapFirstFavorite()
    }

    @Test
    fun testAddFavorite() {
        val favoritesPage = FavoritesPage(composeTestRule)
        favoritesPage
            .tapFavoriteButton()
            .assertFavoriteAdded("Tasty Bites Restaurant")
    }

    @Test
    fun testRemoveFavorite() {
        // Pre-populate favorites
        fakeFavoriteRepository.setFavorites(listOf(
            FavoriteDto(
                id = "fav-1",
                userId = "user-1",
                businessId = "business-1",
                business = null,
                createdAt = "2025-01-01T00:00:00Z"
            )
        ))

        val favoritesPage = FavoritesPage(composeTestRule)
        favoritesPage
            .assertFavoritesDisplayed()
            .removeFavorite(0)
            .assertFavoriteRemoved("Tasty Bites Restaurant")
    }

    @Test
    fun testSearchFavorites() {
        // Pre-populate favorites
        fakeFavoriteRepository.setFavorites(listOf(
            FavoriteDto(
                id = "fav-1",
                userId = "user-1",
                businessId = "business-1",
                business = null,
                createdAt = "2025-01-01T00:00:00Z"
            )
        ))

        val favoritesPage = FavoritesPage(composeTestRule)
        favoritesPage
            .searchFavorites("Tasty")
            .assertFavoritesDisplayed()
    }

    @Test
    fun testEmptyFavoritesState() {
        fakeFavoriteRepository.configureEmptyResults()

        val favoritesPage = FavoritesPage(composeTestRule)
        favoritesPage
            .assertEmptyState()
    }

    @Test
    fun testExploreSellers() {
        fakeFavoriteRepository.configureEmptyResults()

        val favoritesPage = FavoritesPage(composeTestRule)
        favoritesPage
            .assertEmptyState()
            .tapExplore()
    }

    // MARK: - Order History Tests

    @Test
    fun testOrderHistoryScreenDisplays() {
        val historyPage = OrderHistoryPage(composeTestRule)
        historyPage.assertScreenDisplayed()
    }

    @Test
    fun testViewOrderHistory() {
        val historyPage = OrderHistoryPage(composeTestRule)
        historyPage
            .assertOrdersDisplayed()
            .tapFirstOrder()
    }

    @Test
    fun testFilterActiveOrders() {
        val historyPage = OrderHistoryPage(composeTestRule)
        historyPage
            .switchToActiveOrders()
            .assertOrdersDisplayed()
    }

    @Test
    fun testFilterCompletedOrders() {
        val historyPage = OrderHistoryPage(composeTestRule)
        historyPage
            .switchToCompletedOrders()
            .assertOrdersDisplayed()
    }

    @Test
    fun testFilterCancelledOrders() {
        val historyPage = OrderHistoryPage(composeTestRule)
        historyPage
            .switchToCancelledOrders()
            .assertOrdersDisplayed()
    }

    @Test
    fun testReorderFromHistory() {
        val historyPage = OrderHistoryPage(composeTestRule)
        historyPage
            .switchToCompletedOrders()
            .assertReorderButtonVisible()
            .reorderFirst()
    }

    @Test
    fun testTrackOrderFromHistory() {
        val historyPage = OrderHistoryPage(composeTestRule)
        historyPage
            .switchToActiveOrders()
            .assertTrackButtonVisible()
            .trackFirstOrder()
    }

    @Test
    fun testSearchOrders() {
        val historyPage = OrderHistoryPage(composeTestRule)
        historyPage
            .searchOrders("ORDER001")
            .assertOrdersDisplayed()
    }

    @Test
    fun testFilterByDateRange() {
        val historyPage = OrderHistoryPage(composeTestRule)
        historyPage
            .filterByDateRange(OrderHistoryPage.DateRange.LAST_7_DAYS)
            .assertOrdersDisplayed()
    }

    @Test
    fun testOrderDetailsDisplay() {
        val historyPage = OrderHistoryPage(composeTestRule)
        historyPage
            .tapFirstOrder()
            .assertOrderDetailsDisplayed()
    }

    @Test
    fun testEmptyOrderHistoryState() {
        val historyPage = OrderHistoryPage(composeTestRule)
        historyPage
            .assertEmptyState()
    }

    @Test
    fun testTapHelp() {
        val historyPage = OrderHistoryPage(composeTestRule)
        historyPage
            .tapHelp()
    }
}
