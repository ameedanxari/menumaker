package com.menumaker.data.repository

import com.menumaker.data.common.Resource
import com.menumaker.data.remote.api.ApiService
import com.menumaker.data.remote.models.ApplyReferralResponse
import com.menumaker.data.remote.models.ReferralHistoryDto
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

    override fun getReferralStats(): Flow<Resource<ReferralStatsData>> = flow {
        emit(Resource.Loading)
        try {
            val response = apiService.getReferralStats()
            if (response.isSuccessful && response.body() != null) {
                val data = response.body()!!.data
                emit(Resource.Success(data))
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
                val referrals = response.body()!!.data.referrals
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
            val request = mapOf("code" to code)
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
}
