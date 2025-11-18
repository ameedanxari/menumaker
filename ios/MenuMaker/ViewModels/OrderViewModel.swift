import Foundation
import Combine

/// Order management view model
@MainActor
class OrderViewModel: ObservableObject {
    @Published var orders: [Order] = []
    @Published var filteredOrders: [Order] = []
    @Published var selectedStatus: OrderStatus?
    @Published var searchQuery: String = ""
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let repository = OrderRepository.shared
    private let notificationService = NotificationService.shared
    private let analyticsService = AnalyticsService.shared

    private var cancellables = Set<AnyCancellable>()

    init() {
        setupObservers()
        Task {
            await loadOrders()
        }
    }

    private func setupObservers() {
        // Update filtered orders when search query or status filter changes
        Publishers.CombineLatest($searchQuery, $selectedStatus)
            .debounce(for: .milliseconds(300), scheduler: DispatchQueue.main)
            .sink { [weak self] _, _ in
                self?.filterOrders()
            }
            .store(in: &cancellables)
    }

    // MARK: - Data Loading

    func loadOrders() async {
        guard let businessId = try? await KeychainManager.shared.getBusinessId() else {
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            let (orders, _) = try await repository.getOrdersByBusiness(businessId)
            self.orders = orders
            filterOrders()

            analyticsService.trackScreen("Orders List")

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func fetchOrders() async {
        // For customers, fetch their orders
        isLoading = true
        errorMessage = nil

        do {
            let (orders, _) = try await repository.getCustomerOrders()
            self.orders = orders
            filterOrders()

            analyticsService.trackScreen("My Orders")

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func refreshOrders() async {
        await fetchOrders()
    }

    var activeOrders: [Order] {
        orders.filter { $0.isActive }
    }

    var completedOrders: [Order] {
        orders.filter { !$0.isActive && $0.orderStatus != .cancelled }
    }

    var cancelledOrders: [Order] {
        orders.filter { $0.orderStatus == .cancelled }
    }

    // MARK: - Filtering

    private func filterOrders() {
        filteredOrders = repository.filterOrders(
            status: selectedStatus,
            searchQuery: searchQuery.isEmpty ? nil : searchQuery
        )
    }

    func filterByStatus(_ status: OrderStatus?) {
        selectedStatus = status
    }

    func clearFilters() {
        selectedStatus = nil
        searchQuery = ""
    }

    // MARK: - Order Management

    func updateOrderStatus(_ orderId: String, to status: OrderStatus) async {
        isLoading = true

        do {
            let order = try await repository.updateOrderStatus(orderId, status: status)

            // Send notification
            await notificationService.notifyOrderStatusChange(
                orderId: orderId,
                status: status.rawValue
            )

            // Update local list
            if let index = orders.firstIndex(where: { $0.id == orderId }) {
                orders[index] = order
            }

            filterOrders()

            analyticsService.trackOrderStatusChanged(
                orderId: orderId,
                fromStatus: order.status,
                toStatus: status.rawValue
            )

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func deleteOrder(_ orderId: String) async {
        isLoading = true

        do {
            try await repository.deleteOrder(orderId)

            orders.removeAll { $0.id == orderId }
            filterOrders()

            analyticsService.track(.orderCancelled, parameters: ["order_id": orderId])

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    // MARK: - Statistics

    func getOrdersCount(for status: OrderStatus) -> Int {
        orders.filter { $0.orderStatus == status }.count
    }

    func getTotalRevenue() -> Double {
        orders.reduce(0) { $0 + $1.total }
    }

    func getFormattedTotalRevenue() -> String {
        String(format: "₹%.2f", getTotalRevenue())
    }

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

    // MARK: - Error Handling

    func clearError() {
        errorMessage = nil
    }
}
