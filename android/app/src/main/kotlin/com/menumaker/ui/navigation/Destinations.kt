package com.menumaker.ui.navigation

sealed class Destination(val route: String) {
    // Auth
    object Login : Destination("login")
    object Signup : Destination("signup")
    object ForgotPassword : Destination("forgot-password")

    // Seller - Core
    object SellerDashboard : Destination("seller/dashboard")
    object SellerOrders : Destination("seller/orders")
    object OrderDetail : Destination("seller/orders/{orderId}") {
        fun createRoute(orderId: String) = "seller/orders/$orderId"
    }
    object MenuEditor : Destination("seller/menu")
    object DishEditor : Destination("seller/dish/{dishId}") {
        fun createRoute(dishId: String) = "seller/dish/$dishId"
    }
    object NewDish : Destination("seller/dish/new")

    // Seller - Phase 3
    object Coupons : Destination("seller/coupons")
    object PaymentProcessors : Destination("seller/payments")
    object Payouts : Destination("seller/payouts")
    object Integrations : Destination("seller/integrations")
    object Reviews : Destination("seller/reviews")

    // Customer
    object Marketplace : Destination("marketplace")
    object SellerDetail : Destination("seller/{sellerId}") {
        fun createRoute(sellerId: String) = "seller/$sellerId"
    }
    object SellerMenu : Destination("seller/{sellerId}/menu") {
        fun createRoute(sellerId: String) = "seller/$sellerId/menu"
    }
    object Cart : Destination("cart")
    object Checkout : Destination("checkout")
    object Payment : Destination("payment/{total}") {
        fun createRoute(total: Double) = "payment/$total"
    }
    object MyOrders : Destination("my-orders")
    object OrderTracking : Destination("order/{orderId}/track") {
        fun createRoute(orderId: String) = "order/$orderId/track"
    }

    // Shared
    object Profile : Destination("profile")
    object Settings : Destination("settings")
    object Referrals : Destination("referrals")
}
