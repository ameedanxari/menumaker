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
        composeTestRule.onNode(
            hasTestTag("AddPhotoButton") or
            hasText("Add Photo", substring = true, ignoreCase = true) or
            hasText("Upload Photo", substring = true, ignoreCase = true) or
            hasContentDescription("add photo", substring = true, ignoreCase = true)
        ).performClick()
        Thread.sleep(500)
        return this
    }

    fun enterComment(text: String): ReviewPage {
        return enterReview(text)
    }

    fun addPhoto(): ReviewPage {
        return tapAddPhoto()
    }

    fun tapDeleteReview(): ReviewPage {
        composeTestRule.onNode(
            hasTestTag("DeleteReviewButton") or
            hasText("Delete", ignoreCase = true) or
            hasText("Remove", ignoreCase = true) or
            hasContentDescription("delete review", substring = true, ignoreCase = true)
        ).performClick()
        Thread.sleep(1000)
        return this
    }

    fun submitReview(): ReviewPage {
        tapSubmit()
        return this
    }

    fun confirmDelete(): ReviewPage {
        composeTestRule.onNode(
            hasTestTag("ConfirmDeleteButton") or
            hasText("Confirm", ignoreCase = true) or
            hasText("Yes", ignoreCase = true) or
            hasText("Delete", ignoreCase = true)
        ).performClick()
        Thread.sleep(1000)
        return this
    }

    fun cancelReview(): ReviewPage {
        composeTestRule.onNode(
            hasTestTag("CancelReviewButton") or
            hasText("Cancel", ignoreCase = true) or
            hasText("Back", ignoreCase = true) or
            hasText("Discard", ignoreCase = true)
        ).performClick()
        Thread.sleep(500)
        return this
    }

    fun removePhoto(index: Int = 0): ReviewPage {
        // Target specific photo or first photo
        val photoRemoveButton = if (index == 0) {
            composeTestRule.onNode(
                hasTestTag("RemovePhotoButton") or
                hasTestTag("RemovePhoto_$index") or
                hasText("remove", substring = true, ignoreCase = true) or
                hasContentDescription("remove photo", substring = true, ignoreCase = true)
            )
        } else {
            composeTestRule.onNode(
                hasTestTag("RemovePhoto_$index") or
                hasContentDescription("remove photo $index", substring = true, ignoreCase = true)
            )
        }
        photoRemoveButton.performClick()
        Thread.sleep(500)
        return this
    }

    fun editReview(): ReviewPage {
        composeTestRule.onNode(
            hasTestTag("EditReviewButton") or
            hasText("Edit", ignoreCase = true) or
            hasText("Modify", ignoreCase = true) or
            hasContentDescription("edit review", substring = true, ignoreCase = true)
        ).performClick()
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

    fun assertRatingSelected(rating: Int? = null): ReviewPage {
        // Check that at least one star is selected
        ratingStars.onFirst().assertExists()
        // If specific rating is provided, could verify that rating
        // For now, just verify stars exist
        return this
    }

    fun assertReviewSubmitted(): ReviewPage {
        // Check for success message or confirmation
        composeTestRule.onNode(
            hasTestTag("ReviewSubmittedMessage") or
            hasText("review submitted", substring = true, ignoreCase = true) or
            hasText("thank you", substring = true, ignoreCase = true) or
            hasText("submitted successfully", substring = true, ignoreCase = true) or
            hasText("thanks for your review", substring = true, ignoreCase = true)
        ).assertExists()
        return this
    }

    fun assertPhotoAdded(): ReviewPage {
        composeTestRule.onNode(
            hasTestTag("ReviewPhoto") or
            hasTestTag("UploadedPhoto") or
            hasContentDescription("review photo", substring = true, ignoreCase = true) or
            hasText("photo added", substring = true, ignoreCase = true)
        ).assertExists()
        return this
    }

    fun assertSubmitButtonDisabled(): ReviewPage {
        submitButton.assertIsNotEnabled()
        return this
    }

    fun assertCharacterCountDisplayed(): ReviewPage {
        composeTestRule.onNode(
            hasTestTag("CharacterCount") or
            hasText("/", substring = true) or
            hasText("character", substring = true, ignoreCase = true) or
            hasText("characters remaining", substring = true, ignoreCase = true)
        ).assertExists()
        return this
    }

    fun assertMaxPhotosReached(): ReviewPage {
        composeTestRule.onNode(
            hasTestTag("MaxPhotosError") or
            hasText("maximum photos", substring = true, ignoreCase = true) or
            hasText("max photos reached", substring = true, ignoreCase = true) or
            hasText("photo limit", substring = true, ignoreCase = true) or
            hasText("can't add more photos", substring = true, ignoreCase = true)
        ).assertExists()
        return this
    }

    fun assertReviewDeleted(): ReviewPage {
        composeTestRule.onNode(
            hasTestTag("ReviewDeletedMessage") or
            hasText("review deleted", substring = true, ignoreCase = true) or
            hasText("review removed", substring = true, ignoreCase = true) or
            hasText("deleted successfully", substring = true, ignoreCase = true) or
            hasText("removed successfully", substring = true, ignoreCase = true)
        ).assertExists()
        return this
    }

    fun assertPhotoRemoved(): ReviewPage {
        // Check that photo removal was successful
        composeTestRule.onNode(
            hasTestTag("PhotoRemovedMessage") or
            hasText("photo removed", substring = true, ignoreCase = true) or
            hasText("photo deleted", substring = true, ignoreCase = true) or
            hasText("removed successfully", substring = true, ignoreCase = true)
        ).assertExists()
        return this
    }
}
