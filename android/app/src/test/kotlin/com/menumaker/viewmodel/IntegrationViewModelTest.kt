package com.menumaker.viewmodel

import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.IntegrationDto
import com.menumaker.data.remote.models.PaymentProcessorData
import com.menumaker.data.remote.models.PaymentProcessorDto
import com.menumaker.data.repository.IntegrationRepository
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
class IntegrationViewModelTest {

    @Mock
    private lateinit var repository: IntegrationRepository

    private lateinit var viewModel: IntegrationViewModel

    private val testDispatcher = UnconfinedTestDispatcher()

    @Before
    fun setup() {
        MockitoAnnotations.openMocks(this)
        Dispatchers.setMain(testDispatcher)

        viewModel = IntegrationViewModel(repository)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `loadIntegrations updates integrationsState`() = runTest {
        val integrations = listOf(
            IntegrationDto("i1", "b1", "Square", "pos", true, null, "2024-01-01")
        )
        Mockito.`when`(repository.getIntegrations("b1")).thenReturn(flow {
            emit(Resource.Success(integrations))
        })
        
        viewModel.loadIntegrations("b1")
        
        val state = viewModel.integrationsState.value
        assertTrue(state is Resource.Success)
        assertEquals(1, (state as Resource.Success).data.size)
    }

    @Test
    fun `connectPOS updates connectState`() = runTest {
        val processor = PaymentProcessorDto(
            id = "p1",
            processorType = "square",
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
        Mockito.`when`(repository.connectPOS("Square")).thenReturn(flow {
             emit(Resource.Success(data))
        })
        
        viewModel.connectPOS("Square")
        
        val state = viewModel.connectState.value
        assertTrue(state is Resource.Success)
        assertEquals("p1", (state as Resource.Success).data.processor.id)
    }
}
