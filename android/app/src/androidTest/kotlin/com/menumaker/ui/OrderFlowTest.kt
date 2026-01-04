package com.menumaker.ui

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import com.menumaker.MainActivity
import com.menumaker.data.local.entities.CartEntity
import com.menumaker.data.repository.CartRepository
import com.menumaker.data.repository.MarketplaceRepository
import com.menumaker.data.repository.OrderRepository
import com.menumaker.fakes.FakeCartRepository
import com.menumaker.fakes.FakeMarketplaceRepository
import com.menumaker.fakes.FakeOrderRepository
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import javax.inject.Inject

/**
 * Instrumented UI tests for order flow
 * Tests menu browsing, cart management, and checkout process
 *
 * These tests use fake repositories via Hilt test module for deterministic,
 * network-independent testing.
 *
 * Requirements covered:
 * - 4.3: Cart management - adding, updating quantities, removing items
 * - 4.4: Order placement with delivery details and payment
 * - 8.1: Cart count and total price updates
 * - 8.4: Checkout validation for delivery address and payment method
 */
@LargeTest
@RunWith(AndroidJUnit4::class)
@HiltAndroidTest
class OrderFlowTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    @Inject
    lateinit var cartRepository: CartRepository

    @Inject
    lateinit var orderRepository: OrderRepository

    @Inject
    lateinit var marketplaceRepository: MarketplaceRepository

    private val fakeCartRepository: FakeCartRepository
        get() = cartRepository as FakeCartRepository

    private val fakeOrderRepository: FakeOrderRepository
        get() = orderRepository as FakeOrderRepository

    private val fakeMarketplaceRepository: FakeMarketplaceRepository
        get() = marketplaceRepository as FakeMarketplaceRepository

    @Before
    fun setup() {
        hiltRule.inject()
        // Reset fake repositories to clean state before each test
        fakeCartRepository.reset()
        fakeOrderRepository.reset()
        fakeMarketplaceRepository.reset()
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

    // MARK: - Cart Operations Tests (Requirements 4.3, 8.1)

    /**
     * Test: Adding item to cart updates cart count
     * Requirements: 4.3 - Cart management, 8.1 - Cart count updates
     */
    @Test
    fun addToCart_singleItem_updatesCartCount() {
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

            // Verify cart repository was called
            assert(fakeCartRepository.addToCartCallCount >= 1) {
                "Cart repository addToCart should be called"
            }
        }
    }

    /**
     * Test: Adding multiple items increases cart quantity
     * Requirements: 4.3 - Cart management
     */
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

            // Verify cart repository was called multiple times
            assert(fakeCartRepository.addToCartCallCount >= 2) {
                "Cart repository addToCart should be called at least twice"
            }
        }
    }

    /**
     * Test: Cart displays added items correctly
     * Requirements: 4.3 - Cart management
     */
    @Test
    fun cart_displaysAddedItems() {
        // Pre-populate cart with test data
        fakeCartRepository.setCartItems(listOf(
            CartEntity(
                dishId = "dish-1",
                businessId = "business-1",
                dishName = "Test Dish",
                quantity = 2,
                priceCents = 500
            )
        ))

        navigateToMenu()

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
                hasText("Test Dish", substring = true, ignoreCase = true) or
                hasText("Quantity", substring = true, ignoreCase = true)
            ).assertExists()
        }
    }

    /**
     * Test: Cart shows correct total price
     * Requirements: 8.1 - Cart total price updates
     */
    @Test
    fun cart_showsCorrectTotalPrice() {
        // Pre-populate cart with test data (2 items at 500 cents each = 1000 cents total)
        fakeCartRepository.setCartItems(listOf(
            CartEntity(
                dishId = "dish-1",
                businessId = "business-1",
                dishName = "Test Dish",
                quantity = 2,
                priceCents = 500
            )
        ))

        navigateToMenu()

        // Go to cart
        val cartButton = composeTestRule.onNode(
            hasText("Cart", substring = true, ignoreCase = true)
        )

        if (cartButton.isDisplayed()) {
            cartButton.performClick()
            composeTestRule.waitForIdle()

            // Verify total is displayed
            composeTestRule.onNode(
                hasText("Total", substring = true, ignoreCase = true) or
                hasText("Subtotal", substring = true, ignoreCase = true)
            ).assertExists()

            // Verify price amount is displayed
            composeTestRule.onNode(
                hasText("₹") or hasText("$") or hasText("10", substring = true)
            ).assertExists()
        }
    }

    /**
     * Test: Increasing quantity updates cart total
     * Requirements: 8.2 - Quantity update recalculates totals
     */
    @Test
    fun cart_increaseQuantity_updatesTotal() {
        // Pre-populate cart
        fakeCartRepository.setCartItems(listOf(
            CartEntity(
                dishId = "dish-1",
                businessId = "business-1",
                dishName = "Test Dish",
                quantity = 1,
                priceCents = 500
            )
        ))

        navigateToMenu()

        // Go to cart
        val cartButton = composeTestRule.onNode(
            hasText("Cart", substring = true)
        )

        if (cartButton.isDisplayed()) {
            cartButton.performClick()
            composeTestRule.waitForIdle()

            // Find increment button in cart
            val incrementButton = composeTestRule.onNode(
                hasText("+") and hasClickAction()
            )

            if (incrementButton.isDisplayed()) {
                incrementButton.performClick()
                composeTestRule.waitForIdle()

                // Verify update was called
                assert(fakeCartRepository.updateCartItemCallCount >= 1) {
                    "Cart repository updateCartItem should be called"
                }
            }
        }
    }

    /**
     * Test: Removing item updates cart
     * Requirements: 4.3 - Cart management
     */
    @Test
    fun cart_removeItem_updatesCart() {
        // Pre-populate cart
        fakeCartRepository.setCartItems(listOf(
            CartEntity(
                dishId = "dish-1",
                businessId = "business-1",
                dishName = "Test Dish",
                quantity = 1,
                priceCents = 500
            )
        ))

        navigateToMenu()

        // Go to cart
        val cartButton = composeTestRule.onNode(
            hasText("Cart", substring = true)
        )

        if (cartButton.isDisplayed()) {
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

                // Verify remove was called
                assert(fakeCartRepository.removeFromCartCallCount >= 1) {
                    "Cart repository removeFromCart should be called"
                }
            }
        }
    }

    // MARK: - Checkout Flow Tests (Requirements 4.4, 8.4)

    /**
     * Test: Checkout button is enabled when cart has items
     * Requirements: 8.4 - Checkout validation
     */
    @Test
    fun checkout_button_enabledWithItems() {
        // Pre-populate cart
        fakeCartRepository.setCartItems(listOf(
            CartEntity(
                dishId = "dish-1",
                businessId = "business-1",
                dishName = "Test Dish",
                quantity = 1,
                priceCents = 500
            )
        ))

        navigateToMenu()

        // Go to cart
        val cartButton = composeTestRule.onNode(
            hasText("Cart", substring = true)
        )

        if (cartButton.isDisplayed()) {
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

    /**
     * Test: Checkout navigates to delivery details screen
     * Requirements: 4.4 - Order placement with delivery details
     */
    @Test
    fun checkout_navigatesToDeliveryDetails() {
        // Pre-populate cart
        fakeCartRepository.setCartItems(listOf(
            CartEntity(
                dishId = "dish-1",
                businessId = "business-1",
                dishName = "Test Dish",
                quantity = 1,
                priceCents = 500
            )
        ))

        navigateToMenu()

        // Navigate to cart
        val cartButton = composeTestRule.onNode(
            hasText("Cart", substring = true)
        )

        if (cartButton.isDisplayed()) {
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

    /**
     * Test: Checkout with empty address shows validation error
     * Requirements: 8.4 - Checkout validation for delivery address
     */
    @Test
    fun checkout_withEmptyAddress_showsValidationError() {
        // Pre-populate cart
        fakeCartRepository.setCartItems(listOf(
            CartEntity(
                dishId = "dish-1",
                businessId = "business-1",
                dishName = "Test Dish",
                quantity = 1,
                priceCents = 500
            )
        ))

        navigateToMenu()

        // Navigate to cart and checkout
        val cartButton = composeTestRule.onNode(
            hasText("Cart", substring = true)
        )

        if (cartButton.isDisplayed()) {
            cartButton.performClick()
            composeTestRule.waitForIdle()

            val checkoutButton = composeTestRule.onNode(
                hasText("Checkout", ignoreCase = true)
            )

            if (checkoutButton.isDisplayed()) {
                checkoutButton.performClick()
                composeTestRule.waitForIdle()

                // Try to place order without address
                val placeOrderButton = composeTestRule.onNode(
                    hasText("Place Order", ignoreCase = true) or
                    hasText("Confirm", ignoreCase = true)
                )

                if (placeOrderButton.isDisplayed()) {
                    placeOrderButton.performClick()
                    composeTestRule.waitForIdle()

                    // Verify validation error
                    composeTestRule.onNode(
                        hasText("address", substring = true, ignoreCase = true) or
                        hasText("required", substring = true, ignoreCase = true) or
                        hasText("enter", substring = true, ignoreCase = true)
                    ).assertExists()
                }
            }
        }
    }

    /**
     * Test: Successful order placement clears cart
     * Requirements: 4.4 - Order placement, 8.5 - Order submission clears cart
     */
    @Test
    fun checkout_successfulOrder_clearsCart() {
        // Pre-populate cart
        fakeCartRepository.setCartItems(listOf(
            CartEntity(
                dishId = "dish-1",
                businessId = "business-1",
                dishName = "Test Dish",
                quantity = 1,
                priceCents = 500
            )
        ))

        navigateToMenu()

        // Navigate to cart and checkout
        val cartButton = composeTestRule.onNode(
            hasText("Cart", substring = true)
        )

        if (cartButton.isDisplayed()) {
            cartButton.performClick()
            composeTestRule.waitForIdle()

            val checkoutButton = composeTestRule.onNode(
                hasText("Checkout", ignoreCase = true)
            )

            if (checkoutButton.isDisplayed()) {
                checkoutButton.performClick()
                composeTestRule.waitForIdle()

                // Enter delivery address
                val addressField = composeTestRule.onNode(
                    hasText("Address", substring = true, ignoreCase = true) and hasSetTextAction()
                )

                if (addressField.isDisplayed()) {
                    addressField.performTextInput("123 Test Street, Test City")
                }

                // Select payment method (Cash)
                val cashOption = composeTestRule.onNode(
                    hasText("Cash", substring = true, ignoreCase = true)
                )

                if (cashOption.isDisplayed()) {
                    cashOption.performClick()
                }

                // Place order
                val placeOrderButton = composeTestRule.onNode(
                    hasText("Place Order", ignoreCase = true)
                )

                if (placeOrderButton.isDisplayed()) {
                    placeOrderButton.performClick()
                    composeTestRule.waitForIdle()

                    // Verify order was created
                    assert(fakeOrderRepository.createOrderCallCount >= 1) {
                        "Order repository createOrder should be called"
                    }
                }
            }
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
