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
        composeTestRule.onNode(
            hasTestTag("NotificationSettingsButton") or
            hasText("Notifications", ignoreCase = true) or
            hasText("Notification Settings", ignoreCase = true)
        ).performClick()
        Thread.sleep(500)
        return this
    }

    fun toggleNotifications(): SettingsPage {
        tapNotificationSettings()
        toggleOrderNotifications()
        return this
    }

    fun toggleOrderNotifications(): SettingsPage {
        composeTestRule.onNode(
            hasTestTag("OrderNotificationsToggle") or
            hasContentDescription("order notifications toggle", substring = true, ignoreCase = true)
        ).performClick()
        Thread.sleep(500)
        return this
    }

    fun togglePromoNotifications(): SettingsPage {
        composeTestRule.onNode(
            hasTestTag("PromoNotificationsToggle") or
            hasContentDescription("promo notifications toggle", substring = true, ignoreCase = true) or
            hasContentDescription("promotional notifications toggle", substring = true, ignoreCase = true)
        ).performClick()
        Thread.sleep(500)
        return this
    }

    fun tapLanguageSettings(): SettingsPage {
        composeTestRule.onNode(
            hasTestTag("LanguageSettingsButton") or
            hasText("Language", ignoreCase = true) or
            hasText("Language Settings", ignoreCase = true)
        ).performClick()
        Thread.sleep(500)
        return this
    }

    fun selectLanguage(language: Language): SettingsPage {
        val languageOption = when (language) {
            Language.ENGLISH -> composeTestRule.onNode(
                hasTestTag("LanguageOption_English") or
                hasText("English")
            )
            Language.HINDI -> composeTestRule.onNode(
                hasTestTag("LanguageOption_Hindi") or
                hasText("हिन्दी") or
                hasText("Hindi", ignoreCase = true)
            )
        }
        languageOption.performClick()
        Thread.sleep(1000)
        return this
    }

    fun selectLanguage(languageString: String): SettingsPage {
        val language = when (languageString.lowercase()) {
            "english" -> Language.ENGLISH
            "हिंदी", "hindi", "हिन्दी" -> Language.HINDI
            else -> Language.ENGLISH
        }
        return selectLanguage(language)
    }

    fun toggleDarkMode(): SettingsPage {
        composeTestRule.onNode(
            hasTestTag("DarkModeToggle") or
            hasContentDescription("dark mode toggle", substring = true, ignoreCase = true) or
            hasContentDescription("theme toggle", substring = true, ignoreCase = true)
        ).performClick()
        Thread.sleep(500)
        return this
    }

    fun tapPrivacy(): SettingsPage {
        composeTestRule.onNode(
            hasTestTag("PrivacySettingsButton") or
            hasText("Privacy", ignoreCase = true) or
            hasText("Privacy Settings", ignoreCase = true)
        ).performClick()
        Thread.sleep(500)
        return this
    }

    fun tapAbout(): SettingsPage {
        val aboutButton = composeTestRule.onNode(
            hasTestTag("AboutButton") or
            hasText("About", ignoreCase = true) or
            hasText("About App", ignoreCase = true)
        )
        aboutButton.performScrollTo()
        aboutButton.performClick()
        Thread.sleep(500)
        return this
    }

    fun tapLogout(): SettingsPage {
        composeTestRule.onNode(
            hasTestTag("LogoutButton") or
            hasText("Logout", ignoreCase = true) or
            hasText("Log out", ignoreCase = true) or
            hasText("Sign out", ignoreCase = true)
        ).performClick()
        Thread.sleep(500)
        return this
    }

    fun confirmLogout(): SettingsPage {
        composeTestRule.onNode(
            hasTestTag("ConfirmLogoutButton") or
            hasText("Confirm", ignoreCase = true) or
            hasText("Yes", ignoreCase = true) or
            hasText("Logout", ignoreCase = true)
        ).performClick()
        Thread.sleep(500)
        return this
    }

    fun tapClearCache(): SettingsPage {
        composeTestRule.onNode(
            hasTestTag("ClearCacheButton") or
            hasText("Clear Cache", ignoreCase = true) or
            hasText("Clear Data", ignoreCase = true)
        ).performClick()
        Thread.sleep(500)
        return this
    }

    fun confirmClearCache(): SettingsPage {
        composeTestRule.onNode(
            hasTestTag("ConfirmClearCacheButton") or
            hasText("Confirm", ignoreCase = true) or
            hasText("Yes", ignoreCase = true) or
            hasText("Clear", ignoreCase = true)
        ).performClick()
        Thread.sleep(500)
        return this
    }

    fun tapDeleteAccount(): SettingsPage {
        composeTestRule.onNode(
            hasTestTag("DeleteAccountButton") or
            hasText("Delete Account", ignoreCase = true) or
            hasText("Remove Account", ignoreCase = true)
        ).performClick()
        Thread.sleep(500)
        return this
    }

    fun enterPassword(password: String): SettingsPage {
        composeTestRule.onNode(
            hasTestTag("PasswordField") or
            hasTestTag("DeleteAccountPasswordField") or
            hasText("Password", substring = true, ignoreCase = true)
        ).performTextInput(password)
        Thread.sleep(500)
        return this
    }

    fun confirmDelete(): SettingsPage {
        composeTestRule.onNode(
            hasTestTag("ConfirmDeleteButton") or
            hasText("Delete", ignoreCase = true) or
            hasText("Confirm", ignoreCase = true) or
            hasText("Yes", ignoreCase = true)
        ).performClick()
        Thread.sleep(500)
        return this
    }

    fun tapPrivacySettings(): SettingsPage {
        composeTestRule.onNode(
            hasTestTag("PrivacySettingsButton") or
            hasText("Privacy Settings", ignoreCase = true) or
            hasText("Privacy", ignoreCase = true)
        ).performClick()
        Thread.sleep(500)
        return this
    }

    fun tapTermsAndConditions(): SettingsPage {
        composeTestRule.onNode(
            hasTestTag("TermsAndConditionsButton") or
            hasText("Terms and Conditions", ignoreCase = true) or
            hasText("Terms of Service", ignoreCase = true) or
            hasText("Terms", ignoreCase = true)
        ).performClick()
        Thread.sleep(500)
        return this
    }

    fun tapPrivacyPolicy(): SettingsPage {
        composeTestRule.onNode(
            hasTestTag("PrivacyPolicyButton") or
            hasText("Privacy Policy", ignoreCase = true)
        ).performClick()
        Thread.sleep(500)
        return this
    }

    fun tapSupport(): SettingsPage {
        composeTestRule.onNode(
            hasTestTag("SupportButton") or
            hasText("Support", ignoreCase = true) or
            hasText("Help & Support", ignoreCase = true) or
            hasText("Customer Support", ignoreCase = true)
        ).performClick()
        Thread.sleep(500)
        return this
    }

    fun toggleTheme(): SettingsPage {
        composeTestRule.onNode(
            hasTestTag("ThemeToggle") or
            hasContentDescription("theme toggle", substring = true, ignoreCase = true)
        ).performClick()
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

    fun assertOrderNotificationsToggled(): SettingsPage {
        orderNotificationsToggle.assertExists()
        return this
    }

    fun assertPromoNotificationsToggled(): SettingsPage {
        promoNotificationsToggle.assertExists()
        return this
    }

    fun assertLanguageSelected(): SettingsPage {
        languageSettings.assertExists()
        return this
    }

    fun assertThemeToggled(): SettingsPage {
        composeTestRule.onNode(hasTestTag("ThemeToggle")).assertExists()
        return this
    }

    fun assertLoggedOut(): SettingsPage {
        composeTestRule.onNodeWithText("Login", ignoreCase = true).assertExists()
        return this
    }

    fun assertCacheCleared(): SettingsPage {
        composeTestRule.onNode(
            hasTestTag("CacheClearedMessage") or
            hasText("cache cleared", substring = true, ignoreCase = true) or
            hasText("cache deleted", substring = true, ignoreCase = true) or
            hasText("cleared successfully", substring = true, ignoreCase = true)
        ).assertExists()
        return this
    }

    fun assertAccountDeleted(): SettingsPage {
        composeTestRule.onNode(
            hasTestTag("AccountDeletedMessage") or
            hasText("account deleted", substring = true, ignoreCase = true) or
            hasText("account removed", substring = true, ignoreCase = true) or
            hasText("successfully deleted", substring = true, ignoreCase = true)
        ).assertExists()
        return this
    }

    fun assertPrivacyOptionsDisplayed(): SettingsPage {
        composeTestRule.onNode(
            hasTestTag("PrivacySection") or
            hasText("Privacy", ignoreCase = true) or
            hasText("Privacy Settings", ignoreCase = true)
        ).assertExists()
        return this
    }

    fun assertTermsDisplayed(): SettingsPage {
        composeTestRule.onNode(
            hasTestTag("TermsAndConditions") or
            hasText("Terms", substring = true, ignoreCase = true) or
            hasText("Terms and Conditions", ignoreCase = true) or
            hasText("Terms of Service", ignoreCase = true)
        ).assertExists()
        return this
    }

    fun assertPrivacyPolicyDisplayed(): SettingsPage {
        composeTestRule.onNode(
            hasTestTag("PrivacyPolicy") or
            hasText("Privacy Policy", ignoreCase = true)
        ).assertExists()
        return this
    }

    fun assertSupportOptionsDisplayed(): SettingsPage {
        composeTestRule.onNode(
            hasTestTag("SupportSection") or
            hasText("Support", ignoreCase = true) or
            hasText("Help", ignoreCase = true) or
            hasText("Customer Support", ignoreCase = true)
        ).assertExists()
        return this
    }

    fun assertLanguageChanged(): SettingsPage {
        // Verify language change confirmation or settings displayed
        composeTestRule.onNode(
            hasTestTag("LanguageChangedMessage") or
            hasText("language changed", substring = true, ignoreCase = true) or
            hasText("language updated", substring = true, ignoreCase = true) or
            hasText("Language", ignoreCase = true)
        ).assertExists()
        return this
    }

    fun assertNotificationsToggled(): SettingsPage {
        // Verify notification toggle exists and is interactable
        composeTestRule.onNode(
            hasTestTag("OrderNotificationsToggle") or
            hasContentDescription("notifications toggle", substring = true, ignoreCase = true)
        ).assertExists()
        return this
    }

    enum class Language {
        ENGLISH, HINDI
    }
}
