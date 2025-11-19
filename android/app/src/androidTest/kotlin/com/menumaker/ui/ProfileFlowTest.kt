package com.menumaker.ui

import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import com.menumaker.MainActivity
import com.menumaker.pageobjects.ProfilePage
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * UI tests for user profile management
 */
@LargeTest
@RunWith(AndroidJUnit4::class)
@HiltAndroidTest
class ProfileFlowTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    @Before
    fun setup() {
        hiltRule.inject()
    }

    @Test
    fun testProfileScreenDisplays() {
        val profilePage = ProfilePage(composeTestRule)
        profilePage.assertScreenDisplayed()
    }

    @Test
    fun testProfileInfoDisplays() {
        val profilePage = ProfilePage(composeTestRule)
        profilePage
            .assertNameDisplayed()
            .assertEmailDisplayed()
            .assertPhoneDisplayed()
    }

    @Test
    fun testEditProfile() {
        val profilePage = ProfilePage(composeTestRule)
        profilePage
            .tapEditProfile()
            .assertEditFormDisplayed()
            .updateName("Updated Name")
            .updatePhone("9876543210")
            .saveProfile()
            .assertProfileUpdated()
    }

    @Test
    fun testChangeProfilePhoto() {
        val profilePage = ProfilePage(composeTestRule)
        profilePage
            .tapProfilePhoto()
            .selectFromGallery()
            .assertPhotoUpdated()
    }

    @Test
    fun testChangePassword() {
        val profilePage = ProfilePage(composeTestRule)
        profilePage
            .tapChangePassword()
            .enterCurrentPassword("oldpassword")
            .enterNewPassword("newpassword123")
            .confirmNewPassword("newpassword123")
            .savePassword()
            .assertPasswordChanged()
    }

    @Test
    fun testPasswordMismatch() {
        val profilePage = ProfilePage(composeTestRule)
        profilePage
            .tapChangePassword()
            .enterCurrentPassword("oldpassword")
            .enterNewPassword("newpassword123")
            .confirmNewPassword("differentpassword")
            .assertPasswordMismatchError()
    }

    @Test
    fun testUpdateAddress() {
        val profilePage = ProfilePage(composeTestRule)
        profilePage
            .tapEditProfile()
            .updateAddress("123 New Street, City, State 12345")
            .saveProfile()
            .assertProfileUpdated()
    }

    @Test
    fun testCancelProfileEdit() {
        val profilePage = ProfilePage(composeTestRule)
        profilePage
            .tapEditProfile()
            .updateName("Updated Name")
            .cancelEdit()
            .assertScreenDisplayed()
    }

    @Test
    fun testViewOrderHistory() {
        val profilePage = ProfilePage(composeTestRule)
        profilePage
            .tapOrderHistory()
            .assertOrderHistoryDisplayed()
    }

    @Test
    fun testViewFavorites() {
        val profilePage = ProfilePage(composeTestRule)
        profilePage
            .tapFavorites()
            .assertFavoritesDisplayed()
    }

    @Test
    fun testViewSettings() {
        val profilePage = ProfilePage(composeTestRule)
        profilePage
            .tapSettings()
            .assertSettingsDisplayed()
    }

    @Test
    fun testLogout() {
        val profilePage = ProfilePage(composeTestRule)
        profilePage
            .tapLogout()
            .confirmLogout()
            .assertLoggedOut()
    }

    @Test
    fun testDeleteAccount() {
        val profilePage = ProfilePage(composeTestRule)
        profilePage
            .tapDeleteAccount()
            .enterPassword("password123")
            .confirmDelete()
            .assertAccountDeleted()
    }

    @Test
    fun testViewRewards() {
        val profilePage = ProfilePage(composeTestRule)
        profilePage
            .tapRewards()
            .assertRewardsDisplayed()
    }

    @Test
    fun testValidationOnEmptyFields() {
        val profilePage = ProfilePage(composeTestRule)
        profilePage
            .tapEditProfile()
            .updateName("")
            .saveProfile()
            .assertValidationError()
    }

    @Test
    fun testPhoneNumberValidation() {
        val profilePage = ProfilePage(composeTestRule)
        profilePage
            .tapEditProfile()
            .updatePhone("123")
            .saveProfile()
            .assertValidationError()
    }
}
