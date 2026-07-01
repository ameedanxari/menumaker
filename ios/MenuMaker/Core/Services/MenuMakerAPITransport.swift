import Foundation

/// HTTP method types used by repositories and generated transport adapters.
enum HTTPMethod: String {
    case get = "GET"
    case post = "POST"
    case put = "PUT"
    case patch = "PATCH"
    case delete = "DELETE"
}

/// API errors surfaced by the transport boundary.
enum APIError: Error, LocalizedError, Equatable {
    case invalidURL
    case requestBoundaryViolation(String)
    case featureUnavailable(String)
    case invalidResponse
    case unauthorized
    case serverError(String)
    case networkError(String)
    case decodingError(String)
    case cancelled
    case unknown

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .requestBoundaryViolation(let message):
            return message
        case .featureUnavailable(let message):
            return message
        case .invalidResponse:
            return "Invalid response from server"
        case .unauthorized:
            return "Unauthorized. Please login again."
        case .serverError(let message):
            return message
        case .networkError(let message):
            return "Network error: \(message)"
        case .decodingError(let message):
            return "Failed to decode response: \(message)"
        case .cancelled:
            return "Request was cancelled"
        case .unknown:
            return "An unknown error occurred"
        }
    }
}

/// Generic API response wrapper used by the backend.
struct APIResponse<T: Decodable>: Decodable {
    let success: Bool
    let data: T?
    let message: String?
    let error: String?
}

struct APIErrorResponse: Decodable {
    let message: String?
    let error: String?
}

protocol MenuMakerRequestTransport {
    func request<T: Decodable>(
        endpoint: String,
        method: HTTPMethod,
        body: Encodable?,
        headers: [String: String]?,
        requiresAuth: Bool
    ) async throws -> T

    func uploadImage(
        endpoint: String,
        image: Data,
        fileName: String,
        mimeType: String,
        requiresAuth: Bool
    ) async throws -> Data
}

@MainActor
final class URLSessionMenuMakerTransport: MenuMakerRequestTransport, MenuMakerAPITransport {
    private static let disabledCapabilityRouteGates: [(capability: String, message: String, segments: [[String]])] = [
        (
            capability: "pos_sync",
            message: "POS integrations are disabled until provider credentials, certification, staging smoke, monitoring, and rollback evidence are recorded.",
            segments: [["pos"]]
        ),
        (
            capability: "delivery_partner",
            message: "Delivery-provider integrations are disabled until provider credentials, certification, staging smoke, monitoring, and rollback evidence are recorded.",
            segments: [["delivery"]]
        ),
        (
            capability: "ocr_import",
            message: "OCR import is disabled until provider credentials, human QA, staging smoke, monitoring, and rollback evidence are recorded.",
            segments: [["ocr"]]
        ),
        (
            capability: "tax_reporting",
            message: "Tax reporting is disabled until tax/legal review, settlement evidence, staging smoke, monitoring, and rollback evidence are recorded.",
            segments: [["tax"], ["tax-reports"], ["reports", "tax"]]
        ),
        (
            capability: "subscriptions",
            message: "Subscriptions are disabled until Stripe credentials, webhook secrets, launch decisions, staging smoke, monitoring, and rollback evidence are recorded.",
            segments: [["subscriptions"]]
        ),
        (
            capability: "enhanced_referrals_affiliates",
            message: "Enhanced referrals, affiliate campaigns, leaderboards, badges, and reward payouts are disabled until payout/reward operations, provider configuration, staging smoke, monitoring, and rollback evidence are recorded.",
            segments: [["affiliates"], ["leaderboard"], ["badges"], ["customers", "referrals"], ["referrals", "share"], ["referrals", "leaderboard"]]
        )
    ]

    private let session: URLSession
    private let keychainManager: KeychainManager
    private let baseURLProvider: () -> String
    private let logger: (String) -> Void

    init() {
        self.session = .shared
        self.keychainManager = .shared
        self.baseURLProvider = { AppConstants.API.baseURL }
        self.logger = { print($0) }
    }

    init(
        session: URLSession,
        baseURLProvider: @escaping () -> String,
        logger: @escaping (String) -> Void
    ) {
        self.session = session
        self.keychainManager = .shared
        self.baseURLProvider = baseURLProvider
        self.logger = logger
    }

    init(
        session: URLSession,
        keychainManager: KeychainManager,
        baseURLProvider: @escaping () -> String,
        logger: @escaping (String) -> Void
    ) {
        self.session = session
        self.keychainManager = keychainManager
        self.baseURLProvider = baseURLProvider
        self.logger = logger
    }

    func request<T: Decodable>(
        endpoint: String,
        method: HTTPMethod = .get,
        body: Encodable? = nil,
        headers: [String: String]? = nil,
        requiresAuth: Bool = true
    ) async throws -> T {
        let request = try await makeRequest(
            endpoint: endpoint,
            method: method,
            body: body,
            headers: headers,
            requiresAuth: requiresAuth
        )
        return try await perform(request, requiresAuth: requiresAuth, didRetryRefresh: false)
    }

    func uploadImage(
        endpoint: String,
        image: Data,
        fileName: String,
        mimeType: String = "image/jpeg",
        requiresAuth: Bool = true
    ) async throws -> Data {
        try assertEndpointCapabilityAvailable(endpoint)
        let safeFileName = try normalizeMultipartHeaderText(
            "Upload file name",
            fileName,
            disallowedCharacters: CharacterSet(charactersIn: "\"\\/:;")
        )
        let safeMimeType = try normalizeMultipartHeaderText(
            "Upload MIME type",
            mimeType,
            disallowedCharacters: CharacterSet.whitespacesAndNewlines.union(CharacterSet(charactersIn: "\"\\;,"))
        )

        guard let url = URL(string: baseURLProvider() + endpoint) else {
            throw APIError.invalidURL
        }

        let boundary = "Boundary-\(UUID().uuidString)"
        var request = URLRequest(url: url)
        request.httpMethod = HTTPMethod.post.rawValue
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.setValue(UUID().uuidString, forHTTPHeaderField: "X-Request-ID")

        if requiresAuth, let token = try? await keychainManager.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"image\"; filename=\"\(safeFileName)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(safeMimeType)\r\n\r\n".data(using: .utf8)!)
        body.append(image)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        request.httpBody = body

        let requestId = request.value(forHTTPHeaderField: "X-Request-ID") ?? "unknown"
        logger("ios_transport_upload request_id=\(requestId) path=\(endpoint) bytes=\(image.count)")
        let (data, response) = try await session.data(for: request)
        try validate(response: response, data: data)
        return data
    }

    func send<RequestBody: Encodable, ResponseBody: Decodable>(
        operationId: String,
        path: String,
        method: String,
        idempotencyKey: String?,
        body: RequestBody?
    ) async throws -> ResponseBody {
        var headers: [String: String] = [:]
        if let idempotencyKey {
            headers["Idempotency-Key"] = idempotencyKey
        }

        return try await request(
            endpoint: path,
            method: HTTPMethod(rawValue: method.uppercased()) ?? .get,
            body: body.map { $0 as Encodable },
            headers: headers.isEmpty ? nil : headers,
            requiresAuth: true
        )
    }

    private func makeRequest(
        endpoint: String,
        method: HTTPMethod,
        body: Encodable?,
        headers: [String: String]?,
        requiresAuth: Bool
    ) async throws -> URLRequest {
        try assertEndpointCapabilityAvailable(endpoint)

        guard let url = URL(string: baseURLProvider() + endpoint) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.timeoutInterval = AppConstants.API.timeout
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue(UUID().uuidString, forHTTPHeaderField: "X-Request-ID")

        if requiresAuth, let token = try? await keychainManager.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        headers?.forEach { key, value in
            request.setValue(value, forHTTPHeaderField: key)
        }

        if let body {
            let encoder = JSONEncoder()
            encoder.keyEncodingStrategy = .convertToSnakeCase
            request.httpBody = try encoder.encode(AnyEncodable(body))
        }

        return request
    }

    private func assertEndpointCapabilityAvailable(_ endpoint: String) throws {
        try assertSafeEndpointText("API route URL", endpoint)

        let path = try normalizeApiPath(endpoint)
        try assertSafeEndpointText("API route path", path)

        let pathSegments = path
            .split(separator: "/")
            .map(String.init)
            .map { $0.lowercased() }

        try assertNoRelativeApiPathSegments(pathSegments)

        if let gate = Self.disabledCapabilityRouteGates.first(where: { gate in
            gate.segments.contains(where: { candidate in
                candidate.enumerated().allSatisfy { index, segment in
                    pathSegments.indices.contains(index) && pathSegments[index] == segment
                }
            })
        }) {
            throw APIError.featureUnavailable("FEATURE_UNAVAILABLE: \(gate.capability) — \(gate.message)")
        }
    }

    private func normalizeApiPath(_ endpoint: String) throws -> String {
        let pathSource = endpoint
            .split(separator: "?", maxSplits: 1, omittingEmptySubsequences: false)[0]
            .split(separator: "#", maxSplits: 1, omittingEmptySubsequences: false)[0]
        let rawPath = extractRawPath(String(pathSource))

        guard let decodedPath = rawPath.removingPercentEncoding else {
            throw APIError.requestBoundaryViolation("API route URL path must be valid percent-encoding")
        }

        let strippedPath = stripApiVersionPrefix(decodedPath)
        return strippedPath.isEmpty ? "/" : strippedPath
    }

    private func extractRawPath(_ pathSource: String) -> String {
        if let schemeRange = pathSource.range(of: "://") {
            let afterAuthority = pathSource[schemeRange.upperBound...]
            if let slashIndex = afterAuthority.firstIndex(of: "/") {
                return String(afterAuthority[slashIndex...])
            }
            return "/"
        }

        if pathSource.hasPrefix("//") {
            let afterAuthority = pathSource.dropFirst(2)
            if let slashIndex = afterAuthority.firstIndex(of: "/") {
                return String(afterAuthority[slashIndex...])
            }
            return "/"
        }

        return pathSource
    }

    private func stripApiVersionPrefix(_ path: String) -> String {
        let apiPrefix = "/api/v"
        let lowercasedPath = path.lowercased()
        guard lowercasedPath.hasPrefix(apiPrefix) else {
            return path
        }

        var digitIndex = path.index(path.startIndex, offsetBy: apiPrefix.count)
        let digitStart = digitIndex
        while digitIndex < path.endIndex, path[digitIndex].isNumber {
            digitIndex = path.index(after: digitIndex)
        }

        guard digitIndex > digitStart else {
            return path
        }
        guard digitIndex == path.endIndex || path[digitIndex] == "/" else {
            return path
        }

        return digitIndex == path.endIndex ? "/" : String(path[digitIndex...])
    }

    private func assertNoRelativeApiPathSegments(_ pathSegments: [String]) throws {
        if pathSegments.contains(where: { $0 == "." || $0 == ".." }) {
            throw APIError.requestBoundaryViolation("API route path must not include relative path segments")
        }
    }

    private func assertSafeEndpointText(_ label: String, _ value: String) throws {
        if value.unicodeScalars.contains(where: isUnsafeEndpointScalar) {
            throw APIError.requestBoundaryViolation("\(label) contains unsafe control characters")
        }
    }

    private func normalizeMultipartHeaderText(
        _ label: String,
        _ value: String,
        disallowedCharacters: CharacterSet
    ) throws -> String {
        try assertSafeEndpointText(label, value)
        let normalized = value.trimmingCharacters(in: .whitespaces)
        guard !normalized.isEmpty else {
            throw APIError.requestBoundaryViolation("\(label) is required")
        }
        if normalized.rangeOfCharacter(from: disallowedCharacters) != nil {
            throw APIError.requestBoundaryViolation("\(label) contains unsafe multipart characters")
        }
        return normalized
    }

    private func isUnsafeEndpointScalar(_ scalar: UnicodeScalar) -> Bool {
        let value = scalar.value
        return value <= 0x1F
            || (0x7F...0x9F).contains(value)
            || value == 0x200B
            || value == 0x200C
            || value == 0x200D
            || value == 0x2060
            || value == 0xFEFF
            || (0x202A...0x202E).contains(value)
            || (0x2066...0x2069).contains(value)
    }

    private func perform<T: Decodable>(
        _ request: URLRequest,
        requiresAuth: Bool,
        didRetryRefresh: Bool
    ) async throws -> T {
        do {
            let requestId = request.value(forHTTPHeaderField: "X-Request-ID") ?? "unknown"
            logger("ios_transport_request request_id=\(requestId) method=\(request.httpMethod ?? "?") path=\(request.url?.path ?? "?")")
            let (data, response) = try await session.data(for: request)

            if let httpResponse = response as? HTTPURLResponse,
               httpResponse.statusCode == 401,
               requiresAuth,
               !didRetryRefresh {
                try await refreshTokenIfPossible()
                var retried = request
                if let token = try? await keychainManager.getToken() {
                    retried.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                }
                return try await perform(retried, requiresAuth: requiresAuth, didRetryRefresh: true)
            }

            try validate(response: response, data: data)
            return try decode(data)
        } catch is CancellationError {
            throw APIError.cancelled
        } catch let error as APIError {
            throw error
        } catch {
            throw APIError.networkError(error.localizedDescription)
        }
    }

    private func validate(response: URLResponse, data: Data) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        switch httpResponse.statusCode {
        case 200...299:
            return
        case 401:
            throw APIError.unauthorized
        case 400...599:
            let decoder = JSONDecoder()
            let decoded = try? decoder.decode(APIErrorResponse.self, from: data)
            throw APIError.serverError(decoded?.message ?? decoded?.error ?? "HTTP \(httpResponse.statusCode)")
        default:
            throw APIError.unknown
        }
    }

    private func decode<T: Decodable>(_ data: Data) throws -> T {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .iso8601

        if T.self == Data.self, let data = data as? T {
            return data
        }

        if let apiResponse = try? decoder.decode(APIResponse<T>.self, from: data),
           let payload = apiResponse.data {
            return payload
        }

        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decodingError(error.localizedDescription)
        }
    }

    private func refreshTokenIfPossible() async throws {
        guard let refreshToken = try? await keychainManager.getRefreshToken(),
              !refreshToken.isEmpty else {
            throw APIError.unauthorized
        }

        struct RefreshRequest: Encodable {
            let refreshToken: String
        }

        struct RefreshData: Decodable {
            let token: String?
            let accessToken: String?
            let refreshToken: String?
        }

        let data: RefreshData = try await request(
            endpoint: AppConstants.API.Endpoints.refreshToken,
            method: .post,
            body: RefreshRequest(refreshToken: refreshToken),
            headers: nil,
            requiresAuth: false
        )

        if let accessToken = data.accessToken ?? data.token {
            try await keychainManager.saveToken(accessToken)
        }
        if let newRefreshToken = data.refreshToken {
            try await keychainManager.saveRefreshToken(newRefreshToken)
        }
    }
}

private struct AnyEncodable: Encodable {
    private let encodeClosure: (Encoder) throws -> Void

    init(_ wrapped: Encodable) {
        self.encodeClosure = wrapped.encode
    }

    func encode(to encoder: Encoder) throws {
        try encodeClosure(encoder)
    }
}
