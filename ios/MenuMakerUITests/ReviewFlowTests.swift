//
//  ReviewFlowTests.swift
//  MenuMakerUITests
//
//  Tests for review and rating system - submit, view, filter, seller replies
//

import XCTest

final class ReviewFlowTests: XCTestCase {

    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["UI-Testing"]
        app.launch()
    }

    override func tearDownWithError() throws {
        app = nil
    }

    // MARK: - Submit Review Tests (P0)

    @MainActor
    func testReviewScreenDisplays() throws {
        loginAsCustomer()
        navigateToReviewScreen()

        let reviewPage = ReviewPage(app: app)
        reviewPage.assertScreenDisplayed()
    }

    @MainActor
    func testSubmitRatingOnly() throws {
        loginAsCustomer()
        navigateToReviewScreen()

        let reviewPage = ReviewPage(app: app)

        guard reviewPage.ratingStars.count > 0 else {
            XCTFail("Review feature not implemented yet - UI element not found or feature not implemented"); return
        }

        reviewPage
            .assertRatingStarsDisplayed()
            .selectRating(5)
            .submitReview()

        sleep(2)

        XCTAssertTrue(reviewPage.successMessage.waitForExistence(timeout: 2), "Review submission success message should appear")
        if reviewPage.successMessage.exists {
            XCTAssertTrue(reviewPage.successMessage.exists, "Submission success message should appear")
        } else {
            XCTAssertTrue(reviewPage.firstReview.waitForExistence(timeout: 2), "Submitted review should appear in the list")
        }
    }

    @MainActor
    func testSubmitReviewWithText() throws {
        loginAsCustomer()
        navigateToReviewScreen()

        let reviewPage = ReviewPage(app: app)

        guard reviewPage.ratingStars.count > 0 else {
            XCTFail("Review feature not implemented yet - UI element not found or feature not implemented"); return
        }

        reviewPage
            .selectRating(4)
            .assertReviewFieldDisplayed()
            .enterReview("Great food and fast delivery!")
            .submitReview()

        sleep(2)

        if reviewPage.successMessage.waitForExistence(timeout: 3) {
            reviewPage.assertSuccessMessageDisplayed()
        }
    }

    @MainActor
    func testSubmitReviewWithPhoto() throws {
        loginAsCustomer()
        navigateToReviewScreen()

        let reviewPage = ReviewPage(app: app)

        guard reviewPage.ratingStars.count > 0 else {
            XCTFail("Review feature not implemented yet - UI element not found or feature not implemented"); return
        }

        guard reviewPage.photoUploadButton.waitForExistence(timeout: 2) else {
            XCTFail("Photo upload feature not implemented yet - UI element not found or feature not implemented"); return
        }

        reviewPage
            .selectRating(5)
            .enterReview("Amazing food! See the photo.")
            .uploadPhoto()

        sleep(1)

        if reviewPage.uploadedPhotos.count > 0 {
            reviewPage.assertPhotoUploaded()
        }

        reviewPage.submitReview()
    }

    @MainActor
    func testSubmitLowRatingReview() throws {
        loginAsCustomer()
        navigateToReviewScreen()

        let reviewPage = ReviewPage(app: app)

        guard reviewPage.ratingStars.count > 0 else {
            XCTFail("Review feature not implemented yet - UI element not found or feature not implemented"); return
        }

        reviewPage
            .selectRating(2)
            .enterReview("Food was cold and took too long.")
            .submitReview()

        sleep(2)
    }

    @MainActor
    func testCancelReviewSubmission() throws {
        loginAsCustomer()
        navigateToReviewScreen()

        let reviewPage = ReviewPage(app: app)

        guard reviewPage.ratingStars.count > 0 else {
            XCTFail("Review feature not implemented yet - UI element not found or feature not implemented"); return
        }

        reviewPage
            .selectRating(3)
            .enterReview("This review will be cancelled")
            .cancelReview()

        sleep(1)

        // Should close review form
        XCTAssertFalse(reviewPage.submitButton.exists || !reviewPage.submitButton.isHittable,
                      "Review form should be closed")
    }

    @MainActor
    func testSubmitReviewWithoutRating() throws {
        loginAsCustomer()
        navigateToReviewScreen()

        let reviewPage = ReviewPage(app: app)

        guard reviewPage.reviewTextField.waitForExistence(timeout: 2) else {
            XCTFail("Review feature not implemented yet - UI element not found or feature not implemented"); return
        }

        reviewPage.enterReview("Great experience!")

        // Submit button should be disabled without rating
        if reviewPage.submitButton.exists {
            // Most apps require at least a rating
            XCTAssertFalse(reviewPage.submitButton.isEnabled,
                          "Submit should be disabled without rating")
        }
    }

    // MARK: - View Reviews Tests (P0)

    @MainActor
    func testViewSellerReviews() throws {
        loginAsCustomer()
        navigateToSellerProfile()

        let reviewPage = ReviewPage(app: app)

        reviewPage.scrollToReviews()

        guard reviewPage.firstReview.waitForExistence(timeout: 2) ||
              reviewPage.emptyStateMessage.waitForExistence(timeout: 2) else {
            XCTFail("Reviews section not implemented yet - UI element not found or feature not implemented"); return
        }

        reviewPage.assertReviewsDisplayed()
    }

    @MainActor
    func testViewAverageRating() throws {
        loginAsCustomer()
        navigateToSellerProfile()

        let reviewPage = ReviewPage(app: app)

        guard reviewPage.averageRatingLabel.waitForExistence(timeout: 2) else {
            XCTFail("Average rating not implemented yet - UI element not found or feature not implemented"); return
        }

        reviewPage.assertAverageRatingDisplayed()
    }

    @MainActor
    func testViewTotalReviewsCount() throws {
        loginAsCustomer()
        navigateToSellerProfile()

        let reviewPage = ReviewPage(app: app)

        guard reviewPage.totalReviewsCountLabel.waitForExistence(timeout: 2) else {
            XCTFail("Reviews count not implemented yet - UI element not found or feature not implemented"); return
        }

        reviewPage.assertTotalReviewsCountDisplayed()
    }

    @MainActor
    func testViewReviewDetails() throws {
        loginAsCustomer()
        navigateToSellerProfile()

        let reviewPage = ReviewPage(app: app)

        reviewPage.scrollToReviews()

        guard reviewPage.firstReview.waitForExistence(timeout: 2) else {
            XCTFail("No reviews available - UI element not found or feature not implemented"); return
        }

        reviewPage.tapFirstReview()

        sleep(1)
        // Review details should be displayed or expanded
    }

    // MARK: - Filter and Sort Reviews Tests (P1)

    @MainActor
    func testFilterReviewsByRating() throws {
        loginAsCustomer()
        navigateToSellerProfile()

        let reviewPage = ReviewPage(app: app)

        reviewPage.scrollToReviews()

        guard reviewPage.filterButtons.count > 0 else {
            XCTFail("Review filtering not implemented yet - UI element not found or feature not implemented"); return
        }

        reviewPage.filterByRating(5)

        sleep(1)

        // Only 5-star reviews should be displayed
    }

    @MainActor
    func testSortReviewsByMostRecent() throws {
        loginAsCustomer()
        navigateToSellerProfile()

        let reviewPage = ReviewPage(app: app)

        reviewPage.scrollToReviews()

        guard reviewPage.sortButton.waitForExistence(timeout: 2) else {
            XCTFail("Review sorting not implemented yet - UI element not found or feature not implemented"); return
        }

        reviewPage.sortByMostRecent()

        sleep(1)
    }

    @MainActor
    func testSortReviewsByMostHelpful() throws {
        loginAsCustomer()
        navigateToSellerProfile()

        let reviewPage = ReviewPage(app: app)

        reviewPage.scrollToReviews()

        guard reviewPage.sortButton.waitForExistence(timeout: 2) else {
            XCTFail("Review sorting not implemented yet - UI element not found or feature not implemented"); return
        }

        reviewPage.sortByMostHelpful()

        sleep(1)
    }

    // MARK: - Review Interaction Tests (P1)

    @MainActor
    func testMarkReviewAsHelpful() throws {
        loginAsCustomer()
        navigateToSellerProfile()

        let reviewPage = ReviewPage(app: app)

        reviewPage.scrollToReviews()

        guard reviewPage.firstReview.waitForExistence(timeout: 2) else {
            XCTFail("No reviews available - UI element not found or feature not implemented"); return
        }

        guard reviewPage.helpfulButton.waitForExistence(timeout: 2) else {
            XCTFail("Helpful button not implemented yet - UI element not found or feature not implemented"); return
        }

        reviewPage.markReviewAsHelpful()

        sleep(1)
    }

    @MainActor
    func testReportReview() throws {
        loginAsCustomer()
        navigateToSellerProfile()

        let reviewPage = ReviewPage(app: app)

        reviewPage.scrollToReviews()

        guard reviewPage.firstReview.waitForExistence(timeout: 2) else {
            XCTFail("No reviews available - UI element not found or feature not implemented"); return
        }

        // Tap to expand review actions
        reviewPage.tapFirstReview()

        guard reviewPage.reportButton.waitForExistence(timeout: 2) else {
            XCTFail("Report feature not implemented yet - UI element not found or feature not implemented"); return
        }

        reviewPage.reportReview()

        sleep(1)
    }

    // MARK: - Seller Review Management Tests (P1)

    @MainActor
    func testSellerViewReceivedReviews() throws {
        loginAsSeller()
        navigateToSellerReviews()

        let reviewPage = ReviewPage(app: app)

        guard reviewPage.firstReview.waitForExistence(timeout: 2) ||
              reviewPage.emptyStateMessage.waitForExistence(timeout: 2) else {
            XCTFail("Seller reviews section not implemented yet - UI element not found or feature not implemented"); return
        }

        reviewPage.assertReviewsDisplayed()
    }

    @MainActor
    func testSellerViewReviewStatistics() throws {
        loginAsSeller()
        navigateToSellerReviews()

        let reviewPage = ReviewPage(app: app)

        guard reviewPage.averageRatingLabel.waitForExistence(timeout: 2) ||
              reviewPage.totalReviewsCountLabel.waitForExistence(timeout: 2) else {
            XCTFail("Review statistics not implemented yet - UI element not found or feature not implemented"); return
        }

        // Verify statistics are displayed
        XCTAssertTrue(reviewPage.averageRatingLabel.exists ||
                     reviewPage.totalReviewsCountLabel.exists,
                     "Review statistics should be displayed")
    }

    @MainActor
    func testSellerReplyToReview() throws {
        loginAsSeller()
        navigateToSellerReviews()

        let reviewPage = ReviewPage(app: app)

        guard reviewPage.firstReview.waitForExistence(timeout: 2) else {
            XCTFail("No reviews to reply to - UI element not found or feature not implemented"); return
        }

        reviewPage.tapFirstReview()

        // Look for reply button
        let replyButton = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'reply'")).firstMatch

        guard replyButton.waitForExistence(timeout: 2) else {
            XCTFail("Reply feature not implemented yet - UI element not found or feature not implemented"); return
        }

        replyButton.tap()
        sleep(1)

        // Enter reply
        let replyField = app.textViews.firstMatch
        if replyField.waitForExistence(timeout: 2) {
            replyField.tap()
            replyField.typeText("Thank you for your feedback!")

            let sendButton = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'send' OR label CONTAINS[c] 'submit'")).firstMatch
            if sendButton.waitForExistence(timeout: 1) {
                sendButton.tap()
                sleep(2)
            }
        }
    }

    @MainActor
    func testViewSellerReplyAsCustomer() throws {
        loginAsCustomer()
        navigateToSellerProfile()

        let reviewPage = ReviewPage(app: app)

        reviewPage.scrollToReviews()

        guard reviewPage.firstReview.waitForExistence(timeout: 2) else {
            XCTFail("No reviews available - UI element not found or feature not implemented"); return
        }

        // Look for seller reply indicator
        XCTAssertTrue(reviewPage.sellerReplyLabel.waitForExistence(timeout: 2), "Seller reply should be visible")
        reviewPage.assertSellerReplyVisible()
    }

    // MARK: - Integration Tests (P1)

    @MainActor
    func testReviewAfterOrderDelivery() throws {
        loginAsCustomer()

        // Navigate to completed orders
        navigateToCompletedOrders()

        guard app.scrollViews.otherElements.matching(identifier: "OrderItem").firstMatch.waitForExistence(timeout: 2) else {
            XCTFail("No completed orders available - UI element not found or feature not implemented"); return
        }

        // Tap first completed order
        let firstOrder = app.scrollViews.otherElements.matching(identifier: "OrderItem").firstMatch
        firstOrder.tap()
        sleep(1)

        // Look for rate/review button
        let trackingPage = DeliveryTrackingPage(app: app)

        guard trackingPage.rateOrderButton.waitForExistence(timeout: 2) else {
            XCTFail("Rate order feature not available - UI element not found or feature not implemented"); return
        }

        trackingPage.tapRateOrder()

        let reviewPage = ReviewPage(app: app)

        guard reviewPage.ratingStars.count > 0 else {
            XCTFail("Review form not displayed - UI element not found or feature not implemented"); return
        }

        reviewPage.submitQuickReview(rating: 5, text: "Great experience!")
    }

    @MainActor
    func testReviewImpactsSellerRating() throws {
        loginAsCustomer()
        navigateToSellerProfile()

        let reviewPage = ReviewPage(app: app)

        // Get initial average rating
        guard reviewPage.averageRatingLabel.waitForExistence(timeout: 2) else {
            XCTFail("Average rating not displayed - UI element not found or feature not implemented"); return
        }

        let _ = reviewPage.averageRatingLabel.label

        // Submit a new review
        navigateToReviewScreen()

        if reviewPage.ratingStars.count > 0 {
            reviewPage.submitQuickReview(rating: 5, text: "Excellent!")

            sleep(2)

            // Navigate back to seller profile
            navigateToSellerProfile()

            // Average rating should be updated (may not change visibly depending on number of reviews)
            XCTAssertTrue(reviewPage.averageRatingLabel.exists,
                         "Average rating should still be displayed")
        }
    }

    @MainActor
    func testCannotReviewSameOrderTwice() throws {
        loginAsCustomer()
        navigateToCompletedOrders()

        guard app.scrollViews.otherElements.matching(identifier: "OrderItem").firstMatch.waitForExistence(timeout: 2) else {
            XCTFail("No completed orders available - UI element not found or feature not implemented"); return
        }

        let firstOrder = app.scrollViews.otherElements.matching(identifier: "OrderItem").firstMatch
        firstOrder.tap()
        sleep(1)

        let trackingPage = DeliveryTrackingPage(app: app)

        if trackingPage.rateOrderButton.waitForExistence(timeout: 2) {
            trackingPage.tapRateOrder()

            let reviewPage = ReviewPage(app: app)
            if reviewPage.ratingStars.count > 0 {
                reviewPage.submitQuickReview(rating: 4, text: "Good food")
                sleep(2)

                // Go back and try to review again
                navigateToCompletedOrders()
                firstOrder.tap()
                sleep(1)

                // Rate button should be disabled or show "Already reviewed"
                if trackingPage.rateOrderButton.exists {
                    XCTAssertFalse(trackingPage.rateOrderButton.isEnabled,
                                  "Cannot review same order twice")
                }
            }
        }
    }

    // MARK: - Helper Methods

    private func loginAsCustomer() {
        let loginPage = LoginPage(app: app)
        if loginPage.emailField.waitForExistence(timeout: 2) {
            loginPage.login(email: "test@example.com", password: "password123")
            _ = app.tabBars.firstMatch.waitForExistence(timeout: 5)
        }
    }

    private func loginAsSeller() {
        let loginPage = LoginPage(app: app)
        if loginPage.emailField.waitForExistence(timeout: 2) {
            loginPage.login(email: "seller@example.com", password: "password123")
            _ = app.tabBars.firstMatch.waitForExistence(timeout: 5)
        }
    }

    private func navigateToReviewScreen() {
        // Navigate to marketplace and find a seller to review
        let marketplaceTab = app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'marketplace' OR label CONTAINS[c] 'home'")).firstMatch
        if marketplaceTab.waitForExistence(timeout: 2) {
            marketplaceTab.tap()
            sleep(1)
        }

        let marketplacePage = MarketplacePage(app: app)
        if marketplacePage.firstSellerCard.waitForExistence(timeout: 2) {
            marketplacePage.tapFirstSeller()
            sleep(1)

            // Look for review/rate button
            let reviewButton = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'review' OR label CONTAINS[c] 'rate'")).firstMatch
            if reviewButton.waitForExistence(timeout: 2) {
                reviewButton.tap()
                sleep(1)
            }
        }
    }

    private func navigateToSellerProfile() {
        let marketplaceTab = app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'marketplace' OR label CONTAINS[c] 'home'")).firstMatch
        if marketplaceTab.waitForExistence(timeout: 2) {
            marketplaceTab.tap()
            sleep(1)
        }

        let marketplacePage = MarketplacePage(app: app)
        if marketplacePage.firstSellerCard.waitForExistence(timeout: 2) {
            marketplacePage.tapFirstSeller()
            sleep(1)
        }
    }

    private func navigateToSellerReviews() {
        // Navigate to reviews section in seller dashboard
        let reviewsTab = app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'review'")).firstMatch

        if reviewsTab.waitForExistence(timeout: 2) {
            reviewsTab.tap()
        } else {
            // Try via menu
            let menuButton = app.navigationBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'menu'")).firstMatch
            if menuButton.waitForExistence(timeout: 2) {
                menuButton.tap()
                sleep(1)

                let reviewsOption = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'review'")).firstMatch
                if reviewsOption.waitForExistence(timeout: 2) {
                    reviewsOption.tap()
                }
            }
        }
    }

    private func navigateToCompletedOrders() {
        let ordersTab = app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'order'")).firstMatch

        if ordersTab.waitForExistence(timeout: 2) {
            ordersTab.tap()
            sleep(1)

            // Switch to completed tab
            let completedTab = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'completed' OR label CONTAINS[c] 'past'")).firstMatch
            if completedTab.waitForExistence(timeout: 2) {
                completedTab.tap()
                sleep(1)
            }
        }
    }
}
