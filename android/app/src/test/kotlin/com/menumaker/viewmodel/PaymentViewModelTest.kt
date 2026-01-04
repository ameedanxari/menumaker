package com.menumaker.viewmodel

import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.PaymentProcessorDto
import com.menumaker.data.remote.models.PaymentProcessorData
import com.menumaker.data.remote.models.PayoutListData
import com.menumaker.data.remote.models.PayoutDto
import com.menumaker.data.repository.PaymentRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.mockito.Mock
import org.mockito.Mockito
import org.mockito.MockitoAnnotations

@ExperimentalCoroutinesApi
class PaymentViewModelTest {

    @Mock
    private lateinit var repository: PaymentRepository

    private lateinit var viewModel: PaymentViewModel

    private val testDispatcher = UnconfinedTestDispatcher()

    @Before
    fun setup() {
        MockitoAnnotations.openMocks(this)
        Dispatchers.setMain(testDispatcher)

        viewModel = PaymentViewModel(repository)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `loadProcessors updates processorsState`() = runTest {
        val processors = listOf(
            PaymentProcessorDto(
                id = "p1",
                processorType = "stripe",
                status = "active",
                isActive = true,
                priority = 1,
                settlementSchedule = "daily",
                minPayoutThresholdCents = 1000,
                feePercentage = 2.9,
                fixedFeeCents = 30,
                lastTransactionAt = null,
                verifiedAt = "2024-01-01",
                connectionError = null,
                metadata = null,
                createdAt = "2024-01-01"
            )
        )
        Mockito.`when`(repository.getPaymentProcessors("b1")).thenReturn(flow { 
            emit(Resource.Success(processors)) 
        })

        viewModel.loadProcessors("b1")
        
        val state = viewModel.processorsState.value
        assertTrue(state is Resource.Success)
        assertEquals(1, (state as Resource.Success).data.size)
    }
    
    @Test
    fun `connectProcessor updates connectState`() = runTest {
        val processor = PaymentProcessorDto(
            id = "p1",
            processorType = "stripe",
            status = "pending",
            isActive = false,
            priority = 1,
            settlementSchedule = null,
            minPayoutThresholdCents = null,
            feePercentage = null,
            fixedFeeCents = null,
            lastTransactionAt = null,
            verifiedAt = null,
            connectionError = null,
            metadata = null,
            createdAt = "2024-01-01"
        )
        val data = PaymentProcessorData(processor = processor)
        Mockito.`when`(repository.connectProcessor("Stripe")).thenReturn(flow {
            emit(Resource.Success(data))
        })
        
        viewModel.connectProcessor("Stripe")
        
        val state = viewModel.connectState.value
        assertTrue(state is Resource.Success)
        assertEquals("p1", (state as Resource.Success).data.processor.id)
    }

    @Test
    fun `loadPayouts updates payoutsState`() = runTest {
        val payouts = listOf(
            PayoutDto(
                id = "payout1",
                businessId = "b1",
                processorId = "p1",
                amountCents = 10000,
                feeCents = 100,
                netAmountCents = 9900,
                currency = "INR",
                status = "completed",
                payoutReference = "ref123",
                failureReason = null,
                initiatedAt = "2024-01-01",
                completedAt = "2024-01-02",
                createdAt = "2024-01-01"
            )
        )
        val data = PayoutListData(
            payouts = payouts,
            total = 1,
            limit = 50,
            offset = 0
        )
        Mockito.`when`(repository.getPayouts("b1")).thenReturn(flow {
            emit(Resource.Success(data))
        })
        
        viewModel.loadPayouts("b1")
        
        val state = viewModel.payoutsState.value
        assertTrue(state is Resource.Success)
        assertEquals(1, (state as Resource.Success).data.payouts.size)
    }
}
