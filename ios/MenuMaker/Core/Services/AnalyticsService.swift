import Foundation
import os.log

/// Analytics event types
enum AnalyticsEvent: String {
    // Auth events
    case login
    case signup
    case logout

    // Business events
    case businessCreated = "business_created"
    case businessUpdated = "business_updated"

    // Menu events
    case dishCreated = "dish_created"
    case dishUpdated = "dish_updated"
    case dishDeleted = "dish_deleted"

    // Order events
    case orderCreated = "order_created"
    case orderStatusChanged = "order_status_changed"
    case orderCompleted = "order_completed"
    case orderCancelled = "order_cancelled"

    // Payment events
    case paymentProcessorConnected = "payment_processor_connected"
    case paymentProcessed = "payment_processed"

    // Marketplace events
    case sellerViewed = "seller_viewed"
    case dishViewed = "dish_viewed"
    case cartItemAdded = "cart_item_added"
    case checkoutStarted = "checkout_started"

    // Coupon events
    case couponCreated = "coupon_created"
    case couponRedeemed = "coupon_redeemed"

    // Screen views
    case screenView = "screen_view"
}

/// Analytics service for tracking user events
@MainActor
class AnalyticsService: ObservableObject {
    static let shared = AnalyticsService()

    private let logger = Logger(subsystem: "com.menumaker.app", category: "Analytics")
    private var sessionId: String
    private var userId: String?
    private var businessId: String?

    private init() {
        self.sessionId = UUID().uuidString
        loadUserContext()
    }

    // MARK: - Context Management

    private func loadUserContext() {
        Task {
            userId = try? await KeychainManager.shared.getUserId()
            businessId = try? await KeychainManager.shared.getBusinessId()
        }
    }

    func setUserId(_ id: String?) {
        userId = id
    }

    func setBusinessId(_ id: String?) {
        businessId = id
    }

    func resetSession() {
        sessionId = UUID().uuidString
        userId = nil
        businessId = nil
    }

    // MARK: - Event Tracking

    func track(_ event: AnalyticsEvent, parameters: [String: Any]? = nil) {
        var eventData: [String: Any] = [
            "event": event.rawValue,
            "session_id": sessionId,
            "timestamp": ISO8601DateFormatter().string(from: Date())
        ]

        if let userId = userId {
            eventData["user_id"] = userId
        }

        if let businessId = businessId {
            eventData["business_id"] = businessId
        }

        if let parameters = parameters {
            eventData["parameters"] = parameters
        }

        // Log event
        logger.info("Analytics Event: \(event.rawValue) - \(String(describing: parameters))")

        // Send to analytics backend
        Task {
            await sendEventToBackend(eventData)
        }
    }

    // MARK: - Screen Tracking

    func trackScreen(_ screenName: String, parameters: [String: Any]? = nil) {
        var params = parameters ?? [:]
        params["screen_name"] = screenName

        track(.screenView, parameters: params)
    }

    // MARK: - Timed Events

    private var timedEvents: [String: Date] = [:]

    func startTimedEvent(_ eventName: String) {
        timedEvents[eventName] = Date()
    }

    func endTimedEvent(_ eventName: String, parameters: [String: Any]? = nil) {
        guard let startTime = timedEvents[eventName] else {
            return
        }

        let duration = Date().timeIntervalSince(startTime)
        var params = parameters ?? [:]
        params["duration"] = duration

        track(AnalyticsEvent(rawValue: eventName) ?? .screenView, parameters: params)

        timedEvents.removeValue(forKey: eventName)
    }

    // MARK: - User Properties

    func setUserProperty(_ key: String, value: Any) {
        logger.info("User Property: \(key) = \(String(describing: value))")

        // Send to analytics backend
        Task {
            await sendUserPropertyToBackend(key: key, value: value)
        }
    }

    // MARK: - Backend Communication

    private func sendEventToBackend(_ eventData: [String: Any]) async {
        // TODO: Send event to analytics backend (e.g., Firebase, Mixpanel, etc.)
        // For now, just log it
        print("📊 Analytics Event:", eventData)
    }

    private func sendUserPropertyToBackend(key: String, value: Any) async {
        // TODO: Send user property to analytics backend
        print("👤 User Property:", key, value)
    }

    // MARK: - Convenience Methods

    func trackLogin(method: String) {
        track(.login, parameters: ["method": method])
    }

    func trackSignup(method: String) {
        track(.signup, parameters: ["method": method])
    }

    func trackOrderCreated(orderId: String, amount: Double, itemCount: Int) {
        track(.orderCreated, parameters: [
            "order_id": orderId,
            "amount": amount,
            "item_count": itemCount
        ])
    }

    func trackOrderStatusChanged(orderId: String, fromStatus: String, toStatus: String) {
        track(.orderStatusChanged, parameters: [
            "order_id": orderId,
            "from_status": fromStatus,
            "to_status": toStatus
        ])
    }

    func trackPaymentProcessed(orderId: String, amount: Double, processor: String) {
        track(.paymentProcessed, parameters: [
            "order_id": orderId,
            "amount": amount,
            "processor": processor
        ])
    }
}
