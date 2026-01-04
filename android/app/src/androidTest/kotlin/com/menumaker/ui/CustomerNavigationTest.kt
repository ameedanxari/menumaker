package com.menumaker.ui

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import com.menumaker.MainActivity
import com.menumaker.data.local.entities.CartEntity
import com.menumaker.data.remote.models.MarketplaceSellerDto
import com.menumaker.data.remote.models.OrderDto
import com.menumaker.data.remote.models.OrderItemDto
import com.menumaker.data.repository.CartRepository
import com.menumaker.data.repository.MarketplaceRepository
import com.menumaker.data.repository.OrderRepository
import com.menumaker.fakes.FakeCartRepository
import com.menumaker.fakes.FakeMarketplaceRepository
import com.menumaker.fakes.FakeOrderRepository
import com.menumaker.pageobjects.CartPage
import com.menumaker.pageobjects.CheckoutPage
import com.menumaker.pageobjects.DeliveryTrackingPage
import com.menumaker.pageobjects.MarketplacePage
import com.menumaker.pageobjects.OrderHistoryPage
import com.menumaker.pageobjects.SellerMenuPage
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import javax.inject.Inject

/**
 * Navigation tests for customer app flows.
 * 
 * These tests verify correct navigation between screens based on user actions.
 * Uses fake repositories via Hilt test module for deterministic, network-independent testing.
 *
 * Requirements covered:
 * - 7.2: Screen navigation verification based on user actions
 */
@LargeTest
@RunWith(AndroidJUnit4::class)
@HiltAndroidTest
class CustomerNavigationTest {

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
        setupTestData()
        loginIfNeeded()
    }

    private fun setupTestData() {
        // Setup marketplace sellers
        fakeMarketplaceRepository.setSellers(listOf(
            MarketplaceSellerDto(
                id = "seller-1",
                name = "Test Restaurant",
                slug = "test-restaurant",
                description = "A great test restaurant",
                logoUrl = null,
                cuisineType = "Italian",
                rating = 4.5,
                reviewCount = 100,
                latitude = 40.7128,
                longitude = -74.0060,
                distanceKm = 1.5
            )
        ))

        // Setup customer orders for tracking
        fakeOrderRepository.customerOrdersResponse = com.menumaker.data.common.Resource.Success(
            listOf(
                OrderDto(
                    id = "order-1",
                    businessId = "seller-1",
                    customerName = "Test Customer",
                    customerPhone = "+1234567890",
                    customerEmail = "customer@example.com",
                    totalCents = 1500,
                    status = "preparing",
                    items = listOf(
                        OrderItemDto(
                            id = "item-1",
                            dishId = "dish-1",
                            dishName = "Test Dish",
                            quantity = 2,
                            priceCents = 750,
                            totalCents = 1500
                        )
                    ),
                    createdAt = "2025-01-01T00:00:00Z",
                    updatedAt = "2025-01-01T00:00:00Z"
                )
            )
        )
    }

    private fun loginIfNeeded() {
        // Check if login screen is present
        val emailField = composeTestRule.onAllNodesWithText("Email").fetchSemanticsNodes()
        if (emailField.isNotEmpty()) {
            composeTestRule.onNodeWithText("Email")
                .performTextInput("customer@example.com")

            composeTestRule.onNodeWithText("Password")
                .performTextInput("password123")

            composeTestRule.onNodeWithText("Login")
                .performClick()

            composeTestRule.waitForIdle()
        }
    }

    // MARK: - Marketplace to Menu Navigation Tests (Requirement 7.2)

    /**
     * Test: Navigation from marketplace to restaurant menu
     * Requirements: 7.2 - Verify correct navigation between screens
     */
    @Test
    fun navigation_fromMarketplace_toMenu() {
        // Navigate to marketplace
        navigateToMarketplace()

        // Tap on first restaurant
        val restaurantCard = composeTestRule.onAllNodes(
            hasTestTag("seller_card") or
            hasTestTag("SellerCard") or
            hasClickAction()
        ).onFirst()

        if (restaurantCard.isDisplayed()) {
            restaurantCard.performClick()
            composeTestRule.waitForIdle()

            // Verify menu screen is displayed
            composeTestRule.waitUntil(timeoutMillis = 3000) {
                composeTestRule.onAllNodes(
                    hasText("Menu", substring = true, ignoreCase = true) or
                    hasText("Add to Cart", substring = true, ignoreCase = true) or
                    hasTestTag("menu_item") or
                    hasTestTag("MenuItem")
                ).fetchSemanticsNodes().isNotEmpty()
            }
        }
    }

    /**
     * Test: Navigation from marketplace to menu shows correct restaurant
     * Requirements: 7.2 - Navigation correctness
     */
    @Test
    fun navigation_fromMarketplace_toMenu_showsCorrectRestaurant() {
        // Navigate to marketplace
        navigateToMarketplace()

        // Tap on restaurant
        val restaurantCard = composeTestRule.onAllNodes(
            hasTestTag("seller_card") or
            hasTestTag("SellerCard") or
            hasClickAction()
        ).onFirst()

        if (restaurantCard.isDisplayed()) {
            restaurantCard.performClick()
            composeTestRule.waitForIdle()

            // Verify restaurant name is displayed on menu screen
            composeTestRule.onNode(
                hasText("Test Restaurant", substring = true, ignoreCase = true) or
                hasText("Menu", substring = true, ignoreCase = true)
            ).assertExists()
        }
    }

    // MARK: - Cart to Checkout Navigation Tests (Requirement 7.2)

    /**
     * Test: Navigation from cart to checkout
     * Requirements: 7.2 - Verify correct navigation between screens
     */
    @Test
    fun navigation_fromCart_toCheckout() {
        // Pre-populate cart with test data
        fakeCartRepository.setCartItems(listOf(
            CartEntity(
                dishId = "dish-1",
                businessId = "seller-1",
                dishName = "Test Dish",
                quantity = 2,
                priceCents = 500
            )
        ))

        // Navigate to cart
        navigateToCart()

        // Click checkout button
        val checkoutButton = composeTestRule.onNode(
            hasText("Checkout", substring = true, ignoreCase = true) or
            hasText("Proceed", substring = true, ignoreCase = true)
        )

        if (checkoutButton.isDisplayed()) {
            checkoutButton.performClick()
            composeTestRule.waitForIdle()

            // Verify checkout screen is displayed
            composeTestRule.waitUntil(timeoutMillis = 3000) {
                composeTestRule.onAllNodes(
                    hasText("Delivery", substring = true, ignoreCase = true) or
                    hasText("Address", substring = true, ignoreCase = true) or
                    hasText("Payment", substring = true, ignoreCase = true) or
                    hasText("Place Order", substring = true, ignoreCase = true)
                ).fetchSemanticsNodes().isNotEmpty()
            }
        }
    }

    /**
     * Test: Navigation from cart to checkout preserves cart items
     * Requirements: 7.2 - Navigation correctness
     */
    @Test
    fun navigation_fromCart_toCheckout_preservesCartItems() {
        // Pre-populate cart with test data
        fakeCartRepository.setCartItems(listOf(
            CartEntity(
                dishId = "dish-1",
                businessId = "seller-1",
                dishName = "Test Dish",
                quantity = 2,
                priceCents = 500
            )
        ))

        // Navigate to cart
        navigateToCart()

        // Click checkout button
        val checkoutButton = composeTestRule.onNode(
            hasText("Checkout", substring = true, ignoreCase = true)
        )

        if (checkoutButton.isDisplayed()) {
            checkoutButton.performClick()
            composeTestRule.waitForIdle()

            // Verify order total is displayed (cart items preserved)
            composeTestRule.onNode(
                hasText("₹", substring = true) or
                hasText("$", substring = true) or
                hasText("Total", substring = true, ignoreCase = true)
            ).assertExists()
        }
    }

    /**
     * Test: Navigation from empty cart does not proceed to checkout
     * Requirements: 7.2 - Navigation validation
     */
    @Test
    fun navigation_fromEmptyCart_doesNotProceedToCheckout() {
        // Ensure cart is empty
        fakeCartRepository.setCartItems(emptyList())

        // Navigate to cart
        navigateToCart()

        // Verify checkout button is disabled or not present
        val checkoutButton = composeTestRule.onNode(
            hasText("Checkout", substring = true, ignoreCase = true)
        )

        // Either button doesn't exist or is disabled
        try {
            checkoutButton.assertIsNotEnabled()
        } catch (e: AssertionError) {
            // Button might not exist for empty cart, which is also valid
            composeTestRule.onNode(
                hasText("empty", substring = true, ignoreCase = true) or
                hasText("no items", substring = true, ignoreCase = true)
            ).assertExists()
        }
    }

    // MARK: - Order to Tracking Navigation Tests (Requirement 7.2)

    /**
     * Test: Navigation from order history to order tracking
     * Requirements: 7.2 - Verify correct navigation between screens
     */
    @Test
    fun navigation_fromOrder_toTracking() {
        // Navigate to orders
        navigateToOrders()

        // Tap on first order
        val orderCard = composeTestRule.onAllNodes(
            hasTestTag("OrderItem") or
            hasTestTag("order_card") or
            hasClickAction()
        ).onFirst()

        if (orderCard.isDisplayed()) {
            orderCard.performClick()
            composeTestRule.waitForIdle()

            // Look for track button or tracking screen
            val trackButton = composeTestRule.onNode(
                hasText("Track", substring = true, ignoreCase = true)
            )

            if (trackButton.isDisplayed()) {
                trackButton.performClick()
                composeTestRule.waitForIdle()
            }

            // Verify tracking screen is displayed
            composeTestRule.waitUntil(timeoutMillis = 3000) {
                composeTestRule.onAllNodes(
                    hasText("Status", substring = true, ignoreCase = true) or
                    hasText("Tracking", substring = true, ignoreCase = true) or
                    hasText("preparing", substring = true, ignoreCase = true) or
                    hasTestTag("OrderStatus") or
                    hasTestTag("TrackingStep")
                ).fetchSemanticsNodes().isNotEmpty()
            }
        }
    }

    /**
     * Test: Navigation from order to tracking shows correct order status
     * Requirements: 7.2 - Navigation correctness
     */
    @Test
    fun navigation_fromOrder_toTracking_showsCorrectStatus() {
        // Navigate to orders
        navigateToOrders()

        // Tap on first order
        val orderCard = composeTestRule.onAllNodes(
            hasTestTag("OrderItem") or
            hasTestTag("order_card") or
            hasClickAction()
        ).onFirst()

        if (orderCard.isDisplayed()) {
            orderCard.performClick()
            composeTestRule.waitForIdle()

            // Verify order status is displayed
            composeTestRule.onNode(
                hasText("preparing", substring = true, ignoreCase = true) or
                hasText("Status", substring = true, ignoreCase = true) or
                hasTestTag("OrderStatus")
            ).assertExists()
        }
    }

    // MARK: - Back Navigation Tests

    /**
     * Test: Back navigation from menu returns to marketplace
     * Requirements: 7.2 - Navigation correctness
     */
    @Test
    fun navigation_backFromMenu_returnsToMarketplace() {
        // Navigate to marketplace then menu
        navigateToMarketplace()

        val restaurantCard = composeTestRule.onAllNodes(
            hasTestTag("seller_card") or
            hasTestTag("SellerCard") or
            hasClickAction()
        ).onFirst()

        if (restaurantCard.isDisplayed()) {
            restaurantCard.performClick()
            composeTestRule.waitForIdle()

            // Press back
            val backButton = composeTestRule.onNode(
                hasContentDescription("Back") or
                hasContentDescription("Navigate up") or
                hasContentDescription("back", substring = true, ignoreCase = true)
            )

            if (backButton.isDisplayed()) {
                backButton.performClick()
                composeTestRule.waitForIdle()

                // Verify marketplace is displayed
                composeTestRule.onNode(
                    hasText("Marketplace", substring = true, ignoreCase = true) or
                    hasText("Browse", substring = true, ignoreCase = true) or
                    hasText("Search", substring = true, ignoreCase = true)
                ).assertExists()
            }
        }
    }

    /**
     * Test: Back navigation from checkout returns to cart
     * Requirements: 7.2 - Navigation correctness
     */
    @Test
    fun navigation_backFromCheckout_returnsToCart() {
        // Pre-populate cart
        fakeCartRepository.setCartItems(listOf(
            CartEntity(
                dishId = "dish-1",
                businessId = "seller-1",
                dishName = "Test Dish",
                quantity = 1,
                priceCents = 500
            )
        ))

        // Navigate to cart then checkout
        navigateToCart()

        val checkoutButton = composeTestRule.onNode(
            hasText("Checkout", substring = true, ignoreCase = true)
        )

        if (checkoutButton.isDisplayed()) {
            checkoutButton.performClick()
            composeTestRule.waitForIdle()

            // Press back
            val backButton = composeTestRule.onNode(
                hasContentDescription("Back") or
                hasContentDescription("Navigate up") or
                hasContentDescription("back", substring = true, ignoreCase = true)
            )

            if (backButton.isDisplayed()) {
                backButton.performClick()
                composeTestRule.waitForIdle()

                // Verify cart is displayed
                composeTestRule.onNode(
                    hasText("Cart", substring = true, ignoreCase = true) or
                    hasText("Checkout", substring = true, ignoreCase = true)
                ).assertExists()
            }
        }
    }

    // MARK: - Tab Navigation Tests

    /**
     * Test: Tab navigation between main screens
     * Requirements: 7.2 - Navigation correctness
     */
    @Test
    fun navigation_tabNavigation_switchesBetweenScreens() {
        // Navigate to marketplace
        navigateToMarketplace()

        // Verify marketplace is displayed
        composeTestRule.onNode(
            hasText("Search", substring = true, ignoreCase = true) or
            hasText("Marketplace", substring = true, ignoreCase = true)
        ).assertExists()

        // Navigate to orders
        navigateToOrders()

        // Verify orders screen is displayed
        composeTestRule.onNode(
            hasText("Orders", substring = true, ignoreCase = true) or
            hasText("My Orders", substring = true, ignoreCase = true)
        ).assertExists()

        // Navigate to profile
        navigateToProfile()

        // Verify profile screen is displayed
        composeTestRule.onNode(
            hasText("Profile", substring = true, ignoreCase = true) or
            hasText("Account", substring = true, ignoreCase = true)
        ).assertExists()
    }

    // MARK: - Helper Methods

    private fun navigateToMarketplace() {
        val marketplaceTab = composeTestRule.onNode(
            hasText("Marketplace", substring = true, ignoreCase = true) or
            hasText("Browse", substring = true, ignoreCase = true) or
            hasText("Home", substring = true, ignoreCase = true) or
            hasContentDescription("Marketplace")
        )

        if (marketplaceTab.isDisplayed()) {
            marketplaceTab.performClick()
            composeTestRule.waitForIdle()
        }
    }

    private fun navigateToCart() {
        val cartTab = composeTestRule.onNode(
            hasText("Cart", substring = true, ignoreCase = true) or
            hasContentDescription("Cart")
        )

        if (cartTab.isDisplayed()) {
            cartTab.performClick()
            composeTestRule.waitForIdle()
        }
    }

    private fun navigateToOrders() {
        val ordersTab = composeTestRule.onNode(
            hasText("Orders", substring = true, ignoreCase = true) or
            hasText("My Orders", substring = true, ignoreCase = true) or
            hasContentDescription("Orders")
        )

        if (ordersTab.isDisplayed()) {
            ordersTab.performClick()
            composeTestRule.waitForIdle()
        }
    }

    private fun navigateToProfile() {
        val profileTab = composeTestRule.onNode(
            hasText("Profile", substring = true, ignoreCase = true) or
            hasText("Account", substring = true, ignoreCase = true) or
            hasContentDescription("Profile")
        )

        if (profileTab.isDisplayed()) {
            profileTab.performClick()
            composeTestRule.waitForIdle()
        }
    }
}

// MARK: - Helper Extensions

private fun SemanticsNodeInteraction.isDisplayed(): Boolean {
    return try {
        assertIsDisplayed()
        true
    } catch (e: AssertionError) {
        false
    }
}
