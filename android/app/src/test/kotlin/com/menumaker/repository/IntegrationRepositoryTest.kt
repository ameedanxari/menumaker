package com.menumaker.repository

import com.google.common.truth.Truth.assertThat
import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.IntegrationDto
import com.menumaker.data.remote.models.PaymentProcessorData
import com.menumaker.data.repository.IntegrationRepositoryImpl
import com.menumaker.testutils.FakeApiService
import com.menumaker.testutils.TestDataFactory
import com.menumaker.testutils.TestDispatcherRule
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.test.runTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import retrofit2.Response
import java.io.IOException

/**
 * Unit tests for IntegrationRepositoryImpl.
 * Tests getIntegrations and connectIntegration flows.
 *
 * Requirements: 12.1, 12.2
 */
@OptIn(ExperimentalCoroutinesApi::class)
class IntegrationRepositoryTest {

    @get:Rule
    val dispatcherRule = TestDispatcherRule()

    private lateinit var fakeApiService: FakeApiService
    private lateinit var repository: IntegrationRepositoryImpl

    @Before
    fun setup() {
        fakeApiService = FakeApiService()
        repository = IntegrationRepositoryImpl(fakeApiService)
    }

    // ==================== getIntegrations Tests ====================

    @Test
    fun `getIntegrations emits Loading then Success with integrations`() = runTest {
        // Given
        val integrations = listOf(
            TestDataFactory.createIntegration(id = "int-1", provider = "square", type = "pos"),
            TestDataFactory.createIntegration(id = "int-2", provider = "doordash", type = "delivery")
        )
        fakeApiService.getIntegrationsResponse = Response.success(
            TestDataFactory.createIntegrationListResponse(integrations = integrations)
        )

        // When
        val results = repository.getIntegrations("business-123").toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        val successResult = results.last() as Resource.Success<List<IntegrationDto>>
        assertThat(successResult.data).hasSize(2)
    }

    @Test
    fun `getIntegrations emits Error on API failure`() = runTest {
        // Given
        fakeApiService.errorCode = 500

        // When
        val results = repository.getIntegrations("business-123").toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        assertThat(results.last()).isInstanceOf(Resource.Error::class.java)
    }

    @Test
    fun `getIntegrations handles network error gracefully`() = runTest {
        // Given
        fakeApiService.shouldThrowException = IOException("Network unavailable")

        // When
        val results = repository.getIntegrations("business-123").toList()

        // Then
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("Network unavailable")
    }

    // ==================== connectPOS Tests ====================

    @Test
    fun `connectPOS emits Loading then Success with processor data`() = runTest {
        // Given
        val processor = TestDataFactory.createPaymentProcessor(processorType = "square")
        fakeApiService.connectPOSResponse = Response.success(
            TestDataFactory.createPaymentProcessorResponse(processor = processor)
        )

        // When
        val results = repository.connectPOS("square").toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        val successResult = results.last() as Resource.Success<PaymentProcessorData>
        assertThat(successResult.data.processor.processorType).isEqualTo("square")
    }

    @Test
    fun `connectPOS emits Error on API failure`() = runTest {
        // Given
        fakeApiService.errorCode = 400

        // When
        val results = repository.connectPOS("invalid-provider").toList()

        // Then
        assertThat(results.last()).isInstanceOf(Resource.Error::class.java)
    }

    @Test
    fun `connectPOS handles network error gracefully`() = runTest {
        // Given
        fakeApiService.shouldThrowException = IOException("Connection timeout")

        // When
        val results = repository.connectPOS("square").toList()

        // Then
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("Connection timeout")
    }

    // ==================== connectDelivery Tests ====================

    @Test
    fun `connectDelivery emits Loading then Success with processor data`() = runTest {
        // Given
        val processor = TestDataFactory.createPaymentProcessor(processorType = "doordash")
        fakeApiService.connectDeliveryResponse = Response.success(
            TestDataFactory.createPaymentProcessorResponse(processor = processor)
        )

        // When
        val results = repository.connectDelivery("doordash").toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        val successResult = results.last() as Resource.Success<PaymentProcessorData>
        assertThat(successResult.data.processor.processorType).isEqualTo("doordash")
    }

    @Test
    fun `connectDelivery emits Error on API failure`() = runTest {
        // Given
        fakeApiService.errorCode = 400

        // When
        val results = repository.connectDelivery("invalid-provider").toList()

        // Then
        assertThat(results.last()).isInstanceOf(Resource.Error::class.java)
    }

    // ==================== disconnectIntegration Tests ====================

    @Test
    fun `disconnectIntegration emits Loading then Success`() = runTest {
        // Given
        fakeApiService.disconnectIntegrationResponse = Response.success(Unit)

        // When
        val results = repository.disconnectIntegration("int-123").toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        assertThat(results.last()).isInstanceOf(Resource.Success::class.java)
    }

    @Test
    fun `disconnectIntegration emits Error on API failure`() = runTest {
        // Given
        fakeApiService.errorCode = 404

        // When
        val results = repository.disconnectIntegration("nonexistent-int").toList()

        // Then
        assertThat(results.last()).isInstanceOf(Resource.Error::class.java)
    }

    @Test
    fun `disconnectIntegration handles network error gracefully`() = runTest {
        // Given
        fakeApiService.shouldThrowException = IOException("Network unavailable")

        // When
        val results = repository.disconnectIntegration("int-123").toList()

        // Then
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("Network unavailable")
    }
}
