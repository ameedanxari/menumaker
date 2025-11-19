package com.menumaker.ui

import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import com.menumaker.MainActivity
import com.menumaker.pageobjects.ReviewPage
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * UI tests for review submission and viewing
 */
@LargeTest
@RunWith(AndroidJUnit4::class)
@HiltAndroidTest
class ReviewFlowTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    @Before
    fun setup() {
        hiltRule.inject()
    }

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
