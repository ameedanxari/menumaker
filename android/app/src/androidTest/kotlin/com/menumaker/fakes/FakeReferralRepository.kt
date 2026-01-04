package com.menumaker.fakes

import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.ApplyReferralResponse
import com.menumaker.data.remote.models.ReferralHistoryDto
import com.menumaker.data.remote.models.ReferralLeaderboardDto
import com.menumaker.data.remote.models.ReferralStatsData
import com.menumaker.data.remote.models.ReferralStatsDto
import com.menumaker.data.remote.models.ReferralStatus
import com.menumaker.data.repository.ReferralRepository
import com.menumaker.fixtures.SharedFixtures
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

/**
 * Fake implementation of ReferralRepository for UI tests.
 * Provides configurable responses for deterministic testing.
 */
class FakeReferralRepository : ReferralRepository {

    // Configurable responses
    var referralStatsResponse: Resource<ReferralStatsData>? = null
    var referralHistoryResponse: Resource<List<ReferralHistoryDto>>? = null
    var applyReferralCodeResponse: Resource<ApplyReferralResponse>? = null

    // Track method calls for verification
    var getReferralStatsCallCount = 0
    var getReferralHistoryCallCount = 0
    var applyReferralCodeCallCount = 0
    var lastAppliedCode: String? = null

    // Valid referral codes for testing
    private val validCodes = mutableSetOf("FRIEND10", "WELCOME20", "SAVE15")

    // Default test data
    private val defaultStats: ReferralStatsDto
        get() = SharedFixtures.referralStats.stats

    private val defaultLeaderboard: List<ReferralLeaderboardDto>
        get() = SharedFixtures.referralStats.leaderboard

    private val defaultHistory: List<ReferralHistoryDto>
        get() = SharedFixtures.referralHistory.referrals.map { it.copy() }

    override fun getReferralStats(): Flow<Resource<ReferralStatsData>> = flow {
        emit(Resource.Loading)
        getReferralStatsCallCount++

        val response = referralStatsResponse ?: Resource.Success(
            ReferralStatsData(
                stats = defaultStats,
                leaderboard = defaultLeaderboard
            )
        )
        emit(response)
    }

    override fun getReferralHistory(): Flow<Resource<List<ReferralHistoryDto>>> = flow {
        emit(Resource.Loading)
        getReferralHistoryCallCount++

        val response = referralHistoryResponse ?: Resource.Success(defaultHistory)
        emit(response)
    }

    override fun applyReferralCode(code: String): Flow<Resource<ApplyReferralResponse>> = flow {
        emit(Resource.Loading)
        applyReferralCodeCallCount++
        lastAppliedCode = code

        if (applyReferralCodeResponse != null) {
            emit(applyReferralCodeResponse!!)
        } else {
            if (validCodes.contains(code.uppercase())) {
                emit(Resource.Success(
                    ApplyReferralResponse(
                        success = true,
                        message = "Referral code applied successfully! You earned ₹100 credit."
                    )
                ))
            } else {
                emit(Resource.Error("Invalid referral code"))
            }
        }
    }

    /**
     * Reset all state for clean test setup
     */
    fun reset() {
        referralStatsResponse = null
        referralHistoryResponse = null
        applyReferralCodeResponse = null
        getReferralStatsCallCount = 0
        getReferralHistoryCallCount = 0
        applyReferralCodeCallCount = 0
        lastAppliedCode = null
        validCodes.clear()
        validCodes.addAll(listOf("FRIEND10", "WELCOME20", "SAVE15"))
    }

    /**
     * Add a valid referral code
     */
    fun addValidCode(code: String) {
        validCodes.add(code.uppercase())
    }

    /**
     * Remove a valid referral code
     */
    fun removeValidCode(code: String) {
        validCodes.remove(code.uppercase())
    }

    /**
     * Check if a code is valid
     */
    fun isValidCode(code: String): Boolean = validCodes.contains(code.uppercase())

    /**
     * Configure for error scenario
     */
    fun configureError(errorMessage: String = "Failed to load referral data") {
        referralStatsResponse = Resource.Error(errorMessage)
        referralHistoryResponse = Resource.Error(errorMessage)
    }

    /**
     * Configure custom stats
     */
    fun configureStats(stats: ReferralStatsDto) {
        referralStatsResponse = Resource.Success(
            ReferralStatsData(
                stats = stats,
                leaderboard = defaultLeaderboard
            )
        )
    }
}
