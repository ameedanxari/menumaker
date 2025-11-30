package com.menumaker.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.menumaker.ui.screens.auth.LoginScreen
import com.menumaker.ui.screens.auth.SignupScreen
import com.menumaker.ui.screens.auth.ForgotPasswordScreen
import com.menumaker.ui.screens.customer.MarketplaceScreen
import com.menumaker.ui.screens.customer.CartScreen
import com.menumaker.ui.screens.customer.MyOrdersScreen
import com.menumaker.viewmodel.AuthViewModel

@Composable
fun NavGraph(
    navController: NavHostController = rememberNavController(),
    authViewModel: AuthViewModel = hiltViewModel()
) {
    val isAuthenticated by authViewModel.isAuthenticated.collectAsState()

    // For Customer app, we might allow browsing without login, but for now let's stick to login first
    // or maybe Marketplace is the start and Login is required for Checkout?
    // Let's assume Login first for parity with Seller app structure for now, 
    // but typically Customer apps allow browsing.
    // Given the current AuthViewModel, let's start with Login if not authenticated.
    
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
        
        composable(Destination.Cart.route) {
            // TODO: Get businessId from cart items or pass via navigation args
            CartScreen(
                businessId = "", // Placeholder - should be from navigation args or cart state
                onNavigateBack = {
                    navController.popBackStack()
                },
                onNavigateToCheckout = {
                    navController.navigate(Destination.Checkout.route)
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
    }
}
