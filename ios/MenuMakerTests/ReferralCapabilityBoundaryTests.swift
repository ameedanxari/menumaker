import Foundation
import Testing
@testable import MenuMaker

@MainActor
struct ReferralCapabilityBoundaryTests {
    @Test("Referral repository suppresses enhanced leaderboard and reward signals")
    func repositorySuppressesEnhancedReferralSignals() {
        let repository = ReferralRepository.shared
        defer {
            repository.stats = nil
            repository.leaderboard = []
        }

        repository.stats = ReferralStats(
            totalReferrals: 10,
            successfulReferrals: 8,
            pendingReferrals: 2,
            monthlyReferrals: 4,
            totalEarningsCents: 50_000,
            availableCreditsCents: 30_000,
            pendingRewardsCents: 20_000,
            referralCode: "REF-123",
            leaderboardPosition: 1
        )
        repository.leaderboard = [
            ReferralLeaderboard(rank: 1, userName: "Seller", referralCount: 8, earningsCents: 50_000)
        ]

        #expect(repository.getTopReferrers().isEmpty)
        #expect(repository.getCurrentUserRank() == nil)
        #expect(repository.getTotalEarnings() == 0.0)
        #expect(repository.getSuccessRate() == 80.0)
    }

    @Test("Referral repository sanitizes stats and rejects unsafe referral codes")
    func repositorySanitizesStatsAndRejectsUnsafeCodes() throws {
        let rawStats = ReferralStats(
            totalReferrals: 10,
            successfulReferrals: 8,
            pendingReferrals: 2,
            monthlyReferrals: 4,
            totalEarningsCents: 50_000,
            availableCreditsCents: 30_000,
            pendingRewardsCents: 20_000,
            referralCode: " REF-123 ",
            leaderboardPosition: 1
        )

        let gatedStats = try ReferralRepository.launchGatedStats(from: rawStats)

        #expect(gatedStats.referralCode == "REF-123")
        #expect(gatedStats.totalEarningsCents == 0)
        #expect(gatedStats.availableCreditsCents == 0)
        #expect(gatedStats.pendingRewardsCents == 0)
        #expect(gatedStats.leaderboardPosition == nil)

        let unsafeStats = ReferralStats(
            totalReferrals: 10,
            successfulReferrals: 8,
            pendingReferrals: 2,
            monthlyReferrals: 4,
            totalEarningsCents: 0,
            availableCreditsCents: 0,
            pendingRewardsCents: 0,
            referralCode: "REF\u{0000}123",
            leaderboardPosition: nil
        )

        #expect(throws: ReferralRepository.BoundaryError.unsafeControlCharacters("Referral code")) {
            try ReferralRepository.launchGatedStats(from: unsafeStats)
        }

        let unsafeBidiStats = ReferralStats(
            totalReferrals: 10,
            successfulReferrals: 8,
            pendingReferrals: 2,
            monthlyReferrals: 4,
            totalEarningsCents: 0,
            availableCreditsCents: 0,
            pendingRewardsCents: 0,
            referralCode: "REF\u{202E}123",
            leaderboardPosition: nil
        )

        #expect(throws: ReferralRepository.BoundaryError.unsafeControlCharacters("Referral code")) {
            try ReferralRepository.launchGatedStats(from: unsafeBidiStats)
        }
    }

    @Test("Referral repository rejects negative stat counters")
    func repositoryRejectsNegativeStatCounters() {
        let rawStats = ReferralStats(
            totalReferrals: -1,
            successfulReferrals: 0,
            pendingReferrals: 0,
            monthlyReferrals: 0,
            totalEarningsCents: 0,
            availableCreditsCents: 0,
            pendingRewardsCents: 0,
            referralCode: "REF-123",
            leaderboardPosition: nil
        )

        #expect(throws: ReferralRepository.BoundaryError.negativeValue("Total referrals")) {
            try ReferralRepository.launchGatedStats(from: rawStats)
        }
    }

    @Test("Referral repository rejects impossible stat counters")
    func repositoryRejectsImpossibleStatCounters() {
        let rawStats = ReferralStats(
            totalReferrals: 3,
            successfulReferrals: 4,
            pendingReferrals: 1,
            monthlyReferrals: 2,
            totalEarningsCents: 0,
            availableCreditsCents: 0,
            pendingRewardsCents: 0,
            referralCode: "REF-123",
            leaderboardPosition: nil
        )

        #expect(throws: ReferralRepository.BoundaryError.exceedsCounter("Successful referrals", "total referrals")) {
            try ReferralRepository.launchGatedStats(from: rawStats)
        }
    }

    @Test("Referral repository sanitizes history while suppressing reward cents")
    func repositorySanitizesHistoryAndSuppressesRewards() throws {
        let history = ReferralHistory(
            id: " ref-1 ",
            referredUserName: " Customer ",
            referredAt: Date(timeIntervalSince1970: 1_700_000_000),
            status: .completed,
            rewardCents: 50_000
        )

        let gatedHistory = try ReferralRepository.launchGatedHistory(history)

        #expect(gatedHistory.id == "ref-1")
        #expect(gatedHistory.referredUserName == "Customer")
        #expect(gatedHistory.rewardCents == 0)

        let unsafeHistory = ReferralHistory(
            id: "ref-1",
            referredUserName: "Customer\u{0000}Name",
            referredAt: Date(timeIntervalSince1970: 1_700_000_000),
            status: .completed,
            rewardCents: 0
        )

        #expect(throws: ReferralRepository.BoundaryError.unsafeControlCharacters("Referred user name")) {
            try ReferralRepository.launchGatedHistory(unsafeHistory)
        }

        let unsafeZeroWidthHistory = ReferralHistory(
            id: "ref-1",
            referredUserName: "Customer\u{200B}Name",
            referredAt: Date(timeIntervalSince1970: 1_700_000_000),
            status: .completed,
            rewardCents: 0
        )

        #expect(throws: ReferralRepository.BoundaryError.unsafeControlCharacters("Referred user name")) {
            try ReferralRepository.launchGatedHistory(unsafeZeroWidthHistory)
        }
    }

    @Test("Referral sharing refuses unsafe manually injected referral codes")
    func referralSharingRefusesUnsafeManualCodes() {
        let repository = ReferralRepository.shared
        defer {
            repository.stats = nil
            repository.leaderboard = []
        }

        repository.stats = ReferralStats(
            totalReferrals: 1,
            successfulReferrals: 1,
            pendingReferrals: 0,
            monthlyReferrals: 1,
            totalEarningsCents: 0,
            availableCreditsCents: 0,
            pendingRewardsCents: 0,
            referralCode: "REF\u{202E}123",
            leaderboardPosition: nil
        )

        #expect(repository.getReferralLink() == nil)
        #expect(repository.shareReferralCode() == nil)
    }

    @Test("Referral view model keeps enhanced rewards and leaderboard disabled")
    func referralViewModelKeepsEnhancedRewardsDisabled() {
        let viewModel = ReferralViewModel()
        viewModel.stats = ReferralStats(
            totalReferrals: 10,
            successfulReferrals: 8,
            pendingReferrals: 2,
            monthlyReferrals: 4,
            totalEarningsCents: 50_000,
            availableCreditsCents: 30_000,
            pendingRewardsCents: 20_000,
            referralCode: "REF-123",
            leaderboardPosition: 1
        )
        viewModel.leaderboard = [
            ReferralLeaderboard(rank: 1, userName: "Seller", referralCount: 8, earningsCents: 50_000)
        ]

        #expect(viewModel.getTotalEarnings() == 0.0)
        #expect(viewModel.getFormattedEarnings() == "Rewards disabled")
        #expect(viewModel.getLeaderboardPosition() == "Not ranked")
        #expect(viewModel.getTopReferrers().isEmpty)
        #expect(viewModel.getCurrentUserRank() == nil)
        #expect(!viewModel.isInTopTen())
    }
}
