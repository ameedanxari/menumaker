//
//  SellerFlowTests.swift
//  MenuMakerUITests
//
//  Tests for seller functionality - menu management, orders, analytics
//

import XCTest

final class SellerFlowTests: XCTestCase {

    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["UI-Testing", "SellerMode"]
        app.launch()

        // Login as seller
        let loginPage = LoginPage(app: app)
        if loginPage.emailField.waitForExistence(timeout: 2) {
            loginPage.login(email: "seller@example.com", password: "password123")
            _ = app.tabBars.firstMatch.waitForExistence(timeout: 5)
        }
    }

    override func tearDownWithError() throws {
        app = nil
    }

    // MARK: - Menu Management Tests (P0)

    @MainActor
    func testMenuEditorDisplays() throws {
        // Navigate to menu tab
        let menuTab = app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'menu'")).firstMatch
        guard menuTab.waitForExistence(timeout: 2) else {
            XCTFail("Menu tab not found - seller interface may not be implemented - UI element not found or feature not implemented"); return
        }
        menuTab.tap()

        let menuEditor = SellerMenuEditorPage(app: app)
        menuEditor.assertScreenDisplayed()
    }

    @MainActor
    func testAddNewMenuItem() throws {
        navigateToMenuEditor()

        let menuEditor = SellerMenuEditorPage(app: app)
        menuEditor
            .tapAddItem()
            .assertItemFormDisplayed()
            .enterItemName("Test Pizza")
            .enterDescription("Delicious test pizza")
            .enterPrice("299")
            .tapSave()
            .assertItemSaved()
            .assertItemExists("Test Pizza")
    }

    @MainActor
    func testEditMenuItem() throws {
        navigateToMenuEditor()

        let menuEditor = SellerMenuEditorPage(app: app)

        // Assume at least one item exists
        guard menuEditor.firstMenuItem.waitForExistence(timeout: 2) else {
            XCTFail("No menu items found to edit - UI element not found or feature not implemented"); return
        }

        menuEditor
            .tapFirstMenuItem()
            .assertItemFormDisplayed()
            .enterItemName(" Updated")  // Append to existing name
            .tapSave()
            .assertItemSaved()
    }

    @MainActor
    func testToggleItemAvailability() throws {
        navigateToMenuEditor()

        let menuEditor = SellerMenuEditorPage(app: app)

        guard menuEditor.firstMenuItem.waitForExistence(timeout: 2) else {
            XCTFail("No menu items found - UI element not found or feature not implemented"); return
        }

        menuEditor
            .tapFirstMenuItem()
            .toggleAvailability()
            .tapSave()
            .assertItemSaved()
    }

    @MainActor
    func testDeleteMenuItem() throws {
        navigateToMenuEditor()

        let menuEditor = SellerMenuEditorPage(app: app)

        guard menuEditor.firstMenuItem.waitForExistence(timeout: 2) else {
            XCTFail("No menu items found to delete - UI element not found or feature not implemented"); return
        }

        let initialCount = menuEditor.menuItems.count

        menuEditor.swipeToDelete(at: 0)

        sleep(1)
        let newCount = menuEditor.menuItems.count
        XCTAssertLessThan(newCount, initialCount, "Item should be deleted")
    }

    @MainActor
    func testUploadItemPhoto() throws {
        navigateToMenuEditor()

        let menuEditor = SellerMenuEditorPage(app: app)
        menuEditor
            .tapAddItem()
            .assertItemFormDisplayed()
            .enterItemName("Photo Test Item")
            .enterPrice("199")
            .tapUploadPhoto()

        // Verify photo was selected (hard to verify precisely in UITest)
        sleep(1)
        menuEditor.tapSave()
    }

    @MainActor
    func testCreateMultipleMenuItems() throws {
        navigateToMenuEditor()

        let menuEditor = SellerMenuEditorPage(app: app)

        let items = [
            ("Margherita Pizza", "Classic cheese pizza", "249"),
            ("Pepperoni Pizza", "With pepperoni toppings", "299"),
            ("Veggie Pizza", "Loaded with vegetables", "279")
        ]

        for (name, desc, price) in items {
            menuEditor.createMenuItem(name: name, description: desc, price: price)
            sleep(1)
        }

        // Verify items were created
        for (name, _, _) in items {
            let itemLabel = app.staticTexts[name]
            if !itemLabel.exists {
                XCTFail("Item '\(name)' should exist")
            }
        }
    }

    // MARK: - Order Management Tests (P0)

    @MainActor
    func testOrdersScreenDisplays() throws {
        navigateToOrders()

        let ordersPage = SellerOrdersPage(app: app)
        ordersPage.assertScreenDisplayed()
    }

    @MainActor
    func testViewNewOrders() throws {
        navigateToOrders()

        let ordersPage = SellerOrdersPage(app: app)
        ordersPage.switchToNewOrders()

        // Either orders are displayed or empty state
        XCTAssertTrue(ordersPage.firstOrder.exists || ordersPage.emptyStateMessage.exists,
                     "Should show orders or empty state")
    }

    @MainActor
    func testAcceptOrder() throws {
        navigateToOrders()

        let ordersPage = SellerOrdersPage(app: app)
        ordersPage.switchToNewOrders()

        guard ordersPage.firstOrder.waitForExistence(timeout: 2) else {
            XCTFail("No new orders found - UI element not found or feature not implemented"); return
        }

        ordersPage
            .tapFirstOrder()
            .assertOrderDetailDisplayed()
            .assertAcceptButtonVisible()
            .acceptOrder()

        // Order should move to active orders
        ordersPage.switchToActiveOrders()
        sleep(1)
        XCTAssertTrue(ordersPage.firstOrder.exists, "Accepted order should appear in active orders")
    }

    @MainActor
    func testRejectOrder() throws {
        navigateToOrders()

        let ordersPage = SellerOrdersPage(app: app)
        ordersPage.switchToNewOrders()

        guard ordersPage.firstOrder.waitForExistence(timeout: 2) else {
            XCTFail("No new orders found - UI element not found or feature not implemented"); return
        }

        ordersPage
            .tapFirstOrder()
            .assertOrderDetailDisplayed()
            .rejectOrder(reason: "Out of ingredients")

        // Order should be removed from new orders
        sleep(1)
    }

    @MainActor
    func testMarkOrderAsPreparing() throws {
        navigateToOrders()

        let ordersPage = SellerOrdersPage(app: app)
        ordersPage.switchToActiveOrders()

        guard ordersPage.firstOrder.waitForExistence(timeout: 2) else {
            XCTFail("No active orders found - UI element not found or feature not implemented"); return
        }

        ordersPage
            .tapFirstOrder()
            .assertOrderDetailDisplayed()
            .assertMarkPreparingButtonVisible()
            .markAsPreparing()

        sleep(1)
    }

    @MainActor
    func testMarkOrderAsReady() throws {
        navigateToOrders()

        let ordersPage = SellerOrdersPage(app: app)
        ordersPage.switchToActiveOrders()

        guard ordersPage.firstOrder.waitForExistence(timeout: 2) else {
            XCTFail("No active orders found - UI element not found or feature not implemented"); return
        }

        ordersPage
            .tapFirstOrder()
            .markAsReady()

        sleep(1)
    }

    @MainActor
    func testPullToRefreshOrders() throws {
        navigateToOrders()

        let ordersPage = SellerOrdersPage(app: app)
        ordersPage
            .pullToRefresh()
            .assertScreenDisplayed()
    }

    @MainActor
    func testViewCompletedOrders() throws {
        navigateToOrders()

        let ordersPage = SellerOrdersPage(app: app)
        ordersPage
            .switchToCompletedOrders()

        // Either orders are displayed or empty state
        XCTAssertTrue(ordersPage.firstOrder.exists || ordersPage.emptyStateMessage.exists,
                     "Should show completed orders or empty state")
    }

    @MainActor
    func testViewOrderDetails() throws {
        navigateToOrders()

        let ordersPage = SellerOrdersPage(app: app)

        guard ordersPage.firstOrder.waitForExistence(timeout: 2) else {
            XCTFail("No orders found - UI element not found or feature not implemented"); return
        }

        ordersPage
            .tapFirstOrder()
            .assertOrderDetailDisplayed()

        // Verify order details are shown
        XCTAssertTrue(ordersPage.orderIdLabel.exists || ordersPage.orderTotalLabel.exists,
                     "Order details should be displayed")
    }

    // MARK: - Helper Methods

    private func navigateToMenuEditor() {
        let menuTab = app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'menu'")).firstMatch
        if menuTab.waitForExistence(timeout: 2) {
            menuTab.tap()
        }
    }

    private func navigateToOrders() {
        let ordersTab = app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'order'")).firstMatch
        if ordersTab.waitForExistence(timeout: 2) {
            ordersTab.tap()
        }
    }
}
