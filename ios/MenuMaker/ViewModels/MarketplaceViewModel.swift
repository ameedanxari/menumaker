import Foundation
import Combine

/// Marketplace view model
@MainActor
class MarketplaceViewModel: ObservableObject {
    @Published var sellers: [MarketplaceSeller] = []
    @Published var filteredSellers: [MarketplaceSeller] = []
    @Published var selectedCuisine: String?
    @Published var minRating: Double?
    @Published var maxDistance: Double?
    @Published var searchQuery: String = ""
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let repository = MarketplaceRepository.shared
    private let locationService = LocationService.shared
    private let analyticsService = AnalyticsService.shared

    private var cancellables = Set<AnyCancellable>()

    init() {
        setupObservers()
        Task {
            await loadSellers()
        }
    }

    private func setupObservers() {
        Publishers.CombineLatest3($searchQuery, $selectedCuisine, $minRating)
            .debounce(for: .milliseconds(300), scheduler: DispatchQueue.main)
            .sink { [weak self] _, _, _ in
                self?.filterSellers()
            }
            .store(in: &cancellables)
    }

    // MARK: - Data Loading

    func loadSellers() async {
        isLoading = true
        errorMessage = nil

        do {
            sellers = try await repository.getAllSellers()
            filterSellers()

            analyticsService.trackScreen("Marketplace")

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func loadNearBySellers(radius: Double = 10.0) async {
        isLoading = true
        errorMessage = nil

        do {
            sellers = try await repository.searchSellersNearMe(
                radius: radius,
                cuisine: selectedCuisine,
                ratingMin: minRating
            )
            filterSellers()

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func refreshSellers() async {
        await loadSellers()
    }

    // MARK: - Filtering

    private func filterSellers() {
        filteredSellers = repository.filterSellers(
            cuisine: selectedCuisine,
            minRating: minRating,
            maxDistance: maxDistance
        )

        // Apply search query
        if !searchQuery.isEmpty {
            filteredSellers = filteredSellers.filter {
                $0.name.localizedCaseInsensitiveContains(searchQuery) ||
                ($0.description?.localizedCaseInsensitiveContains(searchQuery) ?? false)
            }
        }
    }

    func filterByCuisine(_ cuisine: String?) {
        selectedCuisine = cuisine
    }

    func filterByRating(_ rating: Double?) {
        minRating = rating
    }

    func filterByDistance(_ distance: Double?) {
        maxDistance = distance
    }

    func clearFilters() {
        selectedCuisine = nil
        minRating = nil
        maxDistance = nil
        searchQuery = ""
    }

    // MARK: - Sorting

    func sortByDistance() {
        filteredSellers = repository.sortedByDistance()
    }

    func sortByRating() {
        filteredSellers = repository.sortedByRating()
    }

    func sortByReviews() {
        filteredSellers = repository.sortedByReviews()
    }

    // MARK: - Seller Details

    func getSellerDetails(_ sellerId: String) async -> Business? {
        do {
            return try await repository.getSellerById(sellerId)
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }

    // MARK: - Helper Methods

    func getCuisineTypes() -> [String] {
        repository.getCuisineTypes()
    }

    // MARK: - Location

    func requestLocationPermission() {
        locationService.requestAuthorization()
    }

    func getCurrentLocation() async -> (latitude: Double, longitude: Double)? {
        locationService.getCoordinates()
    }

    // MARK: - Error Handling

    func clearError() {
        errorMessage = nil
    }
}
