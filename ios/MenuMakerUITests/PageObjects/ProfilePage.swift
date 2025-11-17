//
//  ProfilePage.swift
//  MenuMakerUITests
//
//  Page Object for User Profile Management Screen
//

import XCTest

struct ProfilePage {
    let app: XCUIApplication

    // MARK: - Elements

    var profilePhoto: XCUIElement {
        app.images.matching(identifier: "ProfilePhoto").firstMatch
    }

    var editPhotoButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'edit photo' OR label CONTAINS[c] 'change photo'")).firstMatch
    }

    var nameLabel: XCUIElement {
        app.staticTexts.matching(identifier: "UserName").firstMatch
    }

    var emailLabel: XCUIElement {
        app.staticTexts.matching(identifier: "UserEmail").firstMatch
    }

    var phoneLabel: XCUIElement {
        app.staticTexts.matching(identifier: "UserPhone").firstMatch
    }

    var editProfileButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'edit profile'")).firstMatch
    }

    var nameField: XCUIElement {
        app.textFields.matching(NSPredicate(format: "placeholderValue CONTAINS[c] 'name'")).firstMatch
    }

    var phoneField: XCUIElement {
        app.textFields.matching(NSPredicate(format: "placeholderValue CONTAINS[c] 'phone'")).firstMatch
    }

    var emailField: XCUIElement {
        app.textFields.matching(NSPredicate(format: "placeholderValue CONTAINS[c] 'email'")).firstMatch
    }

    var addressField: XCUIElement {
        app.textFields.matching(NSPredicate(format: "placeholderValue CONTAINS[c] 'address'")).firstMatch
    }

    var saveButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'save'")).firstMatch
    }

    var cancelButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'cancel'")).firstMatch
    }

    var changePasswordButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'password' OR label CONTAINS[c] 'change password'")).firstMatch
    }

    var currentPasswordField: XCUIElement {
        app.secureTextFields.matching(NSPredicate(format: "placeholderValue CONTAINS[c] 'current'")).firstMatch
    }

    var newPasswordField: XCUIElement {
        app.secureTextFields.matching(NSPredicate(format: "placeholderValue CONTAINS[c] 'new'")).firstMatch
    }

    var confirmPasswordField: XCUIElement {
        app.secureTextFields.matching(NSPredicate(format: "placeholderValue CONTAINS[c] 'confirm'")).firstMatch
    }

    var logoutButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'logout' OR label CONTAINS[c] 'sign out'")).firstMatch
    }

    var confirmLogoutButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'confirm' OR label CONTAINS[c] 'yes'")).firstMatch
    }

    var ordersButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'my order' OR label CONTAINS[c] 'order history'")).firstMatch
    }

    var favoritesButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'favorite' OR label CONTAINS '❤️'")).firstMatch
    }

    var settingsButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'setting' OR label CONTAINS '⚙️'")).firstMatch
    }

    var referralsButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'referral' OR label CONTAINS[c] 'invite'")).firstMatch
    }

    var helpButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'help' OR label CONTAINS[c] 'support'")).firstMatch
    }

    var deleteAccountButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'delete account'")).firstMatch
    }

    var successMessage: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'success' OR label CONTAINS[c] 'updated'")).firstMatch
    }

    var errorMessage: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'error' OR label CONTAINS[c] 'failed'")).firstMatch
    }

    // MARK: - Actions

    @discardableResult
    func tapEditProfile() -> ProfilePage {
        editProfileButton.tap()
        sleep(1)
        return self
    }

    @discardableResult
    func tapEditPhoto() -> ProfilePage {
        if editPhotoButton.waitForExistence(timeout: 1) {
            editPhotoButton.tap()
            sleep(1)

            // Select photo from picker
            let photoButton = app.images.element(boundBy: 0)
            if photoButton.waitForExistence(timeout: 2) {
                photoButton.tap()
            }

            // Close picker
            let doneButton = app.buttons["Done"]
            if doneButton.waitForExistence(timeout: 1) {
                doneButton.tap()
            }
        } else if profilePhoto.exists {
            profilePhoto.tap()
            sleep(1)
        }
        return self
    }

    @discardableResult
    func enterName(_ name: String) -> ProfilePage {
        nameField.tap()
        nameField.clearText()
        nameField.typeText(name)
        return self
    }

    @discardableResult
    func enterPhone(_ phone: String) -> ProfilePage {
        phoneField.tap()
        phoneField.clearText()
        phoneField.typeText(phone)
        return self
    }

    @discardableResult
    func enterAddress(_ address: String) -> ProfilePage {
        if addressField.waitForExistence(timeout: 1) {
            addressField.tap()
            addressField.clearText()
            addressField.typeText(address)
        }
        return self
    }

    @discardableResult
    func saveProfile() -> ProfilePage {
        dismissKeyboardIfNeeded()
        saveButton.tap()
        sleep(2)
        return self
    }

    @discardableResult
    func cancelEdit() -> ProfilePage {
        cancelButton.tap()
        return self
    }

    @discardableResult
    func tapChangePassword() -> ProfilePage {
        if changePasswordButton.waitForExistence(timeout: 2) {
            changePasswordButton.tap()
            sleep(1)
        } else {
            // Scroll to find it
            let scrollView = app.scrollViews.firstMatch
            if scrollView.exists {
                scrollView.swipeUp()
                if changePasswordButton.waitForExistence(timeout: 1) {
                    changePasswordButton.tap()
                    sleep(1)
                }
            }
        }
        return self
    }

    @discardableResult
    func changePassword(current: String, new: String, confirm: String) -> ProfilePage {
        currentPasswordField.tap()
        currentPasswordField.typeText(current)

        newPasswordField.tap()
        newPasswordField.typeText(new)

        confirmPasswordField.tap()
        confirmPasswordField.typeText(confirm)

        dismissKeyboardIfNeeded()
        saveButton.tap()
        sleep(2)

        return self
    }

    @discardableResult
    func tapLogout() -> ProfilePage {
        if logoutButton.waitForExistence(timeout: 2) {
            logoutButton.tap()
        } else {
            // Scroll to find logout
            let scrollView = app.scrollViews.firstMatch
            if scrollView.exists {
                scrollView.swipeUp()
                scrollView.swipeUp()
                if logoutButton.waitForExistence(timeout: 1) {
                    logoutButton.tap()
                }
            }
        }

        sleep(1)

        if confirmLogoutButton.waitForExistence(timeout: 2) {
            confirmLogoutButton.tap()
        }

        sleep(1)
        return self
    }

    @discardableResult
    func tapOrders() -> ProfilePage {
        ordersButton.tap()
        sleep(1)
        return self
    }

    @discardableResult
    func tapFavorites() -> ProfilePage {
        favoritesButton.tap()
        sleep(1)
        return self
    }

    @discardableResult
    func tapSettings() -> ProfilePage {
        settingsButton.tap()
        sleep(1)
        return self
    }

    @discardableResult
    func tapReferrals() -> ProfilePage {
        referralsButton.tap()
        sleep(1)
        return self
    }

    @discardableResult
    func tapHelp() -> ProfilePage {
        helpButton.tap()
        sleep(1)
        return self
    }

    @discardableResult
    func scrollToBottom() -> ProfilePage {
        let scrollView = app.scrollViews.firstMatch
        if scrollView.exists {
            scrollView.swipeUp()
            scrollView.swipeUp()
        }
        return self
    }

    // MARK: - Assertions

    @discardableResult
    func assertScreenDisplayed(timeout: TimeInterval = 2) -> ProfilePage {
        XCTAssertTrue(nameLabel.waitForExistence(timeout: timeout) ||
                     emailLabel.waitForExistence(timeout: timeout) ||
                     editProfileButton.waitForExistence(timeout: timeout),
                     "Profile screen should be displayed")
        return self
    }

    @discardableResult
    func assertProfileInfoDisplayed() -> ProfilePage {
        XCTAssertTrue(nameLabel.exists || emailLabel.exists,
                     "Profile info should be displayed")
        return self
    }

    @discardableResult
    func assertEditFormDisplayed() -> ProfilePage {
        XCTAssertTrue(nameField.waitForExistence(timeout: 2) ||
                     phoneField.waitForExistence(timeout: 2),
                     "Edit form should be displayed")
        return self
    }

    @discardableResult
    func assertProfileUpdated() -> ProfilePage {
        if successMessage.waitForExistence(timeout: 3) {
            XCTAssertTrue(successMessage.exists, "Success message should be displayed")
        } else {
            // Form should be dismissed
            XCTAssertFalse(saveButton.exists, "Edit form should be dismissed")
        }
        return self
    }

    @discardableResult
    func assertChangePasswordFormDisplayed() -> ProfilePage {
        XCTAssertTrue(currentPasswordField.waitForExistence(timeout: 2),
                     "Change password form should be displayed")
        return self
    }

    @discardableResult
    func assertLoggedOut() -> ProfilePage {
        // Should navigate to login screen
        let loginPage = LoginPage(app: app)
        XCTAssertTrue(loginPage.emailField.waitForExistence(timeout: 3),
                     "Should navigate to login screen after logout")
        return self
    }

    @discardableResult
    func assertMenuOptionsDisplayed() -> ProfilePage {
        XCTAssertTrue(ordersButton.exists ||
                     settingsButton.exists ||
                     logoutButton.exists,
                     "Profile menu options should be displayed")
        return self
    }

    // MARK: - Helpers

    private func dismissKeyboardIfNeeded() {
        if app.keyboards.count > 0 {
            app.keyboards.buttons["Return"].tap()
        }
    }
}

extension XCUIElement {
    func clearText() {
        guard let stringValue = self.value as? String else {
            return
        }

        var deleteString = String()
        for _ in stringValue {
            deleteString += XCUIKeyboardKey.delete.rawValue
        }

        self.typeText(deleteString)
    }
}
