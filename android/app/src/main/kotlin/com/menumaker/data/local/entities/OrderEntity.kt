package com.menumaker.data.local.entities

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "orders")
data class OrderEntity(
    @PrimaryKey
    @ColumnInfo(name = "id")
    val id: String,

    @ColumnInfo(name = "business_id")
    val businessId: String,

    @ColumnInfo(name = "customer_name")
    val customerName: String,

    @ColumnInfo(name = "customer_phone")
    val customerPhone: String?,

    @ColumnInfo(name = "customer_email")
    val customerEmail: String?,

    @ColumnInfo(name = "total_cents")
    val totalCents: Int,

    @ColumnInfo(name = "status")
    val status: String,

    @ColumnInfo(name = "created_at")
    val createdAt: String,

    @ColumnInfo(name = "updated_at")
    val updatedAt: String,

    @ColumnInfo(name = "cached_at")
    val cachedAt: Long = System.currentTimeMillis(),

    @ColumnInfo(name = "sync_pending")
    val syncPending: Boolean = false,

    @ColumnInfo(name = "pending_mutation_version")
    val pendingMutationVersion: Int = 1,

    @ColumnInfo(name = "idempotency_key")
    val idempotencyKey: String = id,

    @ColumnInfo(name = "items_payload_json")
    val itemsPayloadJson: String = "[]",

    @ColumnInfo(name = "fees_payload_json")
    val feesPayloadJson: String = "{}",

    @ColumnInfo(name = "address_payload_json")
    val addressPayloadJson: String = "{}",

    @ColumnInfo(name = "payment_method_payload_json")
    val paymentMethodPayloadJson: String = "{}",

    @ColumnInfo(name = "enqueue_time")
    val enqueueTime: Long = cachedAt,

    @ColumnInfo(name = "attempt_count")
    val attemptCount: Int = 0,

    @ColumnInfo(name = "next_attempt_at")
    val nextAttemptAt: Long = 0L,

    @ColumnInfo(name = "last_sync_error")
    val lastSyncError: String? = null,

    @ColumnInfo(name = "server_order_id")
    val serverOrderId: String? = null,

    @ColumnInfo(name = "sync_blocked")
    val syncBlocked: Boolean = false
)
