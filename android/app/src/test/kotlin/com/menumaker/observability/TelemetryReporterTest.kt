package com.menumaker.observability

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TelemetryReporterTest {
    @Test
    fun `sync failure telemetry includes release environment operation and correlation id`() {
        val sent = mutableListOf<TelemetryEvent>()
        val reporter = TelemetryReporter(object : TelemetrySink {
            override fun send(event: TelemetryEvent) {
                sent += event
            }
        })

        val event = reporter.reportSyncFailure(
            release = "1.0.0",
            environment = "staging",
            operation = "orders.sync",
            errorCode = "offline_conflict",
            correlationId = "corr-android",
            metadata = mapOf("workmanager_attempt" to 2)
        )

        assertEquals("sync_failure", event.event)
        assertEquals("1.0.0", event.release)
        assertEquals("staging", event.environment)
        assertEquals("orders.sync", event.operation)
        assertEquals("corr-android", event.correlationId)
        assertEquals(event, sent.single())
    }

    @Test
    fun `redaction removes sensitive keys and values`() {
        val metadata = TelemetryReporter.redact(
            mapOf(
                "authorization" to "Bearer secret-token",
                "customerEmail" to "customer@example.com",
                "note" to "call +1 555 000 1111",
                "safe_code" to "menu_sync"
            )
        )

        val json = metadata.toString()
        assertFalse(json.contains("secret-token"))
        assertFalse(json.contains("customer@example.com"))
        assertFalse(json.contains("+1 555 000 1111"))
        assertTrue(json.contains("menu_sync"))
    }
}
