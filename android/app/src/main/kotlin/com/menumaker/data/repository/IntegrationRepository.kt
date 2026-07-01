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

    private val launchGatedIntegrationTypes = setOf("pos", "delivery")
    private val unsafeTextControls =
        Regex("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F-\\u009F\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u206F\\uFEFF]")

    private fun launchGatedMessage(capability: String, provider: String): String =
        "$capability provider '$provider' is launch-gated in this build and remains disabled until backend capability evidence is recorded."

    private fun normalizeBoundaryText(label: String, value: String, maxLength: Int = 255): String {
        val normalized = value.trim()
        require(normalized.isNotEmpty()) { "$label is required" }
        require(normalized.length <= maxLength) { "$label must be $maxLength characters or fewer" }
        require(!unsafeTextControls.containsMatchIn(normalized)) {
            "$label contains unsafe control characters"
        }
        return normalized
    }

    private fun isVisibleIntegrationBoundaryText(label: String, value: String, maxLength: Int): Boolean =
        try {
            normalizeBoundaryText(label, value, maxLength)
            true
        } catch (_: IllegalArgumentException) {
            false
        }

    private fun visibleIntegrationsWhileLaunchGated(integrations: List<IntegrationDto>): List<IntegrationDto> =
        integrations.filterNot { integration ->
            !isVisibleIntegrationBoundaryText("Integration ID", integration.id, 255) ||
                !isVisibleIntegrationBoundaryText("Integration provider", integration.provider, 64) ||
                !isVisibleIntegrationBoundaryText("Integration type", integration.type, 64) ||
                integration.type.trim().lowercase() in launchGatedIntegrationTypes
        }

    override fun getIntegrations(businessId: String): Flow<Resource<List<IntegrationDto>>> = flow {
        emit(Resource.Loading)
        try {
            val normalizedBusinessId = normalizeBoundaryText("Business ID", businessId)
            val response = apiService.getIntegrations(normalizedBusinessId)
            if (response.isSuccessful && response.body() != null) {
                val integrations = visibleIntegrationsWhileLaunchGated(response.body()!!.data.integrations)
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
            emit(Resource.Error(launchGatedMessage("POS", normalizeBoundaryText("POS provider", provider))))
        } catch (e: IllegalArgumentException) {
            emit(Resource.Error(e.message ?: "Invalid POS provider", e))
        }
    }

    override fun connectDelivery(provider: String): Flow<Resource<PaymentProcessorData>> = flow {
        emit(Resource.Loading)
        try {
            emit(Resource.Error(launchGatedMessage("Delivery", normalizeBoundaryText("Delivery provider", provider))))
        } catch (e: IllegalArgumentException) {
            emit(Resource.Error(e.message ?: "Invalid delivery provider", e))
        }
    }

    override fun disconnectIntegration(id: String): Flow<Resource<Unit>> = flow {
        emit(Resource.Loading)
        try {
            val normalizedId = normalizeBoundaryText("Integration ID", id)
            emit(Resource.Error("Integration disconnect for '$normalizedId' is launch-gated in this build because POS and delivery-provider integrations remain disabled until backend capability evidence is recorded."))
        } catch (e: IllegalArgumentException) {
            emit(Resource.Error(e.message ?: "Invalid integration ID", e))
        }
    }
}
