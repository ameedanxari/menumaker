package com.menumaker.fakes

import com.menumaker.data.local.entities.CartEntity
import com.menumaker.data.repository.CartRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map

/**
 * Fake implementation of CartRepository for UI tests.
 * Uses in-memory storage for deterministic testing.
 */
class FakeCartRepository : CartRepository {

    // In-memory storage for cart items
    private val cartItems = MutableStateFlow<List<CartEntity>>(emptyList())

    // Track method calls for verification
    var addToCartCallCount = 0
    var updateCartItemCallCount = 0
    var removeFromCartCallCount = 0
    var clearCartCallCount = 0
    var lastAddedItem: CartEntity? = null
    var lastUpdatedItem: CartEntity? = null
    var lastRemovedDishId: String? = null
    var lastClearedBusinessId: String? = null

    override fun getCartItems(businessId: String): Flow<List<CartEntity>> {
        return cartItems.map { items ->
            items.filter { it.businessId == businessId }
        }
    }

    override fun getAllCartItems(): Flow<List<CartEntity>> {
        return cartItems
    }

    override suspend fun addToCart(item: CartEntity) {
        addToCartCallCount++
        lastAddedItem = item
        
        val currentItems = cartItems.value.toMutableList()
        val existingIndex = currentItems.indexOfFirst { it.dishId == item.dishId }
        
        if (existingIndex >= 0) {
            // Update quantity if item already exists
            val existing = currentItems[existingIndex]
            currentItems[existingIndex] = existing.copy(
                quantity = existing.quantity + item.quantity
            )
        } else {
            currentItems.add(item)
        }
        
        cartItems.value = currentItems
    }

    override suspend fun updateCartItem(item: CartEntity) {
        updateCartItemCallCount++
        lastUpdatedItem = item
        
        val currentItems = cartItems.value.toMutableList()
        val index = currentItems.indexOfFirst { it.dishId == item.dishId }
        
        if (index >= 0) {
            if (item.quantity <= 0) {
                // Remove item if quantity is zero or negative
                currentItems.removeAt(index)
            } else {
                currentItems[index] = item
            }
            cartItems.value = currentItems
        }
    }

    override suspend fun removeFromCart(dishId: String) {
        removeFromCartCallCount++
        lastRemovedDishId = dishId
        
        val currentItems = cartItems.value.toMutableList()
        currentItems.removeAll { it.dishId == dishId }
        cartItems.value = currentItems
    }

    override suspend fun clearCart(businessId: String) {
        clearCartCallCount++
        lastClearedBusinessId = businessId
        
        val currentItems = cartItems.value.toMutableList()
        currentItems.removeAll { it.businessId == businessId }
        cartItems.value = currentItems
    }

    override fun getCartTotal(businessId: String): Flow<Int> {
        return cartItems.map { items ->
            items.filter { it.businessId == businessId }
                .sumOf { it.priceCents * it.quantity }
        }
    }

    /**
     * Reset all state for clean test setup
     */
    fun reset() {
        cartItems.value = emptyList()
        addToCartCallCount = 0
        updateCartItemCallCount = 0
        removeFromCartCallCount = 0
        clearCartCallCount = 0
        lastAddedItem = null
        lastUpdatedItem = null
        lastRemovedDishId = null
        lastClearedBusinessId = null
    }

    /**
     * Set cart items directly for test setup
     */
    fun setCartItems(items: List<CartEntity>) {
        cartItems.value = items
    }

    /**
     * Get current cart items for verification
     */
    fun getCurrentCartItems(): List<CartEntity> = cartItems.value

    /**
     * Get cart item count
     */
    fun getCartItemCount(): Int = cartItems.value.size

    /**
     * Get total cart value
     */
    fun getTotalCartValue(): Int = cartItems.value.sumOf { it.priceCents * it.quantity }

    /**
     * Configure cart with sample items
     */
    fun configureSampleCart(businessId: String = "business-1") {
        cartItems.value = listOf(
            CartEntity(
                dishId = "dish-1",
                businessId = businessId,
                dishName = "Test Dish 1",
                quantity = 2,
                priceCents = 500
            ),
            CartEntity(
                dishId = "dish-2",
                businessId = businessId,
                dishName = "Test Dish 2",
                quantity = 1,
                priceCents = 750
            )
        )
    }
}
