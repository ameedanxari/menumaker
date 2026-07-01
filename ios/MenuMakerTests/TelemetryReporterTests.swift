import XCTest
@testable import MenuMaker

final class TelemetryReporterTests: XCTestCase {
    final class CapturingSink: TelemetrySink {
        var events: [TelemetryEvent] = []
        func send(_ event: TelemetryEvent) {
            events.append(event)
        }
    }

    func testSyncFailureIncludesReleaseEnvironmentOperationAndCorrelation() {
        let sink = CapturingSink()
        let reporter = TelemetryReporter(sink: sink)

        let event = reporter.reportSyncFailure(
            release: "1.0.0",
            environment: "staging",
            operation: "orders.sync",
            errorCode: "offline_conflict",
            correlationId: "corr-ios",
            metadata: ["attempt": "2"]
        )

        XCTAssertEqual(event.event, "sync_failure")
        XCTAssertEqual(event.release, "1.0.0")
        XCTAssertEqual(event.environment, "staging")
        XCTAssertEqual(event.operation, "orders.sync")
        XCTAssertEqual(event.correlationId, "corr-ios")
        XCTAssertEqual(sink.events, [event])
    }

    func testRedactionRemovesSensitiveKeysAndValues() {
        let metadata = TelemetryReporter.redact([
            "authorization": "Bearer raw-token",
            "customerEmail": "customer@example.com",
            "note": "call +1 555 000 1111",
            "safe_code": "menu_sync"
        ])

        let rendered = "\(metadata)"
        XCTAssertFalse(rendered.contains("raw-token"))
        XCTAssertFalse(rendered.contains("customer@example.com"))
        XCTAssertFalse(rendered.contains("+1 555 000 1111"))
        XCTAssertTrue(rendered.contains("menu_sync"))
    }
}
