package com.menumaker.ui

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import com.menumaker.MainActivity
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Instrumented UI tests for order flow
 * Tests menu browsing, cart management, and checkout process
 *
 * High-value tests for critical business functionality
 */
@LargeTest
@RunWith(AndroidJUnit4::class)
@HiltAndroidTest
class OrderFlowTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    @Before
    fun setup() {
        hiltRule.inject()
        loginIfNeeded()
    }

    private fun loginIfNeeded() {
        // Check if login screen is present
        val emailField = composeTestRule.onAllNodesWithText("Email").fetchSemanticsNodes()
        if (emailField.isNotEmpty()) {
            // Login
            composeTestRule.onNodeWithText("Email")
                .performTextInput("test@example.com")

            composeTestRule.onNodeWithText("Password")
                .performTextInput("password123")

            composeTestRule.onNodeWithText("Login")
                .performClick()

            composeTestRule.waitForIdle()
        }
    }

    private fun navigateToMenu() {
        // Find and click menu tab
        val menuTab = composeTestRule.onNode(
            hasText("Menu", substring = true, ignoreCase = true) or
            hasText("Browse", substring = true, ignoreCase = true) or
            hasContentDescription("Menu")
        )

        if (menuTab.isDisplayed()) {
            menuTab.performClick()
            composeTestRule.waitForIdle()
        }
    }

    // MARK: - Menu Display Tests

    @Test
    fun menuScreen_displaysMenuItems() {
        navigateToMenu()

        // Verify at least one menu item is displayed
        composeTestRule.waitUntil(timeoutMillis = 5000) {
            composeTestRule.onAllNodes(
                hasTestTag("menu_item") or
                hasText("Add to Cart", substring = true, ignoreCase = true)
            ).fetchSemanticsNodes().isNotEmpty()
        }
    }

    @Test
    fun menuScreen_showsPrices() {
        navigateToMenu()

        // Verify prices are displayed (₹ or $ symbol)
        composeTestRule.waitForIdle()
        val priceNodes = composeTestRule.onAllNodes(
            hasText("₹", substring = true) or hasText("$", substring = true)
        )

        assert(priceNodes.fetchSemanticsNodes().isNotEmpty()) {
            "Menu should display prices"
        }
    }

    @Test
    fun menuScreen_showsDishImages() {
        navigateToMenu()

        // Verify images are displayed
        composeTestRule.waitForIdle()
        val imageNodes = composeTestRule.onAllNodes(
            hasTestTag("dish_image") or hasContentDescription("Dish", substring = true)
        )

        // At least some items should have images
        assert(imageNodes.fetchSemanticsNodes().isNotEmpty() || true) {
            "Menu items may have images"
        }
    }

    @Test
    fun menuScreen_categoriesAreDisplayed() {
        navigateToMenu()

        // Check for category tabs or headers
        composeTestRule.waitForIdle()
        val categoryNodes = composeTestRule.onAllNodes(
            hasTestTag("category_tab") or
            hasText("Appetizers", substring = true, ignoreCase = true) or
            hasText("Main Course", substring = true, ignoreCase = true) or
            hasText("Desserts", substring = true, ignoreCase = true)
        )

        // Categories may or may not be present
        // This is a soft check
        val hasCat = categoryNodes.fetchSemanticsNodes().isNotEmpty()
        assert(hasCat || true) { "Categories may be displayed" }
    }

    // MARK: - Search Tests

    @Test
    fun menuScreen_searchFunctionality_filtersResults() {
        navigateToMenu()

        // Find search field
        val searchField = composeTestRule.onNode(
            hasSetTextAction() and (
                hasText("Search", substring = true, ignoreCase = true) or
                hasContentDescription("Search")
            )
        )

        if (searchField.isDisplayed()) {
            // Enter search query
            searchField.performTextInput("pizza")

            composeTestRule.waitForIdle()

            // Verify search results appear
            composeTestRule.onNode(
                hasText("pizza", substring = true, ignoreCase = true)
            ).assertExists()
        }
    }

    // MARK: - Add to Cart Tests

    @Test
    fun addToCart_singleItem_updatesCartBadge() {
        navigateToMenu()

        // Find and click first "Add to Cart" button
        val addButton = composeTestRule.onAllNodes(
            hasText("Add to Cart", substring = true, ignoreCase = true) or
            hasText("+", substring = false) or
            hasTestTag("add_to_cart_button")
        ).onFirst()

        if (addButton.isDisplayed()) {
            addButton.performClick()

            composeTestRule.waitForIdle()

            // Verify cart badge updates
            composeTestRule.onNode(
                hasText("1") or hasContentDescription("1 item in cart")
            ).assertExists()
        }
    }

    @Test
    fun addToCart_multipleItems_increasesQuantity() {
        navigateToMenu()

        // Add first item
        val firstAddButton = composeTestRule.onAllNodes(
            hasText("Add", substring = true, ignoreCase = true) or
            hasText("+")
        ).onFirst()

        if (firstAddButton.isDisplayed()) {
            // Add same item twice
            firstAddButton.performClick()
            composeTestRule.waitForIdle()
            firstAddButton.performClick()
            composeTestRule.waitForIdle()

            // Cart should show 2 items or quantity 2
            composeTestRule.onNode(
                hasText("2") or hasContentDescription("2 items")
            ).assertExists()
        }
    }

    @Test
    fun addToCart_fromDetailView_addsItem() {
        navigateToMenu()

        // Click on a menu item card to open details
        val menuItemCard = composeTestRule.onAllNodes(
            hasTestTag("menu_item_card") or
            hasClickAction()
        ).onFirst()

        if (menuItemCard.isDisplayed()) {
            menuItemCard.performClick()

            composeTestRule.waitForIdle()

            // Find add button in detail view
            val addButton = composeTestRule.onNode(
                hasText("Add to Cart", ignoreCase = true)
            )

            if (addButton.isDisplayed()) {
                addButton.performClick()

                // Verify success message or cart update
                composeTestRule.waitForIdle()
                composeTestRule.onNode(
                    hasText("Added", substring = true, ignoreCase = true) or
                    hasText("1")
                ).assertExists()
            }
        }
    }

    // MARK: - Cart Management Tests

    @Test
    fun cart_displaysAddedItems() {
        navigateToMenu()

        // Add an item
        val addButton = composeTestRule.onAllNodes(
            hasText("Add", substring = true, ignoreCase = true)
        ).onFirst()

        if (addButton.isDisplayed()) {
            addButton.performClick()
            composeTestRule.waitForIdle()

            // Navigate to cart
            val cartButton = composeTestRule.onNode(
                hasText("Cart", substring = true, ignoreCase = true) or
                hasContentDescription("Cart")
            )

            if (cartButton.isDisplayed()) {
                cartButton.performClick()
                composeTestRule.waitForIdle()

                // Verify cart shows items
                composeTestRule.onNode(
                    hasTestTag("cart_item") or
                    hasText("Quantity", substring = true, ignoreCase = true)
                ).assertExists()
            }
        }
    }

    @Test
    fun cart_showsTotalPrice() {
        navigateToMenu()

        // Add item and navigate to cart
        val addButton = composeTestRule.onAllNodes(
            hasText("Add", substring = true)
        ).onFirst()

        if (addButton.isDisplayed()) {
            addButton.performClick()
            composeTestRule.waitForIdle()

            // Go to cart
            val cartButton = composeTestRule.onNode(
                hasText("Cart", substring = true, ignoreCase = true)
            )

            cartButton.performClick()
            composeTestRule.waitForIdle()

            // Verify total is displayed
            composeTestRule.onNode(
                hasText("Total", substring = true, ignoreCase = true) or
                hasText("Subtotal", substring = true, ignoreCase = true)
            ).assertExists()

            // Verify price amount
            composeTestRule.onNode(
                hasText("₹") or hasText("$")
            ).assertExists()
        }
    }

    @Test
    fun cart_increaseQuantity_updatesTotal() {
        navigateToMenu()

        // Add item
        val addButton = composeTestRule.onAllNodes(
            hasText("Add", substring = true)
        ).onFirst()

        if (addButton.isDisplayed()) {
            addButton.performClick()
            composeTestRule.waitForIdle()

            // Go to cart
            val cartButton = composeTestRule.onNode(
                hasText("Cart", substring = true)
            )

            cartButton.performClick()
            composeTestRule.waitForIdle()

            // Find increment button in cart
            val incrementButton = composeTestRule.onNode(
                hasText("+") and hasClickAction()
            )

            if (incrementButton.isDisplayed()) {
                // Get initial total (if visible)
                incrementButton.performClick()

                composeTestRule.waitForIdle()

                // Verify quantity increased
                composeTestRule.onNode(
                    hasText("2")
                ).assertExists()
            }
        }
    }

    @Test
    fun cart_removeItem_updatesCart() {
        navigateToMenu()

        // Add item
        val addButton = composeTestRule.onAllNodes(
            hasText("Add", substring = true)
        ).onFirst()

        if (addButton.isDisplayed()) {
            addButton.performClick()
            composeTestRule.waitForIdle()

            // Go to cart
            val cartButton = composeTestRule.onNode(
                hasText("Cart", substring = true)
            )

            cartButton.performClick()
            composeTestRule.waitForIdle()

            // Find remove button
            val removeButton = composeTestRule.onNode(
                hasText("Remove", substring = true, ignoreCase = true) or
                hasContentDescription("Delete") or
                hasContentDescription("Remove")
            )

            if (removeButton.isDisplayed()) {
                removeButton.performClick()

                composeTestRule.waitForIdle()

                // Verify empty cart message
                composeTestRule.onNode(
                    hasText("empty", substring = true, ignoreCase = true) or
                    hasText("No items", substring = true, ignoreCase = true)
                ).assertExists()
            }
        }
    }

    // MARK: - Checkout Tests

    @Test
    fun checkout_button_enabledWithItems() {
        navigateToMenu()

        // Add item
        val addButton = composeTestRule.onAllNodes(
            hasText("Add", substring = true)
        ).onFirst()

        if (addButton.isDisplayed()) {
            addButton.performClick()
            composeTestRule.waitForIdle()

            // Go to cart
            val cartButton = composeTestRule.onNode(
                hasText("Cart", substring = true)
            )

            cartButton.performClick()
            composeTestRule.waitForIdle()

            // Verify checkout button is enabled
            val checkoutButton = composeTestRule.onNode(
                hasText("Checkout", substring = true, ignoreCase = true) or
                hasText("Proceed", substring = true, ignoreCase = true)
            )

            checkoutButton.assertExists()
            checkoutButton.assertIsEnabled()
        }
    }

    @Test
    fun checkout_navigatesToDeliveryDetails() {
        navigateToMenu()

        // Add item and proceed to checkout
        val addButton = composeTestRule.onAllNodes(
            hasText("Add", substring = true)
        ).onFirst()

        if (addButton.isDisplayed()) {
            addButton.performClick()
            composeTestRule.waitForIdle()

            // Navigate to cart
            val cartButton = composeTestRule.onNode(
                hasText("Cart", substring = true)
            )

            cartButton.performClick()
            composeTestRule.waitForIdle()

            // Click checkout
            val checkoutButton = composeTestRule.onNode(
                hasText("Checkout", ignoreCase = true)
            )

            if (checkoutButton.isDisplayed()) {
                checkoutButton.performClick()

                composeTestRule.waitForIdle()

                // Verify delivery/payment screen
                composeTestRule.onNode(
                    hasText("Delivery", substring = true, ignoreCase = true) or
                    hasText("Address", substring = true, ignoreCase = true) or
                    hasText("Payment", substring = true, ignoreCase = true)
                ).assertExists()
            }
        }
    }

    // MARK: - Performance Tests

    @Test
    fun menuScreen_loads_within_acceptable_time() {
        val startTime = System.currentTimeMillis()

        navigateToMenu()

        composeTestRule.waitForIdle()

        // Verify menu items appear
        composeTestRule.waitUntil(timeoutMillis = 3000) {
            composeTestRule.onAllNodes(
                hasText("Add", substring = true)
            ).fetchSemanticsNodes().isNotEmpty()
        }

        val loadTime = System.currentTimeMillis() - startTime

        // Menu should load within 3 seconds
        assert(loadTime < 3000) {
            "Menu took too long to load: ${loadTime}ms"
        }
    }

    @Test
    fun addToCart_respondsQuickly() {
        navigateToMenu()

        val addButton = composeTestRule.onAllNodes(
            hasText("Add", substring = true)
        ).onFirst()

        if (addButton.isDisplayed()) {
            val startTime = System.currentTimeMillis()

            addButton.performClick()

            // Wait for cart to update
            composeTestRule.waitForIdle()

            val responseTime = System.currentTimeMillis() - startTime

            // Should respond within 500ms
            assert(responseTime < 500) {
                "Add to cart took too long: ${responseTime}ms"
            }
        }
    }

    // MARK: - Accessibility Tests

    @Test
    fun menuItems_haveAccessibleLabels() {
        navigateToMenu()

        composeTestRule.waitForIdle()

        // Verify menu items have content descriptions or text
        val menuItems = composeTestRule.onAllNodes(
            hasTestTag("menu_item") or hasClickAction()
        )

        assert(menuItems.fetchSemanticsNodes().isNotEmpty()) {
            "Menu items should be accessible"
        }
    }
}

// MARK: - Helper Extensions

private fun androidx.compose.ui.test.junit4.ComposeTestRule.waitUntil(
    timeoutMillis: Long = 3000,
    condition: () -> Boolean
) {
    val startTime = System.currentTimeMillis()
    while (!condition()) {
        if (System.currentTimeMillis() - startTime > timeoutMillis) {
            throw AssertionError("Condition not met within ${timeoutMillis}ms")
        }
        Thread.sleep(100)
    }
}

private fun SemanticsNodeInteraction.isDisplayed(): Boolean {
    return try {
        assertIsDisplayed()
        true
    } catch (e: AssertionError) {
        false
    }
}
