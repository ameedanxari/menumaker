package com.menumaker.ui

import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import com.menumaker.MainActivity
import com.menumaker.pageobjects.SettingsPage
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * UI tests for settings and preferences
 */
@LargeTest
@RunWith(AndroidJUnit4::class)
@HiltAndroidTest
class SettingsFlowTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    @Before
    fun setup() {
        hiltRule.inject()
    }

    @Test
    fun testSettingsScreenDisplays() {
        val settingsPage = SettingsPage(composeTestRule)
        settingsPage.assertScreenDisplayed()
    }

    @Test
    fun testToggleNotifications() {
        val settingsPage = SettingsPage(composeTestRule)
        settingsPage
            .toggleNotifications()
            .assertNotificationsToggled()
    }

    @Test
    fun testChangeLanguage() {
        val settingsPage = SettingsPage(composeTestRule)
        settingsPage
            .selectLanguage("हिंदी")
            .assertLanguageChanged()
    }

    @Test
    fun testToggleTheme() {
        val settingsPage = SettingsPage(composeTestRule)
        settingsPage
            .toggleTheme()
            .assertThemeToggled()
    }

    @Test
    fun testLogout() {
        val settingsPage = SettingsPage(composeTestRule)
        settingsPage
            .tapLogout()
            .confirmLogout()
            .assertLoggedOut()
    }

    @Test
    fun testClearCache() {
        val settingsPage = SettingsPage(composeTestRule)
        settingsPage
            .tapClearCache()
            .confirmClearCache()
            .assertCacheCleared()
    }

    @Test
    fun testDeleteAccount() {
        val settingsPage = SettingsPage(composeTestRule)
        settingsPage
            .tapDeleteAccount()
            .enterPassword("password123")
            .confirmDelete()
            .assertAccountDeleted()
    }

    @Test
    fun testPrivacySettings() {
        val settingsPage = SettingsPage(composeTestRule)
        settingsPage
            .tapPrivacySettings()
            .assertPrivacyOptionsDisplayed()
    }

    @Test
    fun testViewTermsAndConditions() {
        val settingsPage = SettingsPage(composeTestRule)
        settingsPage
            .tapTermsAndConditions()
            .assertTermsDisplayed()
    }

    @Test
    fun testViewPrivacyPolicy() {
        val settingsPage = SettingsPage(composeTestRule)
        settingsPage
            .tapPrivacyPolicy()
            .assertPrivacyPolicyDisplayed()
    }

    @Test
    fun testContactSupport() {
        val settingsPage = SettingsPage(composeTestRule)
        settingsPage
            .tapSupport()
            .assertSupportOptionsDisplayed()
    }
}
