package com.menumaker.data.local.db.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.menumaker.data.local.entities.CartEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface CartDao {
    @Query("SELECT * FROM cart_items WHERE business_id = :businessId")
    fun getCartItems(businessId: String): Flow<List<CartEntity>>

    @Query("SELECT * FROM cart_items")
    fun getAllCartItems(): Flow<List<CartEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCartItem(item: CartEntity)

    @Update
    suspend fun updateCartItem(item: CartEntity)

    @Query("DELETE FROM cart_items WHERE dish_id = :dishId")
    suspend fun removeCartItem(dishId: String)

    @Query("DELETE FROM cart_items WHERE business_id = :businessId")
    suspend fun clearCart(businessId: String)

    @Query("DELETE FROM cart_items")
    suspend fun clearAllCarts()
}
