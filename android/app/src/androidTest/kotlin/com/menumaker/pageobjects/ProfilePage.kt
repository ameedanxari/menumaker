package com.menumaker.pageobjects

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.ComposeTestRule

/**
 * Page Object for Profile Screen
 */
class ProfilePage(private val composeTestRule: ComposeTestRule) {

    // Elements
    private val profileName = composeTestRule.onNode(hasTestTag("ProfileName"))
    private val profileEmail = composeTestRule.onNode(hasTestTag("ProfileEmail"))
    private val editProfileButton = composeTestRule.onNodeWithText("Edit Profile", ignoreCase = true)
    private val nameField = composeTestRule.onNodeWithText("Name", substring = true)
    private val phoneField = composeTestRule.onNodeWithText("Phone", substring = true)
    private val saveButton = composeTestRule.onNodeWithText("Save", ignoreCase = true)
    private val logoutButton = composeTestRule.onNodeWithText("Logout", ignoreCase = true)
    private val ordersButton = composeTestRule.onNodeWithText("Orders", ignoreCase = true)
    private val favoritesButton = composeTestRule.onNodeWithText("Favorites", ignoreCase = true)
    private val settingsButton = composeTestRule.onNodeWithText("Settings", ignoreCase = true)

    // Actions
    fun tapEditProfile(): ProfilePage {
        editProfileButton.performClick()
        Thread.sleep(500)
        return this
    }

    fun enterName(name: String): ProfilePage {
        nameField.performTextClearance()
        nameField.performTextInput(name)
        return this
    }

    fun enterPhone(phone: String): ProfilePage {
        phoneField.performTextClearance()
        phoneField.performTextInput(phone)
        return this
    }

    fun tapSave(): ProfilePage {
        saveButton.performClick()
        Thread.sleep(1000)
        return this
    }

    fun tapLogout(): ProfilePage {
        logoutButton.performScrollTo()
        logoutButton.performClick()
        Thread.sleep(500)
        composeTestRule.onNodeWithText("Confirm", ignoreCase = true).performClick()
        Thread.sleep(1000)
        return this
    }

    fun tapOrders(): ProfilePage {
        ordersButton.performClick()
        Thread.sleep(1000)
        return this
    }

    fun tapFavorites(): ProfilePage {
        favoritesButton.performClick()
        Thread.sleep(1000)
        return this
    }

    fun tapSettings(): ProfilePage {
        settingsButton.performClick()
        Thread.sleep(1000)
        return this
    }

    // Assertions
    fun assertScreenDisplayed(): ProfilePage {
        profileName.assertExists()
        return this
    }

    fun assertProfileInfoDisplayed(): ProfilePage {
        profileName.assertExists()
        profileEmail.assertExists()
        return this
    }

    fun assertEditFormDisplayed(): ProfilePage {
        nameField.assertExists()
        saveButton.assertExists()
        return this
    }
}
