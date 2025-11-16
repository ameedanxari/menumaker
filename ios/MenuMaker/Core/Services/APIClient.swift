import Foundation

/// HTTP method types
enum HTTPMethod: String {
    case get = "GET"
    case post = "POST"
    case put = "PUT"
    case patch = "PATCH"
    case delete = "DELETE"
}

/// API errors
enum APIError: Error, LocalizedError {
    case invalidURL
    case invalidResponse
    case unauthorized
    case serverError(String)
    case networkError(Error)
    case decodingError(Error)
    case unknown

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid response from server"
        case .unauthorized:
            return "Unauthorized. Please login again."
        case .serverError(let message):
            return message
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .decodingError(let error):
            return "Failed to decode response: \(error.localizedDescription)"
        case .unknown:
            return "An unknown error occurred"
        }
    }
}

/// Generic API response wrapper
struct APIResponse<T: Decodable>: Decodable {
    let success: Bool
    let data: T?
    let message: String?
    let error: String?
}

/// API Client for all network requests
@MainActor
class APIClient {
    static let shared = APIClient()

    private let baseURL: String
    private let session: URLSession
    private let keychainManager = KeychainManager.shared

    private init() {
        self.baseURL = AppConstants.API.baseURL

        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = AppConstants.API.timeout
        configuration.timeoutIntervalForResource = AppConstants.API.timeout
        configuration.waitsForConnectivity = true

        self.session = URLSession(configuration: configuration)
    }

    // MARK: - Generic Request Methods

    func request<T: Decodable>(
        endpoint: String,
        method: HTTPMethod = .get,
        body: Encodable? = nil,
        headers: [String: String]? = nil,
        requiresAuth: Bool = true
    ) async throws -> T {
        guard let url = URL(string: baseURL + endpoint) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue

        // Add headers
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        // Add auth token if required
        if requiresAuth {
            if let token = try? await keychainManager.getToken() {
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
        }

        // Add custom headers
        headers?.forEach { key, value in
            request.setValue(value, forHTTPHeaderField: key)
        }

        // Add body
        if let body = body {
            request.httpBody = try JSONEncoder().encode(body)
        }

        // Perform request
        do {
            let (data, response) = try await session.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIError.invalidResponse
            }

            // Handle response status codes
            switch httpResponse.statusCode {
            case 200...299:
                // Success - decode response
                do {
                    let decoder = JSONDecoder()
                    decoder.keyDecodingStrategy = .convertFromSnakeCase
                    decoder.dateDecodingStrategy = .iso8601

                    // Try to decode as APIResponse wrapper first
                    if let apiResponse = try? decoder.decode(APIResponse<T>.self, from: data) {
                        if let data = apiResponse.data {
                            return data
                        }
                    }

                    // Otherwise decode directly
                    return try decoder.decode(T.self, from: data)
                } catch {
                    throw APIError.decodingError(error)
                }

            case 401:
                // Unauthorized - try to refresh token
                try await refreshTokenIfNeeded()
                throw APIError.unauthorized

            case 400...499:
                // Client error
                if let errorResponse = try? JSONDecoder().decode(ErrorResponse.self, from: data) {
                    throw APIError.serverError(errorResponse.message ?? "Client error")
                }
                throw APIError.serverError("Client error: \(httpResponse.statusCode)")

            case 500...599:
                // Server error
                if let errorResponse = try? JSONDecoder().decode(ErrorResponse.self, from: data) {
                    throw APIError.serverError(errorResponse.message ?? "Server error")
                }
                throw APIError.serverError("Server error: \(httpResponse.statusCode)")

            default:
                throw APIError.unknown
            }

        } catch let error as APIError {
            throw error
        } catch {
            throw APIError.networkError(error)
        }
    }

    // MARK: - Token Management

    private func refreshTokenIfNeeded() async throws {
        guard let refreshToken = try? await keychainManager.getRefreshToken() else {
            await keychainManager.clearTokens()
            return
        }

        struct RefreshRequest: Encodable {
            let refreshToken: String
        }

        struct RefreshResponse: Decodable {
            let accessToken: String
            let refreshToken: String
        }

        do {
            let response: RefreshResponse = try await request(
                endpoint: AppConstants.API.Endpoints.refreshToken,
                method: .post,
                body: RefreshRequest(refreshToken: refreshToken),
                requiresAuth: false
            )

            try await keychainManager.saveToken(response.accessToken)
            try await keychainManager.saveRefreshToken(response.refreshToken)
        } catch {
            // If refresh fails, clear tokens
            await keychainManager.clearTokens()
            throw APIError.unauthorized
        }
    }

    // MARK: - Upload Methods

    func uploadImage(
        endpoint: String,
        image: Data,
        fileName: String = "image.jpg",
        mimeType: String = "image/jpeg",
        additionalFields: [String: String]? = nil
    ) async throws -> Data {
        guard let url = URL(string: baseURL + endpoint) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = HTTPMethod.post.rawValue

        let boundary = UUID().uuidString
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        // Add auth token
        if let token = try? await keychainManager.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        var body = Data()

        // Add additional fields
        if let fields = additionalFields {
            for (key, value) in fields {
                body.append("--\(boundary)\r\n".data(using: .utf8)!)
                body.append("Content-Disposition: form-data; name=\"\(key)\"\r\n\r\n".data(using: .utf8)!)
                body.append("\(value)\r\n".data(using: .utf8)!)
            }
        }

        // Add image data
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(fileName)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
        body.append(image)
        body.append("\r\n".data(using: .utf8)!)
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)

        request.httpBody = body

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw APIError.invalidResponse
        }

        return data
    }
}

// MARK: - Error Response Model

struct ErrorResponse: Decodable {
    let success: Bool?
    let message: String?
    let error: String?
}
