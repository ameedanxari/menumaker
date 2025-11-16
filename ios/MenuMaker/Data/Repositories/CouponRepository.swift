import Foundation
import Combine

/// Coupon repository
@MainActor
class CouponRepository: ObservableObject {
    static let shared = CouponRepository()

    private let apiClient = APIClient.shared

    @Published var coupons: [Coupon] = []

    private init() {}

    // MARK: - Fetch Operations

    func getCoupons(_ businessId: String) async throws -> [Coupon] {
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

    func validateCoupon(_ code: String) async throws -> Coupon {
        let response: CouponResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.validateCoupon(code),
            method: .get
        )

        return response.data.coupon
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
}
