package com.menumaker.observability

enum class TelemetryPlatform { Android }

data class TelemetryEvent(
    val event: String,
    val release: String,
    val environment: String,
    val operation: String,
    val errorCode: String,
    val correlationId: String,
    val metadata: Map<String, Any?> = emptyMap()
)

interface TelemetrySink {
    fun send(event: TelemetryEvent)
}

class TelemetryReporter(private val sink: TelemetrySink) {
    fun reportSyncFailure(
        release: String,
        environment: String,
        operation: String,
        errorCode: String,
        correlationId: String,
        metadata: Map<String, Any?> = emptyMap()
    ): TelemetryEvent {
        val event = TelemetryEvent(
            event = "sync_failure",
            release = release,
            environment = environment,
            operation = operation,
            errorCode = errorCode,
            correlationId = correlationId,
            metadata = redact(metadata)
        )
        sink.send(event)
        return event
    }

    fun reportForcedDebugCrash(
        release: String,
        environment: String,
        operation: String,
        correlationId: String,
        metadata: Map<String, Any?> = emptyMap()
    ): TelemetryEvent {
        val event = TelemetryEvent(
            event = "forced_debug_crash",
            release = release,
            environment = environment,
            operation = operation,
            errorCode = "debug_crash",
            correlationId = correlationId,
            metadata = redact(metadata)
        )
        sink.send(event)
        return event
    }

    companion object {
        private val sensitiveKeys = Regex("(token|authorization|cookie|password|secret|email|phone|address|payment|card|body)", RegexOption.IGNORE_CASE)
        private val sensitiveValues = listOf(
            Regex("Bearer\\s+[A-Za-z0-9._~+/=-]+", RegexOption.IGNORE_CASE),
            Regex("(sk|pk|rk)_(test|live)_[A-Za-z0-9]+"),
            Regex("[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}", RegexOption.IGNORE_CASE),
            Regex("\\+?[0-9][0-9 .()-]{7,}[0-9]")
        )

        fun redact(metadata: Map<String, Any?>): Map<String, Any?> {
            return metadata.mapValues { (key, value) ->
                if (sensitiveKeys.containsMatchIn(key)) {
                    "[REDACTED]"
                } else if (value is String) {
                    sensitiveValues.fold(value) { current, pattern -> pattern.replace(current, "[REDACTED]") }
                } else {
                    value
                }
            }
        }
    }
}
