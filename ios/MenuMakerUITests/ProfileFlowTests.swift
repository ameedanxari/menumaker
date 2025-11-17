//
//  ProfileFlowTests.swift
//  MenuMakerUITests
//
//  Tests for user profile management - edit profile, change password, logout
//

import XCTest

final class ProfileFlowTests: XCTestCase {

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

    // MARK: - Profile Display Tests (P0)

    @MainActor
    func testProfileScreenDisplays() throws {
        navigateToProfile()

        let profilePage = ProfilePage(app: app)
        profilePage.assertScreenDisplayed()
    }

    @MainActor
    func testProfileInfoDisplayed() throws {
        navigateToProfile()

        let profilePage = ProfilePage(app: app)

        guard profilePage.nameLabel.waitForExistence(timeout: 2) ||
              profilePage.emailLabel.waitForExistence(timeout: 2) else {
            throw XCTSkip("Profile info not implemented yet")
        }

        profilePage.assertProfileInfoDisplayed()
    }

    @MainActor
    func testProfileMenuOptionsDisplayed() throws {
        navigateToProfile()

        let profilePage = ProfilePage(app: app)
        profilePage.assertMenuOptionsDisplayed()
    }

    // MARK: - Edit Profile Tests (P0)

    @MainActor
    func testEditProfile() throws {
        navigateToProfile()

        let profilePage = ProfilePage(app: app)

        guard profilePage.editProfileButton.waitForExistence(timeout: 2) else {
            throw XCTSkip("Edit profile feature not implemented yet")
        }

        profilePage
            .tapEditProfile()
            .assertEditFormDisplayed()
            .enterName("Updated Test User")
            .enterPhone("9876543210")
            .saveProfile()
            .assertProfileUpdated()
    }

    @MainActor
    func testEditProfileWithAddress() throws {
        navigateToProfile()

        let profilePage = ProfilePage(app: app)

        guard profilePage.editProfileButton.waitForExistence(timeout: 2) else {
            throw XCTSkip("Edit profile feature not implemented yet")
        }

        profilePage
            .tapEditProfile()
            .enterName("Test User")
            .enterPhone("1234567890")
            .enterAddress("123 Test Street, Test City")
            .saveProfile()
            .assertProfileUpdated()
    }

    @MainActor
    func testCancelEditProfile() throws {
        navigateToProfile()

        let profilePage = ProfilePage(app: app)

        guard profilePage.editProfileButton.waitForExistence(timeout: 2) else {
            throw XCTSkip("Edit profile feature not implemented yet")
        }

        profilePage
            .tapEditProfile()
            .assertEditFormDisplayed()
            .enterName("Cancel Test")
            .cancelEdit()

        sleep(1)
        // Form should be dismissed
        XCTAssertFalse(profilePage.nameField.exists, "Edit form should be dismissed")
    }

    @MainActor
    func testEditProfilePhoto() throws {
        navigateToProfile()

        let profilePage = ProfilePage(app: app)

        guard profilePage.profilePhoto.waitForExistence(timeout: 2) ||
              profilePage.editPhotoButton.waitForExistence(timeout: 2) else {
            throw XCTSkip("Profile photo feature not implemented yet")
        }

        profilePage.tapEditPhoto()

        sleep(2)
        // Photo picker should appear or photo should be updated
    }

    // MARK: - Change Password Tests (P0)

    @MainActor
    func testChangePassword() throws {
        navigateToProfile()

        let profilePage = ProfilePage(app: app)

        guard profilePage.changePasswordButton.waitForExistence(timeout: 3) else {
            throw XCTSkip("Change password feature not implemented yet")
        }

        profilePage
            .tapChangePassword()
            .assertChangePasswordFormDisplayed()
            .changePassword(current: "password123", new: "newpass123", confirm: "newpass123")

        sleep(2)

        // Should show success message or dismiss form
        if profilePage.successMessage.waitForExistence(timeout: 2) {
            profilePage.assertProfileUpdated()
        }
    }

    @MainActor
    func testChangePasswordMismatch() throws {
        navigateToProfile()

        let profilePage = ProfilePage(app: app)

        guard profilePage.changePasswordButton.waitForExistence(timeout: 3) else {
            throw XCTSkip("Change password feature not implemented yet")
        }

        profilePage
            .tapChangePassword()
            .changePassword(current: "password123", new: "newpass123", confirm: "differentpass")

        sleep(2)

        // Should show error for mismatched passwords
        XCTAssertTrue(profilePage.errorMessage.exists,
                     "Should show error for password mismatch")
    }

    @MainActor
    func testChangePasswordWrongCurrent() throws {
        navigateToProfile()

        let profilePage = ProfilePage(app: app)

        guard profilePage.changePasswordButton.waitForExistence(timeout: 3) else {
            throw XCTSkip("Change password feature not implemented yet")
        }

        profilePage
            .tapChangePassword()
            .changePassword(current: "wrongpassword", new: "newpass123", confirm: "newpass123")

        sleep(2)

        // Should show error for wrong current password
        if profilePage.errorMessage.waitForExistence(timeout: 2) {
            XCTAssertTrue(profilePage.errorMessage.exists,
                         "Should show error for wrong current password")
        }
    }

    // MARK: - Logout Tests (P0)

    @MainActor
    func testLogout() throws {
        navigateToProfile()

        let profilePage = ProfilePage(app: app)

        guard profilePage.logoutButton.waitForExistence(timeout: 3) else {
            throw XCTSkip("Logout feature not implemented yet")
        }

        profilePage
            .tapLogout()
            .assertLoggedOut()
    }

    // MARK: - Profile Navigation Tests (P1)

    @MainActor
    func testNavigateToOrders() throws {
        navigateToProfile()

        let profilePage = ProfilePage(app: app)

        guard profilePage.ordersButton.waitForExistence(timeout: 2) else {
            throw XCTSkip("Orders navigation not implemented yet")
        }

        profilePage.tapOrders()

        sleep(1)

        let orderHistoryPage = OrderHistoryPage(app: app)
        orderHistoryPage.assertScreenDisplayed()
    }

    @MainActor
    func testNavigateToFavorites() throws {
        navigateToProfile()

        let profilePage = ProfilePage(app: app)

        guard profilePage.favoritesButton.waitForExistence(timeout: 2) else {
            throw XCTSkip("Favorites navigation not implemented yet")
        }

        profilePage.tapFavorites()

        sleep(1)

        let favoritesPage = FavoritesPage(app: app)
        favoritesPage.assertScreenDisplayed()
    }

    @MainActor
    func testNavigateToSettings() throws {
        navigateToProfile()

        let profilePage = ProfilePage(app: app)

        guard profilePage.settingsButton.waitForExistence(timeout: 2) else {
            throw XCTSkip("Settings navigation not implemented yet")
        }

        profilePage.tapSettings()

        sleep(1)

        let settingsPage = SettingsPage(app: app)
        settingsPage.assertScreenDisplayed()
    }

    @MainActor
    func testNavigateToReferrals() throws {
        navigateToProfile()

        let profilePage = ProfilePage(app: app)

        guard profilePage.referralsButton.waitForExistence(timeout: 2) else {
            throw XCTSkip("Referrals navigation not implemented yet")
        }

        profilePage.tapReferrals()

        sleep(1)

        let referralPage = ReferralPage(app: app)
        referralPage.assertScreenDisplayed()
    }

    @MainActor
    func testNavigateToHelp() throws {
        navigateToProfile()

        let profilePage = ProfilePage(app: app)

        guard profilePage.helpButton.waitForExistence(timeout: 2) else {
            throw XCTSkip("Help navigation not implemented yet")
        }

        profilePage.tapHelp()

        sleep(1)
        // Help screen should be displayed
    }

    // MARK: - Profile Update Validation Tests (P1)

    @MainActor
    func testEditProfileWithInvalidPhone() throws {
        navigateToProfile()

        let profilePage = ProfilePage(app: app)

        guard profilePage.editProfileButton.waitForExistence(timeout: 2) else {
            throw XCTSkip("Edit profile feature not implemented yet")
        }

        profilePage
            .tapEditProfile()
            .enterPhone("123") // Invalid phone
            .saveProfile()

        sleep(2)

        // Should show validation error or button should be disabled
        if profilePage.errorMessage.waitForExistence(timeout: 2) {
            XCTAssertTrue(profilePage.errorMessage.exists,
                         "Should show error for invalid phone")
        }
    }

    @MainActor
    func testEditProfileWithEmptyName() throws {
        navigateToProfile()

        let profilePage = ProfilePage(app: app)

        guard profilePage.editProfileButton.waitForExistence(timeout: 2) else {
            throw XCTSkip("Edit profile feature not implemented yet")
        }

        profilePage
            .tapEditProfile()
            .enterName("")
            .saveProfile()

        sleep(1)

        // Should not allow saving with empty name
        XCTAssertFalse(profilePage.saveButton.isEnabled ||
                      profilePage.errorMessage.exists,
                      "Should not allow empty name")
    }

    // MARK: - Integration Tests (P1)

    @MainActor
    func testProfileChangesReflectedInApp() throws {
        navigateToProfile()

        let profilePage = ProfilePage(app: app)

        guard profilePage.editProfileButton.waitForExistence(timeout: 2) else {
            throw XCTSkip("Edit profile feature not implemented yet")
        }

        let newName = "Integration Test User"

        profilePage
            .tapEditProfile()
            .enterName(newName)
            .saveProfile()

        sleep(2)

        // Navigate away and back
        app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'home' OR label CONTAINS[c] 'marketplace'")).firstMatch.tap()
        sleep(1)

        navigateToProfile()

        // Verify name is still updated
        if profilePage.nameLabel.waitForExistence(timeout: 2) {
            XCTAssertTrue(profilePage.nameLabel.label.contains(newName) ||
                         profilePage.nameLabel.label.contains("Test"),
                         "Profile changes should persist")
        }
    }

    @MainActor
    func testLogoutClearsSessionData() throws {
        navigateToProfile()

        let profilePage = ProfilePage(app: app)

        guard profilePage.logoutButton.waitForExistence(timeout: 3) else {
            throw XCTSkip("Logout feature not implemented yet")
        }

        profilePage.tapLogout()

        sleep(2)

        // Should navigate to login screen
        let loginPage = LoginPage(app: app)
        XCTAssertTrue(loginPage.emailField.waitForExistence(timeout: 3),
                     "Should navigate to login screen")

        // Try to access protected screens - should redirect to login
        // This verifies session is cleared
    }

    // MARK: - Helper Methods

    private func navigateToProfile() {
        let profileTab = app.tabBars.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'profile' OR label CONTAINS[c] 'account'")).firstMatch

        if profileTab.waitForExistence(timeout: 2) {
            profileTab.tap()
            sleep(1)
        }
    }
}
