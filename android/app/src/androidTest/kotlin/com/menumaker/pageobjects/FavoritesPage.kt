package com.menumaker.pageobjects

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.ComposeTestRule

/**
 * Page Object for Favorites/Bookmarks Screen
 * Provides fluent API for favorites interactions
 */
class FavoritesPage(private val composeTestRule: ComposeTestRule) {

    // Elements
    private val favoritesList = composeTestRule.onAllNodesWithTag("FavoriteItem")
    private val emptyStateMessage = composeTestRule.onNode(
        hasText("no favorite", substring = true, ignoreCase = true) or
        hasText("add some", substring = true, ignoreCase = true)
    )
    private val favoriteButton = composeTestRule.onNodeWithTag("favorite-button")
    private val exploreButton = composeTestRule.onNode(
        hasText("explore", substring = true, ignoreCase = true) or
        hasText("browse", substring = true, ignoreCase = true)
    )
    private val sortButton = composeTestRule.onNodeWithText("sort", substring = true, ignoreCase = true)
    private val searchBar = composeTestRule.onNodeWithTag("search-bar")

    // Actions
    fun tapFirstFavorite(): FavoritesPage {
        if (favoritesList.fetchSemanticsNodes().isNotEmpty()) {
            favoritesList[0].performClick()
            Thread.sleep(1000)
        }
        return this
    }

    fun tapFavorite(index: Int): FavoritesPage {
        if (favoritesList.fetchSemanticsNodes().size > index) {
            favoritesList[index].performClick()
            Thread.sleep(1000)
        }
        return this
    }

    fun removeFavorite(index: Int = 0): FavoritesPage {
        if (favoritesList.fetchSemanticsNodes().size > index) {
            favoritesList[index].performTouchInput {
                swipeLeft()
            }
            // Tap delete button if it appears
            val deleteButton = composeTestRule.onNodeWithText("Delete", ignoreCase = true)
            try {
                deleteButton.performClick()
                Thread.sleep(1000)
            } catch (e: AssertionError) {
                // Delete button not found
            }
        }
        return this
    }

    fun tapFavoriteButton(): FavoritesPage {
        favoriteButton.performClick()
        Thread.sleep(1000)
        return this
    }

    fun tapExplore(): FavoritesPage {
        exploreButton.performClick()
        Thread.sleep(1000)
        return this
    }

    fun searchFavorites(query: String): FavoritesPage {
        searchBar.performTextInput(query)
        Thread.sleep(1000)
        return this
    }

    // Assertions
    fun assertScreenDisplayed(): FavoritesPage {
        composeTestRule.waitUntil(timeoutMillis = 2000) {
            favoritesList.fetchSemanticsNodes().isNotEmpty() ||
            try { emptyStateMessage.assertExists(); true } catch (e: AssertionError) { false }
        }
        return this
    }

    fun assertFavoritesDisplayed(): FavoritesPage {
        assert(favoritesList.fetchSemanticsNodes().isNotEmpty()) {
            "Favorites should be displayed"
        }
        return this
    }

    fun assertEmptyState(): FavoritesPage {
        emptyStateMessage.assertExists()
        return this
    }

    fun assertFavoriteCount(expectedCount: Int): FavoritesPage {
        val actualCount = favoritesList.fetchSemanticsNodes().size
        assert(actualCount == expectedCount) {
            "Should have $expectedCount favorites, found $actualCount"
        }
        return this
    }

    fun assertFavoriteAdded(name: String): FavoritesPage {
        composeTestRule.onNodeWithText(name).assertExists()
        return this
    }

    fun assertFavoriteRemoved(name: String): FavoritesPage {
        composeTestRule.onNodeWithText(name).assertDoesNotExist()
        return this
    }
}
