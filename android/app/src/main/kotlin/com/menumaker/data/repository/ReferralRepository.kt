package com.menumaker.data.repository

import com.menumaker.data.common.Resource
import com.menumaker.data.remote.api.ApiService
import com.menumaker.data.remote.models.ReferralStatsData
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import javax.inject.Inject

interface ReferralRepository {
    fun getReferralStats(): Flow<Resource<ReferralStatsData>>
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
}
