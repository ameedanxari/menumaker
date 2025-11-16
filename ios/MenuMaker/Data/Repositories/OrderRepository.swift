import Foundation
import Combine

/// Order repository
@MainActor
class OrderRepository: ObservableObject {
    static let shared = OrderRepository()

    private let apiClient = APIClient.shared

    @Published var orders: [Order] = []
    @Published var currentOrder: Order?

    private init() {}

    // MARK: - Fetch Operations

    func getOrdersByBusiness(_ businessId: String, page: Int? = nil, limit: Int? = nil) async throws -> (orders: [Order], total: Int) {
        var endpoint = AppConstants.API.Endpoints.orders + "?business_id=\(businessId)"

        if let page = page {
            endpoint += "&page=\(page)"
        }

        if let limit = limit {
            endpoint += "&limit=\(limit)"
        }

        let response: OrderListResponse = try await apiClient.request(
            endpoint: endpoint,
            method: .get
        )

        orders = response.data.orders
        return (response.data.orders, response.data.total)
    }

    func getOrderById(_ orderId: String) async throws -> Order {
        let response: OrderResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.order(orderId),
            method: .get
        )

        currentOrder = response.data.order
        return response.data.order
    }

    // MARK: - Create Operations

    func createOrder(
        businessId: String,
        customerName: String,
        customerPhone: String?,
        customerEmail: String?,
        items: [CreateOrderItemRequest]
    ) async throws -> Order {
        let request = CreateOrderRequest(
            businessId: businessId,
            customerName: customerName,
            customerPhone: customerPhone,
            customerEmail: customerEmail,
            items: items
        )

        let response: OrderResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.orders,
            method: .post,
            body: request
        )

        // Update local cache
        orders.insert(response.data.order, at: 0)

        return response.data.order
    }

    // MARK: - Update Operations

    func updateOrderStatus(_ orderId: String, status: OrderStatus) async throws -> Order {
        let request = UpdateOrderStatusRequest(status: status.rawValue)

        let response: OrderResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.order(orderId),
            method: .patch,
            body: request
        )

        // Update local cache
        if let index = orders.firstIndex(where: { $0.id == orderId }) {
            orders[index] = response.data.order
        }

        currentOrder = response.data.order

        return response.data.order
    }

    // MARK: - Delete Operations

    func deleteOrder(_ orderId: String) async throws {
        let _: EmptyResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.order(orderId),
            method: .delete
        )

        // Update local cache
        orders.removeAll { $0.id == orderId }

        if currentOrder?.id == orderId {
            currentOrder = nil
        }
    }

    // MARK: - Filtering

    func filterOrders(status: OrderStatus? = nil, searchQuery: String? = nil) -> [Order] {
        var filtered = orders

        if let status = status {
            filtered = filtered.filter { $0.status == status.rawValue }
        }

        if let searchQuery = searchQuery, !searchQuery.isEmpty {
            filtered = filtered.filter {
                $0.customerName.localizedCaseInsensitiveContains(searchQuery) ||
                $0.id.localizedCaseInsensitiveContains(searchQuery)
            }
        }

        return filtered
    }

    func getOrdersByStatus(_ status: OrderStatus) -> [Order] {
        orders.filter { $0.status == status.rawValue }
    }

    // MARK: - Statistics

    func getTodayOrders() -> [Order] {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())

        return orders.filter { order in
            guard let date = ISO8601DateFormatter().date(from: order.createdAt) else {
                return false
            }
            return calendar.isDate(date, inSameDayAs: today)
        }
    }

    func getTodayRevenue() -> Double {
        let todayOrders = getTodayOrders()
        return todayOrders.reduce(0) { $0 + $1.total }
    }

    func getOrdersCount(for status: OrderStatus) -> Int {
        orders.filter { $0.status == status.rawValue }.count
    }
}
