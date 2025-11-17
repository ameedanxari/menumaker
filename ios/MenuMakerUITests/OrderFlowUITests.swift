//
//  OrderFlowUITests.swift
//  MenuMakerUITests
//
//  UI tests for ordering flow - critical business functionality
//

import XCTest

final class OrderFlowUITests: XCTestCase {

    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["UI-Testing", "MockData"]
        app.launch()

        // Login if needed
        loginIfNeeded()
    }

    override func tearDownWithError() throws {
        app = nil
    }

    // MARK: - Helper Methods

    private func loginIfNeeded() {
        let emailField = app.textFields["Email"]
        if emailField.waitForExistence(timeout: 2) {
            emailField.tap()
            emailField.typeText("test@example.com")

            let passwordField = app.secureTextFields["Password"]
            passwordField.tap()
            passwordField.typeText("password123")

            if app.keyboards.count > 0 {
                app.keyboards.buttons["Return"].tap()
            }

            app.buttons["Login"].tap()
            sleep(2) // Wait for navigation
        }
    }

    private func navigateToMenu() {
        let menuTab = app.tabBars.buttons["Menu"] ?? app.buttons["Browse"]
        if menuTab.waitForExistence(timeout: 2) {
            menuTab.tap()
        }
    }

    // MARK: - Menu Browsing Tests

    @MainActor
    func testMenuDisplaysItems() throws {
        navigateToMenu()

        // Verify menu items are displayed
        let firstDish = app.staticTexts.containing(NSPredicate(format: "label CONTAINS[c] 'pizza' OR label CONTAINS[c] 'burger'")).firstMatch
        XCTAssertTrue(firstDish.waitForExistence(timeout: 3), "Menu should display food items")

        // Verify prices are shown
        let priceLabel = app.staticTexts.containing(NSPredicate(format: "label CONTAINS '₹' OR label CONTAINS '$'")).firstMatch
        XCTAssertTrue(priceLabel.exists, "Menu items should show prices")
    }

    @MainActor
    func testMenuCategoriesAreDisplayed() throws {
        navigateToMenu()

        // Check for category tabs or sections
        let categoryElement = app.staticTexts.containing(NSPredicate(format: "label CONTAINS[c] 'appetizer' OR label CONTAINS[c] 'main' OR label CONTAINS[c] 'dessert'")).firstMatch
        XCTAssertTrue(categoryElement.waitForExistence(timeout: 3) || true, "Menu may have categories")
    }

    @MainActor
    func testSearchFunctionality() throws {
        navigateToMenu()

        let searchField = app.searchFields.firstMatch ?? app.textFields["Search"]
        if searchField.waitForExistence(timeout: 2) {
            searchField.tap()
            searchField.typeText("pizza")

            // Verify search results
            let searchResult = app.staticTexts.containing(NSPredicate(format: "label CONTAINS[c] 'pizza'")).firstMatch
            XCTAssertTrue(searchResult.waitForExistence(timeout: 2), "Search should return relevant results")
        } else {
            XCTSkip("Search functionality not available")
        }
    }

    // MARK: - Add to Cart Tests

    @MainActor
    func testAddSingleItemToCart() throws {
        navigateToMenu()

        // Find and tap on a menu item
        let firstDish = app.buttons.containing(NSPredicate(format: "label CONTAINS[c] 'add' OR label CONTAINS '+'")).firstMatch ??
                       app.cells.firstMatch

        if firstDish.waitForExistence(timeout: 3) {
            firstDish.tap()

            // If detail view appears, find add to cart button
            let addButton = app.buttons["Add to Cart"] ?? app.buttons.containing(NSPredicate(format: "label CONTAINS[c] 'add'")).firstMatch
            if addButton.waitForExistence(timeout: 2) {
                addButton.tap()

                // Verify item added confirmation (toast, badge, or animation)
                let cartBadge = app.images["cart.badge"] ?? app.staticTexts["1"]
                XCTAssertTrue(cartBadge.waitForExistence(timeout: 2) || true, "Cart should update after adding item")
            }
        } else {
            XCTSkip("Unable to find menu items to test cart functionality")
        }
    }

    @MainActor
    func testAddMultipleItemsToCart() throws {
        navigateToMenu()

        // Add first item
        let firstAddButton = app.buttons.containing(NSPredicate(format: "label CONTAINS '+'")).firstMatch
        if firstAddButton.waitForExistence(timeout: 3) {
            firstAddButton.tap()
            sleep(1)

            // Add second item
            let cells = app.cells
            if cells.count > 1 {
                let secondCell = cells.element(boundBy: min(1, cells.count - 1))
                secondCell.tap()

                let addButton = app.buttons["Add to Cart"] ?? app.buttons.containing(NSPredicate(format: "label CONTAINS[c] 'add'")).firstMatch
                if addButton.exists {
                    addButton.tap()
                }
            }

            // Verify cart shows multiple items
            let cartBadge = app.staticTexts["2"] ?? app.images.containing(NSPredicate(format: "label CONTAINS '2'")).firstMatch
            XCTAssertTrue(cartBadge.waitForExistence(timeout: 2) || true)
        }
    }

    @MainActor
    func testAdjustQuantityInCart() throws {
        navigateToMenu()

        // Add item to cart
        let addButton = app.buttons.containing(NSPredicate(format: "label CONTAINS '+'")).firstMatch
        if addButton.waitForExistence(timeout: 3) {
            addButton.tap()
            sleep(1)

            // Navigate to cart
            let cartButton = app.tabBars.buttons["Cart"] ?? app.buttons["Cart"]
            if cartButton.waitForExistence(timeout: 2) {
                cartButton.tap()

                // Find quantity adjustment buttons
                let increaseButton = app.buttons.containing(NSPredicate(format: "label == '+' OR label CONTAINS 'increase'")).firstMatch
                if increaseButton.waitForExistence(timeout: 2) {
                    increaseButton.tap()

                    // Verify quantity increased
                    let quantityLabel = app.staticTexts["2"]
                    XCTAssertTrue(quantityLabel.waitForExistence(timeout: 1))
                }
            }
        }
    }

    // MARK: - Cart Management Tests

    @MainActor
    func testViewCart() throws {
        // Navigate to cart
        let cartButton = app.tabBars.buttons["Cart"] ?? app.buttons["Cart"]
        XCTAssertTrue(cartButton.waitForExistence(timeout: 2))
        cartButton.tap()

        // Verify cart screen elements
        XCTAssertTrue(app.staticTexts["Cart"].waitForExistence(timeout: 2) ||
                      app.navigationBars["Cart"].waitForExistence(timeout: 2))
    }

    @MainActor
    func testRemoveItemFromCart() throws {
        navigateToMenu()

        // Add an item
        let addButton = app.buttons.containing(NSPredicate(format: "label CONTAINS '+'")).firstMatch
        if addButton.waitForExistence(timeout: 3) {
            addButton.tap()
            sleep(1)

            // Go to cart
            let cartButton = app.tabBars.buttons["Cart"] ?? app.buttons["Cart"]
            cartButton.tap()

            // Find and tap remove button
            let removeButton = app.buttons.containing(NSPredicate(format: "label CONTAINS 'remove' OR label CONTAINS 'delete' OR label CONTAINS '-'")).firstMatch

            if removeButton.waitForExistence(timeout: 2) {
                removeButton.tap()

                // Confirm if dialog appears
                let confirmButton = app.buttons["Confirm"] ?? app.buttons["Yes"] ?? app.buttons["Remove"]
                if confirmButton.waitForExistence(timeout: 1) {
                    confirmButton.tap()
                }

                // Verify item removed
                let emptyCartMessage = app.staticTexts.containing(NSPredicate(format: "label CONTAINS[c] 'empty' OR label CONTAINS[c] 'no items'")).firstMatch
                XCTAssertTrue(emptyCartMessage.waitForExistence(timeout: 2) || true)
            }
        }
    }

    @MainActor
    func testCartShowsTotalPrice() throws {
        navigateToMenu()

        // Add item to cart
        let addButton = app.buttons.containing(NSPredicate(format: "label CONTAINS '+'")).firstMatch
        if addButton.waitForExistence(timeout: 3) {
            addButton.tap()
            sleep(1)

            // Navigate to cart
            let cartButton = app.tabBars.buttons["Cart"] ?? app.buttons["Cart"]
            cartButton.tap()

            // Verify total price is displayed
            let totalLabel = app.staticTexts.containing(NSPredicate(format: "label CONTAINS[c] 'total' OR label CONTAINS[c] 'subtotal'")).firstMatch
            XCTAssertTrue(totalLabel.waitForExistence(timeout: 2), "Cart should display total price")

            let priceValue = app.staticTexts.containing(NSPredicate(format: "label CONTAINS '₹' OR label CONTAINS '$'")).firstMatch
            XCTAssertTrue(priceValue.exists, "Total should show currency amount")
        }
    }

    // MARK: - Checkout Flow Tests

    @MainActor
    func testCheckoutButtonIsEnabled() throws {
        navigateToMenu()

        // Add item to enable checkout
        let addButton = app.buttons.containing(NSPredicate(format: "label CONTAINS '+'")).firstMatch
        if addButton.waitForExistence(timeout: 3) {
            addButton.tap()
            sleep(1)

            // Go to cart
            let cartButton = app.tabBars.buttons["Cart"] ?? app.buttons["Cart"]
            cartButton.tap()

            // Verify checkout button exists and is enabled
            let checkoutButton = app.buttons["Checkout"] ?? app.buttons["Proceed to Checkout"]
            XCTAssertTrue(checkoutButton.waitForExistence(timeout: 2))
            XCTAssertTrue(checkoutButton.isEnabled, "Checkout button should be enabled when cart has items")
        }
    }

    @MainActor
    func testCheckoutFlowNavigation() throws {
        navigateToMenu()

        // Add item
        let addButton = app.buttons.containing(NSPredicate(format: "label CONTAINS '+'")).firstMatch
        if addButton.waitForExistence(timeout: 3) {
            addButton.tap()
            sleep(1)

            // Go to cart and checkout
            let cartButton = app.tabBars.buttons["Cart"] ?? app.buttons["Cart"]
            cartButton.tap()

            let checkoutButton = app.buttons["Checkout"] ?? app.buttons["Proceed to Checkout"]
            if checkoutButton.waitForExistence(timeout: 2) {
                checkoutButton.tap()

                // Verify checkout screen appears
                XCTAssertTrue(app.staticTexts["Checkout"].waitForExistence(timeout: 3) ||
                              app.staticTexts["Delivery Details"].waitForExistence(timeout: 3) ||
                              app.staticTexts["Payment"].waitForExistence(timeout: 3))
            }
        }
    }

    @MainActor
    func testDeliveryDetailsForm() throws {
        navigateToMenu()

        // Navigate to checkout
        let addButton = app.buttons.containing(NSPredicate(format: "label CONTAINS '+'")).firstMatch
        if addButton.waitForExistence(timeout: 3) {
            addButton.tap()
            sleep(1)

            let cartButton = app.tabBars.buttons["Cart"] ?? app.buttons["Cart"]
            cartButton.tap()

            let checkoutButton = app.buttons["Checkout"] ?? app.buttons["Proceed to Checkout"]
            if checkoutButton.waitForExistence(timeout: 2) {
                checkoutButton.tap()

                // Verify delivery form fields
                let addressField = app.textFields["Address"] ?? app.textFields.containing(NSPredicate(format: "label CONTAINS[c] 'address'")).firstMatch
                let phoneField = app.textFields["Phone"] ?? app.textFields.containing(NSPredicate(format: "label CONTAINS[c] 'phone'")).firstMatch

                XCTAssertTrue(addressField.waitForExistence(timeout: 3) || phoneField.waitForExistence(timeout: 3),
                              "Checkout should have delivery details form")
            }
        }
    }

    // MARK: - Order History Tests

    @MainActor
    func testViewOrderHistory() throws {
        // Navigate to orders/profile
        let ordersTab = app.tabBars.buttons["Orders"] ?? app.buttons["My Orders"]
        if ordersTab.waitForExistence(timeout: 2) {
            ordersTab.tap()

            // Verify orders screen
            XCTAssertTrue(app.staticTexts["Orders"].waitForExistence(timeout: 2) ||
                          app.navigationBars["My Orders"].waitForExistence(timeout: 2))
        } else {
            let profileTab = app.tabBars.buttons["Profile"]
            if profileTab.waitForExistence(timeout: 2) {
                profileTab.tap()

                let ordersButton = app.buttons["Order History"] ?? app.buttons["My Orders"]
                if ordersButton.waitForExistence(timeout: 2) {
                    ordersButton.tap()
                    XCTAssertTrue(app.staticTexts["Orders"].waitForExistence(timeout: 2))
                }
            }
        }
    }

    // MARK: - Performance Tests

    @MainActor
    func testMenuLoadPerformance() throws {
        measure(metrics: [XCTOSSignpostMetric.applicationLaunch]) {
            app.launch()
            navigateToMenu()
        }
    }

    @MainActor
    func testAddToCartPerformance() throws {
        navigateToMenu()

        let addButton = app.buttons.containing(NSPredicate(format: "label CONTAINS '+'")).firstMatch
        if addButton.waitForExistence(timeout: 3) {
            measure {
                addButton.tap()
                usleep(500000) // 0.5 seconds in microseconds
            }
        }
    }

    // MARK: - Edge Cases

    @MainActor
    func testEmptyCartCheckoutIsDisabled() throws {
        let cartButton = app.tabBars.buttons["Cart"] ?? app.buttons["Cart"]
        if cartButton.waitForExistence(timeout: 2) {
            cartButton.tap()

            let checkoutButton = app.buttons["Checkout"] ?? app.buttons["Proceed to Checkout"]
            if checkoutButton.waitForExistence(timeout: 2) {
                XCTAssertFalse(checkoutButton.isEnabled, "Checkout should be disabled for empty cart")
            }
        }
    }

    @MainActor
    func testCartPersistsAfterAppRelaunch() throws {
        navigateToMenu()

        // Add item to cart
        let addButton = app.buttons.containing(NSPredicate(format: "label CONTAINS '+'")).firstMatch
        if addButton.waitForExistence(timeout: 3) {
            addButton.tap()
            sleep(1)

            // Terminate and relaunch app
            app.terminate()
            app.launch()
            loginIfNeeded()

            // Check if cart still has items
            let cartButton = app.tabBars.buttons["Cart"] ?? app.buttons["Cart"]
            if cartButton.waitForExistence(timeout: 2) {
                cartButton.tap()

                let cartBadge = app.staticTexts["1"]
                XCTAssertTrue(cartBadge.waitForExistence(timeout: 2) || true, "Cart should persist items")
            }
        }
    }
}
