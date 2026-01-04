package com.menumaker.fakes

import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.OrderDto
import com.menumaker.data.remote.models.OrderItemDto
import com.menumaker.data.repository.OrderRepository
import com.menumaker.fixtures.SharedFixtures
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

/**
 * Fake implementation of OrderRepository for UI tests.
 * Provides configurable responses for deterministic testing.
 */
class FakeOrderRepository : OrderRepository {

    // Configurable responses
    var businessOrdersResponse: Resource<List<OrderDto>>? = null
    var customerOrdersResponse: Resource<List<OrderDto>>? = null
    var createOrderResponse: Resource<OrderDto>? = null
    var orderByIdResponse: Resource<OrderDto>? = null
    var updateStatusResponse: Resource<OrderDto>? = null

    // In-memory storage for orders
    private val orders = mutableListOf<OrderDto>()

    // Track method calls for verification
    var getBusinessOrdersCallCount = 0
    var getCustomerOrdersCallCount = 0
    var createOrderCallCount = 0
    var getOrderByIdCallCount = 0
    var updateStatusCallCount = 0
    var lastBusinessId: String? = null
    var lastOrderId: String? = null
    var lastStatus: String? = null

    private val defaultOrders: List<OrderDto>
        get() = SharedFixtures.orders.map { order ->
            order.copy(items = order.items.map { it.copy() })
        }

    init {
        orders.addAll(defaultOrders)
    }

    override fun getOrdersByBusiness(businessId: String): Flow<Resource<List<OrderDto>>> = flow {
        emit(Resource.Loading)
        getBusinessOrdersCallCount++
        lastBusinessId = businessId
        
        val response = businessOrdersResponse 
            ?: Resource.Success(orders.filter { it.businessId == businessId })
        emit(response)
    }

    override fun getCustomerOrders(): Flow<Resource<List<OrderDto>>> = flow {
        emit(Resource.Loading)
        getCustomerOrdersCallCount++
        
        val response = customerOrdersResponse ?: Resource.Success(orders.toList())
        emit(response)
    }

    override fun createOrder(order: Map<String, Any>): Flow<Resource<OrderDto>> = flow {
        emit(Resource.Loading)
        createOrderCallCount++
        
        if (createOrderResponse != null) {
            emit(createOrderResponse!!)
        } else {
            val fallback = defaultOrders.firstOrNull()
            val newOrder = (fallback ?: OrderDto(
                id = "order-${System.currentTimeMillis()}",
                businessId = order["business_id"] as? String ?: "business-1",
                customerName = "Test Customer",
                customerPhone = "+1234567890",
                customerEmail = "customer@example.com",
                totalCents = order["total_cents"] as? Int ?: 1000,
                status = "pending",
                items = emptyList(),
                createdAt = "2025-01-01T00:00:00Z",
                updatedAt = "2025-01-01T00:00:00Z"
            )).copy(
                id = "order-${System.currentTimeMillis()}",
                businessId = order["business_id"] as? String ?: fallback?.businessId ?: "business-1",
                totalCents = order["total_cents"] as? Int ?: fallback?.totalCents ?: 1000,
                status = "pending"
            )
            orders.add(newOrder)
            emit(Resource.Success(newOrder))
        }
    }

    override fun getOrderById(id: String): Flow<Resource<OrderDto>> = flow {
        emit(Resource.Loading)
        getOrderByIdCallCount++
        lastOrderId = id
        
        if (orderByIdResponse != null) {
            emit(orderByIdResponse!!)
        } else {
            val order = orders.find { it.id == id }
            if (order != null) {
                emit(Resource.Success(order))
            } else {
                emit(Resource.Error("Order not found"))
            }
        }
    }

    override fun updateOrderStatus(id: String, status: String): Flow<Resource<OrderDto>> = flow {
        emit(Resource.Loading)
        updateStatusCallCount++
        lastOrderId = id
        lastStatus = status
        
        if (updateStatusResponse != null) {
            emit(updateStatusResponse!!)
        } else {
            val index = orders.indexOfFirst { it.id == id }
            if (index >= 0) {
                val updatedOrder = orders[index].copy(status = status)
                orders[index] = updatedOrder
                emit(Resource.Success(updatedOrder))
            } else {
                emit(Resource.Error("Order not found"))
            }
        }
    }

    /**
     * Reset all state for clean test setup
     */
    fun reset() {
        businessOrdersResponse = null
        customerOrdersResponse = null
        createOrderResponse = null
        orderByIdResponse = null
        updateStatusResponse = null
        orders.clear()
        orders.addAll(defaultOrders)
        getBusinessOrdersCallCount = 0
        getCustomerOrdersCallCount = 0
        createOrderCallCount = 0
        getOrderByIdCallCount = 0
        updateStatusCallCount = 0
        lastBusinessId = null
        lastOrderId = null
        lastStatus = null
    }

    /**
     * Add an order to the in-memory storage
     */
    fun addOrder(order: OrderDto) {
        orders.add(order)
    }

    /**
     * Get all orders in storage
     */
    fun getAllOrders(): List<OrderDto> = orders.toList()

    /**
     * Configure for empty orders scenario
     */
    fun configureEmptyOrders() {
        orders.clear()
        businessOrdersResponse = Resource.Success(emptyList())
        customerOrdersResponse = Resource.Success(emptyList())
    }

    /**
     * Configure for error scenario
     */
    fun configureError(errorMessage: String = "Failed to load orders") {
        businessOrdersResponse = Resource.Error(errorMessage)
        customerOrdersResponse = Resource.Error(errorMessage)
    }
}
