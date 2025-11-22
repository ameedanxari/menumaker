package com.menumaker.pageobjects

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.ComposeTestRule

/**
 * Page Object for Seller Menu Editor Screen
 */
class SellerMenuEditorPage(private val composeTestRule: ComposeTestRule) {

    // Elements
    private val addItemButton = composeTestRule.onNodeWithText("Add Item", ignoreCase = true)
    private val menuItems = composeTestRule.onAllNodes(hasTestTag("MenuItem"))
    private val itemNameField = composeTestRule.onNodeWithText("Name", substring = true)
    private val itemDescriptionField = composeTestRule.onNodeWithText("Description", substring = true)
    private val itemPriceField = composeTestRule.onNodeWithText("Price", substring = true)
    private val saveButton = composeTestRule.onNodeWithText("Save", ignoreCase = true)
    private val deleteButton = composeTestRule.onNodeWithText("Delete", ignoreCase = true)

    // Actions
    fun tapAddItem(): SellerMenuEditorPage {
        addItemButton.performClick()
        Thread.sleep(500)
        return this
    }

    fun enterItemName(name: String): SellerMenuEditorPage {
        itemNameField.performTextInput(name)
        return this
    }

    fun enterDescription(description: String): SellerMenuEditorPage {
        itemDescriptionField.performTextInput(description)
        return this
    }

    fun enterPrice(price: String): SellerMenuEditorPage {
        itemPriceField.performTextInput(price)
        return this
    }

    fun tapSave(): SellerMenuEditorPage {
        saveButton.performClick()
        Thread.sleep(1000)
        return this
    }

    fun createMenuItem(name: String, description: String, price: String): SellerMenuEditorPage {
        tapAddItem()
        enterItemName(name)
        enterDescription(description)
        enterPrice(price)
        tapSave()
        return this
    }

    fun tapFirstItem(): SellerMenuEditorPage {
        menuItems.onFirst().performClick()
        Thread.sleep(500)
        return this
    }

    fun deleteFirstItem(): SellerMenuEditorPage {
        menuItems.onFirst().performClick()
        Thread.sleep(500)
        deleteButton.performClick()
        Thread.sleep(1000)
        return this
    }

    fun toggleAvailability(index: Int = 0): SellerMenuEditorPage {
        val toggleButton = composeTestRule.onAllNodes(hasTestTag("AvailabilityToggle"))[index]
        toggleButton.performClick()
        Thread.sleep(500)
        return this
    }

    // Assertions
    fun assertScreenDisplayed(): SellerMenuEditorPage {
        addItemButton.assertExists()
        return this
    }

    fun assertItemFormDisplayed(): SellerMenuEditorPage {
        itemNameField.assertExists()
        saveButton.assertExists()
        return this
    }

    fun assertItemExists(name: String): SellerMenuEditorPage {
        composeTestRule.onNodeWithText(name).assertExists()
        return this
    }
}
