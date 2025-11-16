package com.menumaker.data.repository

import com.menumaker.data.common.Resource
import com.menumaker.data.remote.api.ApiService
import com.menumaker.data.remote.models.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import javax.inject.Inject

interface PaymentRepository {
    fun getPaymentProcessors(businessId: String): Flow<Resource<List<PaymentProcessorDto>>>
    fun connectProcessor(provider: String): Flow<Resource<PaymentProcessorData>>
    fun disconnectProcessor(id: String): Flow<Resource<Unit>>
    fun getPayouts(businessId: String): Flow<Resource<PayoutListData>>
    fun updatePayoutSchedule(schedule: Map<String, Any>): Flow<Resource<PayoutListData>>
}

class PaymentRepositoryImpl @Inject constructor(
    private val apiService: ApiService
) : PaymentRepository {

    override fun getPaymentProcessors(businessId: String): Flow<Resource<List<PaymentProcessorDto>>> = flow {
        emit(Resource.Loading)
        try {
            val response = apiService.getPaymentProcessors(businessId)
            if (response.isSuccessful && response.body() != null) {
                val processors = response.body()!!.data.processors
                emit(Resource.Success(processors))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to load processors"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }

    override fun connectProcessor(provider: String): Flow<Resource<PaymentProcessorData>> = flow {
        emit(Resource.Loading)
        try {
            val response = apiService.connectPaymentProcessor(mapOf("provider" to provider))
            if (response.isSuccessful && response.body() != null) {
                val data = response.body()!!.data
                emit(Resource.Success(data))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to connect processor"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }

    override fun disconnectProcessor(id: String): Flow<Resource<Unit>> = flow {
        emit(Resource.Loading)
        try {
            val response = apiService.disconnectPaymentProcessor(id)
            if (response.isSuccessful) {
                emit(Resource.Success(Unit))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to disconnect processor"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }

    override fun getPayouts(businessId: String): Flow<Resource<PayoutListData>> = flow {
        emit(Resource.Loading)
        try {
            val response = apiService.getPayouts(businessId)
            if (response.isSuccessful && response.body() != null) {
                val data = response.body()!!.data
                emit(Resource.Success(data))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to load payouts"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }

    override fun updatePayoutSchedule(schedule: Map<String, Any>): Flow<Resource<PayoutListData>> = flow {
        emit(Resource.Loading)
        try {
            val response = apiService.updatePayoutSchedule(schedule)
            if (response.isSuccessful && response.body() != null) {
                val data = response.body()!!.data
                emit(Resource.Success(data))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to update schedule"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }
}
