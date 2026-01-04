import Foundation

// MARK: - Coupon Models

struct Coupon: Codable, Identifiable {
    let id: String
    let businessId: String
    let code: String
    let discountType: String
    let discountValue: Int
    let maxDiscountCents: Int?
    let minOrderValueCents: Int
    let validUntil: String?
    let usageLimitType: String
    let totalUsageLimit: Int?
    let isActive: Bool
    let createdAt: String

    var discountTypeEnum: DiscountType {
        DiscountType(rawValue: discountType) ?? .percentage
    }

    var formattedDiscount: String {
        switch discountTypeEnum {
        case .percentage:
            return "\(discountValue)% off"
        case .fixed:
            let amount = Double(discountValue) / 100.0
            return String(format: "₹%.2f off", amount)
        }
    }

    var minOrderValue: Double {
        Double(minOrderValueCents) / 100.0
    }

    var formattedMinOrder: String {
        String(format: "₹%.2f", minOrderValue)
    }

    var maxDiscount: Double? {
        guard let maxCents = maxDiscountCents else { return nil }
        return Double(maxCents) / 100.0
    }

    var formattedMaxDiscount: String? {
        guard let max = maxDiscount else { return nil }
        return String(format: "₹%.2f", max)
    }

    var isExpired: Bool {
        guard let validUntil = validUntil,
              let date = ISO8601DateFormatter().date(from: validUntil) else {
            return false
        }
        return date < Date()
    }

    var formattedValidUntil: String? {
        guard let validUntil = validUntil,
              let date = ISO8601DateFormatter().date(from: validUntil) else {
            return nil
        }

        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: date)
    }
}

struct CouponResponse: Decodable {
    let success: Bool
    let data: CouponData
}

struct CouponData: Decodable {
    let coupon: Coupon
}

struct CouponListResponse: Decodable {
    let success: Bool
    let data: CouponListData
}

struct CouponListData: Decodable {
    let coupons: [Coupon]
}

struct ValidateCouponRequest: Encodable {
    let couponCode: String
    let businessId: String
    let orderSubtotalCents: Int
    let dishIds: [String]
}

struct ValidatedCouponData: Decodable {
    let valid: Bool
    let discountAmountCents: Int
    let discountAmount: Double
    let coupon: Coupon
}

struct ValidateCouponResponse: Decodable {
    let success: Bool
    let data: ValidatedCouponData
}

struct CreateCouponRequest: Encodable {
    let businessId: String
    let code: String
    let discountType: String
    let discountValue: Int
    let maxDiscountCents: Int?
    let minOrderValueCents: Int
    let validUntil: String?
    let usageLimitType: String
    let totalUsageLimit: Int?
}

struct UpdateCouponRequest: Encodable {
    let discountValue: Int?
    let maxDiscountCents: Int?
    let minOrderValueCents: Int?
    let validUntil: String?
    let isActive: Bool?
}

// MARK: - Discount Type

enum DiscountType: String, Codable, CaseIterable {
    case percentage
    case fixed

    var displayName: String {
        switch self {
        case .percentage: return "Percentage"
        case .fixed: return "Fixed Amount"
        }
    }
}

// MARK: - Usage Limit Type

enum UsageLimitType: String, Codable, CaseIterable {
    case unlimited
    case total
    case perUser = "per_user"

    var displayName: String {
        switch self {
        case .unlimited: return "Unlimited"
        case .total: return "Total Usage Limit"
        case .perUser: return "Per User Limit"
        }
    }
}
