package com.menumaker.repository

import com.google.common.truth.Truth.assertThat
import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.PaymentProcessorData
import com.menumaker.data.remote.models.PaymentProcessorDto
import com.menumaker.data.repository.PaymentRepositoryImpl
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
 * Unit tests for PaymentRepositoryImpl.
 * Tests getPaymentProcessors and connectProcessor flows.
 *
 * Requirements: 3.5, 10.3
 */
@OptIn(ExperimentalCoroutinesApi::class)
class PaymentRepositoryTest {

    @get:Rule
    val dispatcherRule = TestDispatcherRule()

    private lateinit var fakeApiService: FakeApiService
    private lateinit var repository: PaymentRepositoryImpl

    @Before
    fun setup() {
        fakeApiService = FakeApiService()
        repository = PaymentRepositoryImpl(fakeApiService)
    }

    // ==================== getPaymentProcessors Tests ====================

    @Test
    fun `getPaymentProcessors emits Loading then Success with processors`() = runTest {
        // Given
        val processors = listOf(
            TestDataFactory.createPaymentProcessor(id = "proc-1", processorType = "stripe"),
            TestDataFactory.createPaymentProcessor(id = "proc-2", processorType = "razorpay")
        )
        fakeApiService.getPaymentProcessorsResponse = Response.success(
            TestDataFactory.createPaymentProcessorListResponse(processors = processors)
        )

        // When
        val results = repository.getPaymentProcessors("business-123").toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        val successResult = results.last() as Resource.Success<List<PaymentProcessorDto>>
        assertThat(successResult.data).hasSize(2)
    }

    @Test
    fun `getPaymentProcessors emits Error on API failure`() = runTest {
        // Given
        fakeApiService.errorCode = 500

        // When
        val results = repository.getPaymentProcessors("business-123").toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        assertThat(results.last()).isInstanceOf(Resource.Error::class.java)
    }

    @Test
    fun `getPaymentProcessors handles network error gracefully`() = runTest {
        // Given
        fakeApiService.shouldThrowException = IOException("Network unavailable")

        // When
        val results = repository.getPaymentProcessors("business-123").toList()

        // Then
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("Network unavailable")
    }

    // ==================== connectProcessor Tests ====================

    @Test
    fun `connectProcessor emits Loading then Success with processor data`() = runTest {
        // Given
        val processor = TestDataFactory.createPaymentProcessor(processorType = "stripe")
        fakeApiService.connectPaymentProcessorResponse = Response.success(
            TestDataFactory.createPaymentProcessorResponse(processor = processor)
        )

        // When
        val results = repository.connectProcessor("stripe").toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        val successResult = results.last() as Resource.Success<PaymentProcessorData>
        assertThat(successResult.data.processor.processorType).isEqualTo("stripe")
    }

    @Test
    fun `connectProcessor emits Error on API failure`() = runTest {
        // Given
        fakeApiService.errorCode = 400

        // When
        val results = repository.connectProcessor("invalid-provider").toList()

        // Then
        assertThat(results.last()).isInstanceOf(Resource.Error::class.java)
    }

    @Test
    fun `connectProcessor handles network error gracefully`() = runTest {
        // Given
        fakeApiService.shouldThrowException = IOException("Connection timeout")

        // When
        val results = repository.connectProcessor("stripe").toList()

        // Then
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("Connection timeout")
    }

    // ==================== disconnectProcessor Tests ====================

    @Test
    fun `disconnectProcessor emits Loading then Success`() = runTest {
        // Given
        fakeApiService.disconnectPaymentProcessorResponse = Response.success(Unit)

        // When
        val results = repository.disconnectProcessor("proc-123").toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        assertThat(results.last()).isInstanceOf(Resource.Success::class.java)
    }

    @Test
    fun `disconnectProcessor emits Error on API failure`() = runTest {
        // Given
        fakeApiService.errorCode = 404

        // When
        val results = repository.disconnectProcessor("nonexistent-proc").toList()

        // Then
        assertThat(results.last()).isInstanceOf(Resource.Error::class.java)
    }

    // ==================== getPayouts Tests ====================

    @Test
    fun `getPayouts emits Loading then Success with payouts`() = runTest {
        // Given
        val payouts = listOf(TestDataFactory.createPayout())
        fakeApiService.getPayoutsResponse = Response.success(
            TestDataFactory.createPayoutListResponse(payouts = payouts)
        )

        // When
        val results = repository.getPayouts("business-123").toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        assertThat(results.last()).isInstanceOf(Resource.Success::class.java)
    }

    @Test
    fun `getPayouts emits Error on API failure`() = runTest {
        // Given
        fakeApiService.errorCode = 500

        // When
        val results = repository.getPayouts("business-123").toList()

        // Then
        assertThat(results.last()).isInstanceOf(Resource.Error::class.java)
    }
}
