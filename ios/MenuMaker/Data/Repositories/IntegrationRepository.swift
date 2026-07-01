import Foundation
import Combine

private enum IntegrationCapabilityError: LocalizedError {
    case launchGated(String)

    var errorDescription: String? {
        switch self {
        case .launchGated(let capability):
            return "\(capability) integrations are launch-gated in this build and remain disabled until backend capability evidence is recorded."
        }
    }
}

/// Integration repository
@MainActor
class IntegrationRepository: ObservableObject {
    static let shared = IntegrationRepository()

    private let apiClient = APIClient.shared
    private static let launchGatedIntegrationTypes: Set<String> = ["pos", "delivery"]
    private static let unsafeTextScalarValues: Set<UInt32> = {
        Set((Array(0x0000...0x0008)
            + [0x000B, 0x000C]
            + Array(0x000E...0x001F)
            + Array(0x007F...0x009F)
            + Array(0x200B...0x200F)
            + Array(0x202A...0x202E)
            + Array(0x2060...0x206F)
            + [0xFEFF]).map(UInt32.init))
    }()
    private static let queryValueAllowed = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~")

    @Published var integrations: [Integration] = []

    private init() {}

    enum BoundaryError: LocalizedError, Equatable {
        case required(String)
        case tooLong(String, Int)
        case unsafeControlCharacters(String)

        var errorDescription: String? {
            switch self {
            case .required(let label):
                return "\(label) is required"
            case .tooLong(let label, let maxLength):
                return "\(label) must be \(maxLength) characters or fewer"
            case .unsafeControlCharacters(let label):
                return "\(label) contains unsafe control characters"
            }
        }
    }

    static func normalizeIntegrationText(_ label: String, _ value: String, maxLength: Int) throws -> String {
        guard !containsUnsafeTextScalar(value) else {
            throw BoundaryError.unsafeControlCharacters(label)
        }
        let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else {
            throw BoundaryError.required(label)
        }
        guard normalized.count <= maxLength else {
            throw BoundaryError.tooLong(label, maxLength)
        }
        return normalized
    }

    private static func containsUnsafeTextScalar(_ value: String) -> Bool {
        value.unicodeScalars.contains { unsafeTextScalarValues.contains($0.value) }
    }

    static func integrationListEndpoint(for businessId: String) throws -> String {
        let normalizedBusinessId = try normalizeIntegrationText("Business ID", businessId, maxLength: 255)
        let encodedBusinessId = normalizedBusinessId.addingPercentEncoding(withAllowedCharacters: queryValueAllowed) ?? normalizedBusinessId
        return AppConstants.API.Endpoints.integrations + "?business_id=\(encodedBusinessId)"
    }

    // MARK: - Fetch Operations

    func getIntegrations(_ businessId: String) async throws -> [Integration] {
        let response: IntegrationListResponse = try await apiClient.request(
            endpoint: try Self.integrationListEndpoint(for: businessId),
            method: .get
        )

        let visibleIntegrations = Self.visibleIntegrationsWhileLaunchGated(response.data.integrations)
        integrations = visibleIntegrations
        return visibleIntegrations
    }

    static func visibleIntegrationsWhileLaunchGated(_ integrations: [Integration]) -> [Integration] {
        integrations.filter { integration in
            guard (try? normalizeIntegrationText("Integration ID", integration.id, maxLength: 255)) != nil else {
                return false
            }
            guard let normalizedProvider = try? normalizeIntegrationText("Integration provider", integration.provider, maxLength: 64),
                  normalizedProvider.unicodeScalars.allSatisfy({ $0.value >= 0x20 && $0.value <= 0x7E }) else {
                return false
            }
            guard let normalizedType = try? normalizeIntegrationText("Integration type", integration.type, maxLength: 64).lowercased() else {
                return false
            }
            return !launchGatedIntegrationTypes.contains(normalizedType)
        }
    }

    // MARK: - Connect Operations

    func connectPOS(provider: IntegrationProvider, credentials: [String: String]) async throws -> Integration {
        throw IntegrationCapabilityError.launchGated("POS")
    }

    func connectDelivery(provider: IntegrationProvider, credentials: [String: String]) async throws -> Integration {
        throw IntegrationCapabilityError.launchGated("Delivery-provider")
    }

    // MARK: - Disconnect Operations

    func disconnectIntegration(_ integrationId: String) async throws {
        throw IntegrationCapabilityError.launchGated("POS and delivery-provider")
    }

    // MARK: - Helpers

    func getIntegrationsByType(_ type: IntegrationType) -> [Integration] {
        integrations.filter {
            (try? Self.normalizeIntegrationText("Integration type", $0.type, maxLength: 64).lowercased()) == type.rawValue
        }
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
            (try? Self.normalizeIntegrationText("Integration provider", $0.provider, maxLength: 64).lowercased()) == provider.rawValue &&
                (try? Self.normalizeIntegrationText("Integration type", $0.type, maxLength: 64).lowercased()) == type.rawValue
        }
    }

    func getLastSyncTime(for integrationId: String) -> String? {
        guard let normalizedIntegrationId = try? Self.normalizeIntegrationText("Integration ID", integrationId, maxLength: 255) else {
            return nil
        }
        return integrations.first {
            (try? Self.normalizeIntegrationText("Integration ID", $0.id, maxLength: 255)) == normalizedIntegrationId
        }?.formattedLastSync
    }
}
