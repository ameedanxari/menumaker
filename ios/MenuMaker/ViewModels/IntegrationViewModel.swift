import Foundation
import Combine

/// Integration management view model
@MainActor
class IntegrationViewModel: ObservableObject {
    @Published var integrations: [Integration] = []
    @Published var posIntegrations: [Integration] = []
    @Published var deliveryIntegrations: [Integration] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let repository = IntegrationRepository.shared
    private let analyticsService = AnalyticsService.shared

    init() {
        Task {
            await loadIntegrations()
        }
    }

    // MARK: - Data Loading

    func loadIntegrations() async {
        guard let businessId = try? await KeychainManager.shared.getBusinessId() else {
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            integrations = try await repository.getIntegrations(businessId)
            posIntegrations = repository.getPOSIntegrations()
            deliveryIntegrations = repository.getDeliveryIntegrations()

            analyticsService.trackScreen("Integrations")

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func refreshIntegrations() async {
        await loadIntegrations()
    }

    // MARK: - Integration Management

    func connectPOS(provider: IntegrationProvider, credentials: [String: String]) async {
        isLoading = true
        errorMessage = nil

        do {
            let integration = try await repository.connectPOS(
                provider: provider,
                credentials: credentials
            )

            integrations.append(integration)
            posIntegrations = repository.getPOSIntegrations()

            analyticsService.track(.businessCreated, parameters: [
                "integration_type": "pos",
                "provider": provider.rawValue
            ])

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func connectDelivery(provider: IntegrationProvider, credentials: [String: String]) async {
        isLoading = true
        errorMessage = nil

        do {
            let integration = try await repository.connectDelivery(
                provider: provider,
                credentials: credentials
            )

            integrations.append(integration)
            deliveryIntegrations = repository.getDeliveryIntegrations()

            analyticsService.track(.businessCreated, parameters: [
                "integration_type": "delivery",
                "provider": provider.rawValue
            ])

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func disconnectIntegration(_ integrationId: String) async {
        isLoading = true

        do {
            try await repository.disconnectIntegration(integrationId)

            integrations.removeAll { $0.id == integrationId }
            posIntegrations = repository.getPOSIntegrations()
            deliveryIntegrations = repository.getDeliveryIntegrations()

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    // MARK: - Helper Methods

    func hasIntegration(provider: IntegrationProvider, type: IntegrationType) -> Bool {
        repository.hasIntegration(provider: provider, type: type)
    }

    func getActiveIntegrations() -> [Integration] {
        repository.getActiveIntegrations()
    }

    func getLastSyncTime(for integrationId: String) -> String? {
        repository.getLastSyncTime(for: integrationId)
    }

    // MARK: - Statistics

    func getTotalIntegrations() -> Int {
        integrations.count
    }

    func getActiveCount() -> Int {
        repository.getActiveIntegrations().count
    }

    // MARK: - Error Handling

    func clearError() {
        errorMessage = nil
    }
}
