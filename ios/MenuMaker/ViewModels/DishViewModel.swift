import Foundation
import Combine
import UIKit

/// Dish management view model
@MainActor
class DishViewModel: ObservableObject {
    @Published var dishes: [Dish] = []
    @Published var filteredDishes: [Dish] = []
    @Published var categories: [String] = []
    @Published var selectedCategory: String?
    @Published var searchQuery: String = ""
    @Published var showAvailableOnly: Bool = false
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let repository = DishRepository.shared
    private let analyticsService = AnalyticsService.shared

    private var cancellables = Set<AnyCancellable>()

    init() {
        setupObservers()
        Task {
            await loadDishes()
        }
    }

    private func setupObservers() {
        Publishers.CombineLatest3($searchQuery, $selectedCategory, $showAvailableOnly)
            .debounce(for: .milliseconds(300), scheduler: DispatchQueue.main)
            .sink { [weak self] _, _, _ in
                self?.filterDishes()
            }
            .store(in: &cancellables)
    }

    // MARK: - Data Loading

    func loadDishes() async {
        guard let businessId = try? await KeychainManager.shared.getBusinessId() else {
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            dishes = try await repository.getDishesByBusiness(businessId)
            categories = repository.getCategories()
            filterDishes()

            analyticsService.trackScreen("Menu Editor")

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func refreshDishes() async {
        await loadDishes()
    }

    // MARK: - Filtering

    private func filterDishes() {
        filteredDishes = repository.filterDishes(
            category: selectedCategory,
            isAvailable: showAvailableOnly ? true : nil,
            searchQuery: searchQuery.isEmpty ? nil : searchQuery
        )
    }

    func filterByCategory(_ category: String?) {
        selectedCategory = category
    }

    func clearFilters() {
        selectedCategory = nil
        searchQuery = ""
        showAvailableOnly = false
    }

    // MARK: - Dish Management

    func createDish(
        name: String,
        description: String?,
        price: Double,
        category: String?,
        isVegetarian: Bool,
        isAvailable: Bool,
        image: UIImage?
    ) async {
        guard let businessId = try? await KeychainManager.shared.getBusinessId() else {
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            // Upload image if provided
            var imageUrl: String?
            if let image = image {
                imageUrl = try await repository.uploadDishImage(image)
            }

            let priceCents = Int(price * 100)

            let dish = try await repository.createDish(
                businessId: businessId,
                name: name,
                description: description,
                priceCents: priceCents,
                imageUrl: imageUrl,
                category: category,
                isVegetarian: isVegetarian,
                isAvailable: isAvailable
            )

            dishes.append(dish)
            categories = repository.getCategories()
            filterDishes()

            analyticsService.track(.dishCreated, parameters: [
                "dish_id": dish.id,
                "name": name,
                "price": price
            ])

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func updateDish(
        _ dishId: String,
        name: String?,
        description: String?,
        price: Double?,
        category: String?,
        isVegetarian: Bool?,
        isAvailable: Bool?,
        image: UIImage?
    ) async {
        isLoading = true
        errorMessage = nil

        do {
            // Upload new image if provided
            var imageUrl: String?
            if let image = image {
                imageUrl = try await repository.uploadDishImage(image)
            }

            let priceCents = price.map { Int($0 * 100) }

            let dish = try await repository.updateDish(
                dishId,
                name: name,
                description: description,
                priceCents: priceCents,
                imageUrl: imageUrl,
                category: category,
                isVegetarian: isVegetarian,
                isAvailable: isAvailable
            )

            if let index = dishes.firstIndex(where: { $0.id == dishId }) {
                dishes[index] = dish
            }

            categories = repository.getCategories()
            filterDishes()

            analyticsService.track(.dishUpdated, parameters: ["dish_id": dishId])

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func deleteDish(_ dishId: String) async {
        isLoading = true

        do {
            try await repository.deleteDish(dishId)

            dishes.removeAll { $0.id == dishId }
            categories = repository.getCategories()
            filterDishes()

            analyticsService.track(.dishDeleted, parameters: ["dish_id": dishId])

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func toggleAvailability(_ dishId: String) async {
        guard let dish = dishes.first(where: { $0.id == dishId }) else {
            return
        }

        await updateDish(dishId, name: nil, description: nil, price: nil,
                        category: nil, isVegetarian: nil, isAvailable: !dish.isAvailable,
                        image: nil)
    }

    // MARK: - Statistics

    func getTotalDishes() -> Int {
        dishes.count
    }

    func getAvailableDishes() -> Int {
        dishes.filter { $0.isAvailable }.count
    }

    func getVegetarianDishes() -> Int {
        dishes.filter { $0.isVegetarian }.count
    }

    func getDishesByCategory() -> [String: [Dish]] {
        Dictionary(grouping: dishes) { $0.category ?? "Uncategorized" }
    }

    // MARK: - Error Handling

    func clearError() {
        errorMessage = nil
    }
}
