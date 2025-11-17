import Foundation
import Combine

@MainActor
class NotificationViewModel: ObservableObject {
    @Published var notifications: [Notification] = []
    @Published var unreadCount: Int = 0
    @Published var isLoading = false
    @Published var errorMessage: String?

    // Settings
    @Published var orderNotificationsEnabled = true
    @Published var promotionNotificationsEnabled = true
    @Published var reviewNotificationsEnabled = true
    @Published var pushNotificationsEnabled = true
    @Published var emailNotificationsEnabled = false

    private let apiClient = APIClient.shared

    init() {
        Task {
            await loadNotifications()
        }
    }

    func loadNotifications() async {
        isLoading = true
        errorMessage = nil

        do {
            let response: NotificationListResponse = try await apiClient.request(
                endpoint: AppConstants.API.Endpoints.notifications,
                method: .get
            )

            notifications = response.data.notifications
            unreadCount = response.data.unreadCount
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func refreshNotifications() async {
        await loadNotifications()
    }

    func markAsRead(_ notificationId: String) async {
        do {
            let _: NotificationResponse = try await apiClient.request(
                endpoint: "\(AppConstants.API.Endpoints.notifications)/\(notificationId)/read",
                method: .post
            )

            // Update local state
            if let index = notifications.firstIndex(where: { $0.id == notificationId }) {
                var updatedNotification = notifications[index]
                notifications[index] = Notification(
                    id: updatedNotification.id,
                    userId: updatedNotification.userId,
                    type: updatedNotification.type,
                    title: updatedNotification.title,
                    message: updatedNotification.message,
                    isRead: true,
                    createdAt: updatedNotification.createdAt,
                    data: updatedNotification.data
                )
                unreadCount = max(0, unreadCount - 1)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func markAllAsRead() async {
        do {
            let _: EmptyResponse = try await apiClient.request(
                endpoint: "\(AppConstants.API.Endpoints.notifications)/read-all",
                method: .post
            )

            // Update all notifications to read
            notifications = notifications.map { notification in
                Notification(
                    id: notification.id,
                    userId: notification.userId,
                    type: notification.type,
                    title: notification.title,
                    message: notification.message,
                    isRead: true,
                    createdAt: notification.createdAt,
                    data: notification.data
                )
            }
            unreadCount = 0
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
