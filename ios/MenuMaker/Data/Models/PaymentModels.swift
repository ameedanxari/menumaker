import Foundation

// MARK: - Payment Processor Models

struct PaymentProcessor: Codable, Identifiable {
    let id: String
    let businessId: String
    let provider: String
    let isActive: Bool
    let accountId: String?
    let createdAt: String

    var providerType: PaymentProvider {
        PaymentProvider(rawValue: provider) ?? .razorpay
    }

    var displayName: String {
        providerType.displayName
    }

    var icon: String {
        providerType.icon
    }
}

struct PaymentProcessorResponse: Decodable {
    let success: Bool
    let data: PaymentProcessorData
}

struct PaymentProcessorData: Decodable {
    let processor: PaymentProcessor
    let authorizationUrl: String?
}

struct PaymentProcessorListResponse: Decodable {
    let success: Bool
    let data: PaymentProcessorListData
}

struct PaymentProcessorListData: Decodable {
    let processors: [PaymentProcessor]
}

// MARK: - Payout Models

struct Payout: Codable, Identifiable {
    let id: String
    let businessId: String
    let amountCents: Int
    let status: String
    let scheduledFor: String?
    let processedAt: String?
    let createdAt: String

    var amount: Double {
        Double(amountCents) / 100.0
    }

    var formattedAmount: String {
        String(format: "₹%.2f", amount)
    }

    var statusType: PayoutStatus {
        PayoutStatus(rawValue: status) ?? .pending
    }

    var formattedScheduledDate: String? {
        guard let scheduledFor = scheduledFor,
              let date = ISO8601DateFormatter().date(from: scheduledFor) else {
            return nil
        }

        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: date)
    }

    var formattedProcessedDate: String? {
        guard let processedAt = processedAt,
              let date = ISO8601DateFormatter().date(from: processedAt) else {
            return nil
        }

        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

struct PayoutSchedule: Codable, Identifiable {
    let id: String
    let businessId: String
    let frequency: String
    let minimumThresholdCents: Int
    let autoPayoutEnabled: Bool

    var minimumThreshold: Double {
        Double(minimumThresholdCents) / 100.0
    }

    var formattedMinimumThreshold: String {
        String(format: "₹%.2f", minimumThreshold)
    }

    var frequencyType: PayoutFrequency {
        PayoutFrequency(rawValue: frequency) ?? .weekly
    }
}

struct PayoutListResponse: Decodable {
    let success: Bool
    let data: PayoutListData
}

struct PayoutListData: Decodable {
    let payouts: [Payout]
    let schedule: PayoutSchedule?
}

// MARK: - Payment Provider

enum PaymentProvider: String, Codable, CaseIterable {
    case razorpay
    case stripe
    case paytm
    case phonepe

    var displayName: String {
        switch self {
        case .razorpay: return "Razorpay"
        case .stripe: return "Stripe"
        case .paytm: return "Paytm"
        case .phonepe: return "PhonePe"
        }
    }

    var icon: String {
        switch self {
        case .razorpay: return "creditcard.fill"
        case .stripe: return "creditcard"
        case .paytm: return "indianrupeesign.circle.fill"
        case .phonepe: return "phone.fill"
        }
    }
}

// MARK: - Payout Status

enum PayoutStatus: String, Codable, CaseIterable {
    case pending
    case scheduled
    case processing
    case completed
    case failed

    var displayName: String {
        rawValue.capitalized
    }
}

// MARK: - Payout Frequency

enum PayoutFrequency: String, Codable, CaseIterable {
    case daily
    case weekly
    case monthly

    var displayName: String {
        rawValue.capitalized
    }
}
