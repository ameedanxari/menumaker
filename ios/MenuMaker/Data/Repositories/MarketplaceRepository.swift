import Foundation

/// Marketplace repository
@MainActor
class MarketplaceRepository: ObservableObject {
    static let shared = MarketplaceRepository()

    private let apiClient = APIClient.shared

    @Published var sellers: [MarketplaceSeller] = []

    private init() {}

    // MARK: - Search Operations

    func searchSellers(filters: MarketplaceSearchFilters) async throws -> (sellers: [MarketplaceSeller], total: Int) {
        var endpoint = AppConstants.API.Endpoints.marketplace + "/sellers?"

        let params = filters.queryParameters
        let queryString = params.map { "\($0.key)=\($0.value)" }.joined(separator: "&")
        endpoint += queryString

        let response: MarketplaceResponse = try await apiClient.request(
            endpoint: endpoint,
            method: .get
        )

        sellers = response.data.sellers
        return (response.data.sellers, response.data.total)
    }

    func searchSellersNearMe(
        radius: Double = 10.0,
        cuisine: String? = nil,
        ratingMin: Double? = nil
    ) async throws -> [MarketplaceSeller] {
        let location = try await LocationService.shared.getCurrentLocation()

        let filters = MarketplaceSearchFilters(
            latitude: location.coordinate.latitude,
            longitude: location.coordinate.longitude,
            cuisine: cuisine,
            ratingMin: ratingMin,
            distanceKm: radius
        )

        let (sellers, _) = try await searchSellers(filters: filters)
        return sellers
    }

    func getAllSellers() async throws -> [MarketplaceSeller] {
        let (sellers, _) = try await searchSellers(filters: MarketplaceSearchFilters())
        return sellers
    }

    // MARK: - Seller Details

    func getSellerById(_ sellerId: String) async throws -> Business {
        let response: BusinessResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.marketplace + "/sellers/\(sellerId)",
            method: .get
        )

        return response.data.business
    }

    // MARK: - Filtering

    func filterSellers(
        cuisine: String? = nil,
        minRating: Double? = nil,
        maxDistance: Double? = nil
    ) -> [MarketplaceSeller] {
        var filtered = sellers

        if let cuisine = cuisine {
            filtered = filtered.filter { $0.cuisineType == cuisine }
        }

        if let minRating = minRating {
            filtered = filtered.filter { $0.rating >= minRating }
        }

        if let maxDistance = maxDistance {
            filtered = filtered.filter { ($0.distanceKm ?? Double.infinity) <= maxDistance }
        }

        return filtered
    }

    func getCuisineTypes() -> [String] {
        let cuisines = Set(sellers.compactMap { $0.cuisineType })
        return Array(cuisines).sorted()
    }

    // MARK: - Sorting

    func sortedByDistance() -> [MarketplaceSeller] {
        sellers.sorted { ($0.distanceKm ?? Double.infinity) < ($1.distanceKm ?? Double.infinity) }
    }

    func sortedByRating() -> [MarketplaceSeller] {
        sellers.sorted { $0.rating > $1.rating }
    }

    func sortedByReviews() -> [MarketplaceSeller] {
        sellers.sorted { $0.reviewCount > $1.reviewCount }
    }
}
