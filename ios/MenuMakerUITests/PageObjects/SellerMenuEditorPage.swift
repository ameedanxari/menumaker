//
//  SellerMenuEditorPage.swift
//  MenuMakerUITests
//
//  Page Object for Seller Menu Editor Screen
//

import XCTest

struct SellerMenuEditorPage {
    let app: XCUIApplication

    // MARK: - Elements

    var addItemButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'add item' OR label CONTAINS[c] 'new item'")).firstMatch
    }

    var menuItems: XCUIElementQuery {
        app.tables.cells.matching(identifier: "MenuItemCell")
    }

    var firstMenuItem: XCUIElement {
        menuItems.firstMatch
    }

    var searchField: XCUIElement {
        app.searchFields.firstMatch
    }

    // Item form fields
    var nameField: XCUIElement {
        app.textFields.matching(NSPredicate(format: "placeholderValue CONTAINS[c] 'name' OR placeholderValue CONTAINS[c] 'item name'")).firstMatch
    }

    var descriptionField: XCUIElement {
        app.textViews.matching(NSPredicate(format: "placeholderValue CONTAINS[c] 'description'")).firstMatch
    }

    var priceField: XCUIElement {
        app.textFields.matching(NSPredicate(format: "placeholderValue CONTAINS[c] 'price'")).firstMatch
    }

    var categoryPicker: XCUIElement {
        app.pickers.firstMatch
    }

    var uploadPhotoButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'upload' OR label CONTAINS[c] 'photo'")).firstMatch
    }

    var availabilityToggle: XCUIElement {
        app.switches.matching(NSPredicate(format: "label CONTAINS[c] 'available'")).firstMatch
    }

    var saveButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'save' OR label == 'Done'")).firstMatch
    }

    var deleteButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'delete'")).firstMatch
    }

    var confirmDeleteButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'confirm' OR label == 'Delete'")).firstMatch
    }

    // MARK: - Actions

    @discardableResult
    func tapAddItem() -> SellerMenuEditorPage {
        addItemButton.tap()
        return self
    }

    @discardableResult
    func tapFirstMenuItem() -> SellerMenuEditorPage {
        firstMenuItem.tap()
        return self
    }

    @discardableResult
    func enterItemName(_ name: String) -> SellerMenuEditorPage {
        nameField.tap()
        nameField.typeText(name)
        return self
    }

    @discardableResult
    func enterDescription(_ description: String) -> SellerMenuEditorPage {
        descriptionField.tap()
        descriptionField.typeText(description)
        return self
    }

    @discardableResult
    func enterPrice(_ price: String) -> SellerMenuEditorPage {
        priceField.tap()
        priceField.typeText(price)
        return self
    }

    @discardableResult
    func selectCategory(_ category: String) -> SellerMenuEditorPage {
        // Tap category field to show picker
        let categoryField = app.textFields.matching(NSPredicate(format: "placeholderValue CONTAINS[c] 'category'")).firstMatch
        if categoryField.exists {
            categoryField.tap()
        }

        // Select from picker
        let pickerWheel = app.pickerWheels.firstMatch
        if pickerWheel.waitForExistence(timeout: 1) {
            pickerWheel.adjust(toPickerWheelValue: category)
        }
        return self
    }

    @discardableResult
    func toggleAvailability() -> SellerMenuEditorPage {
        if availabilityToggle.waitForExistence(timeout: 1) {
            availabilityToggle.tap()
        }
        return self
    }

    @discardableResult
    func tapUploadPhoto() -> SellerMenuEditorPage {
        uploadPhotoButton.tap()

        // Handle photo picker if it appears
        sleep(1)
        let photoPermissionButton = app.buttons["OK"]
        if photoPermissionButton.exists {
            photoPermissionButton.tap()
        }

        // Select first photo
        let firstPhoto = app.images.firstMatch
        if firstPhoto.waitForExistence(timeout: 2) {
            firstPhoto.tap()
        }

        return self
    }

    @discardableResult
    func tapSave() -> SellerMenuEditorPage {
        dismissKeyboardIfNeeded()
        saveButton.tap()
        sleep(1)
        return self
    }

    @discardableResult
    func deleteItem() -> SellerMenuEditorPage {
        deleteButton.tap()

        // Confirm deletion
        if confirmDeleteButton.waitForExistence(timeout: 1) {
            confirmDeleteButton.tap()
        }

        sleep(1)
        return self
    }

    @discardableResult
    func swipeToDelete(at index: Int = 0) -> SellerMenuEditorPage {
        let item = menuItems.element(boundBy: index)
        item.swipeLeft()

        let deleteAction = app.buttons["Delete"]
        if deleteAction.waitForExistence(timeout: 1) {
            deleteAction.tap()
        }

        sleep(1)
        return self
    }

    func createMenuItem(name: String, description: String, price: String, category: String? = nil) {
        tapAddItem()
        enterItemName(name)
        enterDescription(description)
        enterPrice(price)

        if let category = category {
            selectCategory(category)
        }

        tapSave()
    }

    // MARK: - Assertions

    @discardableResult
    func assertScreenDisplayed(timeout: TimeInterval = 2) -> SellerMenuEditorPage {
        XCTAssertTrue(addItemButton.waitForExistence(timeout: timeout) ||
                     menuItems.firstMatch.waitForExistence(timeout: timeout),
                     "Menu editor screen should be displayed")
        return self
    }

    @discardableResult
    func assertItemFormDisplayed(timeout: TimeInterval = 2) -> SellerMenuEditorPage {
        XCTAssertTrue(nameField.waitForExistence(timeout: timeout), "Item form should be displayed")
        return self
    }

    @discardableResult
    func assertItemExists(_ name: String) -> SellerMenuEditorPage {
        let item = app.staticTexts[name]
        XCTAssertTrue(item.exists, "Menu item '\(name)' should exist")
        return self
    }

    @discardableResult
    func assertItemCount(_ expectedCount: Int) -> SellerMenuEditorPage {
        let actualCount = menuItems.count
        XCTAssertEqual(actualCount, expectedCount, "Should have \(expectedCount) menu items, found \(actualCount)")
        return self
    }

    @discardableResult
    func assertItemSaved(timeout: TimeInterval = 2) -> SellerMenuEditorPage {
        // Item form should close
        XCTAssertFalse(nameField.waitForExistence(timeout: timeout), "Item form should close after save")
        return self
    }

    // MARK: - Helpers

    private func dismissKeyboardIfNeeded() {
        if app.keyboards.count > 0 {
            let doneButton = app.buttons["Done"]
            if doneButton.exists {
                doneButton.tap()
            } else {
                app.keyboards.buttons["return"].tap()
            }
        }
    }
}
