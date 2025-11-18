import Foundation
import Combine
import UIKit

/// Review management view model
@MainActor
class ReviewViewModel: ObservableObject {
    @Published var reviews: [Review] = []
    @Published var filteredReviews: [Review] = []
    @Published var averageRating: Double = 0.0
    @Published var totalReviews: Int = 0
    @Published var ratingDistribution: RatingDistribution?
    @Published var selectedRatingFilter: Int?
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var showSuccessMessage = false
    @Published var successMessage: String?
    @Published var sortOrder: SortOrder = .mostRecent

    private let repository = ReviewRepository.shared
    private let analyticsService = AnalyticsService.shared

    private var cancellables = Set<AnyCancellable>()

    init() {
        setupObservers()
        Task {
            await loadReviews()
        }
    }

    private func setupObservers() {
        $selectedRatingFilter
            .sink { [weak self] _ in
                self?.filterReviews()
            }
            .store(in: &cancellables)
    }

    // MARK: - Data Loading

    func loadReviews() async {
        guard let businessId = try? await KeychainManager.shared.getBusinessId() else {
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            let data = try await repository.getReviews(businessId)
            reviews = data.reviews
            averageRating = data.averageRating
            totalReviews = data.totalReviews
            ratingDistribution = repository.getRatingDistribution()
            filterReviews()

            analyticsService.trackScreen("Reviews")

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func refreshReviews() async {
        await loadReviews()
    }

    // MARK: - Filtering

    private func filterReviews() {
        if let rating = selectedRatingFilter {
            filteredReviews = repository.getReviewsByRating(rating)
        } else {
            filteredReviews = reviews
        }
    }

    func filterByRating(_ rating: Int?) {
        selectedRatingFilter = rating
    }

    func clearFilters() {
        selectedRatingFilter = nil
    }

    // MARK: - Review Management

    func createReview(
        customerName: String,
        rating: Int,
        comment: String?,
        images: [UIImage]?
    ) async {
        guard let businessId = try? await KeychainManager.shared.getBusinessId() else {
            return
        }

        guard rating >= 1 && rating <= 5 else {
            errorMessage = "Rating must be between 1 and 5"
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            // Upload images if provided
            var imageUrls: [String]?
            if let images = images, !images.isEmpty {
                imageUrls = try await uploadReviewImages(images)
            }

            let review = try await repository.createReview(
                businessId: businessId,
                customerName: customerName,
                rating: rating,
                comment: comment,
                imageUrls: imageUrls
            )

            reviews.insert(review, at: 0)
            totalReviews += 1
            ratingDistribution = repository.getRatingDistribution()
            filterReviews()

            // Show success message
            successMessage = "Your review has been submitted successfully!"
            showSuccessMessage = true

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    private func uploadReviewImages(_ images: [UIImage]) async throws -> [String] {
        var urls: [String] = []

        for image in images {
            let url = try await repository.uploadReviewImage(image)
            urls.append(url)
        }

        return urls
    }

    // MARK: - Sorting

    func sortByRating(ascending: Bool = false) {
        filteredReviews = repository.sortedByRating(ascending: ascending)
    }

    func sortByDate(ascending: Bool = false) {
        filteredReviews = repository.sortedByDate(ascending: ascending)
    }

    // MARK: - Statistics

    func getFormattedAverageRating() -> String {
        String(format: "%.1f", averageRating)
    }

    func getRatingStars() -> String {
        let fullStars = Int(averageRating)
        let hasHalfStar = averageRating - Double(fullStars) >= 0.5

        var stars = String(repeating: "⭐️", count: fullStars)
        if hasHalfStar && fullStars < 5 {
            stars += "⭐️"
        }

        return stars
    }

    func getReviewsWithImages() -> [Review] {
        repository.getReviewsWithImages()
    }

    func getRecentReviews(count: Int = 5) -> [Review] {
        repository.getRecentReviews(count: count)
    }

    func getRatingPercentage(for rating: Int) -> Double {
        ratingDistribution?.percentage(for: rating) ?? 0.0
    }

    func getRatingCount(for rating: Int) -> Int {
        reviews.filter { $0.rating == rating }.count
    }

    // MARK: - Review Interactions

    func markReviewAsHelpful(_ reviewId: String) async {
        guard let index = reviews.firstIndex(where: { $0.id == reviewId }) else { return }

        isLoading = true

        do {
            try await repository.markReviewAsHelpful(reviewId)

            // Update local review
            var review = reviews[index]
            review.isHelpful = !review.isHelpful
            if review.isHelpful {
                review.helpfulCount += 1
            } else {
                review.helpfulCount -= 1
            }
            reviews[index] = review
            filterReviews()

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func reportReview(_ reviewId: String, reason: String) async {
        guard let index = reviews.firstIndex(where: { $0.id == reviewId }) else { return }

        isLoading = true

        do {
            try await repository.reportReview(reviewId, reason: reason)

            // Update local review
            var review = reviews[index]
            review.isReported = true
            reviews[index] = review
            filterReviews()

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func replyToReview(_ reviewId: String, reply: String) async {
        guard let index = reviews.firstIndex(where: { $0.id == reviewId }),
              let businessId = try? await KeychainManager.shared.getBusinessId() else { return }

        isLoading = true

        do {
            let sellerReply = try await repository.replyToReview(reviewId, businessId: businessId, reply: reply)

            // Update local review
            var review = reviews[index]
            review.sellerReply = sellerReply
            reviews[index] = review
            filterReviews()

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    // MARK: - Sorting

    func sortByMostRecent() {
        sortOrder = .mostRecent
        applySorting()
    }

    func sortByMostHelpful() {
        sortOrder = .mostHelpful
        applySorting()
    }

    func sortByHighestRating() {
        sortOrder = .highestRating
        applySorting()
    }

    func sortByLowestRating() {
        sortOrder = .lowestRating
        applySorting()
    }

    private func applySorting() {
        switch sortOrder {
        case .mostRecent:
            filteredReviews.sort { $0.createdAt > $1.createdAt }
        case .mostHelpful:
            filteredReviews.sort { $0.helpfulCount > $1.helpfulCount }
        case .highestRating:
            filteredReviews.sort { $0.rating > $1.rating }
        case .lowestRating:
            filteredReviews.sort { $0.rating < $1.rating }
        }
    }

    // MARK: - Error Handling

    func clearError() {
        errorMessage = nil
    }
}

// MARK: - Sort Order

enum SortOrder {
    case mostRecent
    case mostHelpful
    case highestRating
    case lowestRating
}
