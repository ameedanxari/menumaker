import Foundation

/// Referral repository
@MainActor
class ReferralRepository: ObservableObject {
    static let shared = ReferralRepository()

    private let apiClient = APIClient.shared

    @Published var stats: ReferralStats?
    @Published var leaderboard: [ReferralLeaderboard] = []

    private init() {}

    // MARK: - Fetch Operations

    func getReferralStats() async throws -> ReferralStatsData {
        let response: ReferralStatsResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.referrals + "/stats",
            method: .get
        )

        stats = response.data.stats
        leaderboard = response.data.leaderboard

        return response.data
    }

    func validateReferralCode(_ code: String) async throws -> Bool {
        do {
            struct ValidateResponse: Decodable {
                let success: Bool
                let valid: Bool
            }

            let response: ValidateResponse = try await apiClient.request(
                endpoint: AppConstants.API.Endpoints.referralCode(code),
                method: .get
            )

            return response.valid
        } catch {
            return false
        }
    }

    // MARK: - Sharing

    func getReferralLink() -> String? {
        guard let code = stats?.referralCode else { return nil }
        return "https://menumaker.app/signup?ref=\(code)"
    }

    func shareReferralCode() -> String? {
        guard let code = stats?.referralCode else { return nil }

        let message = """
        Join MenuMaker and get started with your restaurant business!
        Use my referral code: \(code)

        \(getReferralLink() ?? "https://menumaker.app")
        """

        return message
    }

    // MARK: - Statistics

    func getTopReferrers(count: Int = 10) -> [ReferralLeaderboard] {
        Array(leaderboard.prefix(count))
    }

    func getCurrentUserRank() -> Int? {
        stats?.leaderboardPosition
    }

    func getTotalEarnings() -> Double {
        stats?.totalEarnings ?? 0.0
    }

    func getSuccessRate() -> Double {
        stats?.successRate ?? 0.0
    }
}
