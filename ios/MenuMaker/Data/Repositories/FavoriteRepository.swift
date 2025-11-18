import Foundation
import Combine

/// Favorite repository
@MainActor
class FavoriteRepository: ObservableObject {
    static let shared = FavoriteRepository()

    private let apiClient = APIClient.shared

    @Published var favorites: [Favorite] = []

    private init() {}

    // MARK: - Fetch Operations

    func getFavorites() async throws -> [Favorite] {
        let response: FavoriteListResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.favorites,
            method: .get
        )

        favorites = response.data.favorites
        return response.data.favorites
    }

    // MARK: - Create Operations

    func addFavorite(businessId: String) async throws -> Favorite {
        let request = AddFavoriteRequest(businessId: businessId)

        let response: FavoriteResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.favorites,
            method: .post,
            body: request
        )

        // Update local cache
        favorites.append(response.data.favorite)

        return response.data.favorite
    }

    // MARK: - Delete Operations

    func removeFavorite(favoriteId: String) async throws {
        let _: EmptyResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.favorite(favoriteId),
            method: .delete
        )

        // Update local cache
        favorites.removeAll { $0.id == favoriteId }
    }

    func removeFavoriteByBusinessId(businessId: String) async throws {
        let _: EmptyResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.favoriteBusiness(businessId),
            method: .delete
        )

        // Update local cache
        favorites.removeAll { $0.businessId == businessId }
    }

    // MARK: - Helpers

    func isFavorite(businessId: String) -> Bool {
        favorites.contains { $0.businessId == businessId }
    }

    func getFavorite(forBusinessId businessId: String) -> Favorite? {
        favorites.first { $0.businessId == businessId }
    }
}
