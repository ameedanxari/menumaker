package com.menumaker.fakes

import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.MockChargeData
import com.menumaker.data.remote.models.MockChargeRequest
import com.menumaker.data.remote.models.MockChargeResponse
import com.menumaker.data.remote.models.PaymentProcessorData
import com.menumaker.data.remote.models.PaymentProcessorDto
import com.menumaker.data.remote.models.PayoutDto
import com.menumaker.data.remote.models.PayoutListData
import com.menumaker.data.repository.PaymentRepository
import com.menumaker.fixtures.SharedFixtures
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

/**
 * Fake implementation of PaymentRepository for UI tests.
 * Provides configurable responses for deterministic testing.
 */
class FakePaymentRepository : PaymentRepository {

    // Configurable responses
    var mockChargeResult: MockChargeResponse? = null
    var shouldThrowOnCharge: Boolean = false
    var chargeErrorMessage: String = "Payment failed"
    var paymentProcessorsResponse: Resource<List<PaymentProcessorDto>>? = null
    var connectProcessorResponse: Resource<PaymentProcessorData>? = null
    var disconnectProcessorResponse: Resource<Unit> = Resource.Success(Unit)
    var payoutsResponse: Resource<PayoutListData>? = null
    var updatePayoutScheduleResponse: Resource<PayoutListData>? = null

    // In-memory storage
    private val processors = mutableListOf<PaymentProcessorDto>()
    private val payouts = mutableListOf<PayoutDto>()

    // Track method calls for verification
    var mockChargeCallCount = 0
    var getProcessorsCallCount = 0
    var connectProcessorCallCount = 0
    var disconnectProcessorCallCount = 0
    var getPayoutsCallCount = 0
    var updatePayoutScheduleCallCount = 0
    var lastChargeRequest: MockChargeRequest? = null
    var lastConnectedProvider: String? = null
    var lastDisconnectedProcessorId: String? = null
    var lastBusinessId: String? = null

    // Default test data
    private val defaultProcessors: List<PaymentProcessorDto>
        get() = SharedFixtures.paymentProcessors

    private val defaultPayouts: List<PayoutDto>
        get() = SharedFixtures.payouts.payouts

    init {
        processors.addAll(defaultProcessors)
        payouts.addAll(defaultPayouts)
    }

    override suspend fun mockCharge(request: MockChargeRequest): MockChargeResponse {
        mockChargeCallCount++
        lastChargeRequest = request

        if (shouldThrowOnCharge) {
            throw IllegalStateException(chargeErrorMessage)
        }

        return mockChargeResult ?: MockChargeResponse(
            success = true,
            data = MockChargeData(
                paymentId = "pay_${System.currentTimeMillis()}",
                status = "succeeded"
            )
        )
    }

    override fun getPaymentProcessors(businessId: String): Flow<Resource<List<PaymentProcessorDto>>> = flow {
        emit(Resource.Loading)
        getProcessorsCallCount++
        lastBusinessId = businessId

        val response = paymentProcessorsResponse ?: Resource.Success(processors.toList())
        emit(response)
    }

    override fun connectProcessor(provider: String): Flow<Resource<PaymentProcessorData>> = flow {
        emit(Resource.Loading)
        connectProcessorCallCount++
        lastConnectedProvider = provider

        if (connectProcessorResponse != null) {
            emit(connectProcessorResponse!!)
        } else {
            val newProcessor = PaymentProcessorDto(
                id = "processor-${System.currentTimeMillis()}",
                processorType = provider,
                status = "active",
                isActive = true,
                priority = processors.size + 1,
                settlementSchedule = "daily",
                minPayoutThresholdCents = 10000,
                feePercentage = 2.9,
                fixedFeeCents = 30,
                lastTransactionAt = null,
                verifiedAt = "2025-01-01T00:00:00Z",
                connectionError = null,
                metadata = null,
                createdAt = "2025-01-01T00:00:00Z"
            )
            processors.add(newProcessor)
            emit(Resource.Success(PaymentProcessorData(processor = newProcessor)))
        }
    }

    override fun disconnectProcessor(id: String): Flow<Resource<Unit>> = flow {
        emit(Resource.Loading)
        disconnectProcessorCallCount++
        lastDisconnectedProcessorId = id

        processors.removeAll { it.id == id }
        emit(disconnectProcessorResponse)
    }

    override fun getPayouts(businessId: String): Flow<Resource<PayoutListData>> = flow {
        emit(Resource.Loading)
        getPayoutsCallCount++
        lastBusinessId = businessId

        val response = payoutsResponse ?: Resource.Success(
            PayoutListData(
                payouts = payouts.filter { it.businessId == businessId },
                total = payouts.size,
                limit = 20,
                offset = 0
            )
        )
        emit(response)
    }

    override fun updatePayoutSchedule(schedule: Map<String, Any>): Flow<Resource<PayoutListData>> = flow {
        emit(Resource.Loading)
        updatePayoutScheduleCallCount++

        val response = updatePayoutScheduleResponse ?: Resource.Success(
            PayoutListData(
                payouts = payouts.toList(),
                total = payouts.size,
                limit = 20,
                offset = 0
            )
        )
        emit(response)
    }

    /**
     * Reset all state for clean test setup
     */
    fun reset() {
        mockChargeResult = null
        shouldThrowOnCharge = false
        chargeErrorMessage = "Payment failed"
        paymentProcessorsResponse = null
        connectProcessorResponse = null
        disconnectProcessorResponse = Resource.Success(Unit)
        payoutsResponse = null
        updatePayoutScheduleResponse = null
        processors.clear()
        processors.addAll(defaultProcessors)
        payouts.clear()
        payouts.addAll(defaultPayouts)
        mockChargeCallCount = 0
        getProcessorsCallCount = 0
        connectProcessorCallCount = 0
        disconnectProcessorCallCount = 0
        getPayoutsCallCount = 0
        updatePayoutScheduleCallCount = 0
        lastChargeRequest = null
        lastConnectedProvider = null
        lastDisconnectedProcessorId = null
        lastBusinessId = null
    }

    /**
     * Configure for successful payment
     */
    fun configureSuccessfulPayment() {
        shouldThrowOnCharge = false
        mockChargeResult = MockChargeResponse(
            success = true,
            data = MockChargeData(
                paymentId = "pay_success",
                status = "succeeded"
            )
        )
    }

    /**
     * Configure for failed payment
     */
    fun configureFailedPayment(errorMessage: String = "Payment declined") {
        shouldThrowOnCharge = true
        chargeErrorMessage = errorMessage
    }

    /**
     * Configure for error scenario
     */
    fun configureError(errorMessage: String = "Failed to load payment data") {
        paymentProcessorsResponse = Resource.Error(errorMessage)
        payoutsResponse = Resource.Error(errorMessage)
    }
}
