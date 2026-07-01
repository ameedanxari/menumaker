import Foundation
import Combine

/// Referral repository
@MainActor
class ReferralRepository: ObservableObject {
    static let shared = ReferralRepository()

    private let apiClient = APIClient.shared

    @Published var stats: ReferralStats?
    @Published var leaderboard: [ReferralLeaderboard] = []

    private init() {}

    private static let unsafeTextScalarValues: Set<UInt32> = {
        Set((Array(0x0000...0x0008)
            + [0x000B, 0x000C]
            + Array(0x000E...0x001F)
            + Array(0x007F...0x009F)
            + Array(0x200B...0x200F)
            + Array(0x202A...0x202E)
            + Array(0x2060...0x206F)
            + [0xFEFF]).map(UInt32.init))
    }()

    enum BoundaryError: LocalizedError, Equatable {
        case required(String)
        case tooLong(String, Int)
        case unsafeControlCharacters(String)
        case negativeValue(String)
        case exceedsCounter(String, String)

        var errorDescription: String? {
            switch self {
            case .required(let label):
                return "\(label) is required"
            case .tooLong(let label, let maxLength):
                return "\(label) must be \(maxLength) characters or fewer"
            case .unsafeControlCharacters(let label):
                return "\(label) contains unsafe control characters"
            case .negativeValue(let label):
                return "\(label) must be non-negative"
            case .exceedsCounter(let label, let maxLabel):
                return "\(label) must not exceed \(maxLabel)"
            }
        }
    }

    static func normalizeReferralText(_ label: String, _ value: String, maxLength: Int) throws -> String {
        guard !containsUnsafeTextScalar(value) else {
            throw BoundaryError.unsafeControlCharacters(label)
        }
        let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else {
            throw BoundaryError.required(label)
        }
        guard normalized.count <= maxLength else {
            throw BoundaryError.tooLong(label, maxLength)
        }
        return normalized
    }

    private static func containsUnsafeTextScalar(_ value: String) -> Bool {
        value.unicodeScalars.contains { unsafeTextScalarValues.contains($0.value) }
    }

    private static func requireNonNegative(_ label: String, _ value: Int) throws -> Int {
        guard value >= 0 else {
            throw BoundaryError.negativeValue(label)
        }
        return value
    }

    private static func requireNotGreaterThan(_ label: String, _ value: Int, maxLabel: String, maxValue: Int) throws -> Int {
        guard value <= maxValue else {
            throw BoundaryError.exceedsCounter(label, maxLabel)
        }
        return value
    }

    static func launchGatedStats(from stats: ReferralStats) throws -> ReferralStats {
        let totalReferrals = try requireNonNegative("Total referrals", stats.totalReferrals)
        let successfulReferrals = try requireNotGreaterThan(
            "Successful referrals",
            try requireNonNegative("Successful referrals", stats.successfulReferrals),
            maxLabel: "total referrals",
            maxValue: totalReferrals
        )
        let pendingReferrals = try requireNotGreaterThan(
            "Pending referrals",
            try requireNonNegative("Pending referrals", stats.pendingReferrals),
            maxLabel: "total referrals",
            maxValue: totalReferrals
        )
        let monthlyReferrals = try requireNotGreaterThan(
            "Monthly referrals",
            try requireNonNegative("Monthly referrals", stats.monthlyReferrals),
            maxLabel: "total referrals",
            maxValue: totalReferrals
        )

        return ReferralStats(
            totalReferrals: totalReferrals,
            successfulReferrals: successfulReferrals,
            pendingReferrals: pendingReferrals,
            monthlyReferrals: monthlyReferrals,
            totalEarningsCents: 0,
            availableCreditsCents: 0,
            pendingRewardsCents: 0,
            referralCode: try normalizeReferralText("Referral code", stats.referralCode, maxLength: 64),
            leaderboardPosition: nil
        )
    }

    static func launchGatedHistory(_ referral: ReferralHistory) throws -> ReferralHistory {
        ReferralHistory(
            id: try normalizeReferralText("Referral ID", referral.id, maxLength: 255),
            referredUserName: try normalizeReferralText("Referred user name", referral.referredUserName, maxLength: 255),
            referredAt: referral.referredAt,
            status: referral.status,
            rewardCents: 0
        )
    }

    // MARK: - Fetch Operations

    func getReferralStats() async throws -> ReferralStatsData {
        let response: ReferralStatsResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.referrals + "/stats",
            method: .get
        )

        let gatedStats = try Self.launchGatedStats(from: response.data.stats)
        stats = gatedStats
        leaderboard = []

        return ReferralStatsData(stats: gatedStats, leaderboard: [])
    }

    func getReferralHistory() async throws -> [ReferralHistory] {
        let response: ReferralHistoryResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.referrals + "/history",
            method: .get
        )

        return try response.data.referrals.map(Self.launchGatedHistory)
    }

    func applyReferralCode(_ code: String) async throws -> ApplyReferralResponse {
        struct ApplyCodeRequest: Encodable {
            let code: String
        }

        let normalizedCode = try Self.normalizeReferralText("Referral code", code, maxLength: 64)

        let response: ApplyReferralResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.referrals + "/apply",
            method: .post,
            body: ApplyCodeRequest(code: normalizedCode)
        )

        return response
    }

    func validateReferralCode(_ code: String) async throws -> Bool {
        do {
            let normalizedCode = try Self.normalizeReferralText("Referral code", code, maxLength: 64)
            let encodedCode = normalizedCode.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? normalizedCode

            struct ValidateResponse: Decodable {
                let success: Bool
                let valid: Bool
            }

            let response: ValidateResponse = try await apiClient.request(
                endpoint: AppConstants.API.Endpoints.referralCode(encodedCode),
                method: .get
            )

            return response.valid
        } catch {
            return false
        }
    }

    // MARK: - Sharing

    func getReferralLink() -> String? {
        guard let code = stats?.referralCode,
              let normalizedCode = try? Self.normalizeReferralText("Referral code", code, maxLength: 64),
              let encodedCode = normalizedCode.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) else {
            return nil
        }
        return "https://menumaker.app/signup?ref=\(encodedCode)"
    }

    func shareReferralCode() -> String? {
        guard let code = stats?.referralCode,
              let normalizedCode = try? Self.normalizeReferralText("Referral code", code, maxLength: 64) else {
            return nil
        }

        let message = """
        Join MenuMaker and get started with your restaurant business!
        Use my referral code: \(normalizedCode)

        \(getReferralLink() ?? "https://menumaker.app")
        """

        return message
    }

    // MARK: - Statistics

    func getTopReferrers(count: Int = 10) -> [ReferralLeaderboard] {
        []
    }

    func getCurrentUserRank() -> Int? {
        nil
    }

    func getTotalEarnings() -> Double {
        0.0
    }

    func getSuccessRate() -> Double {
        stats?.successRate ?? 0.0
    }
}
