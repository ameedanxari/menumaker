import Foundation
import Combine

/// Cart management view model
@MainActor
class CartViewModel: ObservableObject {
    @Published var cart: Cart?
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var appliedCoupon: Coupon?
    @Published var discount: Double = 0.0

    private let cartRepository = CartRepository.shared
    private let couponRepository = CouponRepository.shared
    private let analyticsService = AnalyticsService.shared

    init() {
        loadCart()
    }

    // MARK: - Cart Management

    func loadCart() {
        cartRepository.loadCart()
        cart = cartRepository.cart
    }

    func addItem(_ dish: Dish, businessId: String) {
        cartRepository.addItem(dish, businessId: businessId)
        cart = cartRepository.cart

        analyticsService.track(.cartItemAdded, parameters: [
            "dish_id": dish.id,
            "dish_name": dish.name,
            "price": dish.price
        ])
    }

    func removeItem(_ dishId: String) {
        cartRepository.removeItem(dishId)
        cart = cartRepository.cart
    }

    func updateQuantity(_ dishId: String, quantity: Int) {
        cartRepository.updateQuantity(dishId, quantity: quantity)
        cart = cartRepository.cart
    }

    func incrementQuantity(_ dishId: String) {
        cartRepository.incrementQuantity(dishId)
        cart = cartRepository.cart
    }

    func decrementQuantity(_ dishId: String) {
        cartRepository.decrementQuantity(dishId)
        cart = cartRepository.cart
    }

    func clearCart() {
        cartRepository.clearCart()
        cart = nil
        appliedCoupon = nil
        discount = 0.0
    }

    // MARK: - Coupon Management

    func applyCoupon(_ code: String) async {
        isLoading = true
        errorMessage = nil

        do {
            let coupon = try await couponRepository.validateCoupon(code)

            guard coupon.isActive && !coupon.isExpired else {
                errorMessage = "Coupon is not valid or has expired"
                isLoading = false
                return
            }

            let subtotal = getSubtotal()
            discount = couponRepository.calculateDiscount(coupon: coupon, orderValue: subtotal)

            if discount > 0 {
                appliedCoupon = coupon

                analyticsService.track(.couponRedeemed, parameters: [
                    "coupon_code": code,
                    "discount": discount
                ])
            } else {
                errorMessage = "Coupon cannot be applied to this order"
            }

        } catch {
            errorMessage = "Invalid coupon code"
        }

        isLoading = false
    }

    func removeCoupon() {
        appliedCoupon = nil
        discount = 0.0
    }

    // MARK: - Checkout

    func checkout(
        customerName: String,
        customerPhone: String?,
        customerEmail: String?
    ) async -> Order? {
        guard !isEmpty() else {
            errorMessage = "Cart is empty"
            return nil
        }

        isLoading = true
        errorMessage = nil

        do {
            let order = try await cartRepository.createOrder(
                customerName: customerName,
                customerPhone: customerPhone,
                customerEmail: customerEmail
            )

            // Clear cart and coupon after successful checkout
            cart = nil
            appliedCoupon = nil
            discount = 0.0

            analyticsService.track(.checkoutStarted, parameters: [
                "order_id": order.id,
                "total": order.total,
                "items_count": order.itemsCount
            ])

            isLoading = false
            return order

        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
            return nil
        }
    }

    // MARK: - Cart Information

    func getItemCount() -> Int {
        cartRepository.getItemCount()
    }

    func getSubtotal() -> Double {
        cartRepository.getTotal()
    }

    func getFormattedSubtotal() -> String {
        String(format: "₹%.2f", getSubtotal())
    }

    func getTotal() -> Double {
        max(0, getSubtotal() - discount)
    }

    func getFormattedTotal() -> String {
        String(format: "₹%.2f", getTotal())
    }

    func getFormattedDiscount() -> String {
        String(format: "₹%.2f", discount)
    }

    func isEmpty() -> Bool {
        cartRepository.isEmpty()
    }

    func contains(_ dishId: String) -> Bool {
        cartRepository.contains(dishId)
    }

    func getQuantity(_ dishId: String) -> Int {
        cartRepository.getQuantity(dishId)
    }

    // MARK: - Error Handling

    func clearError() {
        errorMessage = nil
    }
}
