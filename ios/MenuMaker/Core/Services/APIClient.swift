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
    private let isUITesting: Bool

    private init() {
        self.baseURL = AppConstants.API.baseURL
        self.isUITesting = CommandLine.arguments.contains("UI-Testing")

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
        // Return mock data for UI testing
        if isUITesting {
            return try await mockResponse(endpoint: endpoint, method: method, body: body)
        }

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

    // MARK: - Mock Responses for UI Testing

    private func mockResponse<T: Decodable>(endpoint: String, method: HTTPMethod, body: Encodable?) async throws -> T {
        // Simulate network delay
        try await Task.sleep(nanoseconds: 300_000_000) // 0.3 seconds

        // Mock authentication responses
        switch endpoint {
        case AppConstants.API.Endpoints.login:
            // Parse login request to validate credentials
            if let loginRequest = body as? LoginRequest {
                // Validate email format
                let emailRegex = "[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,64}"
                let emailPredicate = NSPredicate(format: "SELF MATCHES %@", emailRegex)
                guard emailPredicate.evaluate(with: loginRequest.email) else {
                    throw APIError.serverError("Invalid email format")
                }

                // Check for specific test scenarios
                if loginRequest.email == "nonexistent@example.com" {
                    throw APIError.serverError("Invalid credentials")
                }

                // Validate password
                guard !loginRequest.password.isEmpty else {
                    throw APIError.serverError("Password is required")
                }
            }

            let authData = AuthData(
                accessToken: "mock_access_token",
                refreshToken: "mock_refresh_token",
                user: User(
                    id: "mock_user_id",
                    email: "test@example.com",
                    name: "Test User",
                    phone: "1234567890",
                    role: "seller",
                    createdAt: ISO8601DateFormatter().string(from: Date()),
                    updatedAt: nil
                )
            )
            let response = AuthResponse(success: true, data: authData)
            return response as! T

        case AppConstants.API.Endpoints.signup:
            // Parse signup request to validate data
            if let signupRequest = body as? SignupRequest {
                // Validate email format
                let emailRegex = "[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,64}"
                let emailPredicate = NSPredicate(format: "SELF MATCHES %@", emailRegex)
                guard emailPredicate.evaluate(with: signupRequest.email) else {
                    throw APIError.serverError("Invalid email format")
                }

                // Validate required fields
                guard !signupRequest.name.isEmpty else {
                    throw APIError.serverError("Name is required")
                }

                guard !signupRequest.email.isEmpty else {
                    throw APIError.serverError("Email is required")
                }

                // Validate password strength
                guard signupRequest.password.count >= 8 else {
                    throw APIError.serverError("Password must be at least 8 characters")
                }
            }

            let authData = AuthData(
                accessToken: "mock_access_token",
                refreshToken: "mock_refresh_token",
                user: User(
                    id: "mock_user_id",
                    email: "newuser@example.com",
                    name: "New User",
                    phone: "9876543210",
                    role: "seller",
                    createdAt: ISO8601DateFormatter().string(from: Date()),
                    updatedAt: nil
                )
            )
            let response = AuthResponse(success: true, data: authData)
            return response as! T

        case AppConstants.API.Endpoints.forgotPassword:
            // Parse forgot password request to validate email
            if let forgotPasswordRequest = body as? ForgotPasswordRequest {
                // Validate email format
                let emailRegex = "[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,64}"
                let emailPredicate = NSPredicate(format: "SELF MATCHES %@", emailRegex)
                guard emailPredicate.evaluate(with: forgotPasswordRequest.email) else {
                    throw APIError.serverError("Invalid email format")
                }

                // Check for specific test scenarios
                if forgotPasswordRequest.email == "nonexistent@example.com" {
                    throw APIError.serverError("Email not found")
                }
            }

            let response = EmptyResponse(success: true)
            return response as! T

        case AppConstants.API.Endpoints.logout:
            let response = EmptyResponse(success: true)
            return response as! T

        case AppConstants.API.Endpoints.me:
            let authData = AuthData(
                accessToken: "mock_access_token",
                refreshToken: "mock_refresh_token",
                user: User(
                    id: "mock_user_id",
                    email: "test@example.com",
                    name: "Test User",
                    phone: "1234567890",
                    role: "seller",
                    createdAt: ISO8601DateFormatter().string(from: Date()),
                    updatedAt: nil
                )
            )
            let response = AuthResponse(success: true, data: authData)
            return response as! T

        default:
            // For any other endpoint, return a generic success response
            throw APIError.serverError("Endpoint not mocked: \(endpoint)")
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
