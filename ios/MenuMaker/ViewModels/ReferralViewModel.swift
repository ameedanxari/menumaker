import Foundation
import Combine

/// Referral management view model
@MainActor
class ReferralViewModel: ObservableObject {
    @Published var stats: ReferralStats?
    @Published var leaderboard: [ReferralLeaderboard] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let repository = ReferralRepository.shared
    private let analyticsService = AnalyticsService.shared

    init() {
        Task {
            await loadReferralData()
        }
    }

    // MARK: - Data Loading

    func loadReferralData() async {
        isLoading = true
        errorMessage = nil

        do {
            let data = try await repository.getReferralStats()
            stats = data.stats
            leaderboard = data.leaderboard

            analyticsService.trackScreen("Referrals")

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func refreshData() async {
        await loadReferralData()
    }

    // MARK: - Referral Code

    func getReferralCode() -> String? {
        stats?.referralCode
    }

    func getReferralLink() -> String? {
        repository.getReferralLink()
    }

    func getShareMessage() -> String? {
        repository.shareReferralCode()
    }

    // MARK: - Statistics

    func getTotalReferrals() -> Int {
        stats?.totalReferrals ?? 0
    }

    func getSuccessfulReferrals() -> Int {
        stats?.successfulReferrals ?? 0
    }

    func getPendingReferrals() -> Int {
        stats?.pendingReferrals ?? 0
    }

    func getTotalEarnings() -> Double {
        repository.getTotalEarnings()
    }

    func getFormattedEarnings() -> String {
        stats?.formattedEarnings ?? "₹0.00"
    }

    func getSuccessRate() -> Double {
        repository.getSuccessRate()
    }

    func getFormattedSuccessRate() -> String {
        stats?.formattedSuccessRate ?? "0%"
    }

    func getLeaderboardPosition() -> String {
        stats?.leaderboardDisplay ?? "Not ranked"
    }

    // MARK: - Leaderboard

    func getTopReferrers(count: Int = 10) -> [ReferralLeaderboard] {
        repository.getTopReferrers(count: count)
    }

    func getCurrentUserRank() -> Int? {
        repository.getCurrentUserRank()
    }

    func isInTopTen() -> Bool {
        guard let rank = getCurrentUserRank() else { return false }
        return rank <= 10
    }

    // MARK: - Validation

    func validateReferralCode(_ code: String) async -> Bool {
        do {
            return try await repository.validateReferralCode(code)
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    // MARK: - Error Handling

    func clearError() {
        errorMessage = nil
    }
}
