import Foundation

// MARK: - Notification Types

enum NotificationType: String, Codable {
    case orderUpdate = "order_update"
    case promotion = "promotion"
    case review = "review"
    case system = "system"
}

// MARK: - Notification Model

struct Notification: Identifiable, Codable {
    let id: String
    let userId: String
    let type: NotificationType
    let title: String
    let message: String
    let isRead: Bool
    let createdAt: Date
    let data: [String: String]?

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case type
        case title
        case message
        case isRead = "is_read"
        case createdAt = "created_at"
        case data
    }
}

// MARK: - API Response Models

struct NotificationListResponse: Codable {
    let data: NotificationListData
}

struct NotificationListData: Codable {
    let notifications: [Notification]
    let unreadCount: Int

    enum CodingKeys: String, CodingKey {
        case notifications
        case unreadCount = "unread_count"
    }
}

struct NotificationResponse: Codable {
    let data: NotificationData
}

struct NotificationData: Codable {
    let notification: Notification
}
