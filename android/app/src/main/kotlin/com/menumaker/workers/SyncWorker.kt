package com.menumaker.workers

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import com.menumaker.data.local.db.dao.OrderDao
import com.menumaker.data.local.entities.OrderEntity
import com.menumaker.data.remote.api.ApiService
import com.google.gson.Gson
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.coroutines.flow.first
import retrofit2.HttpException
import kotlin.math.min
import kotlin.random.Random

@HiltWorker
class SyncWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val orderDao: OrderDao,
    private val apiService: ApiService
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        return try {
            val pendingOrders = orderDao.getPendingSyncOrders().first()
            var retryableFailure = false

            pendingOrders.forEachIndexed { index, order ->
                if (order.nextAttemptAt > System.currentTimeMillis()) {
                    retryableFailure = true
                    return@forEachIndexed
                }

                setProgress(
                    workDataOf(
                        PROGRESS_TOTAL to pendingOrders.size,
                        PROGRESS_INDEX to index,
                        PROGRESS_ORDER_ID to order.id,
                        PROGRESS_STATUS to "syncing"
                    )
                )

                try {
                    val response = apiService.createOrder(PendingOrderSyncPayload.build(order))

                    if (response.isSuccessful) {
                        orderDao.markSyncedWithServerId(
                            orderId = order.id,
                            serverOrderId = response.body()?.data?.order?.id
                        )
                        setProgress(
                            workDataOf(
                                PROGRESS_TOTAL to pendingOrders.size,
                                PROGRESS_INDEX to index + 1,
                                PROGRESS_ORDER_ID to order.id,
                                PROGRESS_STATUS to "synced"
                            )
                        )
                    } else {
                        val classification = classifyHttpStatus(response.code())
                        handleFailure(order, classification, response.message())
                        retryableFailure = retryableFailure || classification.retryable
                    }
                } catch (e: Exception) {
                    val classification = classifyException(e)
                    handleFailure(order, classification, e.message ?: "Sync failed")
                    retryableFailure = retryableFailure || classification.retryable
                }
            }

            if (retryableFailure) Result.retry() else Result.success()
        } catch (e: Exception) {
            e.printStackTrace()
            Result.retry()
        }
    }

    private suspend fun handleFailure(
        order: OrderEntity,
        classification: SyncFailureClassification,
        rawMessage: String
    ) {
        val attempts = order.attemptCount + 1
        val blocked = !classification.retryable
        orderDao.markSyncFailed(
            orderId = order.id,
            attemptCount = attempts,
            nextAttemptAt = if (blocked) 0L else System.currentTimeMillis() + nextBackoffMillis(attempts),
            lastSyncError = redactSyncError(rawMessage),
            blocked = blocked
        )
    }

    private fun classifyHttpStatus(statusCode: Int): SyncFailureClassification {
        return when (statusCode) {
            408, 425, 429 -> SyncFailureClassification.Retryable
            in 500..599 -> SyncFailureClassification.Retryable
            in 400..499 -> SyncFailureClassification.Permanent
            else -> SyncFailureClassification.Retryable
        }
    }

    private fun classifyException(exception: Exception): SyncFailureClassification {
        return when (exception) {
            is HttpException -> classifyHttpStatus(exception.code())
            else -> SyncFailureClassification.Retryable
        }
    }

    private fun nextBackoffMillis(attempts: Int): Long {
        val exponential = min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * (1L shl min(attempts, 6)))
        return exponential + Random.nextLong(0L, JITTER_MS)
    }

    private fun redactSyncError(message: String): String {
        return message
            .replace(Regex("\\b\\d{12,19}\\b"), "[redacted-card]")
            .replace(Regex("(?i)(cvv|cvc|security_code)=?\\S*"), "$1=[redacted]")
            .take(300)
    }

    sealed class SyncFailureClassification(val retryable: Boolean) {
        data object Retryable : SyncFailureClassification(true)
        data object Permanent : SyncFailureClassification(false)
    }

    companion object {
        const val PROGRESS_TOTAL = "sync_total"
        const val PROGRESS_INDEX = "sync_index"
        const val PROGRESS_ORDER_ID = "sync_order_id"
        const val PROGRESS_STATUS = "sync_status"
        private const val BASE_BACKOFF_MS = 30_000L
        private const val MAX_BACKOFF_MS = 30 * 60_000L
        private const val JITTER_MS = 5_000L
    }
}

object PendingOrderSyncPayload {
    private val gson = Gson()
    private val blockedPaymentKeys = setOf("pan", "card_number", "number", "cvv", "cvc", "security_code")

    fun build(order: OrderEntity): Map<String, Any> {
        return mapOf(
            "pending_mutation_version" to order.pendingMutationVersion,
            "operation_id" to order.id,
            "idempotency_key" to order.idempotencyKey,
            "business_id" to order.businessId,
            "customer_name" to order.customerName,
            "customer_phone" to (order.customerPhone ?: ""),
            "customer_email" to (order.customerEmail ?: ""),
            "total_cents" to order.totalCents,
            "status" to order.status,
            "items" to parseJsonList(order.itemsPayloadJson),
            "fees" to parseJsonMap(order.feesPayloadJson),
            "delivery_address" to parseJsonMap(order.addressPayloadJson),
            "payment_method" to redactPaymentPayload(parseJsonMap(order.paymentMethodPayloadJson)),
            "client_enqueued_at" to order.enqueueTime,
            "client_created_at" to order.createdAt,
            "client_updated_at" to order.updatedAt
        )
    }

    fun redactPaymentPayload(payload: Map<String, Any>): Map<String, Any> {
        return payload.filterKeys { it.lowercase() !in blockedPaymentKeys }
    }

    private fun parseJsonList(json: String): List<Any> {
        return runCatching {
            @Suppress("UNCHECKED_CAST")
            gson.fromJson(json, List::class.java) as? List<Any>
        }.getOrNull() ?: emptyList()
    }

    private fun parseJsonMap(json: String): Map<String, Any> {
        return runCatching {
            @Suppress("UNCHECKED_CAST")
            gson.fromJson(json, Map::class.java) as? Map<String, Any>
        }.getOrNull() ?: emptyMap()
    }
}
