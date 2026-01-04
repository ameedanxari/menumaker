package com.menumaker.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.menumaker.ui.screens.NotificationsScreen
import com.menumaker.ui.screens.ProfileScreen
import com.menumaker.ui.screens.ReferralsScreen
import com.menumaker.ui.screens.SettingsScreen
import com.menumaker.ui.screens.auth.ForgotPasswordScreen
import com.menumaker.ui.screens.auth.LoginScreen
import com.menumaker.ui.screens.auth.SignupScreen
import com.menumaker.ui.screens.customer.CartScreen
import com.menumaker.ui.screens.customer.CheckoutScreen
import com.menumaker.ui.screens.customer.CustomerReviewsScreen
import com.menumaker.ui.screens.customer.FavoritesScreen
import com.menumaker.ui.screens.customer.MarketplaceScreen
import com.menumaker.ui.screens.customer.MyOrdersScreen
import com.menumaker.ui.screens.customer.OrderTrackingScreen
import com.menumaker.ui.screens.customer.PaymentScreen
import com.menumaker.ui.screens.customer.SellerMenuScreen
import com.menumaker.ui.screens.seller.CouponsScreen
import com.menumaker.ui.screens.seller.DishEditorScreen
import com.menumaker.ui.screens.seller.IntegrationsScreen
import com.menumaker.ui.screens.seller.MenuEditorScreen
import com.menumaker.ui.screens.seller.OrderDetailScreen
import com.menumaker.ui.screens.seller.PaymentProcessorsScreen
import com.menumaker.ui.screens.seller.PayoutsScreen
import com.menumaker.ui.screens.seller.SellerDashboardScreen
import com.menumaker.ui.screens.seller.SellerOrdersScreen
import com.menumaker.ui.screens.seller.SellerReviewsScreen
import com.menumaker.viewmodel.CartViewModel
import com.menumaker.viewmodel.CustomerPaymentViewModel
import com.menumaker.viewmodel.DishViewModel
import com.menumaker.viewmodel.MarketplaceViewModel
import com.menumaker.viewmodel.OrderViewModel
import com.menumaker.viewmodel.SellerViewModel

@Composable
fun NavGraph(
    modifier: Modifier = Modifier
) {
    val navController = rememberNavController()

    NavHost(
        navController = navController,
        startDestination = Destination.Login.route,
        modifier = modifier
    ) {
        composable(Destination.Login.route) {
            LoginScreen(
                onNavigateToSignup = { navController.navigate(Destination.Signup.route) },
                onNavigateToForgotPassword = { navController.navigate(Destination.ForgotPassword.route) },
                onNavigateToDashboard = {
                    navController.navigate(Destination.SellerDashboard.route) {
                        popUpTo(Destination.Login.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Destination.Signup.route) {
            SignupScreen(
                onNavigateToLogin = { navController.popBackStack() },
                onNavigateToDashboard = {
                    navController.navigate(Destination.SellerDashboard.route) {
                        popUpTo(Destination.Login.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Destination.ForgotPassword.route) {
            ForgotPasswordScreen(onNavigateBack = { navController.popBackStack() })
        }

        // Seller
        composable(Destination.SellerDashboard.route) {
            val sellerViewModel: SellerViewModel = hiltViewModel()
            SellerDashboardScreen(
                navController = navController,
                viewModel = sellerViewModel
            )
        }

        composable(Destination.SellerOrders.route) {
            val sellerViewModel: SellerViewModel = hiltViewModel()
            SellerOrdersScreen(
                navController = navController,
                viewModel = sellerViewModel
            )
        }

        composable(
            route = Destination.OrderDetail.route,
            arguments = listOf(navArgument("orderId") { type = NavType.StringType })
        ) { backStackEntry ->
            val orderId = backStackEntry.arguments?.getString("orderId").orEmpty()
            OrderDetailScreen(
                orderId = orderId,
                navController = navController
            )
        }

        composable(Destination.MenuEditor.route) {
            val sellerViewModel: SellerViewModel = hiltViewModel()
            MenuEditorScreen(
                navController = navController,
                viewModel = sellerViewModel
            )
        }

        composable(
            route = Destination.DishEditor.route,
            arguments = listOf(navArgument("dishId") { type = NavType.StringType })
        ) { backStackEntry ->
            val dishId = backStackEntry.arguments?.getString("dishId").orEmpty()
            DishEditorScreen(
                dishId = dishId,
                navController = navController
            )
        }

        composable(Destination.NewDish.route) {
            DishEditorScreen(
                dishId = null,
                navController = navController
            )
        }

        composable(Destination.Coupons.route) {
            CouponsScreen(navController = navController)
        }

        composable(Destination.PaymentProcessors.route) {
            PaymentProcessorsScreen(navController = navController)
        }

        composable(Destination.Payouts.route) {
            PayoutsScreen(navController = navController)
        }

        composable(Destination.Integrations.route) {
            IntegrationsScreen(navController = navController)
        }

        composable(Destination.Reviews.route) {
            SellerReviewsScreen(navController = navController)
        }

        // Customer
        composable(Destination.Marketplace.route) {
            val marketplaceViewModel: MarketplaceViewModel = hiltViewModel()
            MarketplaceScreen(
                navController = navController,
                viewModel = marketplaceViewModel
            )
        }

        composable(
            route = Destination.SellerMenu.route,
            arguments = listOf(navArgument("sellerId") { type = NavType.StringType })
        ) { backStackEntry ->
            val sellerId = backStackEntry.arguments?.getString("sellerId").orEmpty()
            val dishViewModel: DishViewModel = hiltViewModel()
            SellerMenuScreen(
                navController = navController,
                sellerId = sellerId,
                viewModel = dishViewModel
            )
        }

        composable(Destination.Cart.route) {
            val cartViewModel: CartViewModel = hiltViewModel()
            CartScreen(
                navController = navController,
                viewModel = cartViewModel
            )
        }

        composable(Destination.Checkout.route) {
            CheckoutScreen(navController = navController)
        }

        composable(
            route = Destination.Payment.route,
            arguments = listOf(navArgument("total") { type = NavType.StringType })
        ) { backStackEntry ->
            val total = backStackEntry.arguments?.getString("total")?.toDoubleOrNull() ?: 0.0
            val paymentViewModel: CustomerPaymentViewModel = hiltViewModel()
            PaymentScreen(
                navController = navController,
                total = total,
                viewModel = paymentViewModel
            )
        }

        composable(Destination.MyOrders.route) {
            val orderViewModel: OrderViewModel = hiltViewModel()
            MyOrdersScreen(
                navController = navController,
                viewModel = orderViewModel
            )
        }

        composable(
            route = Destination.OrderTracking.route,
            arguments = listOf(navArgument("orderId") { type = NavType.StringType })
        ) { backStackEntry ->
            val orderId = backStackEntry.arguments?.getString("orderId").orEmpty()
            OrderTrackingScreen(
                navController = navController,
                orderId = orderId
            )
        }

        // Shared / Engagement
        composable(Destination.Profile.route) {
            ProfileScreen(onNavigateBack = { navController.popBackStack() })
        }

        composable(Destination.Settings.route) {
            SettingsScreen(onNavigateBack = { navController.popBackStack() })
        }

        composable(Destination.Referrals.route) {
            ReferralsScreen(onNavigateBack = { navController.popBackStack() })
        }

        composable(Destination.Favorites.route) {
            FavoritesScreen(navController = navController)
        }

        composable(Destination.Notifications.route) {
            NotificationsScreen(onNavigateBack = { navController.popBackStack() })
        }

        composable(
            route = Destination.CustomerReviews.route,
            arguments = listOf(
                navArgument("businessId") { type = NavType.StringType },
                navArgument("orderId") {
                    type = NavType.StringType
                    defaultValue = ""
                    nullable = true
                }
            )
        ) { backStackEntry ->
            val businessId = backStackEntry.arguments?.getString("businessId").orEmpty()
            val orderId = backStackEntry.arguments?.getString("orderId")?.takeIf { it.isNotBlank() }
            CustomerReviewsScreen(
                navController = navController,
                businessId = businessId,
                orderId = orderId
            )
        }
    }
}
