package com.menumaker.workers

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.menumaker.data.local.db.dao.OrderDao
import com.menumaker.data.remote.api.ApiService
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.coroutines.flow.first

@HiltWorker
class SyncWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val orderDao: OrderDao,
    private val apiService: ApiService
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        return try {
            // Sync pending orders
            val pendingOrders = orderDao.getPendingSyncOrders().first()

            pendingOrders.forEach { order ->
                try {
                    // Attempt to sync order to backend
                    val orderData = mapOf(
                        "business_id" to order.businessId,
                        "customer_name" to order.customerName,
                        "total_cents" to order.totalCents,
                        "status" to order.status
                    )

                    val response = apiService.createOrder(orderData)

                    if (response.isSuccessful) {
                        // Mark as synced
                        orderDao.markSynced(order.id)
                    }
                } catch (e: Exception) {
                    // Skip this order and continue with others
                    e.printStackTrace()
                }
            }

            Result.success()
        } catch (e: Exception) {
            e.printStackTrace()
            Result.retry()
        }
    }
}
