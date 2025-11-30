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

    struct CreateCouponParams {
        let code: String
        let discountType: DiscountType
        let discountValue: Int
        let maxDiscount: Double?
        let minOrderValue: Double
        let validUntil: Date?
        let usageLimitType: UsageLimitType
        let totalUsageLimit: Int?
    }

    func createCoupon(_ params: CreateCouponParams) async {
        guard let businessId = try? await KeychainManager.shared.getBusinessId() else {
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            let maxDiscountCents = params.maxDiscount.map { Int($0 * 100) }
            let minOrderValueCents = Int(params.minOrderValue * 100)
            let validUntilString = params.validUntil.map { ISO8601DateFormatter().string(from: $0) }

            _ = try await repository.createCoupon(
                businessId: businessId,
                code: params.code.uppercased(),
                discountType: params.discountType,
                discountValue: params.discountValue,
                maxDiscountCents: maxDiscountCents,
                minOrderValueCents: minOrderValueCents,
                validUntil: validUntilString,
                usageLimitType: params.usageLimitType,
                totalUsageLimit: params.totalUsageLimit
            )

            // Refresh all coupon lists from repository to ensure UI updates
            coupons = repository.coupons
            activeCoupons = repository.getActiveCoupons()
            expiredCoupons = repository.getExpiredCoupons()

            // Force UI update by explicitly notifying observers
            objectWillChange.send()

            analyticsService.track(.couponCreated, parameters: [
                "code": params.code,
                "discount_type": params.discountType.rawValue,
                "discount_value": params.discountValue
            ])

            // Ensure full refresh
            await loadCoupons()

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    struct UpdateCouponParams {
        let couponId: String
        let discountValue: Int?
        let maxDiscount: Double?
        let minOrderValue: Double?
        let validUntil: Date?
        let isActive: Bool?

        init(
            couponId: String,
            discountValue: Int? = nil,
            maxDiscount: Double? = nil,
            minOrderValue: Double? = nil,
            validUntil: Date? = nil,
            isActive: Bool? = nil
        ) {
            self.couponId = couponId
            self.discountValue = discountValue
            self.maxDiscount = maxDiscount
            self.minOrderValue = minOrderValue
            self.validUntil = validUntil
            self.isActive = isActive
        }
    }

    func updateCoupon(_ params: UpdateCouponParams) async {
        isLoading = true
        errorMessage = nil

        do {
            let maxDiscountCents = params.maxDiscount.map { Int($0 * 100) }
            let minOrderValueCents = params.minOrderValue.map { Int($0 * 100) }
            let validUntilString = params.validUntil.map { ISO8601DateFormatter().string(from: $0) }

            let coupon = try await repository.updateCoupon(
                params.couponId,
                discountValue: params.discountValue,
                maxDiscountCents: maxDiscountCents,
                minOrderValueCents: minOrderValueCents,
                validUntil: validUntilString,
                isActive: params.isActive
            )

            if let index = coupons.firstIndex(where: { $0.id == params.couponId }) {
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

        await updateCoupon(UpdateCouponParams(
            couponId: couponId,
            isActive: !coupon.isActive
        ))
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
