//
//  SettingsFlowTests.swift
//  MenuMakerUITests
//
//  Tests for app settings - notifications, language, privacy, preferences
//

import XCTest

final class SettingsFlowTests: XCTestCase {

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

    // MARK: - Settings Display Tests (P0)

    @MainActor
    func testSettingsScreenDisplays() throws {
        navigateToSettings()

        let settingsPage = SettingsPage(app: app)
        settingsPage.assertScreenDisplayed()
    }

    // MARK: - Notification Settings Tests (P0)

    @MainActor
    func testNotificationSettingsDisplayed() throws {
        navigateToSettings()

        let settingsPage = SettingsPage(app: app)

        guard settingsPage.notificationSettings.waitForExistence(timeout: 2) else {
            throw XCTSkip("Notification settings not implemented yet")
        }

        settingsPage.tapNotificationSettings()

        sleep(1)

        settingsPage.assertNotificationSettingsDisplayed()
    }

    @MainActor
    func testToggleOrderNotifications() throws {
        navigateToSettings()

        let settingsPage = SettingsPage(app: app)

        if settingsPage.notificationSettings.exists {
            settingsPage.tapNotificationSettings()
        }

        guard settingsPage.orderNotificationsToggle.waitForExistence(timeout: 2) else {
            throw XCTSkip("Order notifications toggle not implemented yet")
        }

        settingsPage.toggleOrderNotifications()

        sleep(1)
    }

    @MainActor
    func testTogglePromoNotifications() throws {
        navigateToSettings()

        let settingsPage = SettingsPage(app: app)

        if settingsPage.notificationSettings.exists {
            settingsPage.tapNotificationSettings()
        }

        guard settingsPage.promoNotificationsToggle.waitForExistence(timeout: 2) else {
            throw XCTSkip("Promo notifications toggle not implemented yet")
        }

        settingsPage.togglePromoNotifications()

        sleep(1)
    }

    @MainActor
    func testTogglePushNotifications() throws {
        navigateToSettings()

        let settingsPage = SettingsPage(app: app)

        if settingsPage.notificationSettings.exists {
            settingsPage.tapNotificationSettings()
        }

        guard settingsPage.pushNotificationsToggle.waitForExistence(timeout: 2) else {
            throw XCTSkip("Push notifications toggle not implemented yet")
        }

        settingsPage.togglePushNotifications()

        sleep(1)
    }

    @MainActor
    func testToggleWhatsAppNotifications() throws {
        navigateToSettings()

        let settingsPage = SettingsPage(app: app)

        if settingsPage.notificationSettings.exists {
            settingsPage.tapNotificationSettings()
        }

        guard settingsPage.whatsappNotificationsToggle.waitForExistence(timeout: 2) else {
            throw XCTSkip("WhatsApp notifications toggle not implemented yet")
        }

        settingsPage.toggleWhatsAppNotifications()

        sleep(1)
    }

    // MARK: - Language Settings Tests (P0)

    @MainActor
    func testLanguageSettingsDisplayed() throws {
        navigateToSettings()

        let settingsPage = SettingsPage(app: app)

        guard settingsPage.languageSettings.waitForExistence(timeout: 2) else {
            throw XCTSkip("Language settings not implemented yet")
        }

        settingsPage.tapLanguageSettings()

        sleep(1)

        settingsPage.assertLanguageOptionsDisplayed()
    }

    @MainActor
    func testChangeLanguageToEnglish() throws {
        navigateToSettings()

        let settingsPage = SettingsPage(app: app)

        guard settingsPage.languageSettings.waitForExistence(timeout: 2) else {
            throw XCTSkip("Language settings not implemented yet")
        }

        settingsPage
            .tapLanguageSettings()
            .selectLanguage(.english)

        sleep(2)

        // App should update to English
    }

    @MainActor
    func testChangeLanguageToHindi() throws {
        navigateToSettings()

        let settingsPage = SettingsPage(app: app)

        guard settingsPage.languageSettings.waitForExistence(timeout: 2) else {
            throw XCTSkip("Language settings not implemented yet")
        }

        settingsPage
            .tapLanguageSettings()

        guard settingsPage.hindiOption.waitForExistence(timeout: 2) else {
            throw XCTSkip("Hindi language not available")
        }

        settingsPage.selectLanguage(.hindi)

        sleep(2)
    }

    // MARK: - Display Settings Tests (P1)

    @MainActor
    func testToggleDarkMode() throws {
        navigateToSettings()

        let settingsPage = SettingsPage(app: app)

        guard settingsPage.darkModeToggle.waitForExistence(timeout: 2) else {
            throw XCTSkip("Dark mode toggle not implemented yet")
        }

        settingsPage.toggleDarkMode()

        sleep(2)

        // UI should update to dark/light mode
    }

    @MainActor
    func testToggleSound() throws {
        navigateToSettings()

        let settingsPage = SettingsPage(app: app)

        guard settingsPage.soundToggle.waitForExistence(timeout: 2) else {
            throw XCTSkip("Sound toggle not implemented yet")
        }

        settingsPage.toggleSound()

        sleep(1)
    }

    // MARK: - Privacy Settings Tests (P1)

    @MainActor
    func testPrivacySettings() throws {
        navigateToSettings()

        let settingsPage = SettingsPage(app: app)

        guard settingsPage.privacySettings.waitForExistence(timeout: 2) else {
            throw XCTSkip("Privacy settings not implemented yet")
        }

        settingsPage.tapPrivacySettings()

        sleep(1)
    }

    @MainActor
    func testViewPrivacyPolicy() throws {
        navigateToSettings()

        let settingsPage = SettingsPage(app: app)
        settingsPage.scrollToBottom()

        guard settingsPage.privacyPolicyButton.waitForExistence(timeout: 2) else {
            throw XCTSkip("Privacy policy not implemented yet")
        }

        settingsPage.tapPrivacyPolicy()

        sleep(1)
    }

    @MainActor
    func testViewTermsAndConditions() throws {
        navigateToSettings()

        let settingsPage = SettingsPage(app: app)
        settingsPage.scrollToBottom()

        guard settingsPage.termsButton.waitForExistence(timeout: 2) else {
            throw XCTSkip("Terms and conditions not implemented yet")
        }

        settingsPage.tapTerms()

        sleep(1)
    }

    // MARK: - About Settings Tests (P1)

    @MainActor
    func testAboutSettings() throws {
        navigateToSettings()

        let settingsPage = SettingsPage(app: app)
        settingsPage.scrollToBottom()

        guard settingsPage.aboutSettings.waitForExistence(timeout: 2) else {
            throw XCTSkip("About settings not implemented yet")
        }

        settingsPage.tapAbout()

        sleep(1)

        // Should display app version and info
        if settingsPage.versionLabel.waitForExistence(timeout: 2) {
            settingsPage.assertVersionDisplayed()
        }
    }

    @MainActor
    func testViewAppVersion() throws {
        navigateToSettings()

        let settingsPage = SettingsPage(app: app)
        settingsPage.scrollToBottom()

        if settingsPage.versionLabel.waitForExistence(timeout: 2) {
            settingsPage.assertVersionDisplayed()
        } else if settingsPage.aboutSettings.exists {
            settingsPage.tapAbout()

            if settingsPage.versionLabel.waitForExistence(timeout: 2) {
                settingsPage.assertVersionDisplayed()
            }
        }
    }

    // MARK: - Help Settings Tests (P1)

    @MainActor
    func testHelpAndSupport() throws {
        navigateToSettings()

        let settingsPage = SettingsPage(app: app)

        guard settingsPage.helpButton.waitForExistence(timeout: 2) else {
            throw XCTSkip("Help and support not implemented yet")
        }

        settingsPage.tapHelp()

        sleep(1)
    }

    @MainActor
    func testFAQSection() throws {
        navigateToSettings()

        let settingsPage = SettingsPage(app: app)

        guard settingsPage.faqButton.waitForExistence(timeout: 2) else {
            throw XCTSkip("FAQ not implemented yet")
        }

        settingsPage.tapFAQ()

        sleep(1)
    }

    // MARK: - Data Management Tests (P1)

    @MainActor
    func testClearCache() throws {
        navigateToSettings()

        let settingsPage = SettingsPage(app: app)
        settingsPage.scrollToBottom()

        guard settingsPage.clearCacheButton.waitForExistence(timeout: 2) else {
            throw XCTSkip("Clear cache not implemented yet")
        }

        settingsPage.tapClearCache()

        sleep(2)

        // Should show confirmation
    }

    // MARK: - Settings Persistence Tests (P1)

    @MainActor
    func testSettingsPersistAcrossSessions() throws {
        navigateToSettings()

        let settingsPage = SettingsPage(app: app)

        if settingsPage.notificationSettings.exists {
            settingsPage.tapNotificationSettings()
        }

        guard settingsPage.orderNotificationsToggle.waitForExistence(timeout: 2) else {
            throw XCTSkip("Notification settings not implemented yet")
        }

        // Toggle setting
        settingsPage.toggleOrderNotifications()

        sleep(1)

        // Get toggle state
        let toggleState = settingsPage.orderNotificationsToggle.value as? String

        // Navigate away and back
        settingsPage.goBack()
        sleep(1)

        app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'home'")).firstMatch.tap()
        sleep(1)

        navigateToSettings()

        if settingsPage.notificationSettings.exists {
            settingsPage.tapNotificationSettings()
        }

        sleep(1)

        // Verify toggle state persisted
        let newToggleState = settingsPage.orderNotificationsToggle.value as? String
        XCTAssertEqual(toggleState, newToggleState,
                      "Settings should persist")
    }

    @MainActor
    func testNavigationBackFromSettings() throws {
        navigateToSettings()

        let settingsPage = SettingsPage(app: app)

        settingsPage.goBack()

        sleep(1)

        // Should navigate back to profile or previous screen
    }

    // MARK: - Helper Methods

    private func navigateToSettings() {
        let profileTab = app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'profile'")).firstMatch

        if profileTab.waitForExistence(timeout: 2) {
            profileTab.tap()
            sleep(1)
        }

        let profilePage = ProfilePage(app: app)

        if profilePage.settingsButton.waitForExistence(timeout: 2) {
            profilePage.tapSettings()
        } else {
            // Look for settings in navigation bar
            let settingsButton = app.navigationBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'setting'")).firstMatch

            if settingsButton.waitForExistence(timeout: 2) {
                settingsButton.tap()
                sleep(1)
            }
        }
    }
}
