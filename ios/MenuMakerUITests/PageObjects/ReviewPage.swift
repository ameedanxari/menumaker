//
//  ReviewPage.swift
//  MenuMakerUITests
//
//  Page Object for Review and Rating Screen
//

import XCTest

struct ReviewPage {
    let app: XCUIApplication

    // MARK: - Elements

    var ratingStars: XCUIElementQuery {
        app.buttons.matching(NSPredicate(format: "identifier CONTAINS 'star' OR label CONTAINS '★' OR label CONTAINS '☆'"))
    }

    var star1: XCUIElement {
        ratingStars.element(boundBy: 0)
    }

    var star2: XCUIElement {
        ratingStars.element(boundBy: 1)
    }

    var star3: XCUIElement {
        ratingStars.element(boundBy: 2)
    }

    var star4: XCUIElement {
        ratingStars.element(boundBy: 3)
    }

    var star5: XCUIElement {
        ratingStars.element(boundBy: 4)
    }

    var reviewTextField: XCUIElement {
        app.textViews.matching(NSPredicate(format: "placeholderValue CONTAINS[c] 'review' OR placeholderValue CONTAINS[c] 'comment' OR placeholderValue CONTAINS[c] 'feedback'")).firstMatch
    }

    var submitButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'submit' OR label CONTAINS[c] 'send'")).firstMatch
    }

    var cancelButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'cancel' OR label CONTAINS[c] 'skip'")).firstMatch
    }

    var successMessage: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'thank' OR label CONTAINS[c] 'submitted' OR label CONTAINS[c] 'success'")).firstMatch
    }

    var reviewsList: XCUIElementQuery {
        app.scrollViews.otherElements.matching(identifier: "ReviewItem")
    }

    var firstReview: XCUIElement {
        reviewsList.firstMatch
    }

    var emptyStateMessage: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'no review'")).firstMatch
    }

    var averageRatingLabel: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label MATCHES '.*[0-9]\\\\.[0-9].*' OR label CONTAINS '★'")).firstMatch
    }

    var totalReviewsCountLabel: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'review' AND label MATCHES '.*\\\\d+.*'")).firstMatch
    }

    var filterButtons: XCUIElementQuery {
        app.buttons.matching(NSPredicate(format: "label MATCHES '[1-5] ★' OR label CONTAINS 'star'"))
    }

    var allReviewsFilter: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'all'")).firstMatch
    }

    var fiveStarFilter: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS '5' AND label CONTAINS '★'")).firstMatch
    }

    var sortButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'sort' OR label CONTAINS 'arrow'")).firstMatch
    }

    var photoUploadButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'photo' OR label CONTAINS[c] 'image' OR label CONTAINS '📷'")).firstMatch
    }

    var uploadedPhotos: XCUIElementQuery {
        app.images.matching(identifier: "ReviewPhoto")
    }

    var reportButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'report' OR label CONTAINS '⚠️'")).firstMatch
    }

    var helpfulButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'helpful' OR label CONTAINS '👍'")).firstMatch
    }

    var sellerReplyLabel: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'seller reply' OR label CONTAINS[c] 'response'")).firstMatch
    }

    // Category-specific rating elements
    var foodQualityRating: XCUIElement {
        app.otherElements.matching(NSPredicate(format: "identifier CONTAINS 'foodQuality'")).firstMatch
    }

    var deliveryRating: XCUIElement {
        app.otherElements.matching(NSPredicate(format: "identifier CONTAINS 'delivery'")).firstMatch
    }

    var packagingRating: XCUIElement {
        app.otherElements.matching(NSPredicate(format: "identifier CONTAINS 'packaging'")).firstMatch
    }

    // MARK: - Actions

    @discardableResult
    func selectRating(_ stars: Int) -> ReviewPage {
        guard stars >= 1 && stars <= 5 else { return self }

        switch stars {
        case 1:
            star1.tap()
        case 2:
            star2.tap()
        case 3:
            star3.tap()
        case 4:
            star4.tap()
        case 5:
            star5.tap()
        default:
            break
        }

        return self
    }

    @discardableResult
    func enterReview(_ text: String) -> ReviewPage {
        reviewTextField.tap()
        reviewTextField.typeText(text)
        return self
    }

    @discardableResult
    func uploadPhoto() -> ReviewPage {
        if photoUploadButton.waitForExistence(timeout: 1) {
            photoUploadButton.tap()
            sleep(1)

            // Select photo from picker (simplified)
            let photoButton = app.images.firstMatch
            if photoButton.waitForExistence(timeout: 2) {
                photoButton.tap()
            }

            // Close picker
            let doneButton = app.buttons["Done"]
            if doneButton.waitForExistence(timeout: 1) {
                doneButton.tap()
            }
        }
        return self
    }

    @discardableResult
    func submitReview() -> ReviewPage {
        dismissKeyboardIfNeeded()
        submitButton.tap()
        sleep(2)
        return self
    }

    @discardableResult
    func cancelReview() -> ReviewPage {
        cancelButton.tap()
        return self
    }

    @discardableResult
    func markReviewAsHelpful() -> ReviewPage {
        if helpfulButton.waitForExistence(timeout: 1) {
            helpfulButton.tap()
            sleep(1)
        }
        return self
    }

    @discardableResult
    func reportReview() -> ReviewPage {
        if reportButton.waitForExistence(timeout: 1) {
            reportButton.tap()
            sleep(1)

            // Confirm report
            let confirmButton = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'confirm' OR label CONTAINS[c] 'report'")).firstMatch
            if confirmButton.waitForExistence(timeout: 1) {
                confirmButton.tap()
            }
        }
        return self
    }

    @discardableResult
    func filterByRating(_ stars: Int) -> ReviewPage {
        guard stars >= 1 && stars <= 5 else { return self }

        let filterButton = app.buttons.matching(NSPredicate(format: "label CONTAINS '\(stars)' AND label CONTAINS '★'")).firstMatch
        if filterButton.waitForExistence(timeout: 1) {
            filterButton.tap()
            sleep(1)
        }

        return self
    }

    @discardableResult
    func tapSortButton() -> ReviewPage {
        sortButton.tap()
        sleep(1)
        return self
    }

    @discardableResult
    func sortByMostRecent() -> ReviewPage {
        tapSortButton()

        let recentOption = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'recent' OR label CONTAINS[c] 'newest'")).firstMatch
        if recentOption.waitForExistence(timeout: 1) {
            recentOption.tap()
        }

        return self
    }

    @discardableResult
    func sortByMostHelpful() -> ReviewPage {
        tapSortButton()

        let helpfulOption = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'helpful' OR label CONTAINS[c] 'top'")).firstMatch
        if helpfulOption.waitForExistence(timeout: 1) {
            helpfulOption.tap()
        }

        return self
    }

    @discardableResult
    func scrollToReviews() -> ReviewPage {
        let scrollView = app.scrollViews.firstMatch
        if scrollView.exists {
            scrollView.swipeUp()
        }
        return self
    }

    @discardableResult
    func tapFirstReview() -> ReviewPage {
        firstReview.tap()
        sleep(1)
        return self
    }

    func submitQuickReview(rating: Int, text: String) {
        selectRating(rating)
        enterReview(text)
        submitReview()
    }

    // MARK: - Assertions

    @discardableResult
    func assertScreenDisplayed(timeout: TimeInterval = 2) -> ReviewPage {
        XCTAssertTrue(ratingStars.count > 0 ||
                     reviewTextField.waitForExistence(timeout: timeout) ||
                     reviewsList.count > 0,
                     "Review screen should be displayed")
        return self
    }

    @discardableResult
    func assertRatingStarsDisplayed() -> ReviewPage {
        XCTAssertEqual(ratingStars.count, 5, "Should display 5 rating stars")
        return self
    }

    @discardableResult
    func assertReviewFieldDisplayed() -> ReviewPage {
        XCTAssertTrue(reviewTextField.exists, "Review text field should be displayed")
        return self
    }

    @discardableResult
    func assertSubmitButtonEnabled() -> ReviewPage {
        XCTAssertTrue(submitButton.isEnabled, "Submit button should be enabled")
        return self
    }

    @discardableResult
    func assertSubmitButtonDisabled() -> ReviewPage {
        XCTAssertFalse(submitButton.isEnabled, "Submit button should be disabled")
        return self
    }

    @discardableResult
    func assertSuccessMessageDisplayed(timeout: TimeInterval = 3) -> ReviewPage {
        XCTAssertTrue(successMessage.waitForExistence(timeout: timeout), "Success message should be displayed")
        return self
    }

    @discardableResult
    func assertReviewsDisplayed() -> ReviewPage {
        XCTAssertTrue(firstReview.exists || emptyStateMessage.exists,
                     "Reviews or empty state should be displayed")
        return self
    }

    @discardableResult
    func assertAverageRatingDisplayed() -> ReviewPage {
        XCTAssertTrue(averageRatingLabel.exists, "Average rating should be displayed")
        return self
    }

    @discardableResult
    func assertTotalReviewsCountDisplayed() -> ReviewPage {
        XCTAssertTrue(totalReviewsCountLabel.exists, "Total reviews count should be displayed")
        return self
    }

    @discardableResult
    func assertPhotoUploaded() -> ReviewPage {
        XCTAssertGreaterThan(uploadedPhotos.count, 0, "Photo should be uploaded")
        return self
    }

    @discardableResult
    func assertSellerReplyVisible() -> ReviewPage {
        XCTAssertTrue(sellerReplyLabel.exists, "Seller reply should be visible")
        return self
    }

    @discardableResult
    func assertEmptyState() -> ReviewPage {
        XCTAssertTrue(emptyStateMessage.exists, "Empty state should be displayed")
        return self
    }

    // MARK: - Helpers

    private func dismissKeyboardIfNeeded() {
        if app.keyboards.count > 0 {
            app.keyboards.buttons["Return"].tap()
        }
    }
}
