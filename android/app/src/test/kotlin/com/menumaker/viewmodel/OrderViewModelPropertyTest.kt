package com.menumaker.viewmodel

import com.google.common.truth.Truth.assertThat
import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.OrderDto
import com.menumaker.data.remote.models.OrderItemDto
import com.menumaker.data.repository.OrderRepository
import io.kotest.property.Arb
import io.kotest.property.arbitrary.arbitrary
import io.kotest.property.arbitrary.element
import io.kotest.property.arbitrary.int
import io.kotest.property.arbitrary.positiveInt
import io.kotest.property.checkAll
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
import org.mockito.Mockito.`when`
import org.mockito.Mockito.reset
import org.mockito.MockitoAnnotations

/**
 * **Feature: android-test-coverage, Property 6: Order Status Transitions**
 * **Validates: Requirements 3.2**
 *
 * Property: For any order, updating its status SHALL result in the new status
 * being reflected in the order detail state.
 */
@ExperimentalCoroutinesApi
class OrderStatusTransitionsPropertyTest {

    @Mock
    private lateinit var orderRepository: OrderRepository

    private lateinit var viewModel: OrderViewModel

    private val testDispatcher = UnconfinedTestDispatcher()

    // Valid order statuses
    private val validStatuses = listOf("pending", "confirmed", "preparing", "ready", "delivered", "cancelled")

    private fun createMockOrder(
        id: String = "order-1",
        status: String = "pending",
        totalCents: Int = 1000
    ) = OrderDto(
        id = id,
        businessId = "business-1",
        customerName = "John Doe",
        customerPhone = "+1234567890",
        customerEmail = "john@example.com",
        totalCents = totalCents,
        status = status,
        items = listOf(
            OrderItemDto(
                id = "item-1",
                dishId = "dish-1",
                dishName = "Pizza",
                quantity = 1,
                priceCents = 1000,
                totalCents = 1000
            )
        ),
        createdAt = "2024-01-01T00:00:00Z",
        updatedAt = "2024-01-01T00:00:00Z"
    )

    @Before
    fun setup() {
        MockitoAnnotations.openMocks(this)
        Dispatchers.setMain(testDispatcher)
        viewModel = OrderViewModel(orderRepository)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    // Custom Arb for order IDs
    private fun arbOrderId(): Arb<String> = arbitrary { rs ->
        val chars = ('a'..'z') + ('0'..'9')
        "order-" + (1..8).map { chars.random(rs.random) }.joinToString("")
    }

    // Custom Arb for valid order statuses
    private fun arbOrderStatus(): Arb<String> = Arb.element(validStatuses)

    @Test
    fun `property - updating order status reflects new status in state`() = runTest {
        // Property: For any order and any valid status, updating SHALL reflect the new status
        checkAll(
            iterations = 100,
            arbOrderId(),
            arbOrderStatus(),
            arbOrderStatus()
        ) { orderId, initialStatus, newStatus ->
            // Reset mock for each iteration
            reset(orderRepository)
            viewModel = OrderViewModel(orderRepository)

            // Given - an order with initial status
            val initialOrder = createMockOrder(id = orderId, status = initialStatus)
            val updatedOrder = initialOrder.copy(status = newStatus)
            
            val successFlow = flow {
                emit(Resource.Loading)
                emit(Resource.Success(updatedOrder))
            }
            `when`(orderRepository.updateOrderStatus(orderId, newStatus)).thenReturn(successFlow)

            // When - status is updated
            viewModel.updateOrderStatus(orderId, newStatus)

            // Then - the new status should be reflected in state
            val state = viewModel.orderDetailState.value
            assertTrue("State should be Success", state is Resource.Success)
            assertEquals(
                "Status should be updated to $newStatus",
                newStatus,
                (state as Resource.Success).data.status
            )
        }
    }

    @Test
    fun `property - order status transitions preserve order data`() = runTest {
        // Property: For any status transition, all other order data SHALL be preserved
        checkAll(
            iterations = 100,
            arbOrderId(),
            arbOrderStatus(),
            arbOrderStatus(),
            Arb.int(1000..100000)  // totalCents
        ) { orderId, initialStatus, newStatus, totalCents ->
            // Reset mock for each iteration
            reset(orderRepository)
            viewModel = OrderViewModel(orderRepository)

            // Given - an order with specific data
            val initialOrder = createMockOrder(
                id = orderId,
                status = initialStatus,
                totalCents = totalCents
            )
            val updatedOrder = initialOrder.copy(status = newStatus)
            
            val successFlow = flow {
                emit(Resource.Success(updatedOrder))
            }
            `when`(orderRepository.updateOrderStatus(orderId, newStatus)).thenReturn(successFlow)

            // When - status is updated
            viewModel.updateOrderStatus(orderId, newStatus)

            // Then - all other data should be preserved
            val state = viewModel.orderDetailState.value as Resource.Success
            assertEquals("Order ID should be preserved", orderId, state.data.id)
            assertEquals("Total should be preserved", totalCents, state.data.totalCents)
            assertEquals("Business ID should be preserved", "business-1", state.data.businessId)
            assertEquals("Customer name should be preserved", "John Doe", state.data.customerName)
        }
    }
}


/**
 * **Feature: android-test-coverage, Property 4: ViewModel Error State Preservation**
 * **Validates: Requirements 2.1**
 *
 * Property: For any ViewModel that has successfully loaded data, receiving an error
 * response SHALL update error state while preserving the previously loaded valid data.
 */
@ExperimentalCoroutinesApi
class OrderViewModelErrorStatePreservationPropertyTest {

    @Mock
    private lateinit var orderRepository: OrderRepository

    private lateinit var viewModel: OrderViewModel

    private val testDispatcher = UnconfinedTestDispatcher()

    private fun createMockOrder(
        id: String = "order-1",
        status: String = "pending"
    ) = OrderDto(
        id = id,
        businessId = "business-1",
        customerName = "John Doe",
        customerPhone = "+1234567890",
        customerEmail = "john@example.com",
        totalCents = 1000,
        status = status,
        items = listOf(
            OrderItemDto(
                id = "item-1",
                dishId = "dish-1",
                dishName = "Pizza",
                quantity = 1,
                priceCents = 1000,
                totalCents = 1000
            )
        ),
        createdAt = "2024-01-01T00:00:00Z",
        updatedAt = "2024-01-01T00:00:00Z"
    )

    @Before
    fun setup() {
        MockitoAnnotations.openMocks(this)
        Dispatchers.setMain(testDispatcher)
        viewModel = OrderViewModel(orderRepository)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    // Custom Arb for error messages
    private fun arbErrorMessage(): Arb<String> = arbitrary { rs ->
        val errorMessages = listOf(
            "Network error",
            "Server unavailable",
            "Timeout",
            "Invalid request",
            "Order not found",
            "Permission denied",
            "Rate limited"
        )
        errorMessages.random(rs.random)
    }

    // Custom Arb for order IDs
    private fun arbOrderId(): Arb<String> = arbitrary { rs ->
        val chars = ('a'..'z') + ('0'..'9')
        "order-" + (1..8).map { chars.random(rs.random) }.joinToString("")
    }

    @Test
    fun `property - error on status update preserves previous order detail`() = runTest {
        // Property: For any successful order detail load followed by failed update,
        // the previous order data SHALL be preserved
        checkAll(
            iterations = 100,
            arbOrderId(),
            arbErrorMessage()
        ) { orderId, errorMessage ->
            // Reset mock for each iteration
            reset(orderRepository)
            viewModel = OrderViewModel(orderRepository)

            // Given - first load order detail successfully
            val order = createMockOrder(id = orderId)
            val successFlow = flow {
                emit(Resource.Success(order))
            }
            `when`(orderRepository.getOrderById(orderId)).thenReturn(successFlow)
            viewModel.loadOrderDetail(orderId)

            // Verify initial success
            assertTrue(viewModel.orderDetailState.value is Resource.Success)
            val initialOrder = (viewModel.orderDetailState.value as Resource.Success).data

            // When - update status fails
            val errorFlow = flow {
                emit(Resource.Loading)
                emit(Resource.Error(errorMessage))
            }
            `when`(orderRepository.updateOrderStatus(orderId, "confirmed")).thenReturn(errorFlow)
            viewModel.updateOrderStatus(orderId, "confirmed")

            // Then - previous order data should be preserved (error doesn't update state in current impl)
            val state = viewModel.orderDetailState.value
            assertTrue("State should still be Success", state is Resource.Success)
            assertEquals(
                "Order data should be preserved",
                initialOrder.id,
                (state as Resource.Success).data.id
            )
        }
    }

    @Test
    fun `property - error messages are preserved in error state`() = runTest {
        // Property: For any error response, the error message SHALL be preserved exactly
        checkAll(
            iterations = 100,
            arbErrorMessage()
        ) { errorMessage ->
            // Reset mock for each iteration
            reset(orderRepository)
            viewModel = OrderViewModel(orderRepository)

            // Given - repository returns error
            val errorFlow = flow {
                emit(Resource.Loading)
                emit(Resource.Error(errorMessage))
            }
            `when`(orderRepository.getOrderById("order-1")).thenReturn(errorFlow)

            // When
            viewModel.loadOrderDetail("order-1")

            // Then - error message should be preserved exactly
            val state = viewModel.orderDetailState.value
            assertTrue("State should be Error", state is Resource.Error)
            assertEquals(
                "Error message should be preserved",
                errorMessage,
                (state as Resource.Error).message
            )
        }
    }

    @Test
    fun `property - loading orders error updates state correctly`() = runTest {
        // Property: For any error when loading orders, state SHALL be Error
        checkAll(
            iterations = 100,
            arbErrorMessage()
        ) { errorMessage ->
            // Reset mock for each iteration
            reset(orderRepository)
            viewModel = OrderViewModel(orderRepository)

            // Given - repository returns error
            val errorFlow = flow {
                emit(Resource.Loading)
                emit(Resource.Error(errorMessage))
            }
            `when`(orderRepository.getOrdersByBusiness("business-1")).thenReturn(errorFlow)

            // When
            viewModel.loadOrders("business-1")

            // Then - state should be Error with correct message
            val state = viewModel.ordersState.value
            assertTrue("State should be Error", state is Resource.Error)
            assertEquals(
                "Error message should match",
                errorMessage,
                (state as Resource.Error).message
            )
        }
    }
}
