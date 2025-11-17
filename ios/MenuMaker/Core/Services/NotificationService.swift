import Foundation
import Combine
import UserNotifications
import UIKit

/// Notification service for managing push notifications
@MainActor
class NotificationService: NSObject, ObservableObject {
    static let shared = NotificationService()

    @Published var authorizationStatus: UNAuthorizationStatus = .notDetermined
    @Published var deviceToken: String?

    private let notificationCenter = UNUserNotificationCenter.current()

    override private init() {
        super.init()
        checkAuthorizationStatus()
    }

    // MARK: - Authorization

    func requestAuthorization() {
        Task {
            do {
                let granted = try await notificationCenter.requestAuthorization(
                    options: [.alert, .badge, .sound]
                )

                if granted {
                    registerForRemoteNotifications()
                }

                checkAuthorizationStatus()
            } catch {
                print("Notification authorization error: \(error)")
            }
        }
    }

    private func checkAuthorizationStatus() {
        Task {
            let settings = await notificationCenter.notificationSettings()
            authorizationStatus = settings.authorizationStatus
        }
    }

    private func registerForRemoteNotifications() {
        DispatchQueue.main.async {
            UIApplication.shared.registerForRemoteNotifications()
        }
    }

    // MARK: - Device Token

    func setDeviceToken(_ tokenData: Data) {
        let token = tokenData.map { String(format: "%02.2hhx", $0) }.joined()
        deviceToken = token

        // Send token to backend
        Task {
            await sendTokenToBackend(token)
        }
    }

    private func sendTokenToBackend(_ token: String) async {
        // TODO: Send device token to backend
        print("Device token: \(token)")
    }

    // MARK: - Local Notifications

    func scheduleLocalNotification(
        title: String,
        body: String,
        identifier: String = UUID().uuidString,
        timeInterval: TimeInterval = 1,
        userInfo: [AnyHashable: Any]? = nil
    ) async throws {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default

        if let userInfo = userInfo {
            content.userInfo = userInfo
        }

        let trigger = UNTimeIntervalNotificationTrigger(
            timeInterval: timeInterval,
            repeats: false
        )

        let request = UNNotificationRequest(
            identifier: identifier,
            content: content,
            trigger: trigger
        )

        try await notificationCenter.add(request)
    }

    func cancelNotification(identifier: String) {
        notificationCenter.removePendingNotificationRequests(withIdentifiers: [identifier])
    }

    func cancelAllNotifications() {
        notificationCenter.removeAllPendingNotificationRequests()
    }

    // MARK: - Badge Management

    func setBadgeCount(_ count: Int) {
        if #available(iOS 16.0, *) {
            Task {
                try? await notificationCenter.setBadgeCount(count)
            }
        } else {
            // Fallback for iOS 15
            DispatchQueue.main.async {
                UIApplication.shared.applicationIconBadgeNumber = count
            }
        }
    }

    func clearBadge() {
        setBadgeCount(0)
    }

    // MARK: - Order Notifications

    func notifyNewOrder(orderId: String, customerName: String) async {
        try? await scheduleLocalNotification(
            title: "New Order",
            body: "New order from \(customerName)",
            identifier: "order_\(orderId)",
            userInfo: ["orderId": orderId, "type": "new_order"]
        )
    }

    func notifyOrderStatusChange(orderId: String, status: String) async {
        try? await scheduleLocalNotification(
            title: "Order Status Updated",
            body: "Order status changed to \(status)",
            identifier: "order_status_\(orderId)",
            userInfo: ["orderId": orderId, "status": status, "type": "order_status"]
        )
    }
}

// MARK: - Notification Delegate

@MainActor
class NotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationDelegate()

    private override init() {
        super.init()
    }

    // Handle notification when app is in foreground
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound, .badge])
    }

    // Handle notification tap
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo

        // Extract values before entering Task to avoid Sendable issues
        let type = userInfo["type"] as? String
        let orderId = userInfo["orderId"] as? String

        Task { @MainActor in
            handleNotificationTap(type: type, orderId: orderId)
            completionHandler()
        }
    }

    private func handleNotificationTap(type: String?, orderId: String?) {
        // Handle different notification types
        guard let type = type else { return }

        switch type {
        case "new_order", "order_status":
            if let orderId = orderId {
                // Navigate to order details
                print("Navigate to order: \(orderId)")
            }
        default:
            break
        }
    }
}
