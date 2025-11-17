package com.menumaker.pageobjects

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.ComposeTestRule

/**
 * Page Object for Settings Screen
 */
class SettingsPage(private val composeTestRule: ComposeTestRule) {

    // Elements
    private val notificationSettings = composeTestRule.onNodeWithText("Notifications", ignoreCase = true)
    private val orderNotificationsToggle = composeTestRule.onNode(hasTestTag("OrderNotificationsToggle"))
    private val promoNotificationsToggle = composeTestRule.onNode(hasTestTag("PromoNotificationsToggle"))
    private val languageSettings = composeTestRule.onNodeWithText("Language", ignoreCase = true)
    private val darkModeToggle = composeTestRule.onNode(hasTestTag("DarkModeToggle"))
    private val privacySettings = composeTestRule.onNodeWithText("Privacy", ignoreCase = true)
    private val aboutSettings = composeTestRule.onNodeWithText("About", ignoreCase = true)
    private val versionLabel = composeTestRule.onNode(hasTestTag("AppVersion"))

    // Actions
    fun tapNotificationSettings(): SettingsPage {
        notificationSettings.performClick()
        Thread.sleep(500)
        return this
    }

    fun toggleOrderNotifications(): SettingsPage {
        orderNotificationsToggle.performClick()
        Thread.sleep(500)
        return this
    }

    fun togglePromoNotifications(): SettingsPage {
        promoNotificationsToggle.performClick()
        Thread.sleep(500)
        return this
    }

    fun tapLanguageSettings(): SettingsPage {
        languageSettings.performClick()
        Thread.sleep(500)
        return this
    }

    fun selectLanguage(language: Language): SettingsPage {
        val languageOption = when (language) {
            Language.ENGLISH -> composeTestRule.onNodeWithText("English")
            Language.HINDI -> composeTestRule.onNodeWithText("हिन्दी")
        }
        languageOption.performClick()
        Thread.sleep(1000)
        return this
    }

    fun toggleDarkMode(): SettingsPage {
        darkModeToggle.performClick()
        Thread.sleep(500)
        return this
    }

    fun tapPrivacy(): SettingsPage {
        privacySettings.performClick()
        Thread.sleep(500)
        return this
    }

    fun tapAbout(): SettingsPage {
        aboutSettings.performScrollTo()
        aboutSettings.performClick()
        Thread.sleep(500)
        return this
    }

    // Assertions
    fun assertScreenDisplayed(): SettingsPage {
        notificationSettings.assertExists()
        return this
    }

    fun assertVersionDisplayed(): SettingsPage {
        versionLabel.assertExists()
        return this
    }

    enum class Language {
        ENGLISH, HINDI
    }
}
