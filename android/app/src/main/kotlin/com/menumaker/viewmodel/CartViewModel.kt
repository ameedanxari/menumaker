package com.menumaker.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.menumaker.data.local.entities.CartEntity
import com.menumaker.data.repository.CartRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class CartViewModel @Inject constructor(
    private val repository: CartRepository
) : ViewModel() {

    private val _cartItems = MutableStateFlow<List<CartEntity>>(emptyList())
    val cartItems: StateFlow<List<CartEntity>> = _cartItems.asStateFlow()

    private val _cartTotal = MutableStateFlow(0)
    val cartTotal: StateFlow<Int> = _cartTotal.asStateFlow()

    fun loadCart(businessId: String) {
        viewModelScope.launch {
            repository.getCartItems(businessId).collect { items ->
                _cartItems.value = items
            }

            repository.getCartTotal(businessId).collect { total ->
                _cartTotal.value = total
            }
        }
    }

    fun addToCart(item: CartEntity) {
        viewModelScope.launch {
            repository.addToCart(item)
        }
    }

    fun updateQuantity(item: CartEntity, quantity: Int) {
        viewModelScope.launch {
            repository.updateCartItem(item.copy(quantity = quantity))
        }
    }

    fun removeItem(dishId: String) {
        viewModelScope.launch {
            repository.removeFromCart(dishId)
        }
    }

    fun clearCart(businessId: String) {
        viewModelScope.launch {
            repository.clearCart(businessId)
        }
    }
}
