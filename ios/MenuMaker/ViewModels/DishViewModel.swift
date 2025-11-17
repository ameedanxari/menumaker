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

    struct CreateDishParams {
        let name: String
        let description: String?
        let price: Double
        let category: String?
        let isVegetarian: Bool
        let isAvailable: Bool
        let image: UIImage?
    }

    func createDish(_ params: CreateDishParams) async {
        guard let businessId = try? await KeychainManager.shared.getBusinessId() else {
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            // Upload image if provided
            var imageUrl: String?
            if let image = params.image {
                imageUrl = try await repository.uploadDishImage(image)
            }

            let priceCents = Int(params.price * 100)

            let dish = try await repository.createDish(
                DishRepository.CreateDishParams(
                    businessId: businessId,
                    name: params.name,
                    description: params.description,
                    priceCents: priceCents,
                    imageUrl: imageUrl,
                    category: params.category,
                    isVegetarian: params.isVegetarian,
                    isAvailable: params.isAvailable
                )
            )

            dishes.append(dish)
            categories = repository.getCategories()
            filterDishes()

            analyticsService.track(.dishCreated, parameters: [
                "dish_id": dish.id,
                "name": params.name,
                "price": params.price
            ])

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    struct UpdateDishParams {
        let dishId: String
        let name: String?
        let description: String?
        let price: Double?
        let category: String?
        let isVegetarian: Bool?
        let isAvailable: Bool?
        let image: UIImage?

        init(
            dishId: String,
            name: String? = nil,
            description: String? = nil,
            price: Double? = nil,
            category: String? = nil,
            isVegetarian: Bool? = nil,
            isAvailable: Bool? = nil,
            image: UIImage? = nil
        ) {
            self.dishId = dishId
            self.name = name
            self.description = description
            self.price = price
            self.category = category
            self.isVegetarian = isVegetarian
            self.isAvailable = isAvailable
            self.image = image
        }
    }

    func updateDish(_ params: UpdateDishParams) async {
        isLoading = true
        errorMessage = nil

        do {
            // Upload new image if provided
            var imageUrl: String?
            if let image = params.image {
                imageUrl = try await repository.uploadDishImage(image)
            }

            let priceCents = params.price.map { Int($0 * 100) }

            let dish = try await repository.updateDish(
                DishRepository.UpdateDishParams(
                    dishId: params.dishId,
                    name: params.name,
                    description: params.description,
                    priceCents: priceCents,
                    imageUrl: imageUrl,
                    category: params.category,
                    isVegetarian: params.isVegetarian,
                    isAvailable: params.isAvailable
                )
            )

            if let index = dishes.firstIndex(where: { $0.id == params.dishId }) {
                dishes[index] = dish
            }

            categories = repository.getCategories()
            filterDishes()

            analyticsService.track(.dishUpdated, parameters: ["dish_id": params.dishId])

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

        await updateDish(UpdateDishParams(
            dishId: dishId,
            isAvailable: !dish.isAvailable
        ))
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
