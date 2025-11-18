import Foundation

// MARK: - Review Models

struct Review: Codable, Identifiable {
    let id: String
    let businessId: String
    let customerName: String
    let rating: Int
    let comment: String?
    let imageUrls: [String]?
    let createdAt: String
    var helpfulCount: Int
    var isHelpful: Bool
    var isReported: Bool
    var sellerReply: SellerReply?

    init(id: String, businessId: String, customerName: String, rating: Int, comment: String?, imageUrls: [String]?, createdAt: String, helpfulCount: Int = 0, isHelpful: Bool = false, isReported: Bool = false, sellerReply: SellerReply? = nil) {
        self.id = id
        self.businessId = businessId
        self.customerName = customerName
        self.rating = rating
        self.comment = comment
        self.imageUrls = imageUrls
        self.createdAt = createdAt
        self.helpfulCount = helpfulCount
        self.isHelpful = isHelpful
        self.isReported = isReported
        self.sellerReply = sellerReply
    }

    var ratingStars: String {
        String(repeating: "⭐️", count: rating)
    }

    var formattedDate: String {
        guard let date = ISO8601DateFormatter().date(from: createdAt) else {
            return createdAt
        }

        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .full
        return formatter.localizedString(for: date, relativeTo: Date())
    }

    var hasImages: Bool {
        !(imageUrls?.isEmpty ?? true)
    }

    var displayComment: String {
        comment ?? "No comment provided"
    }

    var hasSellerReply: Bool {
        sellerReply != nil
    }
}

struct ReviewResponse: Decodable {
    let success: Bool
    let data: ReviewData
}

struct ReviewData: Decodable {
    let review: Review
}

struct ReviewListResponse: Decodable {
    let success: Bool
    let data: ReviewListData
}

struct ReviewListData: Decodable {
    let reviews: [Review]
    let averageRating: Double
    let totalReviews: Int

    var formattedAverageRating: String {
        String(format: "%.1f", averageRating)
    }

    var ratingStars: String {
        let fullStars = Int(averageRating)
        let hasHalfStar = averageRating - Double(fullStars) >= 0.5

        var stars = String(repeating: "⭐️", count: fullStars)
        if hasHalfStar && fullStars < 5 {
            stars += "⭐️"
        }

        return stars
    }
}

struct CreateReviewRequest: Encodable {
    let businessId: String
    let customerName: String
    let rating: Int
    let comment: String?
    let imageUrls: [String]?
}

// MARK: - Rating Distribution

struct RatingDistribution: Codable {
    let fiveStar: Int
    let fourStar: Int
    let threeStar: Int
    let twoStar: Int
    let oneStar: Int

    var total: Int {
        fiveStar + fourStar + threeStar + twoStar + oneStar
    }

    func percentage(for rating: Int) -> Double {
        guard total > 0 else { return 0 }

        let count: Int
        switch rating {
        case 5: count = fiveStar
        case 4: count = fourStar
        case 3: count = threeStar
        case 2: count = twoStar
        case 1: count = oneStar
        default: count = 0
        }

        return Double(count) / Double(total) * 100
    }

    static func from(reviews: [Review]) -> RatingDistribution {
        var distribution = RatingDistribution(
            fiveStar: 0,
            fourStar: 0,
            threeStar: 0,
            twoStar: 0,
            oneStar: 0
        )

        for review in reviews {
            switch review.rating {
            case 5: distribution = RatingDistribution(
                fiveStar: distribution.fiveStar + 1,
                fourStar: distribution.fourStar,
                threeStar: distribution.threeStar,
                twoStar: distribution.twoStar,
                oneStar: distribution.oneStar
            )
            case 4: distribution = RatingDistribution(
                fiveStar: distribution.fiveStar,
                fourStar: distribution.fourStar + 1,
                threeStar: distribution.threeStar,
                twoStar: distribution.twoStar,
                oneStar: distribution.oneStar
            )
            case 3: distribution = RatingDistribution(
                fiveStar: distribution.fiveStar,
                fourStar: distribution.fourStar,
                threeStar: distribution.threeStar + 1,
                twoStar: distribution.twoStar,
                oneStar: distribution.oneStar
            )
            case 2: distribution = RatingDistribution(
                fiveStar: distribution.fiveStar,
                fourStar: distribution.fourStar,
                threeStar: distribution.threeStar,
                twoStar: distribution.twoStar + 1,
                oneStar: distribution.oneStar
            )
            case 1: distribution = RatingDistribution(
                fiveStar: distribution.fiveStar,
                fourStar: distribution.fourStar,
                threeStar: distribution.threeStar,
                twoStar: distribution.twoStar,
                oneStar: distribution.oneStar + 1
            )
            default: break
            }
        }

        return distribution
    }
}

// MARK: - Seller Reply

struct SellerReply: Codable {
    let id: String
    let reviewId: String
    let sellerName: String
    let reply: String
    let createdAt: String

    var formattedDate: String {
        guard let date = ISO8601DateFormatter().date(from: createdAt) else {
            return createdAt
        }

        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

// MARK: - Reply Response

struct ReplyResponse: Codable {
    let success: Bool
    let data: ReplyData
}

struct ReplyData: Codable {
    let sellerReply: SellerReply
}
