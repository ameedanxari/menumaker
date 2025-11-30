package com.menumaker.data.repository

import com.menumaker.data.common.Resource
import com.menumaker.data.local.db.dao.OrderDao
import com.menumaker.data.local.entities.OrderEntity
import com.menumaker.data.remote.api.ApiService
import com.menumaker.data.remote.models.OrderDto
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import javax.inject.Inject

interface OrderRepository {
    fun getOrdersByBusiness(businessId: String): Flow<Resource<List<OrderDto>>>
    fun getCustomerOrders(): Flow<Resource<List<OrderDto>>>
    fun createOrder(order: Map<String, Any>): Flow<Resource<OrderDto>>
    fun getOrderById(id: String): Flow<Resource<OrderDto>>
    fun updateOrderStatus(id: String, status: String): Flow<Resource<OrderDto>>
}

class OrderRepositoryImpl @Inject constructor(
    private val apiService: ApiService,
    private val orderDao: OrderDao
) : OrderRepository {

    override fun getOrdersByBusiness(businessId: String): Flow<Resource<List<OrderDto>>> = flow {
        emit(Resource.Loading)
        try {
            // First emit cached data
            orderDao.getOrdersByBusiness(businessId).collect { cached ->
                if (cached.isNotEmpty()) {
                    emit(Resource.Success(cached.map { it.toDto() }))
                }
            }

            // Then fetch fresh data
            val response = apiService.getOrdersByBusiness(businessId)
            if (response.isSuccessful && response.body() != null) {
                val orders = response.body()!!.data.orders
                orderDao.insertOrders(orders.map { it.toEntity() })
                emit(Resource.Success(orders))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to load orders"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }

    override fun getCustomerOrders(): Flow<Resource<List<OrderDto>>> = flow {
        emit(Resource.Loading)
        try {
            val response = apiService.getCustomerOrders()
            if (response.isSuccessful && response.body() != null) {
                val orders = response.body()!!.data.orders
                // We might want to cache these too, but for now just return
                emit(Resource.Success(orders))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to load orders"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }

    override fun createOrder(order: Map<String, Any>): Flow<Resource<OrderDto>> = flow {
        emit(Resource.Loading)
        try {
            val response = apiService.createOrder(order)
            if (response.isSuccessful && response.body() != null) {
                val createdOrder = response.body()!!.data.order
                orderDao.insertOrder(createdOrder.toEntity())
                emit(Resource.Success(createdOrder))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to create order"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }

    override fun getOrderById(id: String): Flow<Resource<OrderDto>> = flow {
        emit(Resource.Loading)
        try {
            val response = apiService.getOrderById(id)
            if (response.isSuccessful && response.body() != null) {
                val order = response.body()!!.data.order
                orderDao.insertOrder(order.toEntity())
                emit(Resource.Success(order))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to load order"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }

    override fun updateOrderStatus(id: String, status: String): Flow<Resource<OrderDto>> = flow {
        emit(Resource.Loading)
        try {
            val response = apiService.updateOrderStatus(id, mapOf("status" to status))
            if (response.isSuccessful && response.body() != null) {
                val order = response.body()!!.data.order
                orderDao.insertOrder(order.toEntity())
                emit(Resource.Success(order))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to update order"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }

    private fun OrderDto.toEntity() = OrderEntity(
        id = id,
        businessId = businessId,
        customerName = customerName,
        customerPhone = customerPhone,
        customerEmail = customerEmail,
        totalCents = totalCents,
        status = status,
        createdAt = createdAt,
        updatedAt = updatedAt
    )

    private fun OrderEntity.toDto() = OrderDto(
        id = id,
        businessId = businessId,
        customerName = customerName,
        customerPhone = customerPhone,
        customerEmail = customerEmail,
        totalCents = totalCents,
        status = status,
        items = emptyList(), // Items would be fetched separately
        createdAt = createdAt,
        updatedAt = updatedAt
    )
}
