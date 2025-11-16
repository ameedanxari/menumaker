package com.menumaker.data.remote.models

import com.google.gson.annotations.SerializedName

// Referrals
data class ReferralStatsDto(
    @SerializedName("total_referrals") val totalReferrals: Int,
    @SerializedName("successful_referrals") val successfulReferrals: Int,
    @SerializedName("pending_referrals") val pendingReferrals: Int,
    @SerializedName("total_earnings_cents") val totalEarningsCents: Int,
    @SerializedName("referral_code") val referralCode: String,
    @SerializedName("leaderboard_position") val leaderboardPosition: Int?
)

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
