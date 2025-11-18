import Foundation
import SwiftUI

enum AppConstants {
    // MARK: - API Configuration
    enum API {
        static let baseURL = ProcessInfo.processInfo.environment["API_BASE_URL"] ?? "http://localhost:3001/api/v1"
        static let timeout: TimeInterval = 30

        // Endpoints
        enum Endpoints {
            // Auth
            static let login = "/auth/login"
            static let signup = "/auth/signup"
            static let logout = "/auth/logout"
            static let me = "/auth/me"
            static let refreshToken = "/auth/refresh"
            static let forgotPassword = "/auth/forgot-password"
            static let updateProfile = "/auth/profile"
            static let changePassword = "/auth/change-password"
            static let updatePhoto = "/auth/photo"

            // Business
            static let businesses = "/businesses"
            static func business(_ id: String) -> String { "/businesses/\(id)" }
            static func businessBySlug(_ slug: String) -> String { "/businesses/slug/\(slug)" }

            // Menus
            static let menus = "/menus"
            static func menu(_ id: String) -> String { "/menus/\(id)" }
            static func menuDishes(_ menuId: String) -> String { "/menus/\(menuId)/dishes" }

            // Dishes
            static let dishes = "/dishes"
            static func dish(_ id: String) -> String { "/dishes/\(id)" }

            // Orders
            static let orders = "/orders"
            static func order(_ id: String) -> String { "/orders/\(id)" }
            static func businessOrders(_ businessId: String) -> String { "/businesses/\(businessId)/orders" }
            static let customerOrders = "/orders/my-orders"

            // Payments
            static let payments = "/payments"
            static let paymentProcessors = "/payment-processors"

            // Coupons
            static let coupons = "/coupons"
            static func coupon(_ id: String) -> String { "/coupons/\(id)" }
            static func validateCoupon(_ code: String) -> String { "/coupons/validate/\(code)" }

            // Marketplace
            static let marketplace = "/marketplace"
            static let marketplaceSearch = "/marketplace/search"

            // Reviews
            static let reviews = "/reviews"
            static func businessReviews(_ businessId: String) -> String { "/businesses/\(businessId)/reviews" }

            // Referrals
            static let referrals = "/referrals"
            static func referralCode(_ code: String) -> String { "/referrals/code/\(code)" }

            // Notifications
            static let notifications = "/notifications"

            // Favorites
            static let favorites = "/favorites"
            static func favorite(_ id: String) -> String { "/favorites/\(id)" }
            static func favoriteBusiness(_ businessId: String) -> String { "/favorites/business/\(businessId)" }

            // Subscriptions
            static let subscriptions = "/subscriptions"
            static let currentSubscription = "/subscriptions/current"

            // Integrations
            static let integrations = "/integrations"
            static let posIntegrations = "/pos"
            static let deliveryIntegrations = "/delivery"

            // Analytics
            static let analytics = "/analytics"
            static func businessAnalytics(_ businessId: String) -> String { "/businesses/\(businessId)/analytics" }
            static let exportAnalytics = "/analytics/export"
        }
    }

    // MARK: - Storage Keys
    enum Storage {
        static let authToken = "authToken"
        static let refreshToken = "refreshToken"
        static let userId = "userId"
        static let businessId = "businessId"
        static let userEmail = "userEmail"
    }

    // MARK: - UserDefaults Keys
    enum UserDefaultsKeys {
        static let hasCompletedOnboarding = "hasCompletedOnboarding"
        static let preferredLanguage = "preferredLanguage"
        static let notificationsEnabled = "notificationsEnabled"
        static let biometricAuthEnabled = "biometricAuthEnabled"
        static let colorScheme = "colorScheme"
    }

    // MARK: - Validation
    enum Validation {
        static let minPasswordLength = 8
        static let maxNameLength = 100
        static let maxDescriptionLength = 500
        static let emailRegex = "[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,64}"
    }

    // MARK: - UI Configuration
    enum UI {
        static let cornerRadius: CGFloat = 12
        static let smallCornerRadius: CGFloat = 8
        static let largeCornerRadius: CGFloat = 16

        static let padding: CGFloat = 16
        static let smallPadding: CGFloat = 8
        static let largePadding: CGFloat = 24

        static let buttonHeight: CGFloat = 48
        static let inputHeight: CGFloat = 52

        static let iconSize: CGFloat = 24
        static let largeIconSize: CGFloat = 48
    }

    // MARK: - Animation
    enum Animation {
        static let defaultDuration: Double = 0.3
        static let quickDuration: Double = 0.15
        static let slowDuration: Double = 0.5
    }

    // MARK: - Order Status
    enum OrderStatus: String, CaseIterable {
        case pending
        case confirmed
        case ready
        case fulfilled
        case cancelled

        var displayName: String {
            rawValue.capitalized
        }

        var color: Color {
            switch self {
            case .pending: return .orange
            case .confirmed: return .blue
            case .ready: return .purple
            case .fulfilled: return .green
            case .cancelled: return .red
            }
        }

        var icon: String {
            switch self {
            case .pending: return "clock"
            case .confirmed: return "checkmark.circle"
            case .ready: return "bell"
            case .fulfilled: return "checkmark.circle.fill"
            case .cancelled: return "xmark.circle"
            }
        }
    }

    // MARK: - Subscription Tiers
    enum SubscriptionTier: String, CaseIterable {
        case free
        case starter
        case pro

        var displayName: String {
            switch self {
            case .free: return "Free"
            case .starter: return "Starter"
            case .pro: return "Pro"
            }
        }

        var price: Int {
            switch self {
            case .free: return 0
            case .starter: return 49900 // Rs. 499
            case .pro: return 99900 // Rs. 999
            }
        }

        var maxOrders: Int {
            switch self {
            case .free: return 20
            case .starter: return 100
            case .pro: return -1 // unlimited
            }
        }
    }
}
