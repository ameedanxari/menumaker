import Foundation
import Combine

/// Seller dashboard view model
@MainActor
class SellerViewModel: ObservableObject {
    @Published var business: Business?
    @Published var todayOrders: [Order] = []
    @Published var todayRevenue: Double = 0.0
    @Published var pendingOrders: Int = 0
    @Published var dishes: [Dish] = []
    @Published var recentReviews: [Review] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let businessRepository = BusinessRepository.shared
    private let orderRepository = OrderRepository.shared
    private let dishRepository = DishRepository.shared
    private let reviewRepository = ReviewRepository.shared
    private let analyticsService = AnalyticsService.shared

    init() {
        Task {
            await loadDashboardData()
        }
    }

    // MARK: - Data Loading

    func loadDashboardData() async {
        isLoading = true
        errorMessage = nil

        do {
            // Load business
            business = try await businessRepository.getCurrentBusiness()

            guard let businessId = business?.id else {
                throw RepositoryError.notFound
            }

            analyticsService.setBusinessId(businessId)

            // Load data in parallel
            async let ordersTask = orderRepository.getOrdersByBusiness(businessId)
            async let dishesTask = dishRepository.getDishesByBusiness(businessId)
            async let reviewsTask = reviewRepository.getReviews(businessId)

            _ = try await ordersTask
            dishes = try await dishesTask
            _ = try await reviewsTask

            // Calculate statistics
            updateStatistics()

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func refreshData() async {
        await loadDashboardData()
    }

    private func updateStatistics() {
        todayOrders = orderRepository.getTodayOrders()
        todayRevenue = orderRepository.getTodayRevenue()
        pendingOrders = orderRepository.getOrdersCount(for: .pending)
        recentReviews = reviewRepository.getRecentReviews(count: 5)
    }

    // MARK: - Business Management

    func updateBusiness(name: String?, description: String?, logoUrl: String?) async {
        guard let businessId = business?.id else { return }

        isLoading = true

        do {
            business = try await businessRepository.updateBusiness(
                businessId,
                name: name,
                description: description,
                logoUrl: logoUrl
            )

            analyticsService.track(.businessUpdated)

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func uploadBusinessLogo(_ image: UIImage) async -> String? {
        do {
            let url = try await ImageService.shared.uploadImage(image, to: "/upload/business-logo")
            return url
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }

    // MARK: - Statistics

    func getFormattedRevenue() -> String {
        String(format: "₹%.2f", todayRevenue)
    }

    func getTotalDishes() -> Int {
        dishes.count
    }

    func getAvailableDishes() -> Int {
        dishes.filter { $0.isAvailable }.count
    }

    func getAverageRating() -> Double {
        reviewRepository.averageRating
    }

    func getFormattedAverageRating() -> String {
        String(format: "%.1f", getAverageRating())
    }

    func getTotalReviews() -> Int {
        reviewRepository.totalReviews
    }

    // MARK: - Quick Actions

    func markOrderAsReady(_ orderId: String) async {
        do {
            _ = try await orderRepository.updateOrderStatus(orderId, status: .ready)
            updateStatistics()

            analyticsService.track(.orderStatusChanged, parameters: [
                "order_id": orderId,
                "new_status": "ready"
            ])

        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func markOrderAsFulfilled(_ orderId: String) async {
        do {
            _ = try await orderRepository.updateOrderStatus(orderId, status: .fulfilled)
            updateStatistics()

            analyticsService.track(.orderCompleted, parameters: ["order_id": orderId])

        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Error Handling

    func clearError() {
        errorMessage = nil
    }
}

import UIKit
