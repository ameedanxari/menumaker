//
//  NotificationPage.swift
//  MenuMakerUITests
//
//  Page Object for Notifications Screen
//

import XCTest

struct NotificationPage {
    let app: XCUIApplication

    // MARK: - Elements

    var notificationsList: XCUIElementQuery {
        app.scrollViews.otherElements.matching(identifier: "NotificationItem")
    }

    var firstNotification: XCUIElement {
        notificationsList.firstMatch
    }

    var unreadNotifications: XCUIElementQuery {
        app.scrollViews.otherElements.matching(NSPredicate(format: "identifier CONTAINS 'Notification' AND label CONTAINS '•'"))
    }

    var emptyStateMessage: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'no notification'")).firstMatch
    }

    var markAllReadButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'mark all' OR label CONTAINS[c] 'read all'")).firstMatch
    }

    var filterButtons: XCUIElementQuery {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'all' OR label CONTAINS[c] 'unread' OR label CONTAINS[c] 'orders' OR label CONTAINS[c] 'updates'"))
    }

    var allFilter: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'all'")).firstMatch
    }

    var unreadFilter: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'unread'")).firstMatch
    }

    var ordersFilter: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'order'")).firstMatch
    }

    var clearAllButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'clear' OR label CONTAINS[c] 'delete all'")).firstMatch
    }

    var settingsButton: XCUIElement {
        app.navigationBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'setting' OR label CONTAINS '⚙️'")).firstMatch
    }

    var backButton: XCUIElement {
        app.navigationBars.buttons.firstMatch
    }

    // Notification types
    var orderNotifications: XCUIElementQuery {
        app.scrollViews.otherElements.matching(NSPredicate(format: "label CONTAINS[c] 'order'"))
    }

    var deliveryNotifications: XCUIElementQuery {
        app.scrollViews.otherElements.matching(NSPredicate(format: "label CONTAINS[c] 'delivery' OR label CONTAINS[c] 'delivered'"))
    }

    var promoNotifications: XCUIElementQuery {
        app.scrollViews.otherElements.matching(NSPredicate(format: "label CONTAINS[c] 'offer' OR label CONTAINS[c] 'discount'"))
    }

    var notificationBadge: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label MATCHES '\\\\d+' AND identifier CONTAINS 'badge'")).firstMatch
    }

    // MARK: - Actions

    @discardableResult
    func tapFirstNotification() -> NotificationPage {
        firstNotification.tap()
        sleep(1)
        return self
    }

    @discardableResult
    func tapNotification(at index: Int) -> NotificationPage {
        let notification = notificationsList.element(boundBy: index)
        if notification.waitForExistence(timeout: 2) {
            notification.tap()
            sleep(1)
        }
        return self
    }

    @discardableResult
    func swipeToDeleteNotification(at index: Int = 0) -> NotificationPage {
        let notification = notificationsList.element(boundBy: index)
        if notification.exists {
            notification.swipeLeft()
            let deleteButton = app.buttons["Delete"]
            if deleteButton.waitForExistence(timeout: 1) {
                deleteButton.tap()
                sleep(1)
            }
        }
        return self
    }

    @discardableResult
    func markAllAsRead() -> NotificationPage {
        if markAllReadButton.waitForExistence(timeout: 2) {
            markAllReadButton.tap()
            sleep(1)
        }
        return self
    }

    @discardableResult
    func clearAllNotifications() -> NotificationPage {
        if clearAllButton.waitForExistence(timeout: 2) {
            clearAllButton.tap()
            sleep(1)

            // Confirm if needed
            let confirmButton = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'confirm' OR label CONTAINS[c] 'yes'")).firstMatch
            if confirmButton.waitForExistence(timeout: 1) {
                confirmButton.tap()
                sleep(1)
            }
        }
        return self
    }

    @discardableResult
    func filterByAll() -> NotificationPage {
        allFilter.tap()
        sleep(1)
        return self
    }

    @discardableResult
    func filterByUnread() -> NotificationPage {
        unreadFilter.tap()
        sleep(1)
        return self
    }

    @discardableResult
    func filterByOrders() -> NotificationPage {
        ordersFilter.tap()
        sleep(1)
        return self
    }

    @discardableResult
    func pullToRefresh() -> NotificationPage {
        let scrollView = app.scrollViews.firstMatch
        if scrollView.exists {
            let start = scrollView.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.2))
            let end = scrollView.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.8))
            start.press(forDuration: 0, thenDragTo: end)
            sleep(1)
        }
        return self
    }

    @discardableResult
    func tapSettings() -> NotificationPage {
        settingsButton.tap()
        sleep(1)
        return self
    }

    @discardableResult
    func goBack() -> NotificationPage {
        backButton.tap()
        return self
    }

    // MARK: - Assertions

    @discardableResult
    func assertScreenDisplayed(timeout: TimeInterval = 2) -> NotificationPage {
        XCTAssertTrue(firstNotification.waitForExistence(timeout: timeout) ||
                     emptyStateMessage.waitForExistence(timeout: timeout) ||
                     markAllReadButton.waitForExistence(timeout: timeout),
                     "Notifications screen should be displayed")
        return self
    }

    @discardableResult
    func assertNotificationsDisplayed() -> NotificationPage {
        XCTAssertTrue(firstNotification.exists, "Notifications should be displayed")
        return self
    }

    @discardableResult
    func assertEmptyState() -> NotificationPage {
        XCTAssertTrue(emptyStateMessage.exists, "Empty state should be displayed")
        return self
    }

    @discardableResult
    func assertUnreadNotificationsExist() -> NotificationPage {
        XCTAssertGreaterThan(unreadNotifications.count, 0, "Unread notifications should exist")
        return self
    }

    @discardableResult
    func assertNotificationCount(_ expectedCount: Int) -> NotificationPage {
        let actualCount = notificationsList.count
        XCTAssertEqual(actualCount, expectedCount,
                      "Should have \(expectedCount) notifications, found \(actualCount)")
        return self
    }

    @discardableResult
    func assertOrderNotificationsExist() -> NotificationPage {
        XCTAssertGreaterThan(orderNotifications.count, 0, "Order notifications should exist")
        return self
    }

    @discardableResult
    func assertFilterOptionsDisplayed() -> NotificationPage {
        XCTAssertGreaterThan(filterButtons.count, 0, "Filter options should be displayed")
        return self
    }

    @discardableResult
    func assertMarkAllReadButtonVisible() -> NotificationPage {
        XCTAssertTrue(markAllReadButton.exists, "Mark all read button should be visible")
        return self
    }

    @discardableResult
    func assertNotificationBadgeCount(_ count: Int) -> NotificationPage {
        if count > 0 {
            XCTAssertTrue(notificationBadge.exists, "Notification badge should be visible")
            let badgeText = notificationBadge.label
            if let badgeCount = Int(badgeText) {
                XCTAssertEqual(badgeCount, count, "Badge should show \(count) notifications")
            }
        } else {
            XCTAssertFalse(notificationBadge.exists, "Notification badge should not be visible")
        }
        return self
    }
}
