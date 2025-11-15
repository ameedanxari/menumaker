package com.menumaker.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.OrderDto
import com.menumaker.data.repository.OrderRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class OrderViewModel @Inject constructor(
    private val orderRepository: OrderRepository
) : ViewModel() {

    private val _ordersState = MutableStateFlow<Resource<List<OrderDto>>?>(null)
    val ordersState: StateFlow<Resource<List<OrderDto>>?> = _ordersState.asStateFlow()

    private val _orderDetailState = MutableStateFlow<Resource<OrderDto>?>(null)
    val orderDetailState: StateFlow<Resource<OrderDto>?> = _orderDetailState.asStateFlow()

    fun loadOrders(businessId: String) {
        viewModelScope.launch {
            orderRepository.getOrdersByBusiness(businessId).collect { resource ->
                _ordersState.value = resource
            }
        }
    }

    fun loadOrderDetail(orderId: String) {
        viewModelScope.launch {
            orderRepository.getOrderById(orderId).collect { resource ->
                _orderDetailState.value = resource
            }
        }
    }

    fun updateOrderStatus(orderId: String, status: String) {
        viewModelScope.launch {
            orderRepository.updateOrderStatus(orderId, status).collect { resource ->
                if (resource is Resource.Success) {
                    _orderDetailState.value = resource
                }
            }
        }
    }
}
