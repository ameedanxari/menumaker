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
                    address: "123 Main St, City, State 12345",
                    photoUrl: nil,
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
                    address: nil,
                    photoUrl: nil,
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
                    address: "123 Main St, City, State 12345",
                    photoUrl: nil,
                    role: "seller",
                    createdAt: ISO8601DateFormatter().string(from: Date()),
                    updatedAt: nil
                )
            )
            let response = AuthResponse(success: true, data: authData)
            return response as! T

        case AppConstants.API.Endpoints.updateProfile:
            // Parse update profile request
            if let updateRequest = body as? UpdateProfileRequest {
                // Validate phone format if provided
                if let phone = updateRequest.phone, !phone.isEmpty {
                    // Simple validation: phone should be numeric and 10 digits
                    let numericPhone = phone.filter { $0.isNumber }
                    guard numericPhone.count >= 10 else {
                        throw APIError.serverError("Invalid phone number")
                    }
                }

                // Validate name if provided
                if let name = updateRequest.name, !name.isEmpty {
                    guard name.count >= 2 else {
                        throw APIError.serverError("Name must be at least 2 characters")
                    }
                }
            }

            // Return updated user
            let updatedUser = User(
                id: "mock_user_id",
                email: "test@example.com",
                name: (body as? UpdateProfileRequest)?.name ?? "Test User",
                phone: (body as? UpdateProfileRequest)?.phone ?? "1234567890",
                address: (body as? UpdateProfileRequest)?.address,
                photoUrl: nil,
                role: "seller",
                createdAt: ISO8601DateFormatter().string(from: Date().addingTimeInterval(-86400 * 30)),
                updatedAt: ISO8601DateFormatter().string(from: Date())
            )
            let response = UserResponse(success: true, data: UserData(user: updatedUser))
            return response as! T

        case AppConstants.API.Endpoints.changePassword:
            // Parse change password request
            if let passwordRequest = body as? ChangePasswordRequest {
                // Validate current password
                if passwordRequest.currentPassword != "password123" {
                    throw APIError.serverError("Current password is incorrect")
                }

                // Validate new password
                guard passwordRequest.newPassword.count >= 8 else {
                    throw APIError.serverError("New password must be at least 8 characters")
                }

                // Check if new password is same as current
                if passwordRequest.newPassword == passwordRequest.currentPassword {
                    throw APIError.serverError("New password must be different from current password")
                }
            }

            let response = MessageResponse(success: true, message: "Password changed successfully")
            return response as! T

        case _ where endpoint.hasPrefix(AppConstants.API.Endpoints.coupons):
            return try await mockCouponResponse(endpoint: endpoint, method: method, body: body)

        case _ where endpoint.hasPrefix(AppConstants.API.Endpoints.orders) || endpoint.hasPrefix(AppConstants.API.Endpoints.customerOrders):
            return try await mockOrderResponse(endpoint: endpoint, method: method, body: body)

        case _ where endpoint.hasPrefix(AppConstants.API.Endpoints.favorites):
            return try await mockFavoriteResponse(endpoint: endpoint, method: method, body: body)

        case _ where endpoint.hasPrefix(AppConstants.API.Endpoints.marketplace):
            return try await mockMarketplaceResponse(endpoint: endpoint, method: method, body: body)

        case _ where endpoint.hasPrefix(AppConstants.API.Endpoints.dishes):
            return try await mockDishResponse(endpoint: endpoint, method: method, body: body)

        default:
            // For any other endpoint, return a generic success response
            throw APIError.serverError("Endpoint not mocked: \(endpoint)")
        }
    }

    // MARK: - Coupon Mock Responses

    private func mockCouponResponse<T: Decodable>(endpoint: String, method: HTTPMethod, body: Encodable?) async throws -> T {
        // Simulate network delay
        try await Task.sleep(nanoseconds: 200_000_000) // 0.2 seconds

        // Handle different coupon endpoints
        if endpoint == AppConstants.API.Endpoints.coupons {
            // GET /coupons - list coupons
            if method == .get {
                let coupons = [
                    Coupon(
                        id: "coupon1",
                        businessId: "business1",
                        code: "SAVE20",
                        discountType: "percentage",
                        discountValue: 20,
                        maxDiscountCents: 50000,
                        minOrderValueCents: 50000,
                        validUntil: nil,
                        usageLimitType: "unlimited",
                        totalUsageLimit: nil,
                        isActive: true,
                        createdAt: ISO8601DateFormatter().string(from: Date())
                    ),
                    Coupon(
                        id: "coupon2",
                        businessId: "business1",
                        code: "FLAT100",
                        discountType: "fixed",
                        discountValue: 10000,
                        maxDiscountCents: nil,
                        minOrderValueCents: 100000,
                        validUntil: nil,
                        usageLimitType: "unlimited",
                        totalUsageLimit: nil,
                        isActive: true,
                        createdAt: ISO8601DateFormatter().string(from: Date())
                    )
                ]
                let response = CouponListResponse(success: true, data: CouponListData(coupons: coupons))
                return response as! T
            }

            // POST /coupons - create coupon
            if method == .post, let createRequest = body as? CreateCouponRequest {
                let coupon = Coupon(
                    id: UUID().uuidString,
                    businessId: createRequest.businessId,
                    code: createRequest.code,
                    discountType: createRequest.discountType,
                    discountValue: createRequest.discountValue,
                    maxDiscountCents: createRequest.maxDiscountCents,
                    minOrderValueCents: createRequest.minOrderValueCents,
                    validUntil: createRequest.validUntil,
                    usageLimitType: createRequest.usageLimitType,
                    totalUsageLimit: createRequest.totalUsageLimit,
                    isActive: true,
                    createdAt: ISO8601DateFormatter().string(from: Date())
                )
                let response = CouponResponse(success: true, data: CouponData(coupon: coupon))
                return response as! T
            }
        }

        // Handle /coupons/:id endpoints
        if endpoint.contains("/coupons/") && endpoint.count > AppConstants.API.Endpoints.coupons.count {
            let couponId = endpoint.replacingOccurrences(of: AppConstants.API.Endpoints.coupons + "/", with: "")

            // Handle validate endpoint
            if endpoint.contains("/validate/") {
                let code = endpoint.replacingOccurrences(of: AppConstants.API.Endpoints.coupons + "/validate/", with: "")

                // Check for invalid/expired codes
                if code == "INVALIDCODE999" || code == "EXPIRED" {
                    throw APIError.serverError("Invalid or expired coupon")
                }

                // Return mock valid coupon
                let coupon = Coupon(
                    id: "valid_coupon",
                    businessId: "business1",
                    code: code,
                    discountType: "percentage",
                    discountValue: 20,
                    maxDiscountCents: nil,
                    minOrderValueCents: 50000,
                    validUntil: nil,
                    usageLimitType: "unlimited",
                    totalUsageLimit: nil,
                    isActive: true,
                    createdAt: ISO8601DateFormatter().string(from: Date())
                )
                let response = CouponResponse(success: true, data: CouponData(coupon: coupon))
                return response as! T
            }

            // PATCH /coupons/:id - update coupon
            if method == .patch {
                let coupon = Coupon(
                    id: couponId,
                    businessId: "business1",
                    code: "UPDATED",
                    discountType: "percentage",
                    discountValue: 25,
                    maxDiscountCents: nil,
                    minOrderValueCents: 50000,
                    validUntil: nil,
                    usageLimitType: "unlimited",
                    totalUsageLimit: nil,
                    isActive: true,
                    createdAt: ISO8601DateFormatter().string(from: Date())
                )
                let response = CouponResponse(success: true, data: CouponData(coupon: coupon))
                return response as! T
            }

            // DELETE /coupons/:id - delete coupon
            if method == .delete {
                let response = EmptyResponse(success: true)
                return response as! T
            }

            // GET /coupons/:id - get single coupon
            if method == .get {
                let coupon = Coupon(
                    id: couponId,
                    businessId: "business1",
                    code: "SAVE20",
                    discountType: "percentage",
                    discountValue: 20,
                    maxDiscountCents: nil,
                    minOrderValueCents: 50000,
                    validUntil: nil,
                    usageLimitType: "unlimited",
                    totalUsageLimit: nil,
                    isActive: true,
                    createdAt: ISO8601DateFormatter().string(from: Date())
                )
                let response = CouponResponse(success: true, data: CouponData(coupon: coupon))
                return response as! T
            }
        }

        throw APIError.serverError("Coupon endpoint not fully mocked: \(endpoint)")
    }

    // MARK: - Order Mock Responses

    private func mockOrderResponse<T: Decodable>(endpoint: String, method: HTTPMethod, body: Encodable?) async throws -> T {
        // Simulate network delay
        try await Task.sleep(nanoseconds: 300_000_000) // 0.3 seconds

        let now = Date()
        let formatter = ISO8601DateFormatter()

        // Mock order items
        let mockItems = [
            OrderItem(
                id: "item1",
                dishId: "dish1",
                dishName: "Paneer Tikka",
                quantity: 2,
                priceCents: 15000,
                totalCents: 30000
            ),
            OrderItem(
                id: "item2",
                dishId: "dish2",
                dishName: "Naan",
                quantity: 3,
                priceCents: 5000,
                totalCents: 15000
            )
        ]

        // Handle /orders/my-orders - Get customer orders
        if endpoint == AppConstants.API.Endpoints.customerOrders || endpoint.starts(with: AppConstants.API.Endpoints.customerOrders + "?") {
            let orders = [
                Order(
                    id: "ORDER001",
                    businessId: "biz1",
                    customerName: "Test User",
                    customerPhone: "+919876543210",
                    customerEmail: "test@example.com",
                    totalCents: 45000,
                    status: "out_for_delivery",
                    items: mockItems,
                    createdAt: formatter.string(from: now.addingTimeInterval(-1800)),
                    updatedAt: formatter.string(from: now),
                    deliveryAddress: "123 Test Street, Test City, 110001",
                    estimatedDeliveryTime: formatter.string(from: now.addingTimeInterval(900)),
                    deliveryPersonName: "Rajesh Kumar",
                    deliveryPersonPhone: "+919876543210"
                ),
                Order(
                    id: "ORDER002",
                    businessId: "biz1",
                    customerName: "Test User",
                    customerPhone: "+919876543210",
                    customerEmail: "test@example.com",
                    totalCents: 35000,
                    status: "preparing",
                    items: mockItems,
                    createdAt: formatter.string(from: now.addingTimeInterval(-900)),
                    updatedAt: formatter.string(from: now),
                    deliveryAddress: "123 Test Street, Test City, 110001",
                    estimatedDeliveryTime: formatter.string(from: now.addingTimeInterval(1800)),
                    deliveryPersonName: nil,
                    deliveryPersonPhone: nil
                ),
                Order(
                    id: "ORDER003",
                    businessId: "biz1",
                    customerName: "Test User",
                    customerPhone: "+919876543210",
                    customerEmail: "test@example.com",
                    totalCents: 50000,
                    status: "delivered",
                    items: mockItems,
                    createdAt: formatter.string(from: now.addingTimeInterval(-86400)),
                    updatedAt: formatter.string(from: now.addingTimeInterval(-85000)),
                    deliveryAddress: "123 Test Street, Test City, 110001",
                    estimatedDeliveryTime: nil,
                    deliveryPersonName: "Amit Singh",
                    deliveryPersonPhone: "+919876543211"
                )
            ]

            let response = OrderListResponse(
                success: true,
                data: OrderListData(orders: orders, total: orders.count)
            )
            return response as! T
        }

        // Handle /orders/:id - Get single order
        if endpoint.starts(with: AppConstants.API.Endpoints.orders + "/") && method == .get {
            let orderId = endpoint.replacingOccurrences(of: AppConstants.API.Endpoints.orders + "/", with: "")

            let order = Order(
                id: orderId,
                businessId: "biz1",
                customerName: "Test User",
                customerPhone: "+919876543210",
                customerEmail: "test@example.com",
                totalCents: 45000,
                status: "out_for_delivery",
                items: mockItems,
                createdAt: formatter.string(from: now.addingTimeInterval(-1800)),
                updatedAt: formatter.string(from: now),
                deliveryAddress: "123 Test Street, Test City, 110001",
                estimatedDeliveryTime: formatter.string(from: now.addingTimeInterval(900)),
                deliveryPersonName: "Rajesh Kumar",
                deliveryPersonPhone: "+919876543210"
            )

            let response = OrderResponse(success: true, data: OrderData(order: order))
            return response as! T
        }

        // Handle PATCH /orders/:id - Update order status
        if endpoint.starts(with: AppConstants.API.Endpoints.orders + "/") && method == .patch {
            let orderId = endpoint.replacingOccurrences(of: AppConstants.API.Endpoints.orders + "/", with: "")

            // Return updated order with same data (status update simulated)
            let order = Order(
                id: orderId,
                businessId: "biz1",
                customerName: "Test User",
                customerPhone: "+919876543210",
                customerEmail: "test@example.com",
                totalCents: 45000,
                status: "out_for_delivery",
                items: mockItems,
                createdAt: formatter.string(from: now.addingTimeInterval(-1800)),
                updatedAt: formatter.string(from: now),
                deliveryAddress: "123 Test Street, Test City, 110001",
                estimatedDeliveryTime: formatter.string(from: now.addingTimeInterval(900)),
                deliveryPersonName: "Rajesh Kumar",
                deliveryPersonPhone: "+919876543210"
            )

            let response = OrderResponse(success: true, data: OrderData(order: order))
            return response as! T
        }

        // Handle DELETE /orders/:id - Cancel order
        if endpoint.starts(with: AppConstants.API.Endpoints.orders + "/") && method == .delete {
            let response = EmptyResponse(success: true)
            return response as! T
        }

        throw APIError.serverError("Order endpoint not fully mocked: \(endpoint)")
    }

    // MARK: - Favorite Mock Responses

    private func mockFavoriteResponse<T: Decodable>(endpoint: String, method: HTTPMethod, body: Encodable?) async throws -> T {
        // Simulate network delay
        try await Task.sleep(nanoseconds: 200_000_000) // 0.2 seconds

        let now = Date()
        let formatter = ISO8601DateFormatter()

        // Mock businesses for favorites
        let mockBusiness1 = Business(
            id: "business1",
            name: "Tasty Bites Restaurant",
            slug: "tasty-bites",
            description: "Authentic Indian cuisine with a modern twist",
            logoUrl: "https://example.com/logo1.jpg",
            ownerId: "owner1",
            isActive: true,
            createdAt: formatter.string(from: now.addingTimeInterval(-86400 * 30)),
            updatedAt: formatter.string(from: now)
        )

        let mockBusiness2 = Business(
            id: "business2",
            name: "Pizza Palace",
            slug: "pizza-palace",
            description: "Fresh wood-fired pizzas delivered to your door",
            logoUrl: "https://example.com/logo2.jpg",
            ownerId: "owner2",
            isActive: true,
            createdAt: formatter.string(from: now.addingTimeInterval(-86400 * 60)),
            updatedAt: formatter.string(from: now)
        )

        let mockBusiness3 = Business(
            id: "business3",
            name: "Sushi Express",
            slug: "sushi-express",
            description: "Premium sushi and Japanese delicacies",
            logoUrl: "https://example.com/logo3.jpg",
            ownerId: "owner3",
            isActive: true,
            createdAt: formatter.string(from: now.addingTimeInterval(-86400 * 15)),
            updatedAt: formatter.string(from: now)
        )

        // Handle GET /favorites - Get all favorites
        if endpoint == AppConstants.API.Endpoints.favorites && method == .get {
            let favorites = [
                Favorite(
                    id: "fav1",
                    userId: "mock_user_id",
                    businessId: "business1",
                    business: mockBusiness1,
                    createdAt: formatter.string(from: now.addingTimeInterval(-86400 * 7))
                ),
                Favorite(
                    id: "fav2",
                    userId: "mock_user_id",
                    businessId: "business2",
                    business: mockBusiness2,
                    createdAt: formatter.string(from: now.addingTimeInterval(-86400 * 14))
                ),
                Favorite(
                    id: "fav3",
                    userId: "mock_user_id",
                    businessId: "business3",
                    business: mockBusiness3,
                    createdAt: formatter.string(from: now.addingTimeInterval(-86400 * 3))
                )
            ]

            let response = FavoriteListResponse(
                success: true,
                data: FavoriteListData(favorites: favorites)
            )
            return response as! T
        }

        // Handle POST /favorites - Add favorite
        if endpoint == AppConstants.API.Endpoints.favorites && method == .post {
            guard let addRequest = body as? AddFavoriteRequest else {
                throw APIError.serverError("Invalid request body")
            }

            let favorite = Favorite(
                id: UUID().uuidString,
                userId: "mock_user_id",
                businessId: addRequest.businessId,
                business: mockBusiness1,
                createdAt: formatter.string(from: now)
            )

            let response = FavoriteResponse(
                success: true,
                data: FavoriteData(favorite: favorite)
            )
            return response as! T
        }

        // Handle DELETE /favorites/:id - Remove favorite by ID
        if endpoint.starts(with: AppConstants.API.Endpoints.favorites + "/") &&
           !endpoint.contains("/business/") &&
           method == .delete {
            let response = EmptyResponse(success: true)
            return response as! T
        }

        // Handle DELETE /favorites/business/:businessId - Remove favorite by business ID
        if endpoint.contains("/business/") && method == .delete {
            let response = EmptyResponse(success: true)
            return response as! T
        }

        throw APIError.serverError("Favorite endpoint not fully mocked: \(endpoint)")
    }

    // MARK: - Marketplace Mock Responses

    private func mockMarketplaceResponse<T: Decodable>(endpoint: String, method: HTTPMethod, body: Encodable?) async throws -> T {
        // Simulate network delay
        try await Task.sleep(nanoseconds: 250_000_000) // 0.25 seconds

        let mockSellers = [
            MarketplaceSeller(
                id: "seller1",
                name: "Tasty Bites Restaurant",
                slug: "tasty-bites",
                description: "Authentic Indian cuisine with a modern twist",
                logoUrl: "https://example.com/logo1.jpg",
                cuisineType: "Indian",
                rating: 4.5,
                reviewCount: 125,
                latitude: 28.6139,
                longitude: 77.2090,
                distanceKm: 1.2
            ),
            MarketplaceSeller(
                id: "seller2",
                name: "Pizza Palace",
                slug: "pizza-palace",
                description: "Fresh wood-fired pizzas delivered to your door",
                logoUrl: "https://example.com/logo2.jpg",
                cuisineType: "Italian",
                rating: 4.7,
                reviewCount: 89,
                latitude: 28.6149,
                longitude: 77.2100,
                distanceKm: 0.8
            ),
            MarketplaceSeller(
                id: "seller3",
                name: "Sushi Express",
                slug: "sushi-express",
                description: "Premium sushi and Japanese delicacies",
                logoUrl: "https://example.com/logo3.jpg",
                cuisineType: "Japanese",
                rating: 4.8,
                reviewCount: 156,
                latitude: 28.6159,
                longitude: 77.2110,
                distanceKm: 2.5
            ),
            MarketplaceSeller(
                id: "seller4",
                name: "Burger Junction",
                slug: "burger-junction",
                description: "Juicy burgers and crispy fries",
                logoUrl: "https://example.com/logo4.jpg",
                cuisineType: "American",
                rating: 4.3,
                reviewCount: 67,
                latitude: 28.6129,
                longitude: 77.2080,
                distanceKm: 1.5
            )
        ]

        // Handle GET /marketplace - Get all sellers
        if endpoint == AppConstants.API.Endpoints.marketplace || endpoint.starts(with: AppConstants.API.Endpoints.marketplace + "?") {
            let response = MarketplaceResponse(
                success: true,
                data: MarketplaceData(sellers: mockSellers, total: mockSellers.count)
            )
            return response as! T
        }

        throw APIError.serverError("Marketplace endpoint not fully mocked: \(endpoint)")
    }

    // MARK: - Dish Mock Responses

    private func mockDishResponse<T: Decodable>(endpoint: String, method: HTTPMethod, body: Encodable?) async throws -> T {
        // Simulate network delay
        try await Task.sleep(nanoseconds: 250_000_000) // 0.25 seconds

        let now = Date()
        let formatter = ISO8601DateFormatter()

        let mockDishes = [
            Dish(
                id: "dish1",
                businessId: "seller1",
                name: "Paneer Tikka",
                description: "Grilled cottage cheese marinated in spices",
                priceCents: 25000,
                imageUrl: "https://example.com/dish1.jpg",
                category: "Appetizers",
                isVegetarian: true,
                isAvailable: true,
                createdAt: formatter.string(from: now.addingTimeInterval(-86400 * 10)),
                updatedAt: formatter.string(from: now)
            ),
            Dish(
                id: "dish2",
                businessId: "seller1",
                name: "Butter Chicken",
                description: "Tender chicken in creamy tomato sauce",
                priceCents: 35000,
                imageUrl: "https://example.com/dish2.jpg",
                category: "Main Course",
                isVegetarian: false,
                isAvailable: true,
                createdAt: formatter.string(from: now.addingTimeInterval(-86400 * 8)),
                updatedAt: formatter.string(from: now)
            ),
            Dish(
                id: "dish3",
                businessId: "seller1",
                name: "Naan",
                description: "Fresh baked Indian bread",
                priceCents: 5000,
                imageUrl: "https://example.com/dish3.jpg",
                category: "Breads",
                isVegetarian: true,
                isAvailable: true,
                createdAt: formatter.string(from: now.addingTimeInterval(-86400 * 5)),
                updatedAt: formatter.string(from: now)
            ),
            Dish(
                id: "dish4",
                businessId: "seller2",
                name: "Margherita Pizza",
                description: "Classic tomato and mozzarella pizza",
                priceCents: 30000,
                imageUrl: "https://example.com/dish4.jpg",
                category: "Pizzas",
                isVegetarian: true,
                isAvailable: true,
                createdAt: formatter.string(from: now.addingTimeInterval(-86400 * 7)),
                updatedAt: formatter.string(from: now)
            ),
            Dish(
                id: "dish5",
                businessId: "seller2",
                name: "Pepperoni Pizza",
                description: "Loaded with pepperoni and cheese",
                priceCents: 35000,
                imageUrl: "https://example.com/dish5.jpg",
                category: "Pizzas",
                isVegetarian: false,
                isAvailable: true,
                createdAt: formatter.string(from: now.addingTimeInterval(-86400 * 6)),
                updatedAt: formatter.string(from: now)
            )
        ]

        // Handle GET /dishes?business_id=X - Get dishes by business
        if endpoint.contains("business_id=") {
            // Extract business ID from query params
            let filteredDishes = mockDishes.filter { dish in
                endpoint.contains(dish.businessId)
            }

            let response = DishListResponse(
                success: true,
                data: DishListData(dishes: filteredDishes)
            )
            return response as! T
        }

        // Handle GET /dishes/:id - Get single dish
        if endpoint.starts(with: AppConstants.API.Endpoints.dishes + "/") && method == .get {
            // Return first dish for simplicity
            if let dish = mockDishes.first {
                let response = DishResponse(
                    success: true,
                    data: DishData(dish: dish)
                )
                return response as! T
            }
        }

        throw APIError.serverError("Dish endpoint not fully mocked: \(endpoint)")
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
