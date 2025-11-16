package com.menumaker.data.repository

import com.menumaker.data.common.Resource
import com.menumaker.data.remote.api.ApiService
import com.menumaker.data.remote.models.IntegrationDto
import com.menumaker.data.remote.models.PaymentProcessorData
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import javax.inject.Inject

interface IntegrationRepository {
    fun getIntegrations(businessId: String): Flow<Resource<List<IntegrationDto>>>
    fun connectPOS(provider: String): Flow<Resource<PaymentProcessorData>>
    fun connectDelivery(provider: String): Flow<Resource<PaymentProcessorData>>
    fun disconnectIntegration(id: String): Flow<Resource<Unit>>
}

class IntegrationRepositoryImpl @Inject constructor(
    private val apiService: ApiService
) : IntegrationRepository {

    override fun getIntegrations(businessId: String): Flow<Resource<List<IntegrationDto>>> = flow {
        emit(Resource.Loading)
        try {
            val response = apiService.getIntegrations(businessId)
            if (response.isSuccessful && response.body() != null) {
                val integrations = response.body()!!.data.integrations
                emit(Resource.Success(integrations))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to load integrations"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }

    override fun connectPOS(provider: String): Flow<Resource<PaymentProcessorData>> = flow {
        emit(Resource.Loading)
        try {
            val response = apiService.connectPOS(mapOf("provider" to provider))
            if (response.isSuccessful && response.body() != null) {
                val data = response.body()!!.data
                emit(Resource.Success(data))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to connect POS"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }

    override fun connectDelivery(provider: String): Flow<Resource<PaymentProcessorData>> = flow {
        emit(Resource.Loading)
        try {
            val response = apiService.connectDelivery(mapOf("provider" to provider))
            if (response.isSuccessful && response.body() != null) {
                val data = response.body()!!.data
                emit(Resource.Success(data))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to connect delivery"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }

    override fun disconnectIntegration(id: String): Flow<Resource<Unit>> = flow {
        emit(Resource.Loading)
        try {
            val response = apiService.disconnectIntegration(id)
            if (response.isSuccessful) {
                emit(Resource.Success(Unit))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to disconnect integration"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }
}
