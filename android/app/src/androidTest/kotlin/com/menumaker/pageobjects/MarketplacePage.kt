package com.menumaker.pageobjects

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.ComposeTestRule

/**
 * Page Object for Marketplace Screen
 */
class MarketplacePage(private val composeTestRule: ComposeTestRule) {

    // Elements
    private val searchBar = composeTestRule.onNodeWithText("Search", substring = true, ignoreCase = true)
    private val sellerCards = composeTestRule.onAllNodes(hasTestTag("SellerCard"))
    private val firstSellerCard = sellerCards.onFirst()
    private val sortButton = composeTestRule.onNode(hasContentDescription("Sort", substring = true, ignoreCase = true))
    private val filterButton = composeTestRule.onNode(hasContentDescription("Filter", substring = true, ignoreCase = true))

    // Actions
    fun tapFirstSeller(): SellerMenuPage {
        firstSellerCard.performClick()
        Thread.sleep(1000)
        return SellerMenuPage(composeTestRule)
    }

    fun search(query: String): MarketplacePage {
        searchBar.performClick()
        searchBar.performTextInput(query)
        Thread.sleep(1000)
        return this
    }

    fun tapSort(): MarketplacePage {
        sortButton.performClick()
        Thread.sleep(500)
        return this
    }

    fun sortByDistance(): MarketplacePage {
        tapSort()
        composeTestRule.onNodeWithText("Distance", ignoreCase = true).performClick()
        Thread.sleep(500)
        return this
    }

    fun sortByRating(): MarketplacePage {
        tapSort()
        composeTestRule.onNodeWithText("Rating", ignoreCase = true).performClick()
        Thread.sleep(500)
        return this
    }

    fun tapFilter(): MarketplacePage {
        filterButton.performClick()
        Thread.sleep(500)
        return this
    }

    // Assertions
    fun assertScreenDisplayed(): MarketplacePage {
        searchBar.assertExists()
        return this
    }

    fun assertSellersDisplayed(): MarketplacePage {
        firstSellerCard.assertExists()
        return this
    }

    fun assertSellerCount(minCount: Int): MarketplacePage {
        assert(sellerCards.fetchSemanticsNodes().size >= minCount) {
            "Expected at least $minCount sellers"
        }
        return this
    }
}
