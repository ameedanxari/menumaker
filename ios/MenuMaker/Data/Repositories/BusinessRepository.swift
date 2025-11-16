import Foundation
import Combine

/// Business repository
@MainActor
class BusinessRepository: ObservableObject {
    static let shared = BusinessRepository()

    private let apiClient = APIClient.shared
    private let keychainManager = KeychainManager.shared

    @Published var currentBusiness: Business?

    private init() {}

    // MARK: - Fetch Operations

    func getBusinesses() async throws -> [Business] {
        let response: BusinessListResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.businesses,
            method: .get
        )

        return response.data.businesses
    }

    func getBusinessById(_ id: String) async throws -> Business {
        let response: BusinessResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.business(id),
            method: .get
        )

        return response.data.business
    }

    func getBusinessBySlug(_ slug: String) async throws -> Business {
        let response: BusinessResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.businessBySlug(slug),
            method: .get
        )

        return response.data.business
    }

    func getCurrentBusiness() async throws -> Business {
        let businesses = try await getBusinesses()

        guard let business = businesses.first else {
            throw RepositoryError.notFound
        }

        currentBusiness = business

        // Save business ID
        try await keychainManager.saveBusinessId(business.id)

        return business
    }

    // MARK: - Create Operations

    func createBusiness(name: String, slug: String, description: String?, logoUrl: String?) async throws -> Business {
        let request = CreateBusinessRequest(
            name: name,
            slug: slug,
            description: description,
            logoUrl: logoUrl
        )

        let response: BusinessResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.businesses,
            method: .post,
            body: request
        )

        currentBusiness = response.data.business

        // Save business ID
        try await keychainManager.saveBusinessId(response.data.business.id)

        return response.data.business
    }

    // MARK: - Update Operations

    func updateBusiness(
        _ businessId: String,
        name: String? = nil,
        description: String? = nil,
        logoUrl: String? = nil,
        isActive: Bool? = nil
    ) async throws -> Business {
        let request = UpdateBusinessRequest(
            name: name,
            description: description,
            logoUrl: logoUrl,
            isActive: isActive
        )

        let response: BusinessResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.business(businessId),
            method: .patch,
            body: request
        )

        currentBusiness = response.data.business

        return response.data.business
    }

    // MARK: - Delete Operations

    func deleteBusiness(_ businessId: String) async throws {
        let _: EmptyResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.business(businessId),
            method: .delete
        )

        if currentBusiness?.id == businessId {
            currentBusiness = nil
        }
    }
}

// MARK: - Repository Error

enum RepositoryError: Error, LocalizedError {
    case notFound
    case invalidData
    case unknown

    var errorDescription: String? {
        switch self {
        case .notFound:
            return "Resource not found"
        case .invalidData:
            return "Invalid data"
        case .unknown:
            return "An unknown error occurred"
        }
    }
}
