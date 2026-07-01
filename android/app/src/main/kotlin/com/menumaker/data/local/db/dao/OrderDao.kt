package com.menumaker.data.local.db.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.menumaker.data.local.entities.OrderEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface OrderDao {

    @Query("SELECT * FROM orders WHERE id = :orderId")
    fun getOrderById(orderId: String): Flow<OrderEntity?>

    @Query("SELECT * FROM orders WHERE business_id = :businessId ORDER BY created_at DESC")
    fun getOrdersByBusiness(businessId: String): Flow<List<OrderEntity>>

    @Query("SELECT * FROM orders WHERE sync_pending = 1 AND sync_blocked = 0 ORDER BY enqueue_time ASC, created_at ASC")
    fun getPendingSyncOrders(): Flow<List<OrderEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrder(order: OrderEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrders(orders: List<OrderEntity>)

    @Update
    suspend fun updateOrder(order: OrderEntity)

    @Query("UPDATE orders SET sync_pending = 0, sync_blocked = 0, last_sync_error = NULL WHERE id = :orderId")
    suspend fun markSynced(orderId: String)

    @Query(
        """
        UPDATE orders
        SET sync_pending = 0,
            sync_blocked = 0,
            server_order_id = :serverOrderId,
            last_sync_error = NULL
        WHERE id = :orderId
        """
    )
    suspend fun markSyncedWithServerId(orderId: String, serverOrderId: String?)

    @Query(
        """
        UPDATE orders
        SET attempt_count = :attemptCount,
            next_attempt_at = :nextAttemptAt,
            last_sync_error = :lastSyncError,
            sync_blocked = :blocked
        WHERE id = :orderId
        """
    )
    suspend fun markSyncFailed(
        orderId: String,
        attemptCount: Int,
        nextAttemptAt: Long,
        lastSyncError: String,
        blocked: Boolean
    )

    @Query("DELETE FROM orders WHERE id = :orderId")
    suspend fun deleteOrder(orderId: String)

    @Query("DELETE FROM orders")
    suspend fun deleteAll()
}
