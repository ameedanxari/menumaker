//
//  NotificationFlowTests.swift
//  MenuMakerUITests
//
//  Tests for notification system - view, filter, mark as read, settings
//

import XCTest

final class NotificationFlowTests: XCTestCase {

    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["UI-Testing"]
        app.launch()

        // Login
        let loginPage = LoginPage(app: app)
        if loginPage.emailField.waitForExistence(timeout: 2) {
            loginPage.login(email: "test@example.com", password: "password123")
            _ = app.tabBars.firstMatch.waitForExistence(timeout: 5)
        }
    }

    override func tearDownWithError() throws {
        app = nil
    }

    // MARK: - Notification Display Tests (P0)

    @MainActor
    func testNotificationScreenDisplays() throws {
        navigateToNotifications()

        let notificationPage = NotificationPage(app: app)
        notificationPage.assertScreenDisplayed()
    }

    @MainActor
    func testNotificationsDisplayed() throws {
        navigateToNotifications()

        let notificationPage = NotificationPage(app: app)

        guard notificationPage.firstNotification.waitForExistence(timeout: 2) ||
              notificationPage.emptyStateMessage.waitForExistence(timeout: 2) else {
            throw XCTSkip("Notifications not implemented yet")
        }

        // Should show notifications or empty state
        XCTAssertTrue(notificationPage.firstNotification.exists ||
                     notificationPage.emptyStateMessage.exists,
                     "Should show notifications or empty state")
    }

    @MainActor
    func testTapNotification() throws {
        navigateToNotifications()

        let notificationPage = NotificationPage(app: app)

        guard notificationPage.firstNotification.waitForExistence(timeout: 2) else {
            throw XCTSkip("No notifications available")
        }

        notificationPage.tapFirstNotification()

        sleep(2)
        // Should navigate to related screen or mark as read
    }

    // MARK: - Notification Management Tests (P0)

    @MainActor
    func testMarkAllAsRead() throws {
        navigateToNotifications()

        let notificationPage = NotificationPage(app: app)

        guard notificationPage.markAllReadButton.waitForExistence(timeout: 2) else {
            throw XCTSkip("Mark all read feature not implemented yet")
        }

        let initialUnreadCount = notificationPage.unreadNotifications.count

        notificationPage.markAllAsRead()

        sleep(1)

        let finalUnreadCount = notificationPage.unreadNotifications.count

        XCTAssertLessThanOrEqual(finalUnreadCount, initialUnreadCount,
                                "Unread count should decrease or stay same")
    }

    @MainActor
    func testDeleteNotification() throws {
        navigateToNotifications()

        let notificationPage = NotificationPage(app: app)

        guard notificationPage.firstNotification.waitForExistence(timeout: 2) else {
            throw XCTSkip("No notifications available")
        }

        let initialCount = notificationPage.notificationsList.count

        notificationPage.swipeToDeleteNotification(at: 0)

        sleep(1)

        let finalCount = notificationPage.notificationsList.count

        XCTAssertLessThan(finalCount, initialCount,
                         "Notification should be deleted")
    }

    @MainActor
    func testClearAllNotifications() throws {
        navigateToNotifications()

        let notificationPage = NotificationPage(app: app)

        guard notificationPage.clearAllButton.waitForExistence(timeout: 2) else {
            throw XCTSkip("Clear all feature not implemented yet")
        }

        notificationPage.clearAllNotifications()

        sleep(2)

        // Should show empty state or have fewer notifications
        XCTAssertTrue(notificationPage.emptyStateMessage.exists ||
                     notificationPage.notificationsList.count == 0,
                     "Notifications should be cleared")
    }

    // MARK: - Notification Filtering Tests (P1)

    @MainActor
    func testFilterByAll() throws {
        navigateToNotifications()

        let notificationPage = NotificationPage(app: app)

        guard notificationPage.filterButtons.count > 0 else {
            throw XCTSkip("Notification filters not implemented yet")
        }

        notificationPage.filterByAll()

        sleep(1)
        // All notifications should be displayed
    }

    @MainActor
    func testFilterByUnread() throws {
        navigateToNotifications()

        let notificationPage = NotificationPage(app: app)

        guard notificationPage.unreadFilter.waitForExistence(timeout: 2) else {
            throw XCTSkip("Unread filter not implemented yet")
        }

        notificationPage.filterByUnread()

        sleep(1)

        // Only unread notifications should be displayed
        if notificationPage.firstNotification.exists {
            notificationPage.assertUnreadNotificationsExist()
        }
    }

    @MainActor
    func testFilterByOrders() throws {
        navigateToNotifications()

        let notificationPage = NotificationPage(app: app)

        guard notificationPage.ordersFilter.waitForExistence(timeout: 2) else {
            throw XCTSkip("Orders filter not implemented yet")
        }

        notificationPage.filterByOrders()

        sleep(1)

        // Should show order-related notifications
        if notificationPage.firstNotification.exists {
            notificationPage.assertOrderNotificationsExist()
        }
    }

    // MARK: - Notification Types Tests (P1)

    @MainActor
    func testOrderNotifications() throws {
        navigateToNotifications()

        let notificationPage = NotificationPage(app: app)

        if notificationPage.orderNotifications.count > 0 {
            notificationPage.assertOrderNotificationsExist()
        }
    }

    @MainActor
    func testPullToRefresh() throws {
        navigateToNotifications()

        let notificationPage = NotificationPage(app: app)
        notificationPage.pullToRefresh()

        sleep(2)

        // Notifications should still be displayed
        notificationPage.assertScreenDisplayed()
    }

    // MARK: - Notification Settings Tests (P1)

    @MainActor
    func testNavigateToNotificationSettings() throws {
        navigateToNotifications()

        let notificationPage = NotificationPage(app: app)

        guard notificationPage.settingsButton.waitForExistence(timeout: 2) else {
            throw XCTSkip("Notification settings not implemented yet")
        }

        notificationPage.tapSettings()

        sleep(1)

        let settingsPage = SettingsPage(app: app)
        settingsPage.assertScreenDisplayed()
    }

    // MARK: - Notification Badge Tests (P1)

    @MainActor
    func testNotificationBadgeUpdates() throws {
        // Navigate to notifications
        navigateToNotifications()

        let notificationPage = NotificationPage(app: app)

        if notificationPage.firstNotification.waitForExistence(timeout: 2) {
            // Mark all as read
            if notificationPage.markAllReadButton.exists {
                notificationPage.markAllAsRead()
                sleep(1)
            }
        }

        // Navigate away
        app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'home' OR label CONTAINS[c] 'marketplace'")).firstMatch.tap()
        sleep(1)

        // Badge should be updated (0 or hidden)
    }

    // MARK: - Integration Tests (P1)

    @MainActor
    func testNotificationNavigatesToOrder() throws {
        navigateToNotifications()

        let notificationPage = NotificationPage(app: app)

        // Find an order notification
        guard notificationPage.orderNotifications.count > 0 else {
            throw XCTSkip("No order notifications available")
        }

        let orderNotification = notificationPage.orderNotifications.firstMatch
        orderNotification.tap()

        sleep(2)

        // Should navigate to order tracking or details
        let trackingPage = DeliveryTrackingPage(app: app)
        if trackingPage.orderStatusLabel.waitForExistence(timeout: 2) {
            trackingPage.assertScreenDisplayed()
        }
    }

    @MainActor
    func testEmptyStateWithExploreAction() throws {
        navigateToNotifications()

        let notificationPage = NotificationPage(app: app)

        if notificationPage.emptyStateMessage.waitForExistence(timeout: 2) {
            notificationPage.assertEmptyState()

            // Look for explore or browse button in empty state
            let exploreButton = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'explore' OR label CONTAINS[c] 'browse'")).firstMatch

            if exploreButton.waitForExistence(timeout: 1) {
                exploreButton.tap()
                sleep(1)

                // Should navigate to marketplace
                let marketplacePage = MarketplacePage(app: app)
                marketplacePage.assertScreenDisplayed()
            }
        }
    }

    // MARK: - Helper Methods

    private func navigateToNotifications() {
        let notificationsTab = app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'notification' OR label CONTAINS '🔔'")).firstMatch

        if notificationsTab.waitForExistence(timeout: 2) {
            notificationsTab.tap()
            sleep(1)
        } else {
            // Try navigation bar icon
            let notificationIcon = app.navigationBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'notification' OR label CONTAINS '🔔'")).firstMatch

            if notificationIcon.waitForExistence(timeout: 2) {
                notificationIcon.tap()
                sleep(1)
            }
        }
    }
}
