import Foundation

// MARK: - Business Models

struct Business: Codable, Identifiable {
    let id: String
    let name: String
    let slug: String
    let description: String?
    let logoUrl: String?
    let ownerId: String
    let isActive: Bool
    let createdAt: String
    let updatedAt: String

    var formattedCreatedDate: String {
        guard let date = ISO8601DateFormatter().date(from: createdAt) else {
            return createdAt
        }

        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: date)
    }

    var displayDescription: String {
        description ?? "No description available"
    }
}

struct BusinessResponse: Decodable {
    let success: Bool
    let data: BusinessData
}

struct BusinessData: Decodable {
    let business: Business
}

struct BusinessListResponse: Decodable {
    let success: Bool
    let data: BusinessListData
}

struct BusinessListData: Decodable {
    let businesses: [Business]
}

struct CreateBusinessRequest: Encodable {
    let name: String
    let slug: String
    let description: String?
    let logoUrl: String?
}

struct UpdateBusinessRequest: Encodable {
    let name: String?
    let description: String?
    let logoUrl: String?
    let isActive: Bool?
}
