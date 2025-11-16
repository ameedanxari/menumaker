import Foundation
import Combine

/// Dish repository
@MainActor
class DishRepository: ObservableObject {
    static let shared = DishRepository()

    private let apiClient = APIClient.shared

    @Published var dishes: [Dish] = []

    private init() {}

    // MARK: - Fetch Operations

    func getDishesByBusiness(_ businessId: String) async throws -> [Dish] {
        let response: DishListResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.dishes + "?business_id=\(businessId)",
            method: .get
        )

        dishes = response.data.dishes
        return response.data.dishes
    }

    func getDishById(_ dishId: String) async throws -> Dish {
        let response: DishResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.dish(dishId),
            method: .get
        )

        return response.data.dish
    }

    func getMenuDishes(_ menuId: String) async throws -> [Dish] {
        let response: DishListResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.menuDishes(menuId),
            method: .get
        )

        return response.data.dishes
    }

    // MARK: - Create Operations

    func createDish(
        businessId: String,
        name: String,
        description: String?,
        priceCents: Int,
        imageUrl: String?,
        category: String?,
        isVegetarian: Bool,
        isAvailable: Bool
    ) async throws -> Dish {
        let request = CreateDishRequest(
            businessId: businessId,
            name: name,
            description: description,
            priceCents: priceCents,
            imageUrl: imageUrl,
            category: category,
            isVegetarian: isVegetarian,
            isAvailable: isAvailable
        )

        let response: DishResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.dishes,
            method: .post,
            body: request
        )

        // Update local cache
        dishes.append(response.data.dish)

        return response.data.dish
    }

    // MARK: - Update Operations

    func updateDish(
        _ dishId: String,
        name: String? = nil,
        description: String? = nil,
        priceCents: Int? = nil,
        imageUrl: String? = nil,
        category: String? = nil,
        isVegetarian: Bool? = nil,
        isAvailable: Bool? = nil
    ) async throws -> Dish {
        let request = UpdateDishRequest(
            name: name,
            description: description,
            priceCents: priceCents,
            imageUrl: imageUrl,
            category: category,
            isVegetarian: isVegetarian,
            isAvailable: isAvailable
        )

        let response: DishResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.dish(dishId),
            method: .patch,
            body: request
        )

        // Update local cache
        if let index = dishes.firstIndex(where: { $0.id == dishId }) {
            dishes[index] = response.data.dish
        }

        return response.data.dish
    }

    // MARK: - Delete Operations

    func deleteDish(_ dishId: String) async throws {
        let _: EmptyResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.dish(dishId),
            method: .delete
        )

        // Update local cache
        dishes.removeAll { $0.id == dishId }
    }

    // MARK: - Image Upload

    func uploadDishImage(_ image: UIImage) async throws -> String {
        try await ImageService.shared.uploadImage(image, to: "/upload/dish-image")
    }

    // MARK: - Filtering

    func filterDishes(
        category: String? = nil,
        isVegetarian: Bool? = nil,
        isAvailable: Bool? = nil,
        searchQuery: String? = nil
    ) -> [Dish] {
        var filtered = dishes

        if let category = category {
            filtered = filtered.filter { $0.category == category }
        }

        if let isVegetarian = isVegetarian {
            filtered = filtered.filter { $0.isVegetarian == isVegetarian }
        }

        if let isAvailable = isAvailable {
            filtered = filtered.filter { $0.isAvailable == isAvailable }
        }

        if let searchQuery = searchQuery, !searchQuery.isEmpty {
            filtered = filtered.filter {
                $0.name.localizedCaseInsensitiveContains(searchQuery) ||
                ($0.description?.localizedCaseInsensitiveContains(searchQuery) ?? false)
            }
        }

        return filtered
    }

    func getCategories() -> [String] {
        let categories = Set(dishes.compactMap { $0.category })
        return Array(categories).sorted()
    }
}

import UIKit
