import Foundation

/// Cart repository
@MainActor
class CartRepository: ObservableObject {
    static let shared = CartRepository()

    @Published var cart: Cart?

    private let userDefaults = UserDefaults.standard
    private let cartKey = "menumaker_cart"

    private init() {
        loadCart()
    }

    // MARK: - Cart Management

    func loadCart() {
        guard let data = userDefaults.data(forKey: cartKey),
              let cart = try? JSONDecoder().decode(Cart.self, from: data) else {
            return
        }

        self.cart = cart
    }

    func saveCart() {
        guard let cart = cart,
              let data = try? JSONEncoder().encode(cart) else {
            return
        }

        userDefaults.set(data, forKey: cartKey)
    }

    func clearCart() {
        cart = nil
        userDefaults.removeObject(forKey: cartKey)
    }

    // MARK: - Item Management

    func addItem(_ dish: Dish, businessId: String) {
        if cart == nil {
            cart = Cart(items: [], businessId: businessId)
        }

        // Check if cart belongs to different business
        if let existingCart = cart, existingCart.businessId != businessId {
            // Clear cart and create new one
            cart = Cart(items: [], businessId: businessId)
        }

        cart?.addItem(dish)
        saveCart()
    }

    func removeItem(_ dishId: String) {
        cart?.removeItem(dishId)
        saveCart()
    }

    func updateQuantity(_ dishId: String, quantity: Int) {
        cart?.updateQuantity(dishId, quantity: quantity)
        saveCart()
    }

    func incrementQuantity(_ dishId: String) {
        guard let item = cart?.items.first(where: { $0.dishId == dishId }) else {
            return
        }

        updateQuantity(dishId, quantity: item.quantity + 1)
    }

    func decrementQuantity(_ dishId: String) {
        guard let item = cart?.items.first(where: { $0.dishId == dishId }) else {
            return
        }

        let newQuantity = item.quantity - 1

        if newQuantity <= 0 {
            removeItem(dishId)
        } else {
            updateQuantity(dishId, quantity: newQuantity)
        }
    }

    // MARK: - Cart Information

    func getItemCount() -> Int {
        cart?.itemsCount ?? 0
    }

    func getTotal() -> Double {
        cart?.total ?? 0
    }

    func getFormattedTotal() -> String {
        cart?.formattedTotal ?? "₹0.00"
    }

    func isEmpty() -> Bool {
        cart?.isEmpty ?? true
    }

    func contains(_ dishId: String) -> Bool {
        cart?.items.contains { $0.dishId == dishId } ?? false
    }

    func getQuantity(_ dishId: String) -> Int {
        cart?.items.first { $0.dishId == dishId }?.quantity ?? 0
    }

    // MARK: - Checkout

    func createOrder(
        customerName: String,
        customerPhone: String?,
        customerEmail: String?
    ) async throws -> Order {
        guard let cart = cart else {
            throw CartError.emptyCart
        }

        let orderItems = cart.items.map { item in
            CreateOrderItemRequest(
                dishId: item.dishId,
                quantity: item.quantity
            )
        }

        let order = try await OrderRepository.shared.createOrder(
            businessId: cart.businessId,
            customerName: customerName,
            customerPhone: customerPhone,
            customerEmail: customerEmail,
            items: orderItems
        )

        // Clear cart after successful order
        clearCart()

        return order
    }

    // MARK: - Validation

    func validateCart() throws {
        guard let cart = cart, !cart.isEmpty else {
            throw CartError.emptyCart
        }

        if cart.total < 0 {
            throw CartError.invalidTotal
        }
    }
}

// MARK: - Cart Error

enum CartError: Error, LocalizedError {
    case emptyCart
    case invalidTotal
    case differentBusiness

    var errorDescription: String? {
        switch self {
        case .emptyCart:
            return "Cart is empty"
        case .invalidTotal:
            return "Invalid cart total"
        case .differentBusiness:
            return "Cannot add items from different businesses"
        }
    }
}
