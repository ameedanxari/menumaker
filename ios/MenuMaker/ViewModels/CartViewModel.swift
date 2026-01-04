import Foundation
import Combine

/// Cart management view model
@MainActor
class CartViewModel: ObservableObject {
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var appliedCoupon: Coupon?
    @Published var discount: Double = 0.0

    private let cartRepository = CartRepository.shared
    private let couponRepository = CouponRepository.shared
    private let analyticsService = AnalyticsService.shared
    private var cancellables = Set<AnyCancellable>()

    // Observe the repository's cart directly
    var cart: Cart? {
        cartRepository.cart
    }

    init() {
        print("DEBUG: CartViewModel init")
        // Subscribe to cart changes from repository
        cartRepository.$cart
            .sink { [weak self] newCart in
                print("DEBUG: CartViewModel received cart update. Items: \(newCart?.items.count ?? 0)")
                self?.objectWillChange.send()
            }
            .store(in: &cancellables)
    }

    func addItem(_ dish: Dish, businessId: String) {
        cartRepository.addItem(dish, businessId: businessId)

        analyticsService.track(.cartItemAdded, parameters: [
            "dish_id": dish.id,
            "dish_name": dish.name,
            "price": dish.price
        ])
    }

    func removeItem(_ dishId: String) {
        cartRepository.removeItem(dishId)
    }

    func updateQuantity(_ dishId: String, quantity: Int) {
        cartRepository.updateQuantity(dishId, quantity: quantity)
    }

    func incrementQuantity(_ dishId: String) {
        cartRepository.incrementQuantity(dishId)
    }

    func decrementQuantity(_ dishId: String) {
        cartRepository.decrementQuantity(dishId)
    }

    func clearCart() {
        cartRepository.clearCart()
        appliedCoupon = nil
        discount = 0.0
    }

    // MARK: - Coupon Management

    func applyCoupon(_ code: String) async {
        isLoading = true
        errorMessage = nil

        guard let currentCart = cart, !currentCart.items.isEmpty else {
            errorMessage = "Add items to cart before applying a coupon"
            isLoading = false
            return
        }

        do {
            let normalizedCode = code.uppercased()
            let validation = try await couponRepository.validateCoupon(
                code: normalizedCode,
                businessId: currentCart.businessId,
                orderSubtotalCents: currentCart.totalCents,
                dishIds: currentCart.items.map { $0.dishId }
            )

            // Update discount and applied coupon from validated response
            discount = validation.discountAmount
            appliedCoupon = validation.coupon

            analyticsService.track(.couponRedeemed, parameters: [
                "coupon_code": normalizedCode,
                "discount": validation.discountAmount
            ])

        } catch let apiError as APIError {
            appliedCoupon = nil
            discount = 0.0
            errorMessage = apiError.localizedDescription
        } catch {
            appliedCoupon = nil
            discount = 0.0
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func removeCoupon() {
        appliedCoupon = nil
        discount = 0.0
        errorMessage = nil
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
            // Cart is cleared by cartRepository.createOrder() internally
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
