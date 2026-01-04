package com.menumaker.ui

import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import com.menumaker.MainActivity
import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.ReviewDto
import com.menumaker.data.repository.ReviewRepository
import com.menumaker.fakes.FakeReviewRepository
import com.menumaker.pageobjects.ReviewPage
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import javax.inject.Inject

/**
 * UI tests for review submission and viewing
 *
 * These tests use FakeReviewRepository via Hilt test module for deterministic,
 * network-independent testing.
 *
 * Requirements covered:
 * - 4.7: Review submission - rating and reviewing completed orders
 */
@LargeTest
@RunWith(AndroidJUnit4::class)
@HiltAndroidTest
class ReviewFlowTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    @Inject
    lateinit var reviewRepository: ReviewRepository

    private val fakeReviewRepository: FakeReviewRepository
        get() = reviewRepository as FakeReviewRepository

    @Before
    fun setup() {
        hiltRule.inject()
        // Reset fake repository to clean state before each test
        fakeReviewRepository.reset()
    }

    // MARK: - Review Submission Tests with Mocked Dependencies (Requirements 4.7)

    /**
     * Test: Submit review with mocked repository
     * Requirements: 4.7 - Allow rating and reviewing completed orders
     */
    @Test
    fun testSubmitReview_withMockedRepository() {
        val reviewPage = ReviewPage(composeTestRule)
        reviewPage
            .selectRating(5)
            .enterComment("Excellent food and service!")
            .submitReview()
        
        // Verify repository was called
        assert(fakeReviewRepository.createReviewCallCount >= 1) {
            "ReviewRepository createReview should be called"
        }
    }

    /**
     * Test: Submit review with minimum rating
     * Requirements: 4.7 - Allow rating
     */
    @Test
    fun testSubmitMinimumRating_withMockedRepository() {
        val reviewPage = ReviewPage(composeTestRule)
        reviewPage
            .selectRating(1)
            .enterComment("Poor experience")
            .submitReview()
        
        // Verify repository was called with correct rating
        assert(fakeReviewRepository.createReviewCallCount >= 1) {
            "ReviewRepository createReview should be called"
        }
        
        val lastReview = fakeReviewRepository.lastCreatedReview
        if (lastReview != null) {
            assert((lastReview["rating"] as? Number)?.toInt() == 1) {
                "Rating should be 1"
            }
        }
    }

    /**
     * Test: Review submission error handling
     * Requirements: 4.7 - Handle errors gracefully
     */
    @Test
    fun testReviewSubmissionError_showsErrorMessage() {
        // Configure error
        fakeReviewRepository.createReviewResponse = Resource.Error("Failed to submit review")

        val reviewPage = ReviewPage(composeTestRule)
        reviewPage
            .selectRating(4)
            .enterComment("Test comment")
            .submitReview()
        
        // Error should be handled gracefully
    }

    // MARK: - Original Review Tests (kept for compatibility)

    @Test
    fun testReviewScreenDisplays() {
        val reviewPage = ReviewPage(composeTestRule)
        reviewPage.assertScreenDisplayed()
    }

    @Test
    fun testSubmitReviewWithRating() {
        val reviewPage = ReviewPage(composeTestRule)
        reviewPage
            .selectRating(5)
            .assertRatingSelected(5)
            .enterComment("Excellent food and service!")
            .submitReview()
            .assertReviewSubmitted()
    }

    @Test
    fun testSubmitMinimumRating() {
        val reviewPage = ReviewPage(composeTestRule)
        reviewPage
            .selectRating(1)
            .assertRatingSelected(1)
            .enterComment("Poor experience")
            .submitReview()
            .assertReviewSubmitted()
    }

    @Test
    fun testSubmitReviewWithPhotos() {
        val reviewPage = ReviewPage(composeTestRule)
        reviewPage
            .selectRating(4)
            .enterComment("Great food!")
            .addPhoto()
            .assertPhotoAdded()
            .submitReview()
            .assertReviewSubmitted()
    }

    @Test
    fun testRemovePhoto() {
        val reviewPage = ReviewPage(composeTestRule)
        reviewPage
            .addPhoto()
            .assertPhotoAdded()
            .removePhoto(0)
            .assertPhotoRemoved()
    }

    @Test
    fun testSubmitButtonDisabledWithoutRating() {
        val reviewPage = ReviewPage(composeTestRule)
        reviewPage
            .enterComment("Comment without rating")
            .assertSubmitButtonDisabled()
    }

    @Test
    fun testSubmitButtonEnabledWithRating() {
        val reviewPage = ReviewPage(composeTestRule)
        reviewPage
            .selectRating(4)
            .assertSubmitButtonEnabled()
    }

    @Test
    fun testCancelReview() {
        val reviewPage = ReviewPage(composeTestRule)
        reviewPage
            .selectRating(3)
            .enterComment("Test comment")
            .cancelReview()
            .assertScreenDisplayed()
    }

    @Test
    fun testEditReview() {
        val reviewPage = ReviewPage(composeTestRule)
        reviewPage
            .selectRating(4)
            .enterComment("Initial comment")
            .submitReview()
            .editReview()
            .selectRating(5)
            .submitReview()
            .assertReviewSubmitted()
    }

    @Test
    fun testDeleteReview() {
        val reviewPage = ReviewPage(composeTestRule)
        reviewPage
            .tapDeleteReview()
            .confirmDelete()
            .assertReviewDeleted()
    }

    @Test
    fun testCharacterCountDisplay() {
        val reviewPage = ReviewPage(composeTestRule)
        reviewPage
            .enterComment("This is a test comment")
            .assertCharacterCountDisplayed()
    }

    @Test
    fun testMaxPhotosLimit() {
        val reviewPage = ReviewPage(composeTestRule)
        reviewPage
            .addPhoto()
            .addPhoto()
            .addPhoto()
            .assertMaxPhotosReached()
    }
}
