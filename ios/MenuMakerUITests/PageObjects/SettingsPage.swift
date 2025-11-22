//
//  SettingsPage.swift
//  MenuMakerUITests
//
//  Page Object for App Settings Screen
//

import XCTest

struct SettingsPage {
    let app: XCUIApplication

    // MARK: - Elements

    var notificationSettings: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'notification'")).firstMatch
    }

    var orderNotificationsToggle: XCUIElement {
        app.switches["orderNotificationToggle"]
    }

    var promoNotificationsToggle: XCUIElement {
        app.switches["promoNotificationToggle"]
    }

    var pushNotificationsToggle: XCUIElement {
        app.switches["pushNotificationToggle"]
    }

    var emailNotificationsToggle: XCUIElement {
        app.switches["emailNotificationToggle"]
    }

    var whatsappNotificationsToggle: XCUIElement {
        app.switches["whatsappNotificationToggle"]
    }

    var languageSettings: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'language'")).firstMatch
    }

    var languageOptions: XCUIElementQuery {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'english' OR label CONTAINS[c] 'hindi' OR label CONTAINS[c] 'tamil'"))
    }

    var englishOption: XCUIElement {
        app.buttons["English"]
    }

    var hindiOption: XCUIElement {
        app.buttons["हिन्दी"]
    }

    var locationSettings: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'location'")).firstMatch
    }

    var privacySettings: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'privacy'")).firstMatch
    }

    var aboutSettings: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'about'")).firstMatch
    }

    var versionLabel: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'version' OR label MATCHES '.*\\\\d+\\\\.\\\\d+\\\\.\\\\d+.*'")).firstMatch
    }

    var termsButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'terms'")).firstMatch
    }

    var privacyPolicyButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'privacy policy'")).firstMatch
    }

    var helpButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'help' OR label CONTAINS[c] 'support'")).firstMatch
    }

    var faqButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'faq'")).firstMatch
    }

    var contactUsButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'contact'")).firstMatch
    }

    var clearCacheButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'clear cache'")).firstMatch
    }

    var darkModeToggle: XCUIElement {
        app.switches["darkModeToggle"]
    }

    var soundToggle: XCUIElement {
        app.switches["soundToggle"]
    }

    var autoPlayVideosToggle: XCUIElement {
        app.switches.matching(NSPredicate(format: "identifier CONTAINS 'autoPlay'")).firstMatch
    }

    var dataUsageSettings: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'data'")).firstMatch
    }

    var backButton: XCUIElement {
        app.navigationBars.buttons.firstMatch
    }

    var saveButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'save'")).firstMatch
    }

    // MARK: - Actions

    @discardableResult
    func tapNotificationSettings() -> SettingsPage {
        notificationSettings.tap()
        sleep(1)
        return self
    }

    @discardableResult
    func toggleOrderNotifications() -> SettingsPage {
        if orderNotificationsToggle.waitForExistence(timeout: 2) {
            orderNotificationsToggle.tap()
            sleep(1)
        }
        return self
    }

    @discardableResult
    func togglePromoNotifications() -> SettingsPage {
        if promoNotificationsToggle.waitForExistence(timeout: 2) {
            promoNotificationsToggle.tap()
            sleep(1)
        }
        return self
    }

    @discardableResult
    func togglePushNotifications() -> SettingsPage {
        if pushNotificationsToggle.waitForExistence(timeout: 2) {
            pushNotificationsToggle.tap()
            sleep(1)
        }
        return self
    }

    @discardableResult
    func toggleWhatsAppNotifications() -> SettingsPage {
        if whatsappNotificationsToggle.waitForExistence(timeout: 2) {
            whatsappNotificationsToggle.tap()
            sleep(1)
        }
        return self
    }

    @discardableResult
    func tapLanguageSettings() -> SettingsPage {
        languageSettings.tap()
        sleep(1)
        return self
    }

    @discardableResult
    func selectLanguage(_ language: Language) -> SettingsPage {
        switch language {
        case .english:
            if englishOption.waitForExistence(timeout: 2) {
                englishOption.tap()
            }
        case .hindi:
            if hindiOption.waitForExistence(timeout: 2) {
                hindiOption.tap()
            }
        }
        sleep(1)
        return self
    }

    @discardableResult
    func toggleDarkMode() -> SettingsPage {
        if darkModeToggle.waitForExistence(timeout: 2) {
            darkModeToggle.tap()
            sleep(1)
        }
        return self
    }

    @discardableResult
    func toggleSound() -> SettingsPage {
        if soundToggle.waitForExistence(timeout: 2) {
            soundToggle.tap()
            sleep(1)
        }
        return self
    }

    @discardableResult
    func tapPrivacySettings() -> SettingsPage {
        privacySettings.tap()
        sleep(1)
        return self
    }

    @discardableResult
    func tapAbout() -> SettingsPage {
        if aboutSettings.waitForExistence(timeout: 2) {
            aboutSettings.tap()
        } else {
            scrollToBottom()
            if aboutSettings.waitForExistence(timeout: 1) {
                aboutSettings.tap()
            }
        }
        sleep(1)
        return self
    }

    @discardableResult
    func tapTerms() -> SettingsPage {
        termsButton.tap()
        sleep(1)
        return self
    }

    @discardableResult
    func tapPrivacyPolicy() -> SettingsPage {
        privacyPolicyButton.tap()
        sleep(1)
        return self
    }

    @discardableResult
    func tapHelp() -> SettingsPage {
        helpButton.tap()
        sleep(1)
        return self
    }

    @discardableResult
    func tapFAQ() -> SettingsPage {
        if faqButton.waitForExistence(timeout: 2) {
            faqButton.tap()
            sleep(1)
        }
        return self
    }

    @discardableResult
    func tapClearCache() -> SettingsPage {
        if clearCacheButton.waitForExistence(timeout: 2) {
            clearCacheButton.tap()
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
    func saveSettings() -> SettingsPage {
        if saveButton.waitForExistence(timeout: 1) {
            saveButton.tap()
            sleep(1)
        }
        return self
    }

    @discardableResult
    func goBack() -> SettingsPage {
        backButton.tap()
        return self
    }

    @discardableResult
    func scrollToBottom() -> SettingsPage {
        let scrollView = app.scrollViews.firstMatch
        if scrollView.exists {
            scrollView.swipeUp()
            scrollView.swipeUp()
        }
        return self
    }

    // MARK: - Assertions

    @discardableResult
    func assertScreenDisplayed(timeout: TimeInterval = 2) -> SettingsPage {
        XCTAssertTrue(notificationSettings.waitForExistence(timeout: timeout) ||
                     languageSettings.waitForExistence(timeout: timeout) ||
                     helpButton.waitForExistence(timeout: timeout),
                     "Settings screen should be displayed")
        return self
    }

    @discardableResult
    func assertNotificationSettingsDisplayed() -> SettingsPage {
        XCTAssertTrue(orderNotificationsToggle.exists ||
                     pushNotificationsToggle.exists,
                     "Notification settings should be displayed")
        return self
    }

    @discardableResult
    func assertLanguageOptionsDisplayed() -> SettingsPage {
        XCTAssertGreaterThan(languageOptions.count, 0,
                           "Language options should be displayed")
        return self
    }

    @discardableResult
    func assertVersionDisplayed() -> SettingsPage {
        XCTAssertTrue(versionLabel.exists, "App version should be displayed")
        return self
    }

    @discardableResult
    func assertToggleState(_ toggle: XCUIElement, isOn: Bool) -> SettingsPage {
        let toggleValue = toggle.value as? String
        XCTAssertEqual(toggleValue, isOn ? "1" : "0",
                      "Toggle should be \(isOn ? "on" : "off")")
        return self
    }

    // MARK: - Types

    enum Language {
        case english
        case hindi
    }
}
