package com.menumaker.viewmodel

import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.IntegrationDto
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
    fun `connectPOS exposes launch-gated error state`() = runTest {
        Mockito.`when`(repository.connectPOS("Square")).thenReturn(flow {
             emit(Resource.Error("POS provider 'Square' is launch-gated in this build"))
        })
        
        viewModel.connectPOS("Square")
        
        val state = viewModel.connectState.value
        assertTrue(state is Resource.Error)
        assertEquals("POS provider 'Square' is launch-gated in this build", (state as Resource.Error).message)
    }

    @Test
    fun `connectDelivery exposes launch-gated error state`() = runTest {
        Mockito.`when`(repository.connectDelivery("DoorDash")).thenReturn(flow {
             emit(Resource.Error("Delivery provider 'DoorDash' is launch-gated in this build"))
        })

        viewModel.connectDelivery("DoorDash")

        val state = viewModel.connectState.value
        assertTrue(state is Resource.Error)
        assertEquals("Delivery provider 'DoorDash' is launch-gated in this build", (state as Resource.Error).message)
    }

    @Test
    fun `disconnectIntegration exposes launch-gated error state`() = runTest {
        Mockito.`when`(repository.disconnectIntegration("int-1")).thenReturn(flow {
            emit(Resource.Error("Integration disconnect for 'int-1' is launch-gated in this build"))
        })

        viewModel.disconnectIntegration("int-1", "b1")

        val state = viewModel.disconnectState.value
        assertTrue(state is Resource.Error)
        assertEquals("Integration disconnect for 'int-1' is launch-gated in this build", (state as Resource.Error).message)
    }
}
