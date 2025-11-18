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
    let deliveryAddress: String?
    let estimatedDeliveryTime: String?
    let deliveryPersonName: String?
    let deliveryPersonPhone: String?

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

    var orderId: String {
        // Format order ID for display
        "#\(id.prefix(8).uppercased())"
    }

    var formattedEstimatedTime: String? {
        guard let estimatedTime = estimatedDeliveryTime,
              let date = ISO8601DateFormatter().date(from: estimatedTime) else {
            return nil
        }

        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return "Estimated arrival: \(formatter.string(from: date))"
    }

    var canBeCancelled: Bool {
        orderStatus == .pending || orderStatus == .confirmed
    }

    var isActive: Bool {
        ![.delivered, .cancelled].contains(orderStatus)
    }

    var isDelivered: Bool {
        orderStatus == .delivered
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
    case pending = "pending"
    case confirmed = "confirmed"
    case preparing = "preparing"
    case ready = "ready"
    case outForDelivery = "out_for_delivery"
    case delivered = "delivered"
    case cancelled = "cancelled"

    var displayName: String {
        switch self {
        case .pending: return "Order Placed"
        case .confirmed: return "Confirmed"
        case .preparing: return "Preparing"
        case .ready: return "Ready for Pickup"
        case .outForDelivery: return "Out for Delivery"
        case .delivered: return "Delivered"
        case .cancelled: return "Cancelled"
        }
    }

    var color: Color {
        switch self {
        case .pending: return .orange
        case .confirmed: return .blue
        case .preparing: return .purple
        case .ready: return .indigo
        case .outForDelivery: return .cyan
        case .delivered: return .green
        case .cancelled: return .red
        }
    }

    var icon: String {
        switch self {
        case .pending: return "clock"
        case .confirmed: return "checkmark.circle"
        case .preparing: return "flame"
        case .ready: return "bell"
        case .outForDelivery: return "shippingbox"
        case .delivered: return "checkmark.circle.fill"
        case .cancelled: return "xmark.circle"
        }
    }

    var stepNumber: Int {
        switch self {
        case .pending: return 0
        case .confirmed: return 1
        case .preparing: return 2
        case .ready: return 3
        case .outForDelivery: return 4
        case .delivered: return 5
        case .cancelled: return -1
        }
    }

    static var trackingStatuses: [OrderStatus] {
        [.pending, .confirmed, .preparing, .ready, .outForDelivery, .delivered]
    }
}
