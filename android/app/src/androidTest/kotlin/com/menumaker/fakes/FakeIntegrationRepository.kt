package com.menumaker.fakes

import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.IntegrationDto
import com.menumaker.data.remote.models.PaymentProcessorData
import com.menumaker.data.remote.models.PaymentProcessorDto
import com.menumaker.data.repository.IntegrationRepository
import com.menumaker.fixtures.SharedFixtures
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

/**
 * Fake implementation of IntegrationRepository for UI tests.
 * Provides configurable responses for deterministic testing.
 */
class FakeIntegrationRepository : IntegrationRepository {

    // Configurable responses
    var integrationsResponse: Resource<List<IntegrationDto>>? = null
    var connectPOSResponse: Resource<PaymentProcessorData>? = null
    var connectDeliveryResponse: Resource<PaymentProcessorData>? = null
    var disconnectIntegrationResponse: Resource<Unit> = Resource.Success(Unit)

    // In-memory storage for integrations
    private val integrations = mutableListOf<IntegrationDto>()

    // Track method calls for verification
    var getIntegrationsCallCount = 0
    var connectPOSCallCount = 0
    var connectDeliveryCallCount = 0
    var disconnectIntegrationCallCount = 0
    var lastBusinessId: String? = null
    var lastConnectedPOSProvider: String? = null
    var lastConnectedDeliveryProvider: String? = null
    var lastDisconnectedIntegrationId: String? = null

    // Default test data
    private val defaultIntegrations: List<IntegrationDto>
        get() = SharedFixtures.integrations

    init {
        integrations.addAll(defaultIntegrations)
    }

    override fun getIntegrations(businessId: String): Flow<Resource<List<IntegrationDto>>> = flow {
        emit(Resource.Loading)
        getIntegrationsCallCount++
        lastBusinessId = businessId

        val response = integrationsResponse 
            ?: Resource.Success(integrations.filter { it.businessId == businessId })
        emit(response)
    }

    override fun connectPOS(provider: String): Flow<Resource<PaymentProcessorData>> = flow {
        emit(Resource.Loading)
        connectPOSCallCount++
        lastConnectedPOSProvider = provider

        if (connectPOSResponse != null) {
            emit(connectPOSResponse!!)
        } else {
            val newIntegration = IntegrationDto(
                id = "integration-${System.currentTimeMillis()}",
                businessId = "business-1",
                provider = provider,
                type = "pos",
                isActive = true,
                lastSyncAt = null,
                createdAt = "2025-01-01T00:00:00Z"
            )
            integrations.add(newIntegration)
            
            // Return a PaymentProcessorData as per the interface
            val processorDto = PaymentProcessorDto(
                id = newIntegration.id,
                processorType = provider,
                status = "active",
                isActive = true,
                priority = 1,
                settlementSchedule = null,
                minPayoutThresholdCents = null,
                feePercentage = null,
                fixedFeeCents = null,
                lastTransactionAt = null,
                verifiedAt = "2025-01-01T00:00:00Z",
                connectionError = null,
                metadata = null,
                createdAt = "2025-01-01T00:00:00Z"
            )
            emit(Resource.Success(PaymentProcessorData(processor = processorDto)))
        }
    }

    override fun connectDelivery(provider: String): Flow<Resource<PaymentProcessorData>> = flow {
        emit(Resource.Loading)
        connectDeliveryCallCount++
        lastConnectedDeliveryProvider = provider

        if (connectDeliveryResponse != null) {
            emit(connectDeliveryResponse!!)
        } else {
            val newIntegration = IntegrationDto(
                id = "integration-${System.currentTimeMillis()}",
                businessId = "business-1",
                provider = provider,
                type = "delivery",
                isActive = true,
                lastSyncAt = null,
                createdAt = "2025-01-01T00:00:00Z"
            )
            integrations.add(newIntegration)
            
            // Return a PaymentProcessorData as per the interface
            val processorDto = PaymentProcessorDto(
                id = newIntegration.id,
                processorType = provider,
                status = "active",
                isActive = true,
                priority = 1,
                settlementSchedule = null,
                minPayoutThresholdCents = null,
                feePercentage = null,
                fixedFeeCents = null,
                lastTransactionAt = null,
                verifiedAt = "2025-01-01T00:00:00Z",
                connectionError = null,
                metadata = null,
                createdAt = "2025-01-01T00:00:00Z"
            )
            emit(Resource.Success(PaymentProcessorData(processor = processorDto)))
        }
    }

    override fun disconnectIntegration(id: String): Flow<Resource<Unit>> = flow {
        emit(Resource.Loading)
        disconnectIntegrationCallCount++
        lastDisconnectedIntegrationId = id

        integrations.removeAll { it.id == id }
        emit(disconnectIntegrationResponse)
    }

    /**
     * Reset all state for clean test setup
     */
    fun reset() {
        integrationsResponse = null
        connectPOSResponse = null
        connectDeliveryResponse = null
        disconnectIntegrationResponse = Resource.Success(Unit)
        integrations.clear()
        integrations.addAll(defaultIntegrations)
        getIntegrationsCallCount = 0
        connectPOSCallCount = 0
        connectDeliveryCallCount = 0
        disconnectIntegrationCallCount = 0
        lastBusinessId = null
        lastConnectedPOSProvider = null
        lastConnectedDeliveryProvider = null
        lastDisconnectedIntegrationId = null
    }

    /**
     * Set integrations directly for test setup
     */
    fun setIntegrations(newIntegrations: List<IntegrationDto>) {
        integrations.clear()
        integrations.addAll(newIntegrations)
    }

    /**
     * Get all integrations
     */
    fun getAllIntegrations(): List<IntegrationDto> = integrations.toList()

    /**
     * Get integrations by type
     */
    fun getIntegrationsByType(type: String): List<IntegrationDto> {
        return integrations.filter { it.type == type }
    }

    /**
     * Configure for empty results scenario
     */
    fun configureEmptyResults() {
        integrations.clear()
        integrationsResponse = Resource.Success(emptyList())
    }

    /**
     * Configure for error scenario
     */
    fun configureError(errorMessage: String = "Failed to load integrations") {
        integrationsResponse = Resource.Error(errorMessage)
    }
}
