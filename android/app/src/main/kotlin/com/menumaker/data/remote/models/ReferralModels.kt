package com.menumaker.data.remote.models

import com.google.gson.annotations.SerializedName

// MARK: - Referral Status

enum class ReferralStatus(val value: String) {
    @SerializedName("pending")
    PENDING("pending"),

    @SerializedName("completed")
    COMPLETED("completed"),

    @SerializedName("credited")
    CREDITED("credited"),

    @SerializedName("expired")
    EXPIRED("expired");

    val displayName: String
        get() = when (this) {
            PENDING -> "Pending"
            COMPLETED -> "Completed"
            CREDITED -> "Credited"
            EXPIRED -> "Expired"
        }
}

// MARK: - Referral Models

data class ReferralStatsDto(
    @SerializedName("total_referrals") val totalReferrals: Int,
    @SerializedName("successful_referrals") val successfulReferrals: Int,
    @SerializedName("pending_referrals") val pendingReferrals: Int,
    @SerializedName("monthly_referrals") val monthlyReferrals: Int,
    @SerializedName("total_earnings_cents") val totalEarningsCents: Int,
    @SerializedName("available_credits_cents") val availableCreditsCents: Int,
    @SerializedName("pending_rewards_cents") val pendingRewardsCents: Int,
    @SerializedName("referral_code") val referralCode: String,
    @SerializedName("leaderboard_position") val leaderboardPosition: Int?
) {
    val totalEarnings: Double
        get() = totalEarningsCents / 100.0

    val availableCredits: Double
        get() = availableCreditsCents / 100.0

    val pendingRewards: Double
        get() = pendingRewardsCents / 100.0

    val successRate: Double
        get() = if (totalReferrals > 0) {
            (successfulReferrals.toDouble() / totalReferrals) * 100
        } else 0.0

    val leaderboardDisplay: String
        get() = leaderboardPosition?.let { "#$it" } ?: "Not ranked"
}

data class ReferralLeaderboardDto(
    @SerializedName("rank") val rank: Int,
    @SerializedName("user_name") val userName: String,
    @SerializedName("referral_count") val referralCount: Int,
    @SerializedName("earnings_cents") val earningsCents: Int
)

data class ReferralStatsResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: ReferralStatsData
)

data class ReferralStatsData(
    @SerializedName("stats") val stats: ReferralStatsDto,
    @SerializedName("leaderboard") val leaderboard: List<ReferralLeaderboardDto>
)

data class ReferralHistoryDto(
    @SerializedName("id") val id: String,
    @SerializedName("referred_user_name") val referredUserName: String,
    @SerializedName("referred_at") val referredAt: String,
    @SerializedName("status") val status: ReferralStatus,
    @SerializedName("reward_cents") val rewardCents: Int
) {
    val reward: Double
        get() = rewardCents / 100.0

    val formattedReward: String
        get() = String.format("₹%.2f", reward)

    val rewardAmountCents: Int
        get() = rewardCents

    val createdAt: String
        get() = referredAt
}

data class ReferralHistoryResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: ReferralHistoryData
)

data class ReferralHistoryData(
    @SerializedName("referrals") val referrals: List<ReferralHistoryDto>
)

data class ApplyReferralResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("message") val message: String?
)

// Integrations
data class IntegrationDto(
    @SerializedName("id") val id: String,
    @SerializedName("business_id") val businessId: String,
    @SerializedName("provider") val provider: String,
    @SerializedName("type") val type: String, // "pos" or "delivery"
    @SerializedName("is_active") val isActive: Boolean,
    @SerializedName("last_sync_at") val lastSyncAt: String?,
    @SerializedName("created_at") val createdAt: String
)

data class IntegrationListResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: IntegrationListData
)

data class IntegrationListData(
    @SerializedName("integrations") val integrations: List<IntegrationDto>
)
