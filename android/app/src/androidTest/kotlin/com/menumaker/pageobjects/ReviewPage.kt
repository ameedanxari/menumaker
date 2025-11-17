package com.menumaker.pageobjects

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.ComposeTestRule

/**
 * Page Object for Review and Rating Screen
 */
class ReviewPage(private val composeTestRule: ComposeTestRule) {

    // Elements
    private val ratingStars = composeTestRule.onAllNodes(hasTestTag("RatingStar"))
    private val reviewTextField = composeTestRule.onNodeWithText("Write review", substring = true, ignoreCase = true)
    private val submitButton = composeTestRule.onNodeWithText("Submit", ignoreCase = true)
    private val reviewsList = composeTestRule.onAllNodes(hasTestTag("ReviewItem"))
    private val averageRatingLabel = composeTestRule.onNode(hasTestTag("AverageRating"))
    private val photoUploadButton = composeTestRule.onNodeWithText("Add Photo", substring = true, ignoreCase = true)

    // Actions
    fun selectRating(stars: Int): ReviewPage {
        require(stars in 1..5) { "Rating must be between 1 and 5" }
        ratingStars[stars - 1].performClick()
        Thread.sleep(500)
        return this
    }

    fun enterReview(text: String): ReviewPage {
        reviewTextField.performClick()
        reviewTextField.performTextInput(text)
        return this
    }

    fun tapSubmit(): ReviewPage {
        submitButton.performClick()
        Thread.sleep(2000)
        return this
    }

    fun submitQuickReview(rating: Int, text: String): ReviewPage {
        selectRating(rating)
        enterReview(text)
        tapSubmit()
        return this
    }

    fun tapAddPhoto(): ReviewPage {
        photoUploadButton.performClick()
        Thread.sleep(500)
        return this
    }

    // Assertions
    fun assertScreenDisplayed(): ReviewPage {
        ratingStars.onFirst().assertExists()
        return this
    }

    fun assertReviewsDisplayed(): ReviewPage {
        assert(reviewsList.fetchSemanticsNodes().isNotEmpty()) {
            "Reviews should be displayed"
        }
        return this
    }

    fun assertAverageRatingDisplayed(): ReviewPage {
        averageRatingLabel.assertExists()
        return this
    }

    fun assertSubmitButtonEnabled(): ReviewPage {
        submitButton.assertIsEnabled()
        return this
    }
}
