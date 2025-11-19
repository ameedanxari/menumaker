package com.menumaker.ui

import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import com.menumaker.MainActivity
import com.menumaker.pageobjects.FavoritesPage
import com.menumaker.pageobjects.OrderHistoryPage
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * UI tests for favorites and order history functionality
 */
@LargeTest
@RunWith(AndroidJUnit4::class)
@HiltAndroidTest
class FavoritesAndHistoryTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    @Before
    fun setup() {
        hiltRule.inject()
    }

    // MARK: - Favorites Tests

    @Test
    fun testFavoritesScreenDisplays() {
        val favoritesPage = FavoritesPage(composeTestRule)
        favoritesPage.assertScreenDisplayed()
    }

    @Test
    fun testViewFavorites() {
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
        val favoritesPage = FavoritesPage(composeTestRule)
        favoritesPage
            .assertFavoritesDisplayed()
            .removeFavorite(0)
            .assertFavoriteRemoved("Tasty Bites Restaurant")
    }

    @Test
    fun testSearchFavorites() {
        val favoritesPage = FavoritesPage(composeTestRule)
        favoritesPage
            .searchFavorites("Tasty")
            .assertFavoritesDisplayed()
    }

    @Test
    fun testEmptyFavoritesState() {
        val favoritesPage = FavoritesPage(composeTestRule)
        favoritesPage
            .assertEmptyState()
    }

    @Test
    fun testExploreSellers() {
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
