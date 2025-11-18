import Foundation
import Combine

/// Favorite view model
@MainActor
class FavoriteViewModel: ObservableObject {
    @Published var favorites: [Favorite] = []
    @Published var filteredFavorites: [Favorite] = []
    @Published var searchQuery: String = ""
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let repository = FavoriteRepository.shared
    private let analyticsService = AnalyticsService.shared

    private var cancellables = Set<AnyCancellable>()

    init() {
        setupObservers()
        Task {
            await loadFavorites()
        }
    }

    private func setupObservers() {
        $searchQuery
            .debounce(for: .milliseconds(300), scheduler: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.filterFavorites()
            }
            .store(in: &cancellables)
    }

    // MARK: - Data Loading

    func loadFavorites() async {
        isLoading = true
        errorMessage = nil

        do {
            favorites = try await repository.getFavorites()
            filterFavorites()

            analyticsService.trackScreen("Favorites")

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func refreshFavorites() async {
        await loadFavorites()
    }

    // MARK: - Filtering

    private func filterFavorites() {
        if searchQuery.isEmpty {
            filteredFavorites = favorites
        } else {
            filteredFavorites = favorites.filter {
                $0.business?.name.localizedCaseInsensitiveContains(searchQuery) ?? false ||
                $0.business?.description?.localizedCaseInsensitiveContains(searchQuery) ?? false
            }
        }
    }

    // MARK: - Favorite Management

    func addFavorite(businessId: String) async {
        isLoading = true

        do {
            _ = try await repository.addFavorite(businessId: businessId)

            // Reload to get updated list with business details
            await loadFavorites()

            analyticsService.track(.favoriteSaved, parameters: ["business_id": businessId])

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func removeFavorite(_ favoriteId: String) async {
        isLoading = true

        do {
            try await repository.removeFavorite(favoriteId: favoriteId)

            // Update local list
            favorites.removeAll { $0.id == favoriteId }
            filterFavorites()

            analyticsService.track(.favoriteRemoved, parameters: ["favorite_id": favoriteId])

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func removeFavoriteByBusinessId(_ businessId: String) async {
        isLoading = true

        do {
            try await repository.removeFavoriteByBusinessId(businessId: businessId)

            // Update local list
            favorites.removeAll { $0.businessId == businessId }
            filterFavorites()

            analyticsService.track(.favoriteRemoved, parameters: ["business_id": businessId])

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func isFavorite(businessId: String) -> Bool {
        repository.isFavorite(businessId: businessId)
    }

    // MARK: - Error Handling

    func clearError() {
        errorMessage = nil
    }
}
