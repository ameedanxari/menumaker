import Foundation

// MARK: - Menu Models

struct Menu: Codable, Identifiable {
    let id: String
    let businessId: String
    let name: String
    let description: String?
    let isActive: Bool
    let displayOrder: Int
    let createdAt: String
    let updatedAt: String

    var displayDescription: String {
        description ?? "No description"
    }

    var formattedCreatedDate: String {
        guard let date = ISO8601DateFormatter().date(from: createdAt) else {
            return createdAt
        }

        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: date)
    }
}

struct MenuResponse: Decodable {
    let success: Bool
    let data: MenuData
}

struct MenuData: Decodable {
    let menu: Menu
}

struct MenuListResponse: Decodable {
    let success: Bool
    let data: MenuListData
}

struct MenuListData: Decodable {
    let menus: [Menu]
}

struct CreateMenuRequest: Encodable {
    let businessId: String
    let name: String
    let description: String?
    let isActive: Bool
    let displayOrder: Int
}

struct UpdateMenuRequest: Encodable {
    let name: String?
    let description: String?
    let isActive: Bool?
    let displayOrder: Int?
}
