package com.menumaker.data.repository

import com.menumaker.data.common.Resource
import com.menumaker.data.remote.api.ApiService
import com.menumaker.data.remote.models.ApplyReferralResponse
import com.menumaker.data.remote.models.ReferralHistoryDto
import com.menumaker.data.remote.models.ReferralStatsDto
import com.menumaker.data.remote.models.ReferralStatsData
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import javax.inject.Inject

interface ReferralRepository {
    fun getReferralStats(): Flow<Resource<ReferralStatsData>>
    fun getReferralHistory(): Flow<Resource<List<ReferralHistoryDto>>>
    fun applyReferralCode(code: String): Flow<Resource<ApplyReferralResponse>>
}

class ReferralRepositoryImpl @Inject constructor(
    private val apiService: ApiService
) : ReferralRepository {

    private val unsafeTextControls =
        Regex("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F-\\u009F\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u206F\\uFEFF]")

    override fun getReferralStats(): Flow<Resource<ReferralStatsData>> = flow {
        emit(Resource.Loading)
        try {
            val response = apiService.getReferralStats()
            if (response.isSuccessful && response.body() != null) {
                val data = response.body()!!.data
                emit(Resource.Success(launchGatedStats(data)))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to load referral stats"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }

    override fun getReferralHistory(): Flow<Resource<List<ReferralHistoryDto>>> = flow {
        emit(Resource.Loading)
        try {
            val response = apiService.getReferralHistory()
            if (response.isSuccessful && response.body() != null) {
                val referrals = response.body()!!.data.referrals.map(::sanitizeReferralHistory)
                emit(Resource.Success(referrals))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to load referral history"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }

    override fun applyReferralCode(code: String): Flow<Resource<ApplyReferralResponse>> = flow {
        emit(Resource.Loading)
        try {
            val request = mapOf("code" to normalizeReferralText("Referral code", code, 64))
            val response = apiService.applyReferralCode(request)
            if (response.isSuccessful && response.body() != null) {
                emit(Resource.Success(response.body()!!))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to apply referral code"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }

    private fun normalizeReferralText(label: String, value: String, maxLength: Int): String {
        val normalized = value.trim()
        require(normalized.isNotEmpty()) { "$label is required" }
        require(normalized.length <= maxLength) { "$label must be $maxLength characters or fewer" }
        require(!unsafeTextControls.containsMatchIn(normalized)) {
            "$label contains unsafe control characters"
        }
        return normalized
    }

    private fun requireNonNegative(label: String, value: Int): Int {
        require(value >= 0) { "$label must be non-negative" }
        return value
    }

    private fun requireNotGreaterThan(label: String, value: Int, maxLabel: String, maxValue: Int): Int {
        require(value <= maxValue) { "$label must not exceed $maxLabel" }
        return value
    }

    private fun sanitizeReferralStats(stats: ReferralStatsDto): ReferralStatsDto {
        val totalReferrals = requireNonNegative("Total referrals", stats.totalReferrals)
        val successfulReferrals = requireNotGreaterThan(
            "Successful referrals",
            requireNonNegative("Successful referrals", stats.successfulReferrals),
            "total referrals",
            totalReferrals
        )
        val pendingReferrals = requireNotGreaterThan(
            "Pending referrals",
            requireNonNegative("Pending referrals", stats.pendingReferrals),
            "total referrals",
            totalReferrals
        )
        val monthlyReferrals = requireNotGreaterThan(
            "Monthly referrals",
            requireNonNegative("Monthly referrals", stats.monthlyReferrals),
            "total referrals",
            totalReferrals
        )

        return stats.copy(
            totalReferrals = totalReferrals,
            successfulReferrals = successfulReferrals,
            pendingReferrals = pendingReferrals,
            monthlyReferrals = monthlyReferrals,
            totalEarningsCents = 0,
            availableCreditsCents = 0,
            pendingRewardsCents = 0,
            referralCode = normalizeReferralText("Referral code", stats.referralCode, 64),
            leaderboardPosition = null
        )
    }

    private fun sanitizeReferralHistory(referral: ReferralHistoryDto): ReferralHistoryDto =
        referral.copy(
            id = normalizeReferralText("Referral ID", referral.id, 255),
            referredUserName = normalizeReferralText("Referred user name", referral.referredUserName, 255),
            referredAt = normalizeReferralText("Referral timestamp", referral.referredAt, 64),
            rewardCents = 0
        )

    private fun launchGatedStats(data: ReferralStatsData): ReferralStatsData =
        data.copy(
            stats = sanitizeReferralStats(data.stats),
            leaderboard = emptyList()
        )
}
