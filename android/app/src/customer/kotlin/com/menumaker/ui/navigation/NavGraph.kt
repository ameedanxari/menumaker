package com.menumaker.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.menumaker.ui.screens.auth.LoginScreen
import com.menumaker.ui.screens.auth.SignupScreen
import com.menumaker.ui.screens.auth.ForgotPasswordScreen
import com.menumaker.ui.screens.customer.CartScreen
import com.menumaker.ui.screens.customer.FavoritesScreen
import com.menumaker.ui.screens.customer.MarketplaceScreen
import com.menumaker.ui.screens.customer.MyOrdersScreen
import com.menumaker.ui.screens.customer.OrderTrackingScreen
import com.menumaker.ui.screens.customer.PaymentScreen
import com.menumaker.ui.screens.customer.ReviewsScreen
import com.menumaker.ui.screens.customer.SellerMenuScreen
import com.menumaker.ui.screens.NotificationsScreen
import com.menumaker.ui.screens.ProfileScreen
import com.menumaker.ui.screens.ReferralsScreen
import com.menumaker.ui.screens.SettingsScreen
import com.menumaker.viewmodel.AuthViewModel

@Composable
fun NavGraph(
    navController: NavHostController = rememberNavController(),
    authViewModel: AuthViewModel = hiltViewModel()
) {
    val isAuthenticated by authViewModel.isAuthenticated.collectAsState()

    val startDestination = if (isAuthenticated) {
        Destination.Marketplace.route
    } else {
        Destination.Login.route
    }

    NavHost(
        navController = navController,
        startDestination = startDestination
    ) {
        // Auth routes
        composable(Destination.Login.route) {
            LoginScreen(
                onNavigateToSignup = {
                    navController.navigate(Destination.Signup.route)
                },
                onNavigateToForgotPassword = {
                    navController.navigate(Destination.ForgotPassword.route)
                },
                onNavigateToDashboard = {
                    navController.navigate(Destination.Marketplace.route) {
                        popUpTo(Destination.Login.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Destination.Signup.route) {
            SignupScreen(
                onNavigateToLogin = {
                    navController.popBackStack()
                },
                onNavigateToDashboard = {
                    navController.navigate(Destination.Marketplace.route) {
                        popUpTo(Destination.Signup.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Destination.ForgotPassword.route) {
            ForgotPasswordScreen(
                onNavigateBack = {
                    navController.popBackStack()
                }
            )
        }

        // Customer routes
        composable(Destination.Marketplace.route) {
            MarketplaceScreen(
                onNavigateToSeller = { sellerId ->
                    navController.navigate(Destination.SellerMenu.createRoute(sellerId))
                }
            )
        }

        composable(
            route = Destination.SellerMenu.route,
            arguments = listOf(navArgument("sellerId") { type = NavType.StringType })
        ) { backStackEntry ->
            val sellerId = backStackEntry.arguments?.getString("sellerId") ?: ""
            SellerMenuScreen(
                businessId = sellerId,
                onNavigateBack = {
                    navController.popBackStack()
                }
            )
        }
        
        composable(Destination.Cart.route) {
            CartScreen(
                businessId = "", // Will be retrieved from cart state
                onNavigateBack = {
                    navController.popBackStack()
                },
                onNavigateToCheckout = {
                    // Navigate to payment with a default total - actual total comes from cart
                    navController.navigate(Destination.Payment.createRoute(0.0))
                }
            )
        }

        composable(
            route = Destination.Payment.route,
            arguments = listOf(navArgument("total") { type = NavType.StringType })
        ) { backStackEntry ->
            val totalStr = backStackEntry.arguments?.getString("total") ?: "0.0"
            val total = totalStr.toDoubleOrNull() ?: 0.0
            PaymentScreen(
                orderTotal = total,
                onNavigateBack = {
                    navController.popBackStack()
                },
                onPaymentSuccess = { orderId ->
                    navController.navigate(Destination.OrderTracking.createRoute(orderId)) {
                        popUpTo(Destination.Marketplace.route)
                    }
                }
            )
        }

        composable(Destination.MyOrders.route) {
            MyOrdersScreen(
                onNavigateBack = {
                    navController.popBackStack()
                },
                onNavigateToOrderDetail = { orderId ->
                    navController.navigate(Destination.OrderTracking.createRoute(orderId))
                }
            )
        }

        composable(
            route = Destination.OrderTracking.route,
            arguments = listOf(navArgument("orderId") { type = NavType.StringType })
        ) { backStackEntry ->
            val orderId = backStackEntry.arguments?.getString("orderId") ?: ""
            OrderTrackingScreen(
                orderId = orderId,
                onNavigateBack = {
                    navController.popBackStack()
                }
            )
        }

        composable(Destination.Favorites.route) {
            FavoritesScreen(
                onNavigateBack = {
                    navController.popBackStack()
                },
                onNavigateToSellerMenu = { sellerId ->
                    navController.navigate(Destination.SellerMenu.createRoute(sellerId))
                },
                onNavigateToMarketplace = {
                    navController.navigate(Destination.Marketplace.route)
                }
            )
        }

        composable(
            route = Destination.CustomerReviews.route,
            arguments = listOf(navArgument("businessId") { type = NavType.StringType })
        ) { backStackEntry ->
            val businessId = backStackEntry.arguments?.getString("businessId") ?: ""
            ReviewsScreen(
                businessId = businessId,
                onNavigateBack = {
                    navController.popBackStack()
                }
            )
        }

        // Shared routes
        composable(Destination.Profile.route) {
            ProfileScreen(
                onNavigateBack = {
                    navController.popBackStack()
                },
                onNavigateToOrders = {
                    navController.navigate(Destination.MyOrders.route)
                },
                onNavigateToFavorites = {
                    navController.navigate(Destination.Favorites.route)
                },
                onNavigateToSettings = {
                    navController.navigate(Destination.Settings.route)
                },
                onNavigateToReferrals = {
                    navController.navigate(Destination.Referrals.route)
                }
            )
        }

        composable(Destination.Settings.route) {
            SettingsScreen(
                authViewModel = authViewModel,
                onNavigateBack = {
                    navController.popBackStack()
                }
            )
        }

        composable(Destination.Notifications.route) {
            NotificationsScreen(
                onNavigateBack = {
                    navController.popBackStack()
                }
            )
        }

        composable(Destination.Referrals.route) {
            ReferralsScreen(
                onNavigateBack = {
                    navController.popBackStack()
                }
            )
        }
    }
}
