import Foundation

/// Temporary compatibility adapter for repositories that still call APIClient directly.
///
/// Production networking lives in `URLSessionMenuMakerTransport` and the generated
/// `MenuMakerAPITransport`; this class preserves the
/// existing repository call surface while the remaining repositories migrate to the
/// generated operation clients. It intentionally contains no UI-test environment
/// detection, mutable fixture router, static mock response store, or unsafe casts.
@MainActor
final class APIClient {
    static let shared = APIClient()

    private var transport: MenuMakerRequestTransport

    init() {
        self.transport = URLSessionMenuMakerTransport()
    }

    init(transport: MenuMakerRequestTransport) {
        self.transport = transport
    }

    static func resetMockData() {
        // Production targets no longer own mutable UI-test fixtures.
        // UI tests must seed state through test bundles, launch arguments, or the fake backend.
    }

    func configureTransportForTesting(_ transport: MenuMakerRequestTransport) {
        self.transport = transport
    }

    func request<T: Decodable>(
        endpoint: String,
        method: HTTPMethod = .get,
        body: Encodable? = nil,
        headers: [String: String]? = nil,
        requiresAuth: Bool = true
    ) async throws -> T {
        try await transport.request(
            endpoint: endpoint,
            method: method,
            body: body,
            headers: headers,
            requiresAuth: requiresAuth
        )
    }

    func uploadImage(
        endpoint: String,
        image: Data,
        fileName: String,
        mimeType: String = "image/jpeg",
        requiresAuth: Bool = true
    ) async throws -> Data {
        try await transport.uploadImage(
            endpoint: endpoint,
            image: image,
            fileName: fileName,
            mimeType: mimeType,
            requiresAuth: requiresAuth
        )
    }
}
