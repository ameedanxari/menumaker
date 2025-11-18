import Foundation

// MARK: - Favorite Models

struct Favorite: Codable, Identifiable {
    let id: String
    let userId: String
    let businessId: String
    let business: Business?
    let createdAt: String

    var formattedDate: String {
        guard let date = ISO8601DateFormatter().date(from: createdAt) else {
            return createdAt
        }

        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: date)
    }
}

struct FavoriteResponse: Decodable {
    let success: Bool
    let data: FavoriteData
}

struct FavoriteData: Decodable {
    let favorite: Favorite
}

struct FavoriteListResponse: Decodable {
    let success: Bool
    let data: FavoriteListData
}

struct FavoriteListData: Decodable {
    let favorites: [Favorite]
}

struct AddFavoriteRequest: Encodable {
    let businessId: String
}

struct RemoveFavoriteRequest: Encodable {
    let businessId: String
}
