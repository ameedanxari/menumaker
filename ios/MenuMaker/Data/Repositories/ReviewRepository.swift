import Foundation
import Combine

/// Review repository
@MainActor
class ReviewRepository: ObservableObject {
    static let shared = ReviewRepository()

    private let apiClient = APIClient.shared

    @Published var reviews: [Review] = []
    @Published var averageRating: Double = 0.0
    @Published var totalReviews: Int = 0

    private init() {}

    // MARK: - Fetch Operations

    func getReviews(_ businessId: String) async throws -> ReviewListData {
        let response: ReviewListResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.reviews + "?business_id=\(businessId)",
            method: .get
        )

        reviews = response.data.reviews
        averageRating = response.data.averageRating
        totalReviews = response.data.totalReviews

        return response.data
    }

    func getBusinessReviews(_ businessId: String) async throws -> ReviewListData {
        let response: ReviewListResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.businessReviews(businessId),
            method: .get
        )

        return response.data
    }

    // MARK: - Create Operations

    func createReview(
        businessId: String,
        customerName: String,
        rating: Int,
        comment: String?,
        imageUrls: [String]?
    ) async throws -> Review {
        let request = CreateReviewRequest(
            businessId: businessId,
            customerName: customerName,
            rating: rating,
            comment: comment,
            imageUrls: imageUrls
        )

        let response: ReviewResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.reviews,
            method: .post,
            body: request
        )

        // Update local cache
        reviews.insert(response.data.review, at: 0)
        totalReviews += 1

        // Recalculate average rating
        let totalRatingSum = reviews.reduce(0) { $0 + $1.rating }
        averageRating = Double(totalRatingSum) / Double(reviews.count)

        return response.data.review
    }

    // MARK: - Image Upload

    func uploadReviewImage(_ image: UIImage) async throws -> String {
        try await ImageService.shared.uploadImage(image, to: "/upload/review-image")
    }

    // MARK: - Review Actions

    func markReviewAsHelpful(_ reviewId: String) async throws {
        let _: EmptyResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.reviews + "/\(reviewId)/helpful",
            method: .post
        )
    }

    func reportReview(_ reviewId: String, reason: String) async throws {
        struct ReportRequest: Encodable {
            let reason: String
        }

        let _: EmptyResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.reviews + "/\(reviewId)/report",
            method: .post,
            body: ReportRequest(reason: reason)
        )
    }

    func replyToReview(_ reviewId: String, businessId: String, reply: String) async throws -> String {
        struct ReplyRequest: Encodable {
            let businessId: String
            let reply: String
        }

        struct ReplyResponse: Decodable {
            let success: Bool
            let data: ReplyData
        }

        struct ReplyData: Decodable {
            let sellerReply: String
        }

        let response: ReplyResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.reviews + "/\(reviewId)/reply",
            method: .post,
            body: ReplyRequest(businessId: businessId, reply: reply)
        )

        return response.data.sellerReply
    }

    // MARK: - Filtering and Sorting

    func filterReviews(minRating: Int? = nil, maxRating: Int? = nil) -> [Review] {
        var filtered = reviews

        if let minRating = minRating {
            filtered = filtered.filter { $0.rating >= minRating }
        }

        if let maxRating = maxRating {
            filtered = filtered.filter { $0.rating <= maxRating }
        }

        return filtered
    }

    func getReviewsByRating(_ rating: Int) -> [Review] {
        reviews.filter { $0.rating == rating }
    }

    func sortedByRating(ascending: Bool = false) -> [Review] {
        reviews.sorted { ascending ? $0.rating < $1.rating : $0.rating > $1.rating }
    }

    func sortedByDate(ascending: Bool = false) -> [Review] {
        reviews.sorted { review1, review2 in
            guard let date1 = ISO8601DateFormatter().date(from: review1.createdAt),
                  let date2 = ISO8601DateFormatter().date(from: review2.createdAt) else {
                return false
            }

            return ascending ? date1 < date2 : date1 > date2
        }
    }

    func getReviewsWithImages() -> [Review] {
        reviews.filter { $0.hasImages }
    }

    // MARK: - Statistics

    func getRatingDistribution() -> RatingDistribution {
        RatingDistribution.from(reviews: reviews)
    }

    func getRecentReviews(count: Int = 5) -> [Review] {
        Array(sortedByDate().prefix(count))
    }
}

import UIKit
