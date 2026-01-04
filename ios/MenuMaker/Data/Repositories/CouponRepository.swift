import Foundation
import Combine

/// Coupon repository
@MainActor
class CouponRepository: ObservableObject {
    static let shared = CouponRepository()

    private let apiClient = APIClient.shared

    @Published var coupons: [Coupon] = []
    private var isUITesting: Bool {
        ProcessInfo.processInfo.arguments.contains("UI-Testing") ||
        ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil
    }

    private init() {}

    // MARK: - Fetch Operations

    func getCoupons(_ businessId: String) async throws -> [Coupon] {
        if isUITesting, !coupons.isEmpty {
            return coupons
        }

        if isUITesting, let seeded = loadFixtureCoupons() {
            coupons = seeded
            return seeded
        }

        let response: CouponListResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.coupons + "?business_id=\(businessId)",
            method: .get
        )

        coupons = response.data.coupons
        return response.data.coupons
    }

    func getCouponById(_ couponId: String) async throws -> Coupon {
        let response: CouponResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.coupon(couponId),
            method: .get
        )

        return response.data.coupon
    }

    struct ValidatedCouponResult {
        let coupon: Coupon
        let discountAmount: Double
        let discountAmountCents: Int
    }

    func validateCoupon(
        code: String,
        businessId: String,
        orderSubtotalCents: Int,
        dishIds: [String]
    ) async throws -> ValidatedCouponResult {
        let normalizedCode = code.uppercased()

        if isUITesting {
            let seedCoupons = loadFixtureCoupons() ?? APIClient.mockCoupons
            coupons = seedCoupons

            guard let coupon = seedCoupons.first(where: { $0.code.uppercased() == normalizedCode }) else {
                throw APIError.serverError("Coupon not found in fixtures")
            }

            guard coupon.isActive else {
                throw APIError.serverError("This coupon is not active")
            }

            guard !coupon.isExpired else {
                throw APIError.serverError("This coupon has expired")
            }

            let discountAmount = calculateDiscount(
                coupon: coupon,
                orderValue: Double(orderSubtotalCents) / 100.0
            )

            return ValidatedCouponResult(
                coupon: coupon,
                discountAmount: discountAmount,
                discountAmountCents: Int(discountAmount * 100)
            )
        }

        let request = ValidateCouponRequest(
            couponCode: normalizedCode,
            businessId: businessId,
            orderSubtotalCents: orderSubtotalCents,
            dishIds: dishIds
        )

        let response: ValidateCouponResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.validateCoupon,
            method: .post,
            body: request
        )

        let data = response.data
        return ValidatedCouponResult(
            coupon: data.coupon,
            discountAmount: data.discountAmount,
            discountAmountCents: data.discountAmountCents
        )
    }

    // MARK: - Create Operations

    func createCoupon(
        businessId: String,
        code: String,
        discountType: DiscountType,
        discountValue: Int,
        maxDiscountCents: Int?,
        minOrderValueCents: Int,
        validUntil: String?,
        usageLimitType: UsageLimitType,
        totalUsageLimit: Int?
    ) async throws -> Coupon {
        let request = CreateCouponRequest(
            businessId: businessId,
            code: code,
            discountType: discountType.rawValue,
            discountValue: discountValue,
            maxDiscountCents: maxDiscountCents,
            minOrderValueCents: minOrderValueCents,
            validUntil: validUntil,
            usageLimitType: usageLimitType.rawValue,
            totalUsageLimit: totalUsageLimit
        )

        let response: CouponResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.coupons,
            method: .post,
            body: request
        )

        // Update local cache
        coupons.append(response.data.coupon)

        return response.data.coupon
    }

    // MARK: - Update Operations

    func updateCoupon(
        _ couponId: String,
        discountValue: Int? = nil,
        maxDiscountCents: Int? = nil,
        minOrderValueCents: Int? = nil,
        validUntil: String? = nil,
        isActive: Bool? = nil
    ) async throws -> Coupon {
        let request = UpdateCouponRequest(
            discountValue: discountValue,
            maxDiscountCents: maxDiscountCents,
            minOrderValueCents: minOrderValueCents,
            validUntil: validUntil,
            isActive: isActive
        )

        let response: CouponResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.coupon(couponId),
            method: .patch,
            body: request
        )

        // Update local cache
        if let index = coupons.firstIndex(where: { $0.id == couponId }) {
            coupons[index] = response.data.coupon
        }

        return response.data.coupon
    }

    // MARK: - Delete Operations

    func deleteCoupon(_ couponId: String) async throws {
        let _: EmptyResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.coupon(couponId),
            method: .delete
        )

        // Update local cache
        coupons.removeAll { $0.id == couponId }
    }

    // MARK: - Filtering

    func getActiveCoupons() -> [Coupon] {
        coupons.filter { $0.isActive && !$0.isExpired }
    }

    func getExpiredCoupons() -> [Coupon] {
        coupons.filter { $0.isExpired }
    }

    // MARK: - Discount Calculation

    func calculateDiscount(coupon: Coupon, orderValue: Double) -> Double {
        guard coupon.isActive && !coupon.isExpired else {
            return 0
        }

        let orderValueCents = Int(orderValue * 100)

        guard orderValueCents >= coupon.minOrderValueCents else {
            return 0
        }

        var discountCents: Int

        switch coupon.discountTypeEnum {
        case .percentage:
            discountCents = (orderValueCents * coupon.discountValue) / 100

            if let maxCents = coupon.maxDiscountCents {
                discountCents = min(discountCents, maxCents)
            }

        case .fixed:
            discountCents = coupon.discountValue
        }

        return Double(discountCents) / 100.0
    }

    // MARK: - Test Fixtures

    func loadFixtureCoupons() -> [Coupon]? {
        // Load shared mock coupons for UI testing
        let fm = FileManager.default
        let potentialPaths: [URL?] = [
            Bundle.main.bundleURL
                .deletingLastPathComponent()
                .deletingLastPathComponent()
                .deletingLastPathComponent()
                .appendingPathComponent("shared/mocks/coupons/list/200.json"),
            Bundle.main.resourceURL?.appendingPathComponent("shared/mocks/coupons/list/200.json")
        ]

        for path in potentialPaths.compactMap({ $0 }) where fm.fileExists(atPath: path.path) {
            if let data = try? Data(contentsOf: path),
               let decoded = try? JSONDecoder().decode(CouponListResponse.self, from: data) {
                return decoded.data.coupons
            }
        }

        // Fallback hardcoded seed to keep UI tests stable
        return [
            Coupon(
                id: "ui-test-1",
                businessId: "business-1",
                code: "TESTCODE",
                discountType: "percentage",
                discountValue: 15,
                maxDiscountCents: 1000,
                minOrderValueCents: 0,
                validUntil: "2030-12-31T23:59:59Z",
                usageLimitType: "unlimited",
                totalUsageLimit: nil,
                isActive: true,
                createdAt: "2024-01-01T00:00:00Z"
            ),
            Coupon(
                id: "ui-test-2",
                businessId: "business-1",
                code: "SAVE10",
                discountType: "percentage",
                discountValue: 10,
                maxDiscountCents: 500,
                minOrderValueCents: 1000,
                validUntil: "2030-12-31T23:59:59Z",
                usageLimitType: "unlimited",
                totalUsageLimit: nil,
                isActive: true,
                createdAt: "2024-01-01T00:00:00Z"
            )
        ]
    }
}
