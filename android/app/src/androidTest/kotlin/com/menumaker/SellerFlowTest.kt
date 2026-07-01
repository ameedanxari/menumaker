package com.menumaker

import androidx.activity.ComponentActivity
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.navigation.compose.rememberNavController
import com.menumaker.ui.screens.seller.SellerDashboardContent
import com.menumaker.viewmodel.SellerDashboardSectionError
import com.menumaker.viewmodel.SellerDashboardStatus
import com.menumaker.viewmodel.SellerDashboardUiState
import org.junit.Rule
import org.junit.Test

class SellerFlowTest {

    @get:Rule
    val composeRule = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun dashboardRendersLoadingStateTag() {
        renderDashboard(SellerDashboardUiState(status = SellerDashboardStatus.Loading))

        composeRule.onNodeWithTag("seller-loading").assertIsDisplayed()
    }

    @Test
    fun dashboardRendersEmptyStateTag() {
        renderDashboard(SellerDashboardUiState(status = SellerDashboardStatus.Empty))

        composeRule.onNodeWithTag("seller-empty").assertIsDisplayed()
    }

    @Test
    fun dashboardRendersPartialErrorStateTag() {
        renderDashboard(
            SellerDashboardUiState(
                status = SellerDashboardStatus.PartialError,
                sectionErrors = listOf(SellerDashboardSectionError("dishes", "unavailable"))
            )
        )

        composeRule.onNodeWithTag("seller-partial-error").assertIsDisplayed()
    }

    @Test
    fun dashboardRendersStaleOfflineStateTag() {
        renderDashboard(
            SellerDashboardUiState(
                status = SellerDashboardStatus.StaleOffline,
                sectionErrors = listOf(SellerDashboardSectionError("orders", "offline"))
            )
        )

        composeRule.onNodeWithTag("seller-stale-offline").assertIsDisplayed()
    }

    private fun renderDashboard(state: SellerDashboardUiState) {
        composeRule.setContent {
            MaterialTheme {
                SellerDashboardContent(
                    navController = rememberNavController(),
                    pendingOrders = state.pendingOrders,
                    todayRevenue = state.todayRevenue,
                    dashboardState = state
                )
            }
        }
    }
}
