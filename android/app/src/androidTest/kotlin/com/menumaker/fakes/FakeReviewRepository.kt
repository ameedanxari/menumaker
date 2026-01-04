package com.menumaker.fakes

import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.ReviewDto
import com.menumaker.data.remote.models.ReviewListData
import com.menumaker.data.repository.ReviewRepository
import com.menumaker.fixtures.SharedFixtures
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

/**
 * Fake implementation of ReviewRepository for UI tests.
 * Provides configurable responses for deterministic testing.
 */
class FakeReviewRepository : ReviewRepository {

    // Configurable responses
    var reviewsResponse: Resource<ReviewListData>? = null
    var createReviewResponse: Resource<ReviewDto>? = null

    // In-memory storage for reviews
    private val reviews = mutableListOf<ReviewDto>()

    // Track method calls for verification
    var getReviewsCallCount = 0
    var createReviewCallCount = 0
    var lastBusinessId: String? = null
    var lastCreatedReview: Map<String, Any>? = null

    // Default test data
    private val defaultReviews: List<ReviewDto>
        get() = SharedFixtures.reviews.reviews

    init {
        reviews.addAll(defaultReviews)
    }

    override fun getReviews(businessId: String): Flow<Resource<ReviewListData>> = flow {
        emit(Resource.Loading)
        getReviewsCallCount++
        lastBusinessId = businessId

        if (reviewsResponse != null) {
            emit(reviewsResponse!!)
        } else {
            val filteredReviews = reviews.filter { it.businessId == businessId }
            val averageRating = if (filteredReviews.isNotEmpty()) {
                filteredReviews.map { it.rating }.average()
            } else 0.0

            emit(Resource.Success(
                ReviewListData(
                    reviews = filteredReviews,
                    averageRating = averageRating,
                    totalReviews = filteredReviews.size
                )
            ))
        }
    }

    override fun createReview(review: Map<String, Any>): Flow<Resource<ReviewDto>> = flow {
        emit(Resource.Loading)
        createReviewCallCount++
        lastCreatedReview = review

        if (createReviewResponse != null) {
            emit(createReviewResponse!!)
        } else {
            val newReview = ReviewDto(
                id = "review-${System.currentTimeMillis()}",
                businessId = review["business_id"] as? String ?: "business-1",
                customerName = review["customer_name"] as? String ?: "Anonymous",
                rating = (review["rating"] as? Number)?.toInt() ?: 5,
                comment = review["comment"] as? String,
                imageUrls = null,
                createdAt = "2025-01-01T00:00:00Z"
            )
            reviews.add(newReview)
            emit(Resource.Success(newReview))
        }
    }

    /**
     * Reset all state for clean test setup
     */
    fun reset() {
        reviewsResponse = null
        createReviewResponse = null
        reviews.clear()
        reviews.addAll(defaultReviews)
        getReviewsCallCount = 0
        createReviewCallCount = 0
        lastBusinessId = null
        lastCreatedReview = null
    }

    /**
     * Set reviews directly for test setup
     */
    fun setReviews(newReviews: List<ReviewDto>) {
        reviews.clear()
        reviews.addAll(newReviews)
    }

    /**
     * Add a review to the in-memory storage
     */
    fun addReview(review: ReviewDto) {
        reviews.add(review)
    }

    /**
     * Get average rating for a business
     */
    fun getAverageRating(businessId: String): Double {
        val businessReviews = reviews.filter { it.businessId == businessId }
        return if (businessReviews.isNotEmpty()) {
            businessReviews.map { it.rating }.average()
        } else 0.0
    }

    /**
     * Configure for empty results scenario
     */
    fun configureEmptyResults() {
        reviews.clear()
        reviewsResponse = Resource.Success(
            ReviewListData(
                reviews = emptyList(),
                averageRating = 0.0,
                totalReviews = 0
            )
        )
    }

    /**
     * Configure for error scenario
     */
    fun configureError(errorMessage: String = "Failed to load reviews") {
        reviewsResponse = Resource.Error(errorMessage)
    }
}
