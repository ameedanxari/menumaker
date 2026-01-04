//
//  MorePage.swift
//  MenuMakerUITests
//
//  Page Object for More Screen
//

import XCTest

struct MorePage {
    let app: XCUIApplication

    // MARK: - Elements

    private var moreScreen: XCUIElement {
        let candidates: [XCUIElement] = [
            app.otherElements["more-screen"],
            app.staticTexts["More"].firstMatch,
            app.staticTexts["Profile"].firstMatch
        ]
        return candidates.first(where: { $0.exists }) ?? app.otherElements.firstMatch
    }

    var logoutButton: XCUIElement {
        // SwiftUI Lists with buttons can be accessed different ways depending on iOS version
        // Try in order of most specific to least specific

        // 1. Try as direct button with identifier
        let button = app.buttons["logout-button"]
        if button.exists {
            return button
        }

        // 2. Try within tables (List becomes a table in the view hierarchy)
        let tableButton = app.tables.buttons["logout-button"]
        if tableButton.exists {
            return tableButton
        }

        // 3. Try within cells
        let cellButton = app.cells.buttons["logout-button"]
        if cellButton.exists {
            return cellButton
        }

        // 4. Try finding by static text "Logout" which is part of the Label
        let staticText = app.staticTexts["Logout"]
        if staticText.exists {
            return staticText
        }

        // 5. Fallback: find by label containing "logout"
        return app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'logout'")).firstMatch
    }

    var confirmLogoutButton: XCUIElement {
        // Use firstMatch because SwiftUI creates nested buttons in dialogs
        app.buttons["confirm-logout-button"].firstMatch
    }

    // MARK: - Actions

    @discardableResult
    func tapLogout() -> MorePage {
        // Scroll down if button not visible
        if !logoutButton.exists {
            app.swipeUp()
            Thread.sleep(forTimeInterval: 0.5)
        }

        logoutButton.tap()
        return self
    }

    @discardableResult
    func confirmLogout() -> LoginPage {
        confirmLogoutButton.tap()
        return LoginPage(app: app)
    }

    // MARK: - Assertions

    @discardableResult
    func assertScreenDisplayed(timeout: TimeInterval = 3) -> MorePage {
        XCTAssertTrue(moreScreen.waitForExistence(timeout: timeout), "More screen should be displayed")
        return self
    }

    @discardableResult
    func assertLogoutButtonExists(timeout: TimeInterval = 3) -> MorePage {
        // Scroll to make it visible if needed
        if !logoutButton.exists {
            app.swipeUp()
        }

        XCTAssertTrue(logoutButton.waitForExistence(timeout: timeout), "Logout button should exist")
        return self
    }
}
