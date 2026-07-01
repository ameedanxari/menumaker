import Foundation
import Testing
@testable import MenuMaker

@MainActor
struct IntegrationCapabilityBoundaryTests {
    @Test("POS repository connect is launch-gated locally")
    func posRepositoryConnectIsLaunchGated() async {
        do {
            _ = try await IntegrationRepository.shared.connectPOS(
                provider: .petpooja,
                credentials: ["api_key": "test-key"]
            )
            Issue.record("POS connect must not return a successful integration while launch-gated")
        } catch {
            #expect(error.localizedDescription.contains("POS integrations are launch-gated"))
            #expect(error.localizedDescription.contains("backend capability evidence"))
        }
    }

    @Test("Delivery repository connect is launch-gated locally")
    func deliveryRepositoryConnectIsLaunchGated() async {
        do {
            _ = try await IntegrationRepository.shared.connectDelivery(
                provider: .swiggy,
                credentials: ["api_key": "test-key"]
            )
            Issue.record("Delivery connect must not return a successful integration while launch-gated")
        } catch {
            #expect(error.localizedDescription.contains("Delivery-provider integrations are launch-gated"))
            #expect(error.localizedDescription.contains("backend capability evidence"))
        }
    }

    @Test("Integration repository disconnect is launch-gated locally")
    func repositoryDisconnectIsLaunchGated() async {
        do {
            try await IntegrationRepository.shared.disconnectIntegration("integration-1")
            Issue.record("Integration disconnect must not call the backend while POS/delivery are launch-gated")
        } catch {
            #expect(error.localizedDescription.contains("POS and delivery-provider integrations are launch-gated"))
            #expect(error.localizedDescription.contains("backend capability evidence"))
        }
    }

    @Test("Repository suppresses stale POS and delivery rows while launch-gated")
    func repositorySuppressesStalePOSAndDeliveryRows() async {
        let staleIntegrations = [
            Integration(
                id: "pos-1",
                businessId: "business-1",
                provider: "petpooja",
                type: " POS ",
                isActive: true,
                lastSyncAt: "2026-06-21T06:00:00Z",
                createdAt: "2026-06-21T05:00:00Z"
            ),
            Integration(
                id: "delivery-1",
                businessId: "business-1",
                provider: "swiggy",
                type: " delivery ",
                isActive: true,
                lastSyncAt: "2026-06-21T06:00:00Z",
                createdAt: "2026-06-21T05:00:00Z"
            )
        ]

        let visible = IntegrationRepository.visibleIntegrationsWhileLaunchGated(staleIntegrations)

        #expect(visible.isEmpty)
    }

    @Test("Repository rejects unsafe integration text and encodes business IDs")
    func repositoryRejectsUnsafeIntegrationTextAndEncodesBusinessIds() throws {
        let endpoint = try IntegrationRepository.integrationListEndpoint(for: " business/1?debug=true&x=1 ")

        #expect(endpoint.hasSuffix("?business_id=business%2F1%3Fdebug%3Dtrue%26x%3D1"))

        #expect(throws: IntegrationRepository.BoundaryError.unsafeControlCharacters("Business ID")) {
            try IntegrationRepository.integrationListEndpoint(for: "business\u{0000}1")
        }
        #expect(throws: IntegrationRepository.BoundaryError.unsafeControlCharacters("Business ID")) {
            try IntegrationRepository.integrationListEndpoint(for: "business\u{202E}1")
        }
        #expect(throws: IntegrationRepository.BoundaryError.required("Business ID")) {
            try IntegrationRepository.integrationListEndpoint(for: "  ")
        }
    }

    @Test("Repository hides unsafe launch-gated integration rows")
    func repositoryHidesUnsafeLaunchGatedIntegrationRows() throws {
        #expect(throws: IntegrationRepository.BoundaryError.unsafeControlCharacters("Integration provider")) {
            try IntegrationRepository.normalizeIntegrationText("Integration provider", "petpooja\u{200B}", maxLength: 64)
        }

        let unsafeRows = [
            Integration(
                id: "integration-1",
                businessId: "business-1",
                provider: "petpooja",
                type: "po\u{0000}s",
                isActive: true,
                lastSyncAt: "2026-06-21T06:00:00Z",
                createdAt: "2026-06-21T05:00:00Z"
            ),
            Integration(
                id: "integration\u{2060}2",
                businessId: "business-1",
                provider: "petpooja",
                type: "marketing",
                isActive: true,
                lastSyncAt: "2026-06-21T06:00:00Z",
                createdAt: "2026-06-21T05:00:00Z"
            ),
            Integration(
                id: "integration-3",
                businessId: "business-1",
                provider: "petpooja\u{200B}",
                type: "marketing",
                isActive: true,
                lastSyncAt: "2026-06-21T06:00:00Z",
                createdAt: "2026-06-21T05:00:00Z"
            ),
            Integration(
                id: "integration-4",
                businessId: "business-1",
                provider: "petpooja",
                type: "pos\u{202E}",
                isActive: true,
                lastSyncAt: "2026-06-21T06:00:00Z",
                createdAt: "2026-06-21T05:00:00Z"
            )
        ]

        let visible = IntegrationRepository.visibleIntegrationsWhileLaunchGated(unsafeRows)

        #expect(visible.isEmpty)
    }

    @Test("Repository helper lookups normalize integration text")
    func repositoryHelperLookupsNormalizeIntegrationText() {
        let repository = IntegrationRepository.shared
        defer {
            repository.integrations = []
        }

        repository.integrations = [
            Integration(
                id: " integration-1 ",
                businessId: "business-1",
                provider: " PETPOOJA ",
                type: " POS ",
                isActive: true,
                lastSyncAt: "2026-06-21T06:00:00Z",
                createdAt: "2026-06-21T05:00:00Z"
            )
        ]

        #expect(repository.getPOSIntegrations().count == 1)
        #expect(repository.hasIntegration(provider: .petpooja, type: .pos))
        #expect(repository.getLastSyncTime(for: "integration-1") != nil)
        #expect(repository.getLastSyncTime(for: "integration\u{0000}1") == nil)
        #expect(repository.getLastSyncTime(for: "integration\u{200B}1") == nil)
    }

    @Test("Integration view model exposes disabled POS and delivery state")
    func integrationViewModelExposesLaunchGatedState() async {
        let viewModel = IntegrationViewModel()

        await viewModel.connectPOS(provider: .petpooja, credentials: ["api_key": "test-key"])
        #expect(viewModel.errorMessage?.contains("POS and delivery-provider integrations are disabled") == true)
        #expect(viewModel.getTotalIntegrations() == 0)
        #expect(viewModel.getActiveCount() == 0)

        viewModel.clearError()
        #expect(viewModel.errorMessage == nil)

        await viewModel.connectDelivery(provider: .swiggy, credentials: ["api_key": "test-key"])
        #expect(viewModel.errorMessage?.contains("POS and delivery-provider integrations are disabled") == true)
        #expect(viewModel.getTotalIntegrations() == 0)
        #expect(viewModel.getActiveCount() == 0)

        viewModel.clearError()
        await viewModel.disconnectIntegration("integration-1")
        #expect(viewModel.errorMessage?.contains("POS and delivery-provider integrations are launch-gated") == true)
        #expect(viewModel.getTotalIntegrations() == 0)
        #expect(viewModel.getActiveCount() == 0)
    }
}
