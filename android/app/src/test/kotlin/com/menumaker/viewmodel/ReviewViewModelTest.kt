package com.menumaker.viewmodel

import android.net.Uri
import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.ReviewDto
import com.menumaker.data.remote.models.ReviewListData
import com.menumaker.data.repository.ReviewRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.mockito.Mock
import org.mockito.Mockito.`when`
import org.mockito.MockitoAnnotations

@ExperimentalCoroutinesApi
class ReviewViewModelTest {

    @Mock
    private lateinit var reviewRepository: ReviewRepository

    @Mock
    private lateinit var mockUri: Uri

    private lateinit var viewModel: ReviewViewModel

    private val testDispatcher = UnconfinedTestDispatcher()

    private val mockReview = ReviewDto(
        id = "review-1",
        businessId = "business-1",
        customerName = "John Doe",
        rating = 5,
        comment = "Great food!",
        imageUrls = null,
        createdAt = "2024-01-01T00:00:00Z"
    )

    private val mockReviewListData = ReviewListData(
        reviews = listOf(mockReview),
        averageRating = 4.5,
        totalReviews = 10
    )

    @Before
    fun setup() {
        MockitoAnnotations.openMocks(this)
        Dispatchers.setMain(testDispatcher)

        viewModel = ReviewViewModel(reviewRepository)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `loadReviews updates reviewsState with success`() = runTest {
        // Given
        val businessId = "business-1"
        val successFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Success(mockReviewListData))
        }

        `when`(reviewRepository.getReviews(businessId)).thenReturn(successFlow)

        // When
        viewModel.loadReviews(businessId)

        // Then
        assertTrue(viewModel.reviewsState.value is Resource.Success)
        assertEquals(mockReviewListData, (viewModel.reviewsState.value as Resource.Success).data)
    }

    @Test
    fun `loadReviews updates reviewsState with error`() = runTest {
        // Given
        val businessId = "business-1"
        val errorMessage = "Failed to load reviews"
        val errorFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Error(errorMessage))
        }

        `when`(reviewRepository.getReviews(businessId)).thenReturn(errorFlow)

        // When
        viewModel.loadReviews(businessId)

        // Then
        assertTrue(viewModel.reviewsState.value is Resource.Error)
        assertEquals(errorMessage, (viewModel.reviewsState.value as Resource.Error).message)
    }

    @Test
    fun `createReview updates createState and shows success message`() = runTest {
        // Given
        val reviewData = mapOf(
            "business_id" to "business-1",
            "customer_name" to "John Doe",
            "rating" to 5,
            "comment" to "Great!"
        )
        val successFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Success(mockReview))
        }

        `when`(reviewRepository.createReview(reviewData)).thenReturn(successFlow)
        
        // Mock loadReviews call
        val reviewsFlow = flow {
            emit(Resource.Success(mockReviewListData))
        }
        `when`(reviewRepository.getReviews("business-1")).thenReturn(reviewsFlow)

        // When
        viewModel.createReview(reviewData)

        // Then
        assertTrue(viewModel.createState.value is Resource.Success)
        assertEquals(mockReview, (viewModel.createState.value as Resource.Success).data)
        assertFalse(viewModel.isLoading.value)
        assertTrue(viewModel.showSuccessMessage.value)
        assertEquals("Your review has been submitted successfully!", viewModel.successMessage.value)
    }

    @Test
    fun `createReview updates createState with error and hides success message`() = runTest {
        // Given
        val reviewData = mapOf(
            "business_id" to "business-1",
            "customer_name" to "John Doe",
            "rating" to 5
        )
        val errorMessage = "Failed to create review"
        val errorFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Error(errorMessage))
        }

        `when`(reviewRepository.createReview(reviewData)).thenReturn(errorFlow)

        // When
        viewModel.createReview(reviewData)

        // Then
        assertTrue(viewModel.createState.value is Resource.Error)
        assertEquals(errorMessage, (viewModel.createState.value as Resource.Error).message)
        assertFalse(viewModel.isLoading.value)
        assertFalse(viewModel.showSuccessMessage.value)
        assertEquals(null, viewModel.successMessage.value)
    }

    @Test
    fun `submitReview creates review with correct data`() = runTest {
        // Given
        val businessId = "business-1"
        val orderId = "order-1"
        val customerName = "John Doe"
        val rating = 5
        val comment = "Excellent!"
        val imageUris = emptyList<Uri>()

        val expectedReviewData = mapOf(
            "business_id" to businessId,
            "order_id" to orderId,
            "customer_name" to customerName,
            "rating" to rating,
            "comment" to comment
        )

        val successFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Success(mockReview))
        }

        `when`(reviewRepository.createReview(expectedReviewData)).thenReturn(successFlow)
        
        val reviewsFlow = flow {
            emit(Resource.Success(mockReviewListData))
        }
        `when`(reviewRepository.getReviews(businessId)).thenReturn(reviewsFlow)

        // When
        viewModel.submitReview(businessId, orderId, customerName, rating, comment, imageUris)

        // Then
        assertTrue(viewModel.createState.value is Resource.Success)
        assertTrue(viewModel.showSuccessMessage.value)
    }

    @Test
    fun `submitReview without orderId creates review correctly`() = runTest {
        // Given
        val businessId = "business-1"
        val customerName = "Jane Doe"
        val rating = 4
        val comment = "Good food"
        val imageUris = emptyList<Uri>()

        val expectedReviewData = mapOf(
            "business_id" to businessId,
            "customer_name" to customerName,
            "rating" to rating,
            "comment" to comment
        )

        val successFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Success(mockReview))
        }

        `when`(reviewRepository.createReview(expectedReviewData)).thenReturn(successFlow)
        
        val reviewsFlow = flow {
            emit(Resource.Success(mockReviewListData))
        }
        `when`(reviewRepository.getReviews(businessId)).thenReturn(reviewsFlow)

        // When
        viewModel.submitReview(businessId, null, customerName, rating, comment, imageUris)

        // Then
        assertTrue(viewModel.createState.value is Resource.Success)
    }

    @Test
    fun `clearSuccessMessage resets success state`() {
        // When
        viewModel.clearSuccessMessage()

        // Then
        assertFalse(viewModel.showSuccessMessage.value)
        assertEquals(null, viewModel.successMessage.value)
    }

    @Test
    fun `initial state is correct`() {
        assertEquals(null, viewModel.reviewsState.value)
        assertEquals(null, viewModel.createState.value)
        assertFalse(viewModel.isLoading.value)
        assertFalse(viewModel.showSuccessMessage.value)
        assertEquals(null, viewModel.successMessage.value)
    }
}
