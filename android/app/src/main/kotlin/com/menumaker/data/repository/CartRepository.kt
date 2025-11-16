package com.menumaker.data.repository

import com.menumaker.data.local.db.dao.CartDao
import com.menumaker.data.local.entities.CartEntity
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject

interface CartRepository {
    fun getCartItems(businessId: String): Flow<List<CartEntity>>
    suspend fun addToCart(item: CartEntity)
    suspend fun updateCartItem(item: CartEntity)
    suspend fun removeFromCart(dishId: String)
    suspend fun clearCart(businessId: String)
    fun getCartTotal(businessId: String): Flow<Int>
}

class CartRepositoryImpl @Inject constructor(
    private val cartDao: CartDao
) : CartRepository {

    override fun getCartItems(businessId: String): Flow<List<CartEntity>> {
        return cartDao.getCartItems(businessId)
    }

    override suspend fun addToCart(item: CartEntity) {
        cartDao.insertCartItem(item)
    }

    override suspend fun updateCartItem(item: CartEntity) {
        cartDao.updateCartItem(item)
    }

    override suspend fun removeFromCart(dishId: String) {
        cartDao.removeCartItem(dishId)
    }

    override suspend fun clearCart(businessId: String) {
        cartDao.clearCart(businessId)
    }

    override fun getCartTotal(businessId: String): Flow<Int> {
        return cartDao.getCartItems(businessId).map { items ->
            items.sumOf { it.priceCents * it.quantity }
        }
    }
}
