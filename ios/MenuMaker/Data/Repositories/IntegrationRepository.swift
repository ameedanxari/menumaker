import Foundation
import Combine

/// Integration repository
@MainActor
class IntegrationRepository: ObservableObject {
    static let shared = IntegrationRepository()

    private let apiClient = APIClient.shared

    @Published var integrations: [Integration] = []

    private init() {}

    // MARK: - Fetch Operations

    func getIntegrations(_ businessId: String) async throws -> [Integration] {
        let response: IntegrationListResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.integrations + "?business_id=\(businessId)",
            method: .get
        )

        integrations = response.data.integrations
        return response.data.integrations
    }

    // MARK: - Connect Operations

    func connectPOS(provider: IntegrationProvider, credentials: [String: String]) async throws -> Integration {
        var request = credentials
        request["provider"] = provider.rawValue

        let response: PaymentProcessorResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.posIntegrations + "/connect",
            method: .post,
            body: request
        )

        // Convert PaymentProcessor to Integration
        let integration = Integration(
            id: response.data.processor.id,
            businessId: response.data.processor.businessId,
            provider: response.data.processor.provider,
            type: "pos",
            isActive: response.data.processor.isActive,
            lastSyncAt: nil,
            createdAt: response.data.processor.createdAt
        )

        // Update local cache
        integrations.append(integration)

        return integration
    }

    func connectDelivery(provider: IntegrationProvider, credentials: [String: String]) async throws -> Integration {
        var request = credentials
        request["provider"] = provider.rawValue

        let response: PaymentProcessorResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.deliveryIntegrations + "/connect",
            method: .post,
            body: request
        )

        // Convert PaymentProcessor to Integration
        let integration = Integration(
            id: response.data.processor.id,
            businessId: response.data.processor.businessId,
            provider: response.data.processor.provider,
            type: "delivery",
            isActive: response.data.processor.isActive,
            lastSyncAt: nil,
            createdAt: response.data.processor.createdAt
        )

        // Update local cache
        integrations.append(integration)

        return integration
    }

    // MARK: - Disconnect Operations

    func disconnectIntegration(_ integrationId: String) async throws {
        let _: EmptyResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.integrations + "/\(integrationId)",
            method: .delete
        )

        // Update local cache
        integrations.removeAll { $0.id == integrationId }
    }

    // MARK: - Helpers

    func getIntegrationsByType(_ type: IntegrationType) -> [Integration] {
        integrations.filter { $0.type == type.rawValue }
    }

    func getPOSIntegrations() -> [Integration] {
        getIntegrationsByType(.pos)
    }

    func getDeliveryIntegrations() -> [Integration] {
        getIntegrationsByType(.delivery)
    }

    func getActiveIntegrations() -> [Integration] {
        integrations.filter { $0.isActive }
    }

    func hasIntegration(provider: IntegrationProvider, type: IntegrationType) -> Bool {
        integrations.contains {
            $0.provider == provider.rawValue && $0.type == type.rawValue
        }
    }

    func getLastSyncTime(for integrationId: String) -> String? {
        integrations.first { $0.id == integrationId }?.formattedLastSync
    }
}
