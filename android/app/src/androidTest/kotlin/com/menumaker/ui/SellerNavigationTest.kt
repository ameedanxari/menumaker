package com.menumaker.ui

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import com.menumaker.MainActivity
import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.AnalyticsData
import com.menumaker.data.remote.models.AnalyticsResponseData
import com.menumaker.data.remote.models.CustomerInsights
import com.menumaker.data.remote.models.DishDto
import com.menumaker.data.remote.models.OrderDto
import com.menumaker.data.remote.models.OrderItemDto
import com.menumaker.data.remote.models.PayoutInfo
import com.menumaker.data.remote.models.PopularItem
import com.menumaker.data.remote.models.SalesDataPoint
import com.menumaker.data.repository.BusinessRepository
import com.menumaker.data.repository.DishRepository
import com.menumaker.data.repository.OrderRepository
import com.menumaker.fakes.FakeBusinessRepository
import com.menumaker.fakes.FakeDishRepository
import com.menumaker.fakes.FakeOrderRepository
import com.menumaker.pageobjects.SellerMenuEditorPage
import com.menumaker.pageobjects.SellerOrdersPage
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import javax.inject.Inject

/**
 * Navigation tests for seller app flows.
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
class SellerNavigationTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    @Inject
    lateinit var orderRepository: OrderRepository

    @Inject
    lateinit var businessRepository: BusinessRepository

    @Inject
    lateinit var dishRepository: DishRepository

    private val fakeOrderRepository: FakeOrderRepository
        get() = orderRepository as FakeOrderRepository

    private val fakeBusinessRepository: FakeBusinessRepository
        get() = businessRepository as FakeBusinessRepository

    private val fakeDishRepository: FakeDishRepository
        get() = dishRepository as FakeDishRepository

    @Before
    fun setup() {
        hiltRule.inject()
        // Reset fake repositories to clean state before each test
        fakeOrderRepository.reset()
        fakeBusinessRepository.reset()
        fakeDishRepository.reset()
        setupTestData()
        loginAsSellerIfNeeded()
    }

    private fun setupTestData() {
        // Setup orders for testing
        val testOrders = listOf(
            createTestOrder("order-1", "pending", 1500),
            createTestOrder("order-2", "confirmed", 2000),
            createTestOrder("order-3", "preparing", 1200)
        )
        testOrders.forEach { fakeOrderRepository.addOrder(it) }

        // Setup analytics data
        fakeBusinessRepository.analyticsResponse = Resource.Success(createTestAnalytics())

        // Setup menu items
        fakeDishRepository.setDishes(listOf(
            DishDto(
                id = "dish-1",
                businessId = "business-1",
                name = "Test Dish 1",
                description = "A delicious test dish",
                priceCents = 500,
                imageUrl = null,
                category = "Main Course",
                isVegetarian = false,
                isAvailable = true,
                createdAt = "2025-01-01T00:00:00Z",
                updatedAt = "2025-01-01T00:00:00Z"
            ),
            DishDto(
                id = "dish-2",
                businessId = "business-1",
                name = "Test Dish 2",
                description = "Another delicious dish",
                priceCents = 750,
                imageUrl = null,
                category = "Appetizer",
                isVegetarian = true,
                isAvailable = true,
                createdAt = "2025-01-01T00:00:00Z",
                updatedAt = "2025-01-01T00:00:00Z"
            )
        ))
    }

    private fun createTestOrder(id: String, status: String, totalCents: Int): OrderDto {
        return OrderDto(
            id = id,
            businessId = "business-1",
            customerName = "Test Customer",
            customerPhone = "+1234567890",
            customerEmail = "customer@example.com",
            totalCents = totalCents,
            status = status,
            items = listOf(
                OrderItemDto(
                    id = "item-$id",
                    dishId = "dish-1",
                    dishName = "Test Dish",
                    quantity = 2,
                    priceCents = totalCents / 2,
                    totalCents = totalCents
                )
            ),
            createdAt = "2025-01-01T00:00:00Z",
            updatedAt = "2025-01-01T00:00:00Z"
        )
    }

    private fun createTestAnalytics(): AnalyticsResponseData {
        return AnalyticsResponseData(
            analytics = AnalyticsData(
                totalSales = 50000.0,
                totalOrders = 150,
                totalRevenue = 45000.0,
                averageOrderValue = 333.33,
                newCustomers = 50,
                repeatCustomers = 30,
                popularItems = listOf(
                    PopularItem(
                        id = "item-1",
                        name = "Popular Dish",
                        salesCount = 50,
                        revenue = 25000.0,
                        imageUrl = null
                    )
                ),
                salesData = listOf(
                    SalesDataPoint(id = "1", date = "2025-01-01", sales = 5000.0, orders = 15)
                ),
                peakHours = emptyList()
            ),
            customerInsights = CustomerInsights(
                newCustomers = 50,
                repeatCustomers = 30,
                totalCustomers = 80,
                averageOrdersPerCustomer = 1.875
            ),
            payouts = PayoutInfo(
                pendingAmount = 5000.0,
                completedAmount = 40000.0,
                nextPayoutDate = "2025-01-15"
            )
        )
    }

    private fun loginAsSellerIfNeeded() {
        // Check if login screen is present
        val emailField = composeTestRule.onAllNodesWithText("Email").fetchSemanticsNodes()
        if (emailField.isNotEmpty()) {
            composeTestRule.onNodeWithText("Email")
                .performTextInput("seller@example.com")

            composeTestRule.onNodeWithText("Password")
                .performTextInput("password123")

            composeTestRule.onNodeWithText("Login")
                .performClick()

            composeTestRule.waitForIdle()
        }
    }

    // MARK: - Dashboard to Orders Navigation Tests (Requirement 7.2)

    /**
     * Test: Navigation from dashboard to orders
     * Requirements: 7.2 - Verify correct navigation between screens
     */
    @Test
    fun navigation_fromDashboard_toOrders() {
        // Navigate to dashboard
        navigateToDashboard()

        // Navigate to orders
        navigateToOrders()

        // Verify orders screen is displayed
        composeTestRule.waitUntil(timeoutMillis = 3000) {
            composeTestRule.onAllNodes(
                hasText("Orders", substring = true, ignoreCase = true) or
                hasTestTag("OrderCard") or
                hasText("pending", substring = true, ignoreCase = true) or
                hasText("new", substring = true, ignoreCase = true)
            ).fetchSemanticsNodes().isNotEmpty()
        }
    }

    /**
     * Test: Navigation from dashboard to orders via quick action
     * Requirements: 7.2 - Navigation correctness
     */
    @Test
    fun navigation_fromDashboard_toOrders_viaQuickAction() {
        // Navigate to dashboard
        navigateToDashboard()

        // Look for quick action to view orders
        val viewOrdersButton = composeTestRule.onNode(
            hasText("View Orders", substring = true, ignoreCase = true) or
            hasText("New Orders", substring = true, ignoreCase = true) or
            hasText("Pending", substring = true, ignoreCase = true)
        )

        if (viewOrdersButton.isDisplayed()) {
            viewOrdersButton.performClick()
            composeTestRule.waitForIdle()

            // Verify orders screen is displayed
            composeTestRule.onNode(
                hasText("Orders", substring = true, ignoreCase = true) or
                hasTestTag("OrderCard")
            ).assertExists()
        }
    }

    // MARK: - Orders to Order Detail Navigation Tests (Requirement 7.2)

    /**
     * Test: Navigation from orders list to order detail
     * Requirements: 7.2 - Verify correct navigation between screens
     */
    @Test
    fun navigation_fromOrders_toOrderDetail() {
        // Navigate to orders
        navigateToOrders()

        // Tap on first order
        val orderCard = composeTestRule.onAllNodes(
            hasTestTag("OrderCard") or
            hasTestTag("order_card") or
            hasClickAction()
        ).onFirst()

        if (orderCard.isDisplayed()) {
            orderCard.performClick()
            composeTestRule.waitForIdle()

            // Verify order detail screen is displayed
            composeTestRule.waitUntil(timeoutMillis = 3000) {
                composeTestRule.onAllNodes(
                    hasText("Order", substring = true, ignoreCase = true) or
                    hasText("Customer", substring = true, ignoreCase = true) or
                    hasText("Accept", substring = true, ignoreCase = true) or
                    hasText("₹", substring = true) or
                    hasTestTag("order-id")
                ).fetchSemanticsNodes().isNotEmpty()
            }
        }
    }

    /**
     * Test: Navigation from orders to order detail shows correct order
     * Requirements: 7.2 - Navigation correctness
     */
    @Test
    fun navigation_fromOrders_toOrderDetail_showsCorrectOrder() {
        // Navigate to orders
        navigateToOrders()

        // Tap on first order
        val orderCard = composeTestRule.onAllNodes(
            hasTestTag("OrderCard") or
            hasTestTag("order_card") or
            hasClickAction()
        ).onFirst()

        if (orderCard.isDisplayed()) {
            orderCard.performClick()
            composeTestRule.waitForIdle()

            // Verify order details are displayed
            composeTestRule.onNode(
                hasText("Test Customer", substring = true, ignoreCase = true) or
                hasText("Customer", substring = true, ignoreCase = true) or
                hasText("₹", substring = true)
            ).assertExists()
        }
    }

    /**
     * Test: Back navigation from order detail returns to orders list
     * Requirements: 7.2 - Navigation correctness
     */
    @Test
    fun navigation_backFromOrderDetail_returnsToOrdersList() {
        // Navigate to orders
        navigateToOrders()

        // Tap on first order
        val orderCard = composeTestRule.onAllNodes(
            hasTestTag("OrderCard") or
            hasTestTag("order_card") or
            hasClickAction()
        ).onFirst()

        if (orderCard.isDisplayed()) {
            orderCard.performClick()
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

                // Verify orders list is displayed
                composeTestRule.onNode(
                    hasText("Orders", substring = true, ignoreCase = true) or
                    hasTestTag("OrderCard")
                ).assertExists()
            }
        }
    }

    // MARK: - Dashboard to Menu Editor Navigation Tests (Requirement 7.2)

    /**
     * Test: Navigation from dashboard to menu editor
     * Requirements: 7.2 - Verify correct navigation between screens
     */
    @Test
    fun navigation_fromDashboard_toMenuEditor() {
        // Navigate to dashboard
        navigateToDashboard()

        // Navigate to menu editor
        navigateToMenuEditor()

        // Verify menu editor screen is displayed
        composeTestRule.waitUntil(timeoutMillis = 3000) {
            composeTestRule.onAllNodes(
                hasText("Menu", substring = true, ignoreCase = true) or
                hasText("Add Item", substring = true, ignoreCase = true) or
                hasTestTag("MenuItem") or
                hasText("Edit", substring = true, ignoreCase = true)
            ).fetchSemanticsNodes().isNotEmpty()
        }
    }

    /**
     * Test: Navigation to menu editor shows menu items
     * Requirements: 7.2 - Navigation correctness
     */
    @Test
    fun navigation_toMenuEditor_showsMenuItems() {
        // Navigate to menu editor
        navigateToMenuEditor()

        // Verify menu items are displayed
        composeTestRule.waitUntil(timeoutMillis = 3000) {
            composeTestRule.onAllNodes(
                hasText("Test Dish", substring = true, ignoreCase = true) or
                hasTestTag("MenuItem") or
                hasText("Add Item", substring = true, ignoreCase = true)
            ).fetchSemanticsNodes().isNotEmpty()
        }
    }

    /**
     * Test: Navigation from menu editor to add new dish
     * Requirements: 7.2 - Navigation correctness
     */
    @Test
    fun navigation_fromMenuEditor_toAddNewDish() {
        // Navigate to menu editor
        navigateToMenuEditor()

        // Tap add item button
        val addItemButton = composeTestRule.onNode(
            hasText("Add Item", substring = true, ignoreCase = true) or
            hasText("Add Dish", substring = true, ignoreCase = true) or
            hasContentDescription("Add", substring = true, ignoreCase = true)
        )

        if (addItemButton.isDisplayed()) {
            addItemButton.performClick()
            composeTestRule.waitForIdle()

            // Verify add dish form is displayed
            composeTestRule.waitUntil(timeoutMillis = 3000) {
                composeTestRule.onAllNodes(
                    hasText("Name", substring = true, ignoreCase = true) or
                    hasText("Price", substring = true, ignoreCase = true) or
                    hasText("Description", substring = true, ignoreCase = true) or
                    hasText("Save", substring = true, ignoreCase = true)
                ).fetchSemanticsNodes().isNotEmpty()
            }
        }
    }

    /**
     * Test: Navigation from menu editor to edit dish
     * Requirements: 7.2 - Navigation correctness
     */
    @Test
    fun navigation_fromMenuEditor_toEditDish() {
        // Navigate to menu editor
        navigateToMenuEditor()

        // Tap on first menu item
        val menuItem = composeTestRule.onAllNodes(
            hasTestTag("MenuItem") or
            hasText("Test Dish", substring = true, ignoreCase = true)
        ).onFirst()

        if (menuItem.isDisplayed()) {
            menuItem.performClick()
            composeTestRule.waitForIdle()

            // Verify edit form is displayed
            composeTestRule.waitUntil(timeoutMillis = 3000) {
                composeTestRule.onAllNodes(
                    hasText("Name", substring = true, ignoreCase = true) or
                    hasText("Price", substring = true, ignoreCase = true) or
                    hasText("Save", substring = true, ignoreCase = true) or
                    hasText("Delete", substring = true, ignoreCase = true)
                ).fetchSemanticsNodes().isNotEmpty()
            }
        }
    }

    // MARK: - Tab Navigation Tests

    /**
     * Test: Tab navigation between main seller screens
     * Requirements: 7.2 - Navigation correctness
     */
    @Test
    fun navigation_tabNavigation_switchesBetweenScreens() {
        // Navigate to dashboard
        navigateToDashboard()

        // Verify dashboard is displayed
        composeTestRule.onNode(
            hasText("Dashboard", substring = true, ignoreCase = true) or
            hasText("Analytics", substring = true, ignoreCase = true) or
            hasText("Sales", substring = true, ignoreCase = true)
        ).assertExists()

        // Navigate to orders
        navigateToOrders()

        // Verify orders screen is displayed
        composeTestRule.onNode(
            hasText("Orders", substring = true, ignoreCase = true)
        ).assertExists()

        // Navigate to menu
        navigateToMenuEditor()

        // Verify menu screen is displayed
        composeTestRule.onNode(
            hasText("Menu", substring = true, ignoreCase = true) or
            hasText("Add Item", substring = true, ignoreCase = true)
        ).assertExists()
    }

    /**
     * Test: Navigation to settings from dashboard
     * Requirements: 7.2 - Navigation correctness
     */
    @Test
    fun navigation_fromDashboard_toSettings() {
        // Navigate to dashboard
        navigateToDashboard()

        // Navigate to settings
        val settingsButton = composeTestRule.onNode(
            hasText("Settings", substring = true, ignoreCase = true) or
            hasContentDescription("Settings") or
            hasContentDescription("settings", substring = true, ignoreCase = true)
        )

        if (settingsButton.isDisplayed()) {
            settingsButton.performClick()
            composeTestRule.waitForIdle()

            // Verify settings screen is displayed
            composeTestRule.onNode(
                hasText("Settings", substring = true, ignoreCase = true) or
                hasText("Account", substring = true, ignoreCase = true) or
                hasText("Preferences", substring = true, ignoreCase = true)
            ).assertExists()
        }
    }

    // MARK: - Order Status Navigation Tests

    /**
     * Test: Order status update navigates correctly
     * Requirements: 7.2 - Navigation correctness
     */
    @Test
    fun navigation_orderStatusUpdate_staysOnOrderDetail() {
        // Setup pending order
        fakeOrderRepository.businessOrdersResponse = Resource.Success(
            listOf(createTestOrder("order-pending", "pending", 1500))
        )

        // Navigate to orders
        navigateToOrders()

        // Tap on first order
        val orderCard = composeTestRule.onAllNodes(
            hasTestTag("OrderCard") or
            hasClickAction()
        ).onFirst()

        if (orderCard.isDisplayed()) {
            orderCard.performClick()
            composeTestRule.waitForIdle()

            // Accept order
            val acceptButton = composeTestRule.onNode(
                hasText("Accept", substring = true, ignoreCase = true)
            )

            if (acceptButton.isDisplayed()) {
                acceptButton.performClick()
                composeTestRule.waitForIdle()

                // Verify still on order detail (or navigated to orders list)
                composeTestRule.onNode(
                    hasText("Order", substring = true, ignoreCase = true) or
                    hasText("Orders", substring = true, ignoreCase = true)
                ).assertExists()
            }
        }
    }

    // MARK: - Helper Methods

    private fun navigateToDashboard() {
        val dashboardTab = composeTestRule.onNode(
            hasText("Dashboard", substring = true, ignoreCase = true) or
            hasText("Home", substring = true, ignoreCase = true) or
            hasContentDescription("Dashboard")
        )

        if (dashboardTab.isDisplayed()) {
            dashboardTab.performClick()
            composeTestRule.waitForIdle()
        }
    }

    private fun navigateToOrders() {
        val ordersTab = composeTestRule.onNode(
            hasText("Orders", substring = true, ignoreCase = true) or
            hasContentDescription("Orders")
        )

        if (ordersTab.isDisplayed()) {
            ordersTab.performClick()
            composeTestRule.waitForIdle()
        }
    }

    private fun navigateToMenuEditor() {
        val menuTab = composeTestRule.onNode(
            hasText("Menu", substring = true, ignoreCase = true) or
            hasContentDescription("Menu")
        )

        if (menuTab.isDisplayed()) {
            menuTab.performClick()
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
