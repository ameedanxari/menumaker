import Foundation
import Combine

/// Coupon management view model
@MainActor
class CouponViewModel: ObservableObject {
    @Published var coupons: [Coupon] = []
    @Published var activeCoupons: [Coupon] = []
    @Published var expiredCoupons: [Coupon] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let repository = CouponRepository.shared
    private let analyticsService = AnalyticsService.shared

    init() {
        Task {
            await loadCoupons()
        }
    }

    // MARK: - Data Loading

    func loadCoupons() async {
        guard let businessId = try? await KeychainManager.shared.getBusinessId() else {
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            coupons = try await repository.getCoupons(businessId)
            activeCoupons = repository.getActiveCoupons()
            expiredCoupons = repository.getExpiredCoupons()

            analyticsService.trackScreen("Coupons")

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func refreshCoupons() async {
        await loadCoupons()
    }

    // MARK: - Coupon Management

    func createCoupon(
        code: String,
        discountType: DiscountType,
        discountValue: Int,
        maxDiscount: Double?,
        minOrderValue: Double,
        validUntil: Date?,
        usageLimitType: UsageLimitType,
        totalUsageLimit: Int?
    ) async {
        guard let businessId = try? await KeychainManager.shared.getBusinessId() else {
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            let maxDiscountCents = maxDiscount.map { Int($0 * 100) }
            let minOrderValueCents = Int(minOrderValue * 100)
            let validUntilString = validUntil.map { ISO8601DateFormatter().string(from: $0) }

            let coupon = try await repository.createCoupon(
                businessId: businessId,
                code: code.uppercased(),
                discountType: discountType,
                discountValue: discountValue,
                maxDiscountCents: maxDiscountCents,
                minOrderValueCents: minOrderValueCents,
                validUntil: validUntilString,
                usageLimitType: usageLimitType,
                totalUsageLimit: totalUsageLimit
            )

            coupons.append(coupon)
            activeCoupons = repository.getActiveCoupons()

            analyticsService.track(.couponCreated, parameters: [
                "code": code,
                "discount_type": discountType.rawValue,
                "discount_value": discountValue
            ])

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func updateCoupon(
        _ couponId: String,
        discountValue: Int?,
        maxDiscount: Double?,
        minOrderValue: Double?,
        validUntil: Date?,
        isActive: Bool?
    ) async {
        isLoading = true
        errorMessage = nil

        do {
            let maxDiscountCents = maxDiscount.map { Int($0 * 100) }
            let minOrderValueCents = minOrderValue.map { Int($0 * 100) }
            let validUntilString = validUntil.map { ISO8601DateFormatter().string(from: $0) }

            let coupon = try await repository.updateCoupon(
                couponId,
                discountValue: discountValue,
                maxDiscountCents: maxDiscountCents,
                minOrderValueCents: minOrderValueCents,
                validUntil: validUntilString,
                isActive: isActive
            )

            if let index = coupons.firstIndex(where: { $0.id == couponId }) {
                coupons[index] = coupon
            }

            activeCoupons = repository.getActiveCoupons()
            expiredCoupons = repository.getExpiredCoupons()

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func deleteCoupon(_ couponId: String) async {
        isLoading = true

        do {
            try await repository.deleteCoupon(couponId)

            coupons.removeAll { $0.id == couponId }
            activeCoupons = repository.getActiveCoupons()
            expiredCoupons = repository.getExpiredCoupons()

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func toggleCouponStatus(_ couponId: String) async {
        guard let coupon = coupons.first(where: { $0.id == couponId }) else {
            return
        }

        await updateCoupon(couponId, discountValue: nil, maxDiscount: nil,
                          minOrderValue: nil, validUntil: nil, isActive: !coupon.isActive)
    }

    // MARK: - Validation

    func validateCoupon(_ code: String) async -> Coupon? {
        do {
            return try await repository.validateCoupon(code)
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }

    func calculateDiscount(coupon: Coupon, orderValue: Double) -> Double {
        repository.calculateDiscount(coupon: coupon, orderValue: orderValue)
    }

    // MARK: - Statistics

    func getTotalCoupons() -> Int {
        coupons.count
    }

    func getActiveCouponsCount() -> Int {
        activeCoupons.count
    }

    func getExpiredCouponsCount() -> Int {
        expiredCoupons.count
    }

    // MARK: - Error Handling

    func clearError() {
        errorMessage = nil
    }
}
