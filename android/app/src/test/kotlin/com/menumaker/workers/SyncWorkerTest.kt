package com.menumaker.workers

import com.google.common.truth.Truth.assertThat
import com.menumaker.data.local.entities.OrderEntity
import org.junit.Test

class SyncWorkerTest {

    @Test
    fun `pending order payload preserves complete order mutation`() {
        val order = orderEntity(
            itemsPayloadJson = """
                [
                  {"dish_id":"dish-1","dish_name":"Paneer Bowl","quantity":2,"price_cents":1299,"total_cents":2598,"notes":"extra chutney"}
                ]
            """.trimIndent(),
            feesPayloadJson = """{"subtotal_cents":2598,"tax_cents":210,"delivery_cents":399}""",
            addressPayloadJson = """{"line1":"1 Market St","city":"Vancouver","postal_code":"V6B"}""",
            paymentMethodPayloadJson = """{"type":"card","provider_token":"pm_live_123","last4":"4242"}"""
        )

        val payload = PendingOrderSyncPayload.build(order)

        assertThat(payload["pending_mutation_version"]).isEqualTo(1)
        assertThat(payload["operation_id"]).isEqualTo("local-order-1")
        assertThat(payload["idempotency_key"]).isEqualTo("idem-local-order-1")
        assertThat(payload["business_id"]).isEqualTo("business-1")
        assertThat(payload["total_cents"]).isEqualTo(3207)
        assertThat(payload["items"]).isInstanceOf(List::class.java)
        assertThat(payload["fees"]).isInstanceOf(Map::class.java)
        assertThat(payload["delivery_address"]).isInstanceOf(Map::class.java)
        assertThat(payload["payment_method"]).isInstanceOf(Map::class.java)
    }

    @Test
    fun `payment payload redacts PAN and security codes before sync`() {
        val order = orderEntity(
            paymentMethodPayloadJson = """
                {"type":"card","pan":"4111111111111111","cvv":"123","provider_token":"pm_safe","last4":"1111"}
            """.trimIndent()
        )

        @Suppress("UNCHECKED_CAST")
        val payment = PendingOrderSyncPayload.build(order)["payment_method"] as Map<String, Any>

        assertThat(payment).doesNotContainKey("pan")
        assertThat(payment).doesNotContainKey("cvv")
        assertThat(payment["provider_token"]).isEqualTo("pm_safe")
        assertThat(payment["last4"]).isEqualTo("1111")
    }

    @Test
    fun `idempotency key is stable across repeated payload builds`() {
        val order = orderEntity()

        val first = PendingOrderSyncPayload.build(order)
        val second = PendingOrderSyncPayload.build(order)

        assertThat(first["idempotency_key"]).isEqualTo(second["idempotency_key"])
        assertThat(first["operation_id"]).isEqualTo(second["operation_id"])
    }

    private fun orderEntity(
        itemsPayloadJson: String = """[{"dish_id":"dish-1","quantity":1,"price_cents":3207,"total_cents":3207}]""",
        feesPayloadJson: String = """{"subtotal_cents":3207}""",
        addressPayloadJson: String = """{"type":"pickup"}""",
        paymentMethodPayloadJson: String = """{"type":"cash"}"""
    ): OrderEntity {
        return OrderEntity(
            id = "local-order-1",
            businessId = "business-1",
            customerName = "Offline Customer",
            customerPhone = "+15555550123",
            customerEmail = "offline@example.com",
            totalCents = 3207,
            status = "pending",
            createdAt = "2026-06-20T10:00:00Z",
            updatedAt = "2026-06-20T10:00:00Z",
            syncPending = true,
            idempotencyKey = "idem-local-order-1",
            itemsPayloadJson = itemsPayloadJson,
            feesPayloadJson = feesPayloadJson,
            addressPayloadJson = addressPayloadJson,
            paymentMethodPayloadJson = paymentMethodPayloadJson,
            enqueueTime = 1_800_000_000_000L
        )
    }
}
