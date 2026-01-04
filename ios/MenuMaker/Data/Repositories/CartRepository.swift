import Foundation
import Combine

/// Cart repository
@MainActor
class CartRepository: ObservableObject {
    static let shared = CartRepository()

    @Published var cart: Cart?

    private let userDefaults = UserDefaults.standard
    private let cartKey = "menumaker_cart"
    
    // Use in-memory storage for UI testing
    private var isUITesting: Bool {
        ProcessInfo.processInfo.arguments.contains("UI-Testing") ||
        ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil
    }

    private init() {
        print("DEBUG: CartRepository init. isUITesting: \(isUITesting)")
        loadCart()
    }

    // MARK: - Cart Management

    func loadCart() {
        // In UI testing, cart is only stored in memory
        if isUITesting {
            print("DEBUG: CartRepository loadCart skipped (UI Testing)")
            return
        }
        
        guard let data = userDefaults.data(forKey: cartKey),
              let cart = try? JSONDecoder().decode(Cart.self, from: data) else {
            return
        }

        self.cart = cart
    }

    func saveCart() {
        // In UI testing, cart is only stored in memory (self.cart)
        if isUITesting {
            print("DEBUG: CartRepository saveCart skipped (UI Testing). Current items: \(cart?.items.count ?? 0)")
            return
        }
        
        guard let cart = cart,
              let data = try? JSONEncoder().encode(cart) else {
            return
        }

        userDefaults.set(data, forKey: cartKey)
    }

    func clearCart() {
        print("DEBUG: CartRepository clearCart")
        cart = nil
        
        // Only clear UserDefaults if not in UI testing
        if !isUITesting {
            userDefaults.removeObject(forKey: cartKey)
        }
    }

    // MARK: - Item Management

    func addItem(_ dish: Dish, businessId: String) {
        print("DEBUG: CartRepository addItem called for dish: \(dish.name)")
        
        // Get or create cart
        var currentCart = cart ?? Cart(items: [], businessId: businessId)
        
        // Check if cart belongs to different business
        if currentCart.businessId != businessId {
            currentCart = Cart(items: [], businessId: businessId)
        }
        
        // Add item to cart
        currentCart.addItem(dish)
        
        // Explicitly reassign to trigger @Published
        cart = currentCart
        
        print("DEBUG: CartRepository addItem complete. Cart items: \(cart?.items.count ?? 0)")
        saveCart()
    }

    func removeItem(_ dishId: String) {
        guard var currentCart = cart else { return }
        currentCart.removeItem(dishId)
        cart = currentCart
        saveCart()
    }

    func updateQuantity(_ dishId: String, quantity: Int) {
        guard var currentCart = cart else { return }
        currentCart.updateQuantity(dishId, quantity: quantity)
        cart = currentCart
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
