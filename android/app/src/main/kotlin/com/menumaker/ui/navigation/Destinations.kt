package com.menumaker.ui.navigation

sealed class Destination(val route: String) {
    // Auth
    object Login : Destination("login")
    object Signup : Destination("signup")

    // Seller
    object SellerDashboard : Destination("seller/dashboard")
    object SellerOrders : Destination("seller/orders")
    object OrderDetail : Destination("seller/orders/{orderId}") {
        fun createRoute(orderId: String) = "seller/orders/$orderId"
    }
    object MenuEditor : Destination("seller/menu")
    object DishEditor : Destination("seller/dish/{dishId}") {
        fun createRoute(dishId: String) = "seller/dish/$dishId"
    }

    // Customer
    object Marketplace : Destination("marketplace")
    object SellerDetail : Destination("seller/{sellerId}") {
        fun createRoute(sellerId: String) = "seller/$sellerId"
    }
    object Checkout : Destination("checkout")

    // Shared
    object Profile : Destination("profile")
    object Settings : Destination("settings")
}
