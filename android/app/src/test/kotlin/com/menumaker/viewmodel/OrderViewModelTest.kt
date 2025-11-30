package com.menumaker.viewmodel

import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.OrderDto
import com.menumaker.data.remote.models.OrderItemDto
import com.menumaker.data.repository.OrderRepository
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
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.mockito.MockitoAnnotations

@ExperimentalCoroutinesApi
class OrderViewModelTest {

    @Mock
    private lateinit var orderRepository: OrderRepository

    private lateinit var viewModel: OrderViewModel

    private val testDispatcher = UnconfinedTestDispatcher()

    private val mockOrderItem = OrderItemDto(
        id = "item-1",
        dishId = "dish-1",
        dishName = "Pizza",
        quantity = 1,
        priceCents = 1000,
        totalCents = 1000
    )

    private val mockOrder = OrderDto(
        id = "order-1",
        businessId = "business-1",
        customerName = "John Doe",
        customerPhone = "+1234567890",
        customerEmail = "john@example.com",
        totalCents = 1000,
        status = "pending",
        items = listOf(mockOrderItem),
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

    @Test
    fun `loadOrders updates ordersState with success`() = runTest {
        // Given
        val businessId = "business-1"
        val orders = listOf(mockOrder)
        val successFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Success(orders))
        }

        `when`(orderRepository.getOrdersByBusiness(businessId)).thenReturn(successFlow)

        // When
        viewModel.loadOrders(businessId)

        // Then
        assertTrue(viewModel.ordersState.value is Resource.Success)
        assertEquals(orders, (viewModel.ordersState.value as Resource.Success).data)
    }

    @Test
    fun `loadCustomerOrders updates ordersState with success`() = runTest {
        // Given
        val orders = listOf(mockOrder)
        val successFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Success(orders))
        }

        `when`(orderRepository.getCustomerOrders()).thenReturn(successFlow)

        // When
        viewModel.loadCustomerOrders()

        // Then
        assertTrue(viewModel.ordersState.value is Resource.Success)
        assertEquals(orders, (viewModel.ordersState.value as Resource.Success).data)
    }

    @Test
    fun `loadOrderDetail updates orderDetailState`() = runTest {
        // Given
        val orderId = "order-1"
        val successFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Success(mockOrder))
        }

        `when`(orderRepository.getOrderById(orderId)).thenReturn(successFlow)

        // When
        viewModel.loadOrderDetail(orderId)

        // Then
        assertTrue(viewModel.orderDetailState.value is Resource.Success)
        assertEquals(mockOrder, (viewModel.orderDetailState.value as Resource.Success).data)
    }

    @Test
    fun `updateOrderStatus updates orderDetailState on success`() = runTest {
        // Given
        val orderId = "order-1"
        val newStatus = "confirmed"
        val updatedOrder = mockOrder.copy(status = newStatus)
        val successFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Success(updatedOrder))
        }

        `when`(orderRepository.updateOrderStatus(orderId, newStatus)).thenReturn(successFlow)

        // When
        viewModel.updateOrderStatus(orderId, newStatus)

        // Then
        assertTrue(viewModel.orderDetailState.value is Resource.Success)
        assertEquals(updatedOrder, (viewModel.orderDetailState.value as Resource.Success).data)
    }

    @Test
    fun `initial state is null`() {
        assertEquals(null, viewModel.ordersState.value)
        assertEquals(null, viewModel.orderDetailState.value)
    }
}
