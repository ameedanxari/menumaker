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

    fun updateName(name: String): ProfilePage {
        tapEditProfile()
        enterName(name)
        tapSave()
        return this
    }

    fun updatePhone(phone: String): ProfilePage {
        tapEditProfile()
        enterPhone(phone)
        tapSave()
        return this
    }

    fun updateAddress(address: String): ProfilePage {
        tapEditProfile()
        val addressField = composeTestRule.onNodeWithText("Address", substring = true)
        addressField.performTextClearance()
        addressField.performTextInput(address)
        tapSave()
        return this
    }

    fun tapProfilePhoto(): ProfilePage {
        composeTestRule.onNode(
            hasTestTag("ProfilePhoto") or
            hasTestTag("ProfileImage") or
            hasContentDescription("profile photo", substring = true, ignoreCase = true)
        ).performClick()
        Thread.sleep(1000)
        return this
    }

    fun tapChangePassword(): ProfilePage {
        composeTestRule.onNode(
            hasTestTag("ChangePasswordButton") or
            hasText("Change Password", ignoreCase = true) or
            hasText("Update Password", ignoreCase = true)
        ).performClick()
        Thread.sleep(1000)
        return this
    }

    fun tapOrderHistory(): ProfilePage {
        tapOrders()
        return this
    }

    fun confirmLogout(): ProfilePage {
        composeTestRule.onNodeWithText("Confirm", ignoreCase = true).performClick()
        Thread.sleep(1000)
        return this
    }

    fun tapDeleteAccount(): ProfilePage {
        composeTestRule.onNode(
            hasTestTag("DeleteAccountButton") or
            hasText("Delete Account", ignoreCase = true) or
            hasText("Remove Account", ignoreCase = true)
        ).performClick()
        Thread.sleep(1000)
        return this
    }

    fun tapRewards(): ProfilePage {
        composeTestRule.onNode(
            hasTestTag("RewardsButton") or
            hasText("Rewards", ignoreCase = true) or
            hasText("Points", ignoreCase = true) or
            hasText("Loyalty", ignoreCase = true)
        ).performClick()
        Thread.sleep(1000)
        return this
    }

    fun enterPassword(password: String): ProfilePage {
        val passwordField = composeTestRule.onNode(
            hasTestTag("PasswordField") or
            hasText("Password", substring = true, ignoreCase = true) or
            hasText("Enter password", substring = true, ignoreCase = true)
        )
        passwordField.performTextInput(password)
        return this
    }

    fun saveProfile(): ProfilePage {
        tapSave()
        return this
    }

    fun selectFromGallery(): ProfilePage {
        composeTestRule.onNode(
            hasTestTag("GalleryOption") or
            hasText("Gallery", ignoreCase = true) or
            hasText("Photo Library", ignoreCase = true) or
            hasText("Choose from gallery", substring = true, ignoreCase = true)
        ).performClick()
        Thread.sleep(1000)
        return this
    }

    fun enterCurrentPassword(password: String): ProfilePage {
        composeTestRule.onNode(
            hasTestTag("CurrentPasswordField") or
            hasText("Current Password", substring = true, ignoreCase = true) or
            hasText("Old Password", substring = true, ignoreCase = true)
        ).performTextInput(password)
        return this
    }

    fun enterNewPassword(password: String): ProfilePage {
        composeTestRule.onNode(
            hasTestTag("NewPasswordField") or
            hasText("New Password", substring = true, ignoreCase = true) or
            (hasText("Password", substring = true, ignoreCase = true) and
             !hasText("Current", substring = true, ignoreCase = true))
        ).performTextInput(password)
        return this
    }

    fun confirmNewPassword(password: String): ProfilePage {
        composeTestRule.onNode(
            hasTestTag("ConfirmPasswordField") or
            hasText("Confirm Password", substring = true, ignoreCase = true) or
            hasText("Confirm New Password", substring = true, ignoreCase = true) or
            hasText("Re-enter Password", substring = true, ignoreCase = true)
        ).performTextInput(password)
        return this
    }

    fun savePassword(): ProfilePage {
        composeTestRule.onNode(
            hasTestTag("SavePasswordButton") or
            hasText("Save", ignoreCase = true) or
            hasText("Update", ignoreCase = true) or
            hasText("Change Password", ignoreCase = true)
        ).performClick()
        Thread.sleep(1000)
        return this
    }

    fun cancelEdit(): ProfilePage {
        composeTestRule.onNode(
            hasTestTag("CancelButton") or
            hasText("Cancel", ignoreCase = true) or
            hasText("Back", ignoreCase = true)
        ).performClick()
        Thread.sleep(500)
        return this
    }

    fun confirmDelete(): ProfilePage {
        composeTestRule.onNode(
            hasTestTag("ConfirmDeleteButton") or
            hasText("Confirm", ignoreCase = true) or
            hasText("Delete", ignoreCase = true) or
            hasText("Yes", ignoreCase = true)
        ).performClick()
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

    fun assertNameDisplayed(): ProfilePage {
        profileName.assertExists()
        return this
    }

    fun assertFavoritesDisplayed(): ProfilePage {
        composeTestRule.onNode(
            hasText("favorites", substring = true, ignoreCase = true) or
            hasText("favourite", substring = true, ignoreCase = true)
        ).assertExists()
        return this
    }

    fun assertSettingsDisplayed(): ProfilePage {
        composeTestRule.onNodeWithText("Settings", ignoreCase = true).assertExists()
        return this
    }

    fun assertLoggedOut(): ProfilePage {
        composeTestRule.onNodeWithText("Login", ignoreCase = true).assertExists()
        return this
    }

    fun assertRewardsDisplayed(): ProfilePage {
        composeTestRule.onNode(
            hasText("reward", substring = true, ignoreCase = true) or
            hasText("point", substring = true, ignoreCase = true)
        ).assertExists()
        return this
    }

    fun assertEmailDisplayed(): ProfilePage {
        profileEmail.assertExists()
        return this
    }

    fun assertProfileUpdated(): ProfilePage {
        composeTestRule.onNode(
            hasText("updated", substring = true, ignoreCase = true) or
            hasText("saved", substring = true, ignoreCase = true)
        ).assertExists()
        return this
    }

    fun assertOrderHistoryDisplayed(): ProfilePage {
        composeTestRule.onNode(
            hasText("order", substring = true, ignoreCase = true) or
            hasText("history", substring = true, ignoreCase = true)
        ).assertExists()
        return this
    }

    fun assertValidationError(): ProfilePage {
        composeTestRule.onNode(
            hasText("error", substring = true, ignoreCase = true) or
            hasText("invalid", substring = true, ignoreCase = true) or
            hasText("required", substring = true, ignoreCase = true)
        ).assertExists()
        return this
    }

    fun assertPhoneDisplayed(): ProfilePage {
        composeTestRule.onNode(
            hasText("phone", substring = true, ignoreCase = true) or
            hasText("+", substring = true)
        ).assertExists()
        return this
    }

    fun assertPhotoUpdated(): ProfilePage {
        composeTestRule.onNode(
            hasTestTag("PhotoUpdatedMessage") or
            hasText("photo updated", substring = true, ignoreCase = true) or
            hasText("profile picture updated", substring = true, ignoreCase = true) or
            hasText("changed successfully", substring = true, ignoreCase = true) or
            hasText("updated successfully", substring = true, ignoreCase = true)
        ).assertExists()
        return this
    }

    fun assertAccountDeleted(): ProfilePage {
        composeTestRule.onNode(
            hasTestTag("AccountDeletedMessage") or
            hasText("account deleted", substring = true, ignoreCase = true) or
            hasText("account removed", substring = true, ignoreCase = true) or
            hasText("successfully deleted", substring = true, ignoreCase = true) or
            hasText("account has been deleted", substring = true, ignoreCase = true)
        ).assertExists()
        return this
    }

    fun assertPasswordMismatchError(): ProfilePage {
        composeTestRule.onNode(
            hasTestTag("PasswordMismatchError") or
            hasText("passwords don't match", substring = true, ignoreCase = true) or
            hasText("passwords do not match", substring = true, ignoreCase = true) or
            hasText("password mismatch", substring = true, ignoreCase = true) or
            hasText("must be the same", substring = true, ignoreCase = true)
        ).assertExists()
        return this
    }

    fun assertPasswordChanged(): ProfilePage {
        composeTestRule.onNode(
            hasTestTag("PasswordChangedMessage") or
            hasText("password changed", substring = true, ignoreCase = true) or
            hasText("password updated", substring = true, ignoreCase = true) or
            hasText("password changed successfully", substring = true, ignoreCase = true) or
            hasText("successfully updated", substring = true, ignoreCase = true) or
            hasText("success", substring = true, ignoreCase = true)
        ).assertExists()
        return this
    }
}
