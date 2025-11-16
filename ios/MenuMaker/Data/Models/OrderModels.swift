import Foundation
import SwiftUI

// MARK: - Order Models

struct Order: Codable, Identifiable {
    let id: String
    let businessId: String
    let customerName: String
    let customerPhone: String?
    let customerEmail: String?
    let totalCents: Int
    let status: String
    let items: [OrderItem]
    let createdAt: String
    let updatedAt: String

    var total: Double {
        Double(totalCents) / 100.0
    }

    var formattedTotal: String {
        String(format: "₹%.2f", total)
    }

    var orderStatus: OrderStatus {
        OrderStatus(rawValue: status) ?? .pending
    }

    var statusColor: Color {
        orderStatus.color
    }

    var statusIcon: String {
        orderStatus.icon
    }

    var formattedDate: String {
        guard let date = ISO8601DateFormatter().date(from: createdAt) else {
            return createdAt
        }

        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    var itemsCount: Int {
        items.reduce(0) { $0 + $1.quantity }
    }
}

struct OrderItem: Codable, Identifiable {
    let id: String
    let dishId: String
    let dishName: String
    let quantity: Int
    let priceCents: Int
    let totalCents: Int

    var price: Double {
        Double(priceCents) / 100.0
    }

    var total: Double {
        Double(totalCents) / 100.0
    }

    var formattedPrice: String {
        String(format: "₹%.2f", price)
    }

    var formattedTotal: String {
        String(format: "₹%.2f", total)
    }
}

struct OrderResponse: Decodable {
    let success: Bool
    let data: OrderData
}

struct OrderData: Decodable {
    let order: Order
}

struct OrderListResponse: Decodable {
    let success: Bool
    let data: OrderListData
}

struct OrderListData: Decodable {
    let orders: [Order]
    let total: Int
}

struct CreateOrderRequest: Encodable {
    let businessId: String
    let customerName: String
    let customerPhone: String?
    let customerEmail: String?
    let items: [CreateOrderItemRequest]
}

struct CreateOrderItemRequest: Encodable {
    let dishId: String
    let quantity: Int
}

struct UpdateOrderStatusRequest: Encodable {
    let status: String
}

// MARK: - Order Status

enum OrderStatus: String, CaseIterable, Codable {
    case pending
    case confirmed
    case ready
    case fulfilled
    case cancelled

    var displayName: String {
        rawValue.capitalized
    }

    var color: Color {
        switch self {
        case .pending: return .orange
        case .confirmed: return .blue
        case .ready: return .purple
        case .fulfilled: return .green
        case .cancelled: return .red
        }
    }

    var icon: String {
        switch self {
        case .pending: return "clock"
        case .confirmed: return "checkmark.circle"
        case .ready: return "bell"
        case .fulfilled: return "checkmark.circle.fill"
        case .cancelled: return "xmark.circle"
        }
    }
}
