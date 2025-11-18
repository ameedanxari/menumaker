import Foundation
import SwiftUI

// MARK: - Referral Status

enum ReferralStatus: String, Codable {
    case pending = "pending"
    case completed = "completed"
    case expired = "expired"

    var displayName: String {
        switch self {
        case .pending: return "Pending"
        case .completed: return "Completed"
        case .expired: return "Expired"
        }
    }

    var color: Color {
        switch self {
        case .pending: return .orange
        case .completed: return .green
        case .expired: return .gray
        }
    }
}

// MARK: - Referral Models

struct ReferralStats: Codable {
    let totalReferrals: Int
    let successfulReferrals: Int
    let pendingReferrals: Int
    let monthlyReferrals: Int
    let totalEarningsCents: Int
    let availableCreditsCents: Int
    let pendingRewardsCents: Int
    let referralCode: String
    let leaderboardPosition: Int?

    var totalEarnings: Double {
        Double(totalEarningsCents) / 100.0
    }

    var formattedEarnings: String {
        String(format: "₹%.2f", totalEarnings)
    }

    var availableCredits: Double {
        Double(availableCreditsCents) / 100.0
    }

    var formattedAvailableCredits: String {
        String(format: "₹%.2f", availableCredits)
    }

    var pendingRewards: Double {
        Double(pendingRewardsCents) / 100.0
    }

    var formattedPendingRewards: String {
        String(format: "₹%.2f", pendingRewards)
    }

    var successRate: Double {
        guard totalReferrals > 0 else { return 0 }
        return Double(successfulReferrals) / Double(totalReferrals) * 100
    }

    var formattedSuccessRate: String {
        String(format: "%.1f%%", successRate)
    }

    var leaderboardDisplay: String {
        guard let position = leaderboardPosition else {
            return "Not ranked"
        }
        return "#\(position)"
    }
}

struct ReferralLeaderboard: Codable, Identifiable {
    let rank: Int
    let userName: String
    let referralCount: Int
    let earningsCents: Int

    var id: Int { rank }

    var earnings: Double {
        Double(earningsCents) / 100.0
    }

    var formattedEarnings: String {
        String(format: "₹%.2f", earnings)
    }

    var medalEmoji: String {
        switch rank {
        case 1: return "🥇"
        case 2: return "🥈"
        case 3: return "🥉"
        default: return ""
        }
    }
}

struct ReferralStatsResponse: Decodable {
    let success: Bool
    let data: ReferralStatsData
}

struct ReferralStatsData: Decodable {
    let stats: ReferralStats
    let leaderboard: [ReferralLeaderboard]
}

struct ReferralHistory: Codable, Identifiable {
    let id: String
    let referredUserName: String
    let referredAt: Date
    let status: ReferralStatus
    let rewardCents: Int

    var reward: Double {
        Double(rewardCents) / 100.0
    }

    var formattedReward: String {
        String(format: "₹%.2f", reward)
    }

    var formattedDate: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .full
        return formatter.localizedString(for: referredAt, relativeTo: Date())
    }

    var rewardAmountCents: Int {
        rewardCents
    }

    enum CodingKeys: String, CodingKey {
        case id
        case referredUserName = "referred_user_name"
        case referredAt = "referred_at"
        case status
        case rewardCents = "reward_cents"
    }
}

struct ReferralHistoryResponse: Decodable {
    let success: Bool
    let data: ReferralHistoryData
}

struct ReferralHistoryData: Decodable {
    let referrals: [ReferralHistory]
}

struct ApplyReferralResponse: Decodable {
    let success: Bool
    let message: String?
}

// MARK: - Integration Models

struct Integration: Codable, Identifiable {
    let id: String
    let businessId: String
    let provider: String
    let type: String
    let isActive: Bool
    let lastSyncAt: String?
    let createdAt: String

    var integrationType: IntegrationType {
        IntegrationType(rawValue: type) ?? .pos
    }

    var providerType: IntegrationProvider {
        IntegrationProvider(rawValue: provider)
    }

    var displayName: String {
        providerType.displayName
    }

    var icon: String {
        providerType.icon
    }

    var formattedLastSync: String? {
        guard let lastSyncAt = lastSyncAt,
              let date = ISO8601DateFormatter().date(from: lastSyncAt) else {
            return nil
        }

        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

struct IntegrationListResponse: Decodable {
    let success: Bool
    let data: IntegrationListData
}

struct IntegrationListData: Decodable {
    let integrations: [Integration]
}

// MARK: - Integration Type

enum IntegrationType: String, Codable, CaseIterable {
    case pos
    case delivery

    var displayName: String {
        switch self {
        case .pos: return "POS System"
        case .delivery: return "Delivery Service"
        }
    }
}

// MARK: - Integration Provider

enum IntegrationProvider: Codable, Equatable {
    case petpooja
    case zomato
    case swiggy
    case dunzo
    case other(String)

    init(rawValue: String) {
        switch rawValue.lowercased() {
        case "petpooja": self = .petpooja
        case "zomato": self = .zomato
        case "swiggy": self = .swiggy
        case "dunzo": self = .dunzo
        default: self = .other(rawValue)
        }
    }

    var rawValue: String {
        switch self {
        case .petpooja: return "petpooja"
        case .zomato: return "zomato"
        case .swiggy: return "swiggy"
        case .dunzo: return "dunzo"
        case .other(let value): return value
        }
    }

    var displayName: String {
        switch self {
        case .petpooja: return "Petpooja"
        case .zomato: return "Zomato"
        case .swiggy: return "Swiggy"
        case .dunzo: return "Dunzo"
        case .other(let value): return value
        }
    }

    var icon: String {
        switch self {
        case .petpooja: return "cart.fill"
        case .zomato: return "fork.knife"
        case .swiggy: return "bag.fill"
        case .dunzo: return "bicycle"
        case .other: return "link"
        }
    }
}
