package com.menumaker.repository

import com.google.common.truth.Truth.assertThat
import com.menumaker.data.common.Resource
import com.menumaker.data.local.db.dao.OrderDao
import com.menumaker.data.local.entities.OrderEntity
import com.menumaker.data.remote.models.OrderDto
import com.menumaker.data.remote.models.OrderListResponse
import com.menumaker.data.remote.models.OrderResponse
import com.menumaker.data.repository.OrderRepositoryImpl
import com.menumaker.testutils.FakeApiService
import com.menumaker.testutils.TestDataFactory
import com.menumaker.testutils.TestDispatcherRule
import io.kotest.property.Arb
import io.kotest.property.arbitrary.arbitrary
import io.kotest.property.arbitrary.int
import io.kotest.property.arbitrary.positiveInt
import io.kotest.property.checkAll
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.test.runTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.mockito.Mockito
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import retrofit2.Response
import java.io.IOException

/**
 * Unit tests for OrderRepositoryImpl.
 * Tests getOrdersByBusiness, getCustomerOrders, createOrder, and updateOrderStatus flows.
 *
 * Requirements: 3.2, 4.5
 */
@OptIn(ExperimentalCoroutinesApi::class)
class OrderRepositoryTest {

    @get:Rule
    val dispatcherRule = TestDispatcherRule()

    private lateinit var fakeApiService: FakeApiService
    private lateinit var mockOrderDao: OrderDao
    private lateinit var repository: OrderRepositoryImpl

    @Before
    fun setup() {
        fakeApiService = FakeApiService()
        mockOrderDao = mock()
        repository = OrderRepositoryImpl(fakeApiService, mockOrderDao)
        
        // Default mock behavior - return empty list for cache
        whenever(mockOrderDao.getOrdersByBusiness(any())).thenReturn(flowOf(emptyList()))
    }

    // ==================== getOrdersByBusiness Tests ====================

    @Test
    fun `getOrdersByBusiness emits Loading then Success with orders`() = runTest {
        // Given
        val orders = listOf(
            TestDataFactory.createOrder(id = "order-1", status = "pending"),
            TestDataFactory.createOrder(id = "order-2", status = "confirmed")
        )
        fakeApiService.getOrdersByBusinessResponse = Response.success(
            TestDataFactory.createOrderListResponse(orders = orders)
        )

        // When
        val results = repository.getOrdersByBusiness("business-123").toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        val successResult = results.last() as Resource.Success<List<OrderDto>>
        assertThat(successResult.data).hasSize(2)
        assertThat(successResult.data[0].id).isEqualTo("order-1")
    }

    @Test
    fun `getOrdersByBusiness caches orders on success`() = runTest {
        // Given
        val orders = listOf(TestDataFactory.createOrder())
        fakeApiService.getOrdersByBusinessResponse = Response.success(
            TestDataFactory.createOrderListResponse(orders = orders)
        )

        // When
        repository.getOrdersByBusiness("business-123").toList()

        // Then
        verify(mockOrderDao).insertOrders(any())
    }

    @Test
    fun `getOrdersByBusiness emits Error on API failure`() = runTest {
        // Given
        fakeApiService.errorCode = 500
        fakeApiService.errorMessage = "Server error"

        // When
        val results = repository.getOrdersByBusiness("business-123").toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        assertThat(results.last()).isInstanceOf(Resource.Error::class.java)
    }

    @Test
    fun `getOrdersByBusiness handles network error gracefully`() = runTest {
        // Given
        fakeApiService.shouldThrowException = IOException("Network unavailable")

        // When
        val results = repository.getOrdersByBusiness("business-123").toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("Network unavailable")
    }

    // ==================== getCustomerOrders Tests ====================

    @Test
    fun `getCustomerOrders emits Loading then Success with orders`() = runTest {
        // Given
        val orders = listOf(
            TestDataFactory.createOrder(id = "customer-order-1"),
            TestDataFactory.createOrder(id = "customer-order-2")
        )
        fakeApiService.getCustomerOrdersResponse = Response.success(
            TestDataFactory.createOrderListResponse(orders = orders)
        )

        // When
        val results = repository.getCustomerOrders().toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        val successResult = results.last() as Resource.Success<List<OrderDto>>
        assertThat(successResult.data).hasSize(2)
    }

    @Test
    fun `getCustomerOrders emits Error on API failure`() = runTest {
        // Given
        fakeApiService.errorCode = 401
        fakeApiService.errorMessage = "Unauthorized"

        // When
        val results = repository.getCustomerOrders().toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        assertThat(results.last()).isInstanceOf(Resource.Error::class.java)
    }

    @Test
    fun `getCustomerOrders handles network error gracefully`() = runTest {
        // Given
        fakeApiService.shouldThrowException = IOException("Connection timeout")

        // When
        val results = repository.getCustomerOrders().toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("Connection timeout")
    }

    // ==================== createOrder Tests ====================

    @Test
    fun `createOrder emits Loading then Success with created order`() = runTest {
        // Given
        val createdOrder = TestDataFactory.createOrder(
            id = "new-order-123",
            status = "pending",
            totalCents = 2500
        )
        fakeApiService.createOrderResponse = Response.success(
            TestDataFactory.createOrderResponse(order = createdOrder)
        )

        // When
        val orderData = mapOf(
            "businessId" to "business-123",
            "items" to listOf(mapOf("dishId" to "dish-1", "quantity" to 2))
        )
        val results = repository.createOrder(orderData).toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        val successResult = results.last() as Resource.Success<OrderDto>
        assertThat(successResult.data.id).isEqualTo("new-order-123")
        assertThat(successResult.data.totalCents).isEqualTo(2500)
    }

    @Test
    fun `createOrder caches order on success`() = runTest {
        // Given
        val createdOrder = TestDataFactory.createOrder(id = "new-order-123")
        fakeApiService.createOrderResponse = Response.success(
            TestDataFactory.createOrderResponse(order = createdOrder)
        )

        // When
        repository.createOrder(mapOf("businessId" to "business-123")).toList()

        // Then
        verify(mockOrderDao).insertOrder(any())
    }

    @Test
    fun `createOrder emits Error on API failure`() = runTest {
        // Given
        fakeApiService.errorCode = 400
        fakeApiService.errorMessage = "Invalid order data"

        // When
        val results = repository.createOrder(mapOf("businessId" to "business-123")).toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        assertThat(results.last()).isInstanceOf(Resource.Error::class.java)
    }

    @Test
    fun `createOrder handles network error gracefully`() = runTest {
        // Given
        fakeApiService.shouldThrowException = IOException("Network unavailable")

        // When
        val results = repository.createOrder(mapOf("businessId" to "business-123")).toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("Network unavailable")
    }

    // ==================== updateOrderStatus Tests ====================

    @Test
    fun `updateOrderStatus emits Loading then Success with updated order`() = runTest {
        // Given
        val updatedOrder = TestDataFactory.createOrder(
            id = "order-123",
            status = "confirmed"
        )
        fakeApiService.updateOrderStatusResponse = Response.success(
            TestDataFactory.createOrderResponse(order = updatedOrder)
        )

        // When
        val results = repository.updateOrderStatus("order-123", "confirmed").toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        val successResult = results.last() as Resource.Success<OrderDto>
        assertThat(successResult.data.status).isEqualTo("confirmed")
    }

    @Test
    fun `updateOrderStatus caches updated order`() = runTest {
        // Given
        val updatedOrder = TestDataFactory.createOrder(id = "order-123", status = "preparing")
        fakeApiService.updateOrderStatusResponse = Response.success(
            TestDataFactory.createOrderResponse(order = updatedOrder)
        )

        // When
        repository.updateOrderStatus("order-123", "preparing").toList()

        // Then
        verify(mockOrderDao).insertOrder(any())
    }

    @Test
    fun `updateOrderStatus emits Error on API failure`() = runTest {
        // Given
        fakeApiService.errorCode = 404
        fakeApiService.errorMessage = "Order not found"

        // When
        val results = repository.updateOrderStatus("nonexistent-order", "confirmed").toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        assertThat(results.last()).isInstanceOf(Resource.Error::class.java)
    }

    @Test
    fun `updateOrderStatus handles network error gracefully`() = runTest {
        // Given
        fakeApiService.shouldThrowException = IOException("Connection lost")

        // When
        val results = repository.updateOrderStatus("order-123", "confirmed").toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("Connection lost")
    }

    // ==================== Order Status Transition Tests ====================

    @Test
    fun `updateOrderStatus transitions from pending to confirmed`() = runTest {
        // Given
        val updatedOrder = TestDataFactory.createOrder(id = "order-123", status = "confirmed")
        fakeApiService.updateOrderStatusResponse = Response.success(
            TestDataFactory.createOrderResponse(order = updatedOrder)
        )

        // When
        val results = repository.updateOrderStatus("order-123", "confirmed").toList()

        // Then
        val successResult = results.last() as Resource.Success<OrderDto>
        assertThat(successResult.data.status).isEqualTo("confirmed")
    }

    @Test
    fun `updateOrderStatus transitions from confirmed to preparing`() = runTest {
        // Given
        val updatedOrder = TestDataFactory.createOrder(id = "order-123", status = "preparing")
        fakeApiService.updateOrderStatusResponse = Response.success(
            TestDataFactory.createOrderResponse(order = updatedOrder)
        )

        // When
        val results = repository.updateOrderStatus("order-123", "preparing").toList()

        // Then
        val successResult = results.last() as Resource.Success<OrderDto>
        assertThat(successResult.data.status).isEqualTo("preparing")
    }

    @Test
    fun `updateOrderStatus transitions from preparing to ready`() = runTest {
        // Given
        val updatedOrder = TestDataFactory.createOrder(id = "order-123", status = "ready")
        fakeApiService.updateOrderStatusResponse = Response.success(
            TestDataFactory.createOrderResponse(order = updatedOrder)
        )

        // When
        val results = repository.updateOrderStatus("order-123", "ready").toList()

        // Then
        val successResult = results.last() as Resource.Success<OrderDto>
        assertThat(successResult.data.status).isEqualTo("ready")
    }

    @Test
    fun `updateOrderStatus transitions from ready to delivered`() = runTest {
        // Given
        val updatedOrder = TestDataFactory.createOrder(id = "order-123", status = "delivered")
        fakeApiService.updateOrderStatusResponse = Response.success(
            TestDataFactory.createOrderResponse(order = updatedOrder)
        )

        // When
        val results = repository.updateOrderStatus("order-123", "delivered").toList()

        // Then
        val successResult = results.last() as Resource.Success<OrderDto>
        assertThat(successResult.data.status).isEqualTo("delivered")
    }
}


// ==================== Property-Based Tests ====================

/**
 * **Feature: android-test-coverage, Property 1: Repository Success Response Handling**
 * **Validates: Requirements 1.1, 1.3**
 *
 * Property: For any repository method and valid API response, calling the method
 * SHALL emit Resource.Loading followed by Resource.Success containing the expected data.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class RepositorySuccessResponsePropertyTest {

    @get:Rule
    val dispatcherRule = TestDispatcherRule()

    private lateinit var fakeApiService: FakeApiService
    private lateinit var mockOrderDao: OrderDao
    private lateinit var repository: OrderRepositoryImpl

    @Before
    fun setup() {
        fakeApiService = FakeApiService()
        mockOrderDao = mock()
        repository = OrderRepositoryImpl(fakeApiService, mockOrderDao)
        whenever(mockOrderDao.getOrdersByBusiness(any())).thenReturn(flowOf(emptyList()))
    }

    // Custom Arb for non-blank strings
    private fun arbNonBlankString(range: IntRange): Arb<String> = arbitrary { rs ->
        val chars = ('a'..'z') + ('A'..'Z') + ('0'..'9')
        val length = range.random(rs.random)
        (1..length).map { chars.random(rs.random) }.joinToString("")
    }

    // Custom Arb for order status
    private fun arbOrderStatus(): Arb<String> = arbitrary { rs ->
        listOf("pending", "confirmed", "preparing", "ready", "delivered").random(rs.random)
    }

    @Test
    fun `property - for any valid order response, repository emits Loading then Success`() = runTest {
        // Property: For any valid API response, emit Loading then Success
        checkAll(
            iterations = 100,
            arbNonBlankString(5..20),   // orderId
            arbNonBlankString(5..20),   // businessId
            arbOrderStatus(),            // status
            Arb.positiveInt(1000)        // totalCents
        ) { orderId, businessId, status, totalCents ->
            // Reset state for each iteration
            fakeApiService.reset()
            Mockito.reset(mockOrderDao)
            whenever(mockOrderDao.getOrdersByBusiness(any())).thenReturn(flowOf(emptyList()))
            
            // Given - a valid order response
            val order = TestDataFactory.createOrder(
                id = orderId,
                businessId = businessId,
                status = status,
                totalCents = totalCents
            )
            fakeApiService.getCustomerOrdersResponse = Response.success(
                TestDataFactory.createOrderListResponse(orders = listOf(order))
            )

            // When
            val results = repository.getCustomerOrders().toList()

            // Then - should emit Loading first
            assertThat(results.first()).isEqualTo(Resource.Loading)
            
            // And then Success with correct data
            val successResult = results.last() as Resource.Success<List<OrderDto>>
            assertThat(successResult.data).hasSize(1)
            assertThat(successResult.data[0].id).isEqualTo(orderId)
            assertThat(successResult.data[0].status).isEqualTo(status)
            assertThat(successResult.data[0].totalCents).isEqualTo(totalCents)
        }
    }

    @Test
    fun `property - for any valid create order response, repository emits Loading then Success`() = runTest {
        // Property: For any valid create order response, emit Loading then Success
        checkAll(
            iterations = 100,
            arbNonBlankString(5..20),   // orderId
            Arb.positiveInt(1000)        // totalCents
        ) { orderId, totalCents ->
            // Reset state for each iteration
            fakeApiService.reset()
            Mockito.reset(mockOrderDao)
            
            // Given - a valid create order response
            val order = TestDataFactory.createOrder(
                id = orderId,
                totalCents = totalCents
            )
            fakeApiService.createOrderResponse = Response.success(
                TestDataFactory.createOrderResponse(order = order)
            )

            // When
            val results = repository.createOrder(mapOf("businessId" to "test")).toList()

            // Then - should emit Loading first
            assertThat(results.first()).isEqualTo(Resource.Loading)
            
            // And then Success with correct data
            val successResult = results.last() as Resource.Success<OrderDto>
            assertThat(successResult.data.id).isEqualTo(orderId)
            assertThat(successResult.data.totalCents).isEqualTo(totalCents)
        }
    }
}


/**
 * **Feature: android-test-coverage, Property 2: Repository Error Response Handling**
 * **Validates: Requirements 1.2, 1.3**
 *
 * Property: For any repository method and API error response, calling the method
 * SHALL emit Resource.Loading followed by Resource.Error with the error message.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class RepositoryErrorResponsePropertyTest {

    @get:Rule
    val dispatcherRule = TestDispatcherRule()

    private lateinit var fakeApiService: FakeApiService
    private lateinit var mockOrderDao: OrderDao
    private lateinit var repository: OrderRepositoryImpl

    @Before
    fun setup() {
        fakeApiService = FakeApiService()
        mockOrderDao = mock()
        repository = OrderRepositoryImpl(fakeApiService, mockOrderDao)
        whenever(mockOrderDao.getOrdersByBusiness(any())).thenReturn(flowOf(emptyList()))
    }

    // Custom Arb for HTTP error codes
    private fun arbHttpErrorCode(): Arb<Int> = arbitrary { rs ->
        listOf(400, 401, 403, 404, 500, 502, 503).random(rs.random)
    }

    // Custom Arb for error messages
    private fun arbErrorMessage(): Arb<String> = arbitrary { rs ->
        listOf(
            "Bad Request",
            "Unauthorized",
            "Forbidden",
            "Not Found",
            "Internal Server Error",
            "Bad Gateway",
            "Service Unavailable"
        ).random(rs.random)
    }

    @Test
    fun `property - for any HTTP error, repository emits Loading then Error`() = runTest {
        // Property: For any HTTP error response, emit Loading then Error
        checkAll(
            iterations = 100,
            arbHttpErrorCode(),
            arbErrorMessage()
        ) { errorCode, errorMessage ->
            // Reset state for each iteration
            fakeApiService.reset()
            Mockito.reset(mockOrderDao)
            whenever(mockOrderDao.getOrdersByBusiness(any())).thenReturn(flowOf(emptyList()))
            
            // Given - an HTTP error response
            fakeApiService.errorCode = errorCode
            fakeApiService.errorMessage = errorMessage

            // When
            val results = repository.getCustomerOrders().toList()

            // Then - should emit Loading first
            assertThat(results.first()).isEqualTo(Resource.Loading)
            
            // And then Error
            assertThat(results.last()).isInstanceOf(Resource.Error::class.java)
        }
    }

    @Test
    fun `property - for any network exception, repository emits Loading then Error with message`() = runTest {
        // Property: For any network exception, emit Loading then Error with exception message
        checkAll(
            iterations = 100,
            arbErrorMessage()
        ) { errorMessage ->
            // Reset state for each iteration
            fakeApiService.reset()
            Mockito.reset(mockOrderDao)
            whenever(mockOrderDao.getOrdersByBusiness(any())).thenReturn(flowOf(emptyList()))
            
            // Given - a network exception
            fakeApiService.shouldThrowException = IOException(errorMessage)

            // When
            val results = repository.getCustomerOrders().toList()

            // Then - should emit Loading first
            assertThat(results.first()).isEqualTo(Resource.Loading)
            
            // And then Error with the exception message
            val errorResult = results.last() as Resource.Error
            assertThat(errorResult.message).contains(errorMessage)
        }
    }

    @Test
    fun `property - for any error during create order, repository emits Loading then Error`() = runTest {
        // Property: For any error during create order, emit Loading then Error
        checkAll(
            iterations = 100,
            arbHttpErrorCode()
        ) { errorCode ->
            // Reset state for each iteration
            fakeApiService.reset()
            Mockito.reset(mockOrderDao)
            
            // Given - an HTTP error response
            fakeApiService.errorCode = errorCode

            // When
            val results = repository.createOrder(mapOf("businessId" to "test")).toList()

            // Then - should emit Loading first
            assertThat(results.first()).isEqualTo(Resource.Loading)
            
            // And then Error
            assertThat(results.last()).isInstanceOf(Resource.Error::class.java)
        }
    }
}
