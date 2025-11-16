import Foundation

/// Menu repository
@MainActor
class MenuRepository: ObservableObject {
    static let shared = MenuRepository()

    private let apiClient = APIClient.shared

    @Published var menus: [Menu] = []

    private init() {}

    // MARK: - Fetch Operations

    func getMenus(_ businessId: String) async throws -> [Menu] {
        let response: MenuListResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.menus + "?business_id=\(businessId)",
            method: .get
        )

        menus = response.data.menus
        return response.data.menus
    }

    func getMenuById(_ menuId: String) async throws -> Menu {
        let response: MenuResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.menu(menuId),
            method: .get
        )

        return response.data.menu
    }

    // MARK: - Create Operations

    func createMenu(
        businessId: String,
        name: String,
        description: String?,
        isActive: Bool,
        displayOrder: Int
    ) async throws -> Menu {
        let request = CreateMenuRequest(
            businessId: businessId,
            name: name,
            description: description,
            isActive: isActive,
            displayOrder: displayOrder
        )

        let response: MenuResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.menus,
            method: .post,
            body: request
        )

        // Update local cache
        menus.append(response.data.menu)

        return response.data.menu
    }

    // MARK: - Update Operations

    func updateMenu(
        _ menuId: String,
        name: String? = nil,
        description: String? = nil,
        isActive: Bool? = nil,
        displayOrder: Int? = nil
    ) async throws -> Menu {
        let request = UpdateMenuRequest(
            name: name,
            description: description,
            isActive: isActive,
            displayOrder: displayOrder
        )

        let response: MenuResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.menu(menuId),
            method: .patch,
            body: request
        )

        // Update local cache
        if let index = menus.firstIndex(where: { $0.id == menuId }) {
            menus[index] = response.data.menu
        }

        return response.data.menu
    }

    // MARK: - Delete Operations

    func deleteMenu(_ menuId: String) async throws {
        let _: EmptyResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.menu(menuId),
            method: .delete
        )

        // Update local cache
        menus.removeAll { $0.id == menuId }
    }

    // MARK: - Helpers

    func getActiveMenus() -> [Menu] {
        menus.filter { $0.isActive }
    }

    func sortedByDisplayOrder() -> [Menu] {
        menus.sorted { $0.displayOrder < $1.displayOrder }
    }

    func reorderMenus(_ orderedMenus: [Menu]) async throws {
        // Update display order for each menu
        for (index, menu) in orderedMenus.enumerated() {
            _ = try await updateMenu(menu.id, displayOrder: index)
        }

        // Update local cache
        menus = orderedMenus
    }
}
