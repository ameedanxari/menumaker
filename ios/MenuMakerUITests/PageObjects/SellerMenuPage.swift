//
//  SellerMenuPage.swift
//  MenuMakerUITests
//
//  Page Object for Seller Menu Screen
//

import XCTest

struct SellerMenuPage {
    let app: XCUIApplication

    // MARK: - Elements

    var menuItems: XCUIElementQuery {
        app.scrollViews.otherElements.matching(identifier: "MenuItem")
    }

    var firstMenuItem: XCUIElement {
        menuItems.firstMatch
    }

    var addToCartButtons: XCUIElementQuery {
        app.buttons.matching(NSPredicate(format: "label CONTAINS '+'"))
    }

    var firstAddButton: XCUIElement {
        addToCartButtons.firstMatch
    }

    var cartButton: XCUIElement {
        app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'cart'")).firstMatch
    }

    var cartBadge: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label MATCHES '\\\\d+'")).firstMatch
    }

    var backButton: XCUIElement {
        app.navigationBars.buttons.firstMatch
    }

    // MARK: - Actions

    @discardableResult
    func tapFirstMenuItem() -> SellerMenuPage {
        firstMenuItem.tap()
        return self
    }

    @discardableResult
    func addFirstItemToCart() -> SellerMenuPage {
        firstAddButton.tap()
        sleep(1) // Wait for animation
        return self
    }

    @discardableResult
    func addItemToCart(at index: Int) -> SellerMenuPage {
        let button = addToCartButtons.element(boundBy: index)
        if button.waitForExistence(timeout: 2) {
            button.tap()
            sleep(1)
        }
        return self
    }

    @discardableResult
    func navigateToCart() -> CartPage {
        cartButton.tap()
        return CartPage(app: app)
    }

    @discardableResult
    func goBack() -> MarketplacePage {
        backButton.tap()
        return MarketplacePage(app: app)
    }

    // MARK: - Assertions

    @discardableResult
    func assertScreenDisplayed(timeout: TimeInterval = 2) -> SellerMenuPage {
        XCTAssertTrue(firstMenuItem.waitForExistence(timeout: timeout), "Seller menu should be displayed")
        return self
    }

    @discardableResult
    func assertMenuItemsDisplayed() -> SellerMenuPage {
        XCTAssertGreaterThan(menuItems.count, 0, "Menu items should be displayed")
        return self
    }

    @discardableResult
    func assertCartBadgeCount(_ expectedCount: Int) -> SellerMenuPage {
        if expectedCount > 0 {
            XCTAssertTrue(cartBadge.waitForExistence(timeout: 2), "Cart badge should be visible")
            let badgeText = cartBadge.label
            if let count = Int(badgeText) {
                XCTAssertEqual(count, expectedCount, "Cart badge should show \(expectedCount) items")
            }
        }
        return self
    }
}
