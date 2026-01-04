package com.menumaker.repository

import com.google.common.truth.Truth.assertThat
import com.menumaker.data.common.Resource
import com.menumaker.data.local.db.dao.ReviewDao
import com.menumaker.data.remote.models.ReviewDto
import com.menumaker.data.remote.models.ReviewListData
import com.menumaker.data.repository.ReviewRepositoryImpl
import com.menumaker.testutils.FakeApiService
import com.menumaker.testutils.TestDataFactory
import com.menumaker.testutils.TestDispatcherRule
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.test.runTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import retrofit2.Response
import java.io.IOException

/**
 * Unit tests for ReviewRepositoryImpl.
 * Tests getReviews and createReview flows.
 *
 * Requirements: 4.7
 */
@OptIn(ExperimentalCoroutinesApi::class)
class ReviewRepositoryTest {

    @get:Rule
    val dispatcherRule = TestDispatcherRule()

    private lateinit var fakeApiService: FakeApiService
    private lateinit var mockReviewDao: ReviewDao
    private lateinit var repository: ReviewRepositoryImpl

    @Before
    fun setup() {
        fakeApiService = FakeApiService()
        mockReviewDao = mock()
        repository = ReviewRepositoryImpl(fakeApiService, mockReviewDao)
    }

    // ==================== getReviews Tests ====================

    @Test
    fun `getReviews emits Loading then Success with reviews`() = runTest {
        // Given
        val reviews = listOf(
            TestDataFactory.createReview(id = "review-1", rating = 5),
            TestDataFactory.createReview(id = "review-2", rating = 4)
        )
        fakeApiService.getReviewsResponse = Response.success(
            TestDataFactory.createReviewListResponse(reviews = reviews)
        )

        // When
        val results = repository.getReviews("business-123").toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        val successResult = results.last() as Resource.Success<ReviewListData>
        assertThat(successResult.data.reviews).hasSize(2)
    }

    @Test
    fun `getReviews caches reviews on success`() = runTest {
        // Given
        val reviews = listOf(TestDataFactory.createReview())
        fakeApiService.getReviewsResponse = Response.success(
            TestDataFactory.createReviewListResponse(reviews = reviews)
        )

        // When
        repository.getReviews("business-123").toList()

        // Then
        verify(mockReviewDao).insertReviews(any())
    }

    @Test
    fun `getReviews emits Error on API failure`() = runTest {
        // Given
        fakeApiService.errorCode = 500

        // When
        val results = repository.getReviews("business-123").toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        assertThat(results.last()).isInstanceOf(Resource.Error::class.java)
    }

    @Test
    fun `getReviews handles network error gracefully`() = runTest {
        // Given
        fakeApiService.shouldThrowException = IOException("Network unavailable")

        // When
        val results = repository.getReviews("business-123").toList()

        // Then
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("Network unavailable")
    }

    // ==================== createReview Tests ====================

    @Test
    fun `createReview emits Loading then Success with review`() = runTest {
        // Given
        val review = TestDataFactory.createReview(rating = 5, comment = "Great food!")
        fakeApiService.createReviewResponse = Response.success(
            TestDataFactory.createReviewResponse(review = review)
        )

        // When
        val reviewData = mapOf(
            "businessId" to "business-123",
            "rating" to 5,
            "comment" to "Great food!"
        )
        val results = repository.createReview(reviewData).toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        val successResult = results.last() as Resource.Success<ReviewDto>
        assertThat(successResult.data.rating).isEqualTo(5)
        assertThat(successResult.data.comment).isEqualTo("Great food!")
    }

    @Test
    fun `createReview emits Error on API failure`() = runTest {
        // Given
        fakeApiService.errorCode = 400

        // When
        val results = repository.createReview(mapOf("businessId" to "business-123")).toList()

        // Then
        assertThat(results.last()).isInstanceOf(Resource.Error::class.java)
    }

    @Test
    fun `createReview handles network error gracefully`() = runTest {
        // Given
        fakeApiService.shouldThrowException = IOException("Connection timeout")

        // When
        val results = repository.createReview(mapOf("businessId" to "business-123")).toList()

        // Then
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("Connection timeout")
    }
}
