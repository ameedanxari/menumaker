//
//  MarketplacePage.swift
//  MenuMakerUITests
//
//  Page Object for Marketplace Screen
//

import XCTest

struct MarketplacePage {
    let app: XCUIApplication

    // MARK: - Elements

    var searchBar: XCUIElement {
        app.searchFields.firstMatch
    }

    var sortButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS 'arrow.up.arrow.down'")).firstMatch
    }

    var cuisineFilter: XCUIElement {
        app.scrollViews.matching(identifier: "CuisineFilter").firstMatch
    }

    var sellerCards: XCUIElementQuery {
        app.buttons.matching(identifier: "SellerCard")
    }

    var firstSellerCard: XCUIElement {
        sellerCards.firstMatch
    }

    var emptyState: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'no sellers'")).firstMatch
    }

    // Sort options in action sheet
    var sortByDistanceOption: XCUIElement {
        app.buttons["Distance"]
    }

    var sortByRatingOption: XCUIElement {
        app.buttons["Rating"]
    }

    var sortByReviewsOption: XCUIElement {
        app.buttons["Reviews"]
    }

    // MARK: - Actions

    @discardableResult
    func search(_ query: String) -> MarketplacePage {
        searchBar.tap()
        searchBar.typeText(query)
        return self
    }

    @discardableResult
    func clearSearch() -> MarketplacePage {
        let clearButton = searchBar.buttons["Clear text"].firstMatch
        if clearButton.exists {
            clearButton.tap()
        }
        return self
    }

    @discardableResult
    func tapSortButton() -> MarketplacePage {
        sortButton.tap()
        return self
    }

    @discardableResult
    func sortByDistance() -> MarketplacePage {
        tapSortButton()
        sortByDistanceOption.tap()
        return self
    }

    @discardableResult
    func sortByRating() -> MarketplacePage {
        tapSortButton()
        sortByRatingOption.tap()
        return self
    }

    @discardableResult
    func sortByReviews() -> MarketplacePage {
        tapSortButton()
        sortByReviewsOption.tap()
        return self
    }

    @discardableResult
    func selectCuisineFilter(_ cuisine: String) -> MarketplacePage {
        let filterButton = app.buttons[cuisine]
        if filterButton.waitForExistence(timeout: 2) {
            filterButton.tap()
        }
        return self
    }

    @discardableResult
    func tapFirstSeller() -> SellerMenuPage {
        // Wait for first seller card to appear
        XCTAssertTrue(firstSellerCard.waitForExistence(timeout: 10), "First seller card should appear")
        firstSellerCard.tap()
        return SellerMenuPage(app: app)
    }

    @discardableResult
    func pullToRefresh() -> MarketplacePage {
        let firstCell = app.scrollViews.firstMatch
        let start = firstCell.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.2))
        let end = firstCell.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.8))
        start.press(forDuration: 0, thenDragTo: end)
        return self
    }

    // MARK: - Assertions

    @discardableResult
    func assertScreenDisplayed(timeout: TimeInterval = 10) -> MarketplacePage {
        XCTAssertTrue(searchBar.waitForExistence(timeout: timeout), "Marketplace screen should be displayed")
        return self
    }

    @discardableResult
    func assertSellersDisplayed(timeout: TimeInterval = 10) -> MarketplacePage {
        XCTAssertTrue(firstSellerCard.waitForExistence(timeout: timeout), "Sellers should be displayed")
        return self
    }

    @discardableResult
    func assertEmptyState() -> MarketplacePage {
        XCTAssertTrue(emptyState.exists, "Empty state should be displayed")
        return self
    }

    @discardableResult
    func assertSearchResults(count: Int) -> MarketplacePage {
        let actualCount = sellerCards.count
        XCTAssertEqual(actualCount, count, "Should display \(count) sellers, but found \(actualCount)")
        return self
    }

    @discardableResult
    func assertSortButtonExists() -> MarketplacePage {
        XCTAssertTrue(sortButton.exists, "Sort button should be visible")
        return self
    }
}
