package com.menumaker.ui

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertExists
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.navigation.compose.rememberNavController
import com.menumaker.data.local.entities.CartEntity
import com.menumaker.data.remote.models.DishDto
import com.menumaker.data.remote.models.MarketplaceSellerDto
import com.menumaker.fakes.FakeDishRepository
import com.menumaker.fakes.FakeMarketplaceRepository
import com.menumaker.ui.screens.customer.CartContent
import com.menumaker.ui.screens.customer.SellerMenuScreen
import com.menumaker.ui.screens.customer.MarketplaceScreen
import com.menumaker.ui.screens.seller.SellerDashboardContent
import com.menumaker.viewmodel.CartViewModel
import com.menumaker.viewmodel.DishViewModel
import com.menumaker.viewmodel.MarketplaceViewModel
import org.junit.Rule
import org.junit.Test

class ParityScreensTest {

    @get:Rule
    val composeTestRule = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun marketplace_shows_sellers_from_repository() {
        val fakeRepo = FakeMarketplaceRepository()
        val viewModel = MarketplaceViewModel(fakeRepo)

        composeTestRule.setContent {
            MarketplaceScreen(
                navController = rememberNavController(),
                viewModel = viewModel
            )
        }

        composeTestRule.waitUntil(timeoutMillis = 3_000) {
            composeTestRule.onAllNodes(hasTestTag("seller-seller-1")).fetchSemanticsNodes().isNotEmpty()
        }
        composeTestRule.onNodeWithTag("seller-seller-1").assertIsDisplayed()
        composeTestRule.onNodeWithText("Rating: 4.5 (100)").assertExists()
    }

    @Test
    fun sellerMenu_displays_dishes_from_repository() {
        val fakeRepo = FakeDishRepository().apply {
            setDishes(
                listOf(
                    DishDto(
                        id = "dish-test",
                        businessId = "business-1",
                        name = "Test Dish",
                        description = "From fake repo",
                        priceCents = 999,
                        imageUrl = null,
                        category = "Test",
                        isVegetarian = true,
                        isAvailable = true,
                        createdAt = "2025-01-01",
                        updatedAt = "2025-01-01"
                    )
                )
            )
        }
        val viewModel = DishViewModel(fakeRepo)

        composeTestRule.setContent {
            SellerMenuScreen(
                navController = rememberNavController(),
                sellerId = "business-1",
                viewModel = viewModel
            )
        }

        composeTestRule.waitUntil(timeoutMillis = 3_000) {
            composeTestRule.onAllNodes(hasTestTag("menu-dish-test")).fetchSemanticsNodes().isNotEmpty()
        }
        composeTestRule.onNodeWithTag("menu-dish-test").assertIsDisplayed()
        composeTestRule.onNodeWithText("Test Dish").assertExists()
    }

    @Test
    fun sellerDashboardContent_shows_stats_and_actions() {
        composeTestRule.setContent {
            SellerDashboardContent(
                navController = rememberNavController(),
                pendingOrders = 3,
                todayRevenue = 4200.0
            )
        }

        composeTestRule.onNodeWithTag("pending-count").assertIsDisplayed()
        composeTestRule.onNodeWithTag("quick-Orders").assertIsDisplayed()
        composeTestRule.onNodeWithTag("quick-Menu").assertIsDisplayed()
    }

    @Test
    fun cartContent_shows_items_and_total() {
        val items = listOf(
            CartEntity(
                dishId = "dish-1",
                businessId = "business-1",
                dishName = "Sample Dish",
                quantity = 2,
                priceCents = 500
            )
        )
        composeTestRule.setContent {
            CartContent(
                navController = rememberNavController(),
                cartItems = items,
                totalCents = 1000
            )
        }

        composeTestRule.onNodeWithText("Sample Dish").assertExists()
        composeTestRule.onNodeWithText("Total: $10.0").assertExists()
    }
}
