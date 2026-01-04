package com.menumaker.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.menumaker.ui.screens.auth.ForgotPasswordScreen
import com.menumaker.ui.screens.auth.LoginScreen
import com.menumaker.ui.screens.auth.SignupScreen
import com.menumaker.ui.screens.seller.CouponsScreen
import com.menumaker.ui.screens.seller.DashboardScreen
import com.menumaker.ui.screens.seller.MenuEditorScreen
import com.menumaker.ui.screens.seller.OrdersScreen
import com.menumaker.ui.screens.seller.PaymentProcessorsScreen
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
    val currentUser by authViewModel.currentUser.collectAsState()

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
                onNavigateToForgotPassword = {
                    navController.navigate(Destination.ForgotPassword.route)
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

        composable(Destination.ForgotPassword.route) {
            ForgotPasswordScreen(
                onNavigateBack = {
                    navController.popBackStack()
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

        composable(Destination.MenuEditor.route) {
            // Get businessId from current user
            val businessId = currentUser?.id ?: ""
            MenuEditorScreen(
                businessId = businessId,
                onNavigateBack = {
                    navController.popBackStack()
                },
                onNavigateToDishEditor = { dishId ->
                    navController.navigate(Destination.DishEditor.createRoute(dishId))
                },
                onNavigateToNewDish = {
                    navController.navigate(Destination.NewDish.route)
                }
            )
        }

        composable(Destination.Coupons.route) {
            val businessId = currentUser?.id ?: ""
            CouponsScreen(
                businessId = businessId,
                onNavigateBack = {
                    navController.popBackStack()
                }
            )
        }

        composable(Destination.PaymentProcessors.route) {
            val businessId = currentUser?.id ?: ""
            PaymentProcessorsScreen(
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
