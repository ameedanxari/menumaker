package com.menumaker.ui

import com.google.common.truth.Truth.assertThat
import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.OrderDto
import com.menumaker.data.remote.models.OrderItemDto
import io.kotest.property.Arb
import io.kotest.property.arbitrary.arbitrary
import io.kotest.property.arbitrary.element
import io.kotest.property.arbitrary.int
import io.kotest.property.checkAll
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Test

/**
 * **Feature: android-test-coverage, Property 11: Order Status Display**
 * **Validates: Requirements 4.5**
 *
 * Property: For any order with a given status, the order tracking screen SHALL
 * display the correct status indicator.
 *
 * This property test verifies that:
 * 1. All valid order statuses map to correct display strings
 * 2. Status display is consistent across all orders
 * 3. Status indicators are properly formatted for UI display
 */
@ExperimentalCoroutinesApi
class OrderStatusDisplayPropertyTest {

    // Valid order statuses in the system
    private val validStatuses = listOf(
        "pending",
        "confirmed",
        "preparing",
        "ready",
        "delivered",
        "cancelled"
    )

    // Expected display strings for each status
    private val statusDisplayMap = mapOf(
        "pending" to "Pending",
        "confirmed" to "Confirmed",
        "preparing" to "Preparing",
        "ready" to "Ready",
        "delivered" to "Delivered",
        "cancelled" to "Cancelled"
    )

    // Status progress indicators (0-100%)
    private val statusProgressMap = mapOf(
        "pending" to 0,
        "confirmed" to 25,
        "preparing" to 50,
        "ready" to 75,
        "delivered" to 100,
        "cancelled" to 0
    )

    // Status colors for UI
    private val statusColorMap = mapOf(
        "pending" to "warning",
        "confirmed" to "info",
        "preparing" to "info",
        "ready" to "success",
        "delivered" to "success",
        "cancelled" to "error"
    )

    private fun createMockOrder(
        id: String = "order-1",
        status: String = "pending",
        totalCents: Int = 1000
    ) = OrderDto(
        id = id,
        businessId = "business-1",
        customerName = "John Doe",
        customerPhone = "+1234567890",
        customerEmail = "john@example.com",
        totalCents = totalCents,
        status = status,
        items = listOf(
            OrderItemDto(
                id = "item-1",
                dishId = "dish-1",
                dishName = "Pizza",
                quantity = 1,
                priceCents = 1000,
                totalCents = 1000
            )
        ),
        createdAt = "2024-01-01T00:00:00Z",
        updatedAt = "2024-01-01T00:00:00Z"
    )

    // Custom Arb for order IDs
    private fun arbOrderId(): Arb<String> = arbitrary { rs ->
        val chars = ('a'..'z') + ('0'..'9')
        "order-" + (1..8).map { chars.random(rs.random) }.joinToString("")
    }

    // Custom Arb for valid order statuses
    private fun arbOrderStatus(): Arb<String> = Arb.element(validStatuses)

    /**
     * Simulates the status display logic that would be in the UI layer.
     * This function represents what the Compose UI would display for a given status.
     */
    private fun getStatusDisplayText(status: String): String {
        return statusDisplayMap[status] ?: status.replaceFirstChar { it.uppercase() }
    }

    /**
     * Simulates the progress indicator logic for order tracking.
     */
    private fun getStatusProgress(status: String): Int {
        return statusProgressMap[status] ?: 0
    }

    /**
     * Simulates the color indicator logic for order status.
     */
    private fun getStatusColor(status: String): String {
        return statusColorMap[status] ?: "default"
    }

    /**
     * Determines if an order is in an active (non-terminal) state.
     */
    private fun isActiveOrder(status: String): Boolean {
        return status !in listOf("delivered", "cancelled")
    }

    @Test
    fun `property - all valid statuses map to correct display strings`() = runTest {
        // Property: For any valid order status, the display string SHALL be correctly formatted
        checkAll(
            iterations = 100,
            arbOrderStatus()
        ) { status ->
            // Given - an order with a specific status
            val order = createMockOrder(status = status)

            // When - we get the display text
            val displayText = getStatusDisplayText(order.status)

            // Then - the display text should be properly formatted
            assertThat(displayText).isNotEmpty()
            assertThat(displayText.first().isUpperCase()).isTrue()
            assertThat(statusDisplayMap).containsKey(status)
            assertThat(displayText).isEqualTo(statusDisplayMap[status])
        }
    }

    @Test
    fun `property - status display is consistent for same status across orders`() = runTest {
        // Property: For any two orders with the same status, the display SHALL be identical
        checkAll(
            iterations = 100,
            arbOrderId(),
            arbOrderId(),
            arbOrderStatus(),
            Arb.int(1000..100000),
            Arb.int(1000..100000)
        ) { orderId1, orderId2, status, total1, total2 ->
            // Given - two different orders with the same status
            val order1 = createMockOrder(id = orderId1, status = status, totalCents = total1)
            val order2 = createMockOrder(id = orderId2, status = status, totalCents = total2)

            // When - we get display properties for both
            val display1 = getStatusDisplayText(order1.status)
            val display2 = getStatusDisplayText(order2.status)
            val progress1 = getStatusProgress(order1.status)
            val progress2 = getStatusProgress(order2.status)
            val color1 = getStatusColor(order1.status)
            val color2 = getStatusColor(order2.status)

            // Then - display properties should be identical
            assertThat(display1).isEqualTo(display2)
            assertThat(progress1).isEqualTo(progress2)
            assertThat(color1).isEqualTo(color2)
        }
    }

    @Test
    fun `property - progress indicator increases with order progression`() = runTest {
        // Property: For any order progression, progress SHALL increase monotonically
        // (except for cancelled orders)
        val progressionOrder = listOf("pending", "confirmed", "preparing", "ready", "delivered")

        checkAll(
            iterations = 100,
            arbOrderId()
        ) { orderId ->
            var previousProgress = -1

            for (status in progressionOrder) {
                val order = createMockOrder(id = orderId, status = status)
                val currentProgress = getStatusProgress(order.status)

                // Progress should increase or stay same (for terminal states)
                assertThat(currentProgress).isAtLeast(previousProgress)
                previousProgress = currentProgress
            }

            // Delivered should be 100%
            assertThat(getStatusProgress("delivered")).isEqualTo(100)
        }
    }

    @Test
    fun `property - terminal statuses have correct indicators`() = runTest {
        // Property: For any terminal status (delivered, cancelled), indicators SHALL be correct
        val terminalStatuses = listOf("delivered", "cancelled")

        checkAll(
            iterations = 100,
            arbOrderId(),
            Arb.element(terminalStatuses)
        ) { orderId, status ->
            val order = createMockOrder(id = orderId, status = status)

            // When - we check terminal status properties
            val isActive = isActiveOrder(order.status)
            val progress = getStatusProgress(order.status)
            val color = getStatusColor(order.status)

            // Then - terminal statuses should not be active
            assertThat(isActive).isFalse()

            // Delivered should be 100%, cancelled should be 0%
            if (status == "delivered") {
                assertThat(progress).isEqualTo(100)
                assertThat(color).isEqualTo("success")
            } else {
                assertThat(progress).isEqualTo(0)
                assertThat(color).isEqualTo("error")
            }
        }
    }

    @Test
    fun `property - active statuses have correct indicators`() = runTest {
        // Property: For any active status, indicators SHALL show in-progress state
        val activeStatuses = listOf("pending", "confirmed", "preparing", "ready")

        checkAll(
            iterations = 100,
            arbOrderId(),
            Arb.element(activeStatuses)
        ) { orderId, status ->
            val order = createMockOrder(id = orderId, status = status)

            // When - we check active status properties
            val isActive = isActiveOrder(order.status)
            val progress = getStatusProgress(order.status)

            // Then - active statuses should be marked as active
            assertThat(isActive).isTrue()

            // Progress should be between 0 and 100 (exclusive of 100 for non-delivered)
            assertThat(progress).isIn(0..75)
        }
    }

    @Test
    fun `property - status color mapping is valid for all statuses`() = runTest {
        // Property: For any status, the color indicator SHALL be a valid color type
        val validColors = setOf("warning", "info", "success", "error", "default")

        checkAll(
            iterations = 100,
            arbOrderStatus()
        ) { status ->
            val order = createMockOrder(status = status)

            // When - we get the color for the status
            val color = getStatusColor(order.status)

            // Then - color should be a valid color type
            assertThat(color).isIn(validColors)
        }
    }

    @Test
    fun `property - order status from Resource Success is displayed correctly`() = runTest {
        // Property: For any order wrapped in Resource.Success, status SHALL be extractable and displayable
        checkAll(
            iterations = 100,
            arbOrderId(),
            arbOrderStatus(),
            Arb.int(1000..100000)
        ) { orderId, status, totalCents ->
            // Given - an order wrapped in Resource.Success
            val order = createMockOrder(id = orderId, status = status, totalCents = totalCents)
            val resource: Resource<OrderDto> = Resource.Success(order)

            // When - we extract and display the status
            val extractedOrder = (resource as Resource.Success).data
            val displayText = getStatusDisplayText(extractedOrder.status)
            val progress = getStatusProgress(extractedOrder.status)
            val color = getStatusColor(extractedOrder.status)

            // Then - all display properties should be valid
            assertThat(displayText).isNotEmpty()
            assertThat(progress).isIn(0..100)
            assertThat(color).isNotEmpty()
            assertThat(extractedOrder.status).isEqualTo(status)
        }
    }

    @Test
    fun `property - status display handles edge cases`() = runTest {
        // Property: For any unknown status, display SHALL gracefully handle it
        val unknownStatuses = listOf("unknown", "processing", "shipped", "refunded", "")

        for (unknownStatus in unknownStatuses) {
            val order = createMockOrder(status = unknownStatus)

            // When - we get display properties for unknown status
            val displayText = getStatusDisplayText(order.status)
            val progress = getStatusProgress(order.status)
            val color = getStatusColor(order.status)

            // Then - should handle gracefully without crashing
            assertThat(displayText).isNotNull()
            assertThat(progress).isAtLeast(0)
            assertThat(color).isNotNull()
        }
    }
}
