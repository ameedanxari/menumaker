import Foundation

// MARK: - Dish Models

struct Dish: Codable, Identifiable {
    let id: String
    let businessId: String
    let name: String
    let description: String?
    let priceCents: Int
    let imageUrl: String?
    let category: String?
    let isVegetarian: Bool
    let isAvailable: Bool
    let createdAt: String
    let updatedAt: String

    var price: Double {
        Double(priceCents) / 100.0
    }

    var formattedPrice: String {
        String(format: "₹%.2f", price)
    }

    var displayDescription: String {
        description ?? "No description available"
    }

    var displayCategory: String {
        category ?? "Uncategorized"
    }

    var vegetarianBadge: String {
        isVegetarian ? "🌱" : "🍖"
    }
}

struct DishResponse: Decodable {
    let success: Bool
    let data: DishData
}

struct DishData: Decodable {
    let dish: Dish
}

struct DishListResponse: Decodable {
    let success: Bool
    let data: DishListData
}

struct DishListData: Decodable {
    let dishes: [Dish]
}

struct CreateDishRequest: Encodable {
    let businessId: String
    let name: String
    let description: String?
    let priceCents: Int
    let imageUrl: String?
    let category: String?
    let isVegetarian: Bool
    let isAvailable: Bool
}

struct UpdateDishRequest: Encodable {
    let name: String?
    let description: String?
    let priceCents: Int?
    let imageUrl: String?
    let category: String?
    let isVegetarian: Bool?
    let isAvailable: Bool?
}
