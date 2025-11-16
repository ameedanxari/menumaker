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
import com.menumaker.ui.screens.seller.DashboardScreen
import com.menumaker.ui.screens.seller.OrdersScreen
import com.menumaker.viewmodel.AuthViewModel

@Composable
fun NavGraph(
    navController: NavHostController = rememberNavController(),
    authViewModel: AuthViewModel = hiltViewModel()
) {
    val isAuthenticated by authViewModel.isAuthenticated.collectAsState()

    val startDestination = if (isAuthenticated) {
        Destination.SellerDashboard.route
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
                onNavigateToDashboard = {
                    navController.navigate(Destination.SellerDashboard.route) {
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
                    navController.navigate(Destination.SellerDashboard.route) {
                        popUpTo(Destination.Signup.route) { inclusive = true }
                    }
                }
            )
        }

        // Seller routes
        composable(Destination.SellerDashboard.route) {
            DashboardScreen(
                onNavigateToOrders = {
                    navController.navigate(Destination.SellerOrders.route)
                },
                onNavigateToMenu = {
                    navController.navigate(Destination.MenuEditor.route)
                }
            )
        }

        composable(Destination.SellerOrders.route) {
            OrdersScreen(
                onNavigateBack = {
                    navController.popBackStack()
                },
                onNavigateToOrderDetail = { orderId ->
                    navController.navigate(Destination.OrderDetail.createRoute(orderId))
                }
            )
        }
    }
}
