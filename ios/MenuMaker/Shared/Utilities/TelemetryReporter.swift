import Foundation
import os

public struct TelemetryEvent: Equatable {
    public let event: String
    public let release: String
    public let environment: String
    public let operation: String
    public let errorCode: String
    public let correlationId: String
    public let metadata: [String: String]
}

public protocol TelemetrySink {
    func send(_ event: TelemetryEvent)
}

public final class TelemetryReporter {
    private let sink: TelemetrySink
    private let logger = Logger(subsystem: "com.menumaker.app", category: "telemetry")

    public init(sink: TelemetrySink) {
        self.sink = sink
    }

    @discardableResult
    public func reportSyncFailure(
        release: String,
        environment: String,
        operation: String,
        errorCode: String,
        correlationId: String,
        metadata: [String: String] = [:]
    ) -> TelemetryEvent {
        let event = TelemetryEvent(
            event: "sync_failure",
            release: release,
            environment: environment,
            operation: operation,
            errorCode: errorCode,
            correlationId: correlationId,
            metadata: Self.redact(metadata)
        )
        logger.error("sync failure operation=\(operation, privacy: .public) correlation=\(correlationId, privacy: .public)")
        sink.send(event)
        return event
    }

    @discardableResult
    public func reportForcedDebugCrash(
        release: String,
        environment: String,
        operation: String,
        correlationId: String,
        metadata: [String: String] = [:]
    ) -> TelemetryEvent {
        let event = TelemetryEvent(
            event: "forced_debug_crash",
            release: release,
            environment: environment,
            operation: operation,
            errorCode: "debug_crash",
            correlationId: correlationId,
            metadata: Self.redact(metadata)
        )
        sink.send(event)
        return event
    }

    public static func redact(_ metadata: [String: String]) -> [String: String] {
        metadata.reduce(into: [String: String]()) { result, entry in
            if entry.key.range(of: "(token|authorization|cookie|password|secret|email|phone|address|payment|card|body)", options: [.regularExpression, .caseInsensitive]) != nil {
                result[entry.key] = "[REDACTED]"
            } else {
                result[entry.key] = redactValue(entry.value)
            }
        }
    }

    private static func redactValue(_ value: String) -> String {
        var redacted = value
        for pattern in [
            "Bearer\\s+[A-Za-z0-9._~+/=-]+",
            "(sk|pk|rk)_(test|live)_[A-Za-z0-9]+",
            "[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}",
            "\\+?[0-9][0-9 .()-]{7,}[0-9]"
        ] {
            redacted = redacted.replacingOccurrences(of: pattern, with: "[REDACTED]", options: [.regularExpression, .caseInsensitive])
        }
        return redacted
    }
}
