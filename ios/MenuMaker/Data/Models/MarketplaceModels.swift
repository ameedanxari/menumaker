import Foundation

// MARK: - Marketplace Models

struct MarketplaceSeller: Codable, Identifiable {
    let id: String
    let name: String
    let slug: String
    let description: String?
    let logoUrl: String?
    let cuisineType: String?
    let rating: Double
    let reviewCount: Int
    let latitude: Double?
    let longitude: Double?
    let distanceKm: Double?

    var formattedDistance: String? {
        guard let distanceKm = distanceKm else { return nil }

        if distanceKm < 1.0 {
            let meters = Int(distanceKm * 1000)
            return "\(meters) m"
        } else {
            return String(format: "%.1f km", distanceKm)
        }
    }

    var formattedRating: String {
        String(format: "%.1f", rating)
    }

    var ratingStars: String {
        let fullStars = Int(rating)
        let hasHalfStar = rating - Double(fullStars) >= 0.5

        var stars = String(repeating: "⭐️", count: fullStars)
        if hasHalfStar {
            stars += "⭐️"
        }

        return stars
    }

    var displayCuisine: String {
        cuisineType ?? "Various"
    }

    var displayDescription: String {
        description ?? "No description available"
    }
}

struct MarketplaceResponse: Decodable {
    let success: Bool
    let data: MarketplaceData
}

struct MarketplaceData: Decodable {
    let sellers: [MarketplaceSeller]
    let total: Int
}

// MARK: - Cart Models

struct CartItem: Codable, Identifiable {
    let dishId: String
    let dishName: String
    var quantity: Int
    let priceCents: Int

    var id: String { dishId }

    var price: Double {
        Double(priceCents) / 100.0
    }

    var formattedPrice: String {
        String(format: "₹%.2f", price)
    }

    var total: Double {
        price * Double(quantity)
    }

    var formattedTotal: String {
        String(format: "₹%.2f", total)
    }
}

struct Cart: Codable {
    var items: [CartItem]
    let businessId: String
    var appliedCoupon: Coupon?

    var totalCents: Int {
        items.reduce(0) { $0 + ($1.priceCents * $1.quantity) }
    }

    var total: Double {
        Double(totalCents) / 100.0
    }

    var formattedTotal: String {
        String(format: "₹%.2f", total)
    }
    
    var discountCents: Int {
        guard let coupon = appliedCoupon, coupon.isActive && !coupon.isExpired else {
            return 0
        }
        
        // Check minimum order requirement
        guard totalCents >= coupon.minOrderValueCents else {
            return 0
        }
        
        var discountAmount: Int
        
        switch coupon.discountTypeEnum {
        case .percentage:
            discountAmount = (totalCents * coupon.discountValue) / 100
            
            // Apply max discount cap if specified
            if let maxCents = coupon.maxDiscountCents {
                discountAmount = min(discountAmount, maxCents)
            }
            
        case .fixed:
            discountAmount = coupon.discountValue
        }
        
        // Discount cannot exceed total
        return min(discountAmount, totalCents)
    }
    
    var discount: Double {
        Double(discountCents) / 100.0
    }
    
    var formattedDiscount: String {
        String(format: "₹%.2f", discount)
    }
    
    var finalTotalCents: Int {
        max(0, totalCents - discountCents)
    }
    
    var finalTotal: Double {
        Double(finalTotalCents) / 100.0
    }
    
    var formattedFinalTotal: String {
        String(format: "₹%.2f", finalTotal)
    }

    var itemsCount: Int {
        items.reduce(0) { $0 + $1.quantity }
    }

    var isEmpty: Bool {
        items.isEmpty
    }

    mutating func addItem(_ dish: Dish) {
        if let index = items.firstIndex(where: { $0.dishId == dish.id }) {
            items[index].quantity += 1
        } else {
            let cartItem = CartItem(
                dishId: dish.id,
                dishName: dish.name,
                quantity: 1,
                priceCents: dish.priceCents
            )
            items.append(cartItem)
        }
    }

    mutating func removeItem(_ dishId: String) {
        items.removeAll { $0.dishId == dishId }
    }

    mutating func updateQuantity(_ dishId: String, quantity: Int) {
        if let index = items.firstIndex(where: { $0.dishId == dishId }) {
            if quantity <= 0 {
                items.remove(at: index)
            } else {
                items[index].quantity = quantity
            }
        }
    }

    mutating func clear() {
        items.removeAll()
        appliedCoupon = nil
    }
    
    mutating func applyCoupon(_ coupon: Coupon) {
        appliedCoupon = coupon
    }
    
    mutating func removeCoupon() {
        appliedCoupon = nil
    }
}

// MARK: - Search Filters

struct MarketplaceSearchFilters: Codable {
    var latitude: Double?
    var longitude: Double?
    var cuisine: String?
    var ratingMin: Double?
    var distanceKm: Double?

    var queryParameters: [String: String] {
        var params: [String: String] = [:]

        if let latitude = latitude {
            params["latitude"] = String(latitude)
        }

        if let longitude = longitude {
            params["longitude"] = String(longitude)
        }

        if let cuisine = cuisine {
            params["cuisine"] = cuisine
        }

        if let ratingMin = ratingMin {
            params["rating_min"] = String(ratingMin)
        }

        if let distanceKm = distanceKm {
            params["distance_km"] = String(distanceKm)
        }

        return params
    }
}
