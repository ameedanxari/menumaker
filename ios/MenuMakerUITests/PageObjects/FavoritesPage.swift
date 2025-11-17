//
//  FavoritesPage.swift
//  MenuMakerUITests
//
//  Page Object for Favorites/Bookmarks Screen
//

import XCTest

struct FavoritesPage {
    let app: XCUIApplication

    // MARK: - Elements

    var favoritesList: XCUIElementQuery {
        app.scrollViews.otherElements.matching(identifier: "FavoriteItem")
    }

    var firstFavorite: XCUIElement {
        favoritesList.firstMatch
    }

    var emptyStateMessage: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'no favorite' OR label CONTAINS[c] 'add some'")).firstMatch
    }

    var favoriteButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS '❤' OR label CONTAINS[c] 'favorite' OR identifier CONTAINS 'favorite'")).firstMatch
    }

    var removeButtons: XCUIElementQuery {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'remove' OR label CONTAINS[c] 'delete'"))
    }

    var exploreButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'explore' OR label CONTAINS[c] 'browse'")).firstMatch
    }

    var sortButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'sort'")).firstMatch
    }

    var filterButtons: XCUIElementQuery {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'all' OR label CONTAINS[c] 'sellers' OR label CONTAINS[c] 'items'"))
    }

    var searchBar: XCUIElement {
        app.searchFields.firstMatch
    }

    // MARK: - Actions

    @discardableResult
    func tapFirstFavorite() -> FavoritesPage {
        firstFavorite.tap()
        sleep(1)
        return self
    }

    @discardableResult
    func tapFavorite(at index: Int) -> FavoritesPage {
        let favorite = favoritesList.element(boundBy: index)
        if favorite.waitForExistence(timeout: 2) {
            favorite.tap()
            sleep(1)
        }
        return self
    }

    @discardableResult
    func removeFavorite(at index: Int = 0) -> FavoritesPage {
        let favorite = favoritesList.element(boundBy: index)
        favorite.swipeLeft()

        let removeButton = app.buttons["Delete"]
        if removeButton.waitForExistence(timeout: 1) {
            removeButton.tap()
            sleep(1)
        }

        return self
    }

    @discardableResult
    func tapFavoriteButton() -> FavoritesPage {
        favoriteButton.tap()
        sleep(1)
        return self
    }

    @discardableResult
    func tapExplore() -> FavoritesPage {
        exploreButton.tap()
        sleep(1)
        return self
    }

    @discardableResult
    func searchFavorites(_ query: String) -> FavoritesPage {
        if searchBar.waitForExistence(timeout: 1) {
            searchBar.tap()
            searchBar.typeText(query)
            sleep(1)
        }
        return self
    }

    @discardableResult
    func pullToRefresh() -> FavoritesPage {
        let scrollView = app.scrollViews.firstMatch
        if scrollView.exists {
            let start = scrollView.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.2))
            let end = scrollView.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.8))
            start.press(forDuration: 0, thenDragTo: end)
            sleep(1)
        }
        return self
    }

    // MARK: - Assertions

    @discardableResult
    func assertScreenDisplayed(timeout: TimeInterval = 2) -> FavoritesPage {
        XCTAssertTrue(firstFavorite.waitForExistence(timeout: timeout) ||
                     emptyStateMessage.waitForExistence(timeout: timeout),
                     "Favorites screen should be displayed")
        return self
    }

    @discardableResult
    func assertFavoritesDisplayed() -> FavoritesPage {
        XCTAssertTrue(firstFavorite.exists, "Favorites should be displayed")
        return self
    }

    @discardableResult
    func assertEmptyState() -> FavoritesPage {
        XCTAssertTrue(emptyStateMessage.exists, "Empty state should be displayed")
        return self
    }

    @discardableResult
    func assertFavoriteCount(_ expectedCount: Int) -> FavoritesPage {
        let actualCount = favoritesList.count
        XCTAssertEqual(actualCount, expectedCount,
                      "Should have \(expectedCount) favorites, found \(actualCount)")
        return self
    }

    @discardableResult
    func assertFavoriteAdded(_ name: String) -> FavoritesPage {
        let favoriteLabel = app.staticTexts[name]
        XCTAssertTrue(favoriteLabel.exists, "Favorite '\(name)' should be added")
        return self
    }

    @discardableResult
    func assertFavoriteRemoved(_ name: String) -> FavoritesPage {
        let favoriteLabel = app.staticTexts[name]
        XCTAssertFalse(favoriteLabel.exists, "Favorite '\(name)' should be removed")
        return self
    }
}
