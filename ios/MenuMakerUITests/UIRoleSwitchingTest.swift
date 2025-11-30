import XCTest

/// Diagnostic test to verify role-based UI switching
class UIRoleSwitchingTest: XCTestCase {
    var app: XCUIApplication!
    
    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["UI-Testing"]
        app.launch()
    }
    
    @MainActor
    func testCustomerUIAppears() throws {
        // Login as customer
        let emailField = app.textFields["email-field"]
        let passwordField = app.secureTextFields["password-field"]
        let loginButton = app.buttons["login-button"]
        
        XCTAssertTrue(emailField.waitForExistence(timeout: 5), "Email field should exist")
        
        emailField.tap()
        emailField.typeText("test@example.com")
        
        passwordField.tap()
        passwordField.typeText("password123")
        
        loginButton.tap()
        
        // Wait for tab bar to appear
        let tabBar = app.tabBars.firstMatch
        XCTAssertTrue(tabBar.waitForExistence(timeout: 10), "Tab bar should appear after login")
        
        // Check for marketplace tab
        let marketplaceTab = app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'marketplace'")).firstMatch
        XCTAssertTrue(marketplaceTab.waitForExistence(timeout: 5), "Marketplace tab should exist for customer")
        
        // Print all tab labels for debugging
        let allTabs = app.tabBars.buttons
        print("Found \(allTabs.count) tabs")
        for i in 0..<allTabs.count {
            let tab = allTabs.element(boundBy: i)
            if tab.exists {
                print("Tab \(i): \(tab.label)")
            }
        }
    }
    
    @MainActor
    func testSellerUIAppears() throws {
        // Login as seller
        let emailField = app.textFields["email-field"]
        let passwordField = app.secureTextFields["password-field"]
        let loginButton = app.buttons["login-button"]
        
        XCTAssertTrue(emailField.waitForExistence(timeout: 5), "Email field should exist")
        
        emailField.tap()
        emailField.typeText("seller@example.com")
        
        passwordField.tap()
        passwordField.typeText("password123")
        
        loginButton.tap()
        
        // Wait for tab bar to appear
        let tabBar = app.tabBars.firstMatch
        XCTAssertTrue(tabBar.waitForExistence(timeout: 10), "Tab bar should appear after login")
        
        // Check for dashboard tab (seller UI)
        let dashboardTab = app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'dashboard'")).firstMatch
        XCTAssertTrue(dashboardTab.waitForExistence(timeout: 5), "Dashboard tab should exist for seller")
        
        // Print all tab labels for debugging
        let allTabs = app.tabBars.buttons
        print("Found \(allTabs.count) tabs")
        for i in 0..<allTabs.count {
            let tab = allTabs.element(boundBy: i)
            if tab.exists {
                print("Tab \(i): \(tab.label)")
            }
        }
    }
}
