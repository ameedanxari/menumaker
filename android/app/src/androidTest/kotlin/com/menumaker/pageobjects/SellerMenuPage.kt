package com.menumaker.pageobjects

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.ComposeTestRule

/**
 * Page Object for Seller Menu Screen
 */
class SellerMenuPage(private val composeTestRule: ComposeTestRule) {

    // Elements
    private val menuItems = composeTestRule.onAllNodes(hasTestTag("MenuItem"))
    private val firstMenuItem = menuItems.onFirst()
    private val addToCartButtons = composeTestRule.onAllNodes(hasText("Add to Cart", ignoreCase = true))
    private val firstAddToCartButton = addToCartButtons.onFirst()
    private val cartBadge = composeTestRule.onNode(hasTestTag("CartBadge"))
    private val cartIcon = composeTestRule.onNode(hasContentDescription("Cart", substring = true, ignoreCase = true))

    // Actions
    fun addFirstItemToCart(): SellerMenuPage {
        firstAddToCartButton.performScrollTo()
        firstAddToCartButton.performClick()
        Thread.sleep(1000)
        return this
    }

    fun addItemToCart(index: Int): SellerMenuPage {
        addToCartButtons[index].performScrollTo()
        addToCartButtons[index].performClick()
        Thread.sleep(1000)
        return this
    }

    fun navigateToCart(): CartPage {
        cartIcon.performClick()
        Thread.sleep(1000)
        return CartPage(composeTestRule)
    }

    // Assertions
    fun assertScreenDisplayed(): SellerMenuPage {
        firstMenuItem.assertExists()
        return this
    }

    fun assertMenuItemsDisplayed(): SellerMenuPage {
        assert(menuItems.fetchSemanticsNodes().isNotEmpty()) {
            "Menu items should be displayed"
        }
        return this
    }

    fun assertCartBadgeCount(count: Int): SellerMenuPage {
        cartBadge.assertTextContains(count.toString())
        return this
    }
}
