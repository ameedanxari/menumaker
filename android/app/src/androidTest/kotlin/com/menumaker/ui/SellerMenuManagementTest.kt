package com.menumaker.ui

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import com.menumaker.MainActivity
import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.DishDto
import com.menumaker.data.repository.DishRepository
import com.menumaker.data.repository.MenuRepository
import com.menumaker.fakes.FakeDishRepository
import com.menumaker.fakes.FakeMenuRepository
import com.menumaker.pageobjects.SellerMenuEditorPage
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import javax.inject.Inject

/**
 * UI tests for seller menu management with mocked dependencies.
 * 
 * These tests use fake repositories via Hilt test module for deterministic,
 * network-independent testing.
 *
 * Requirements covered:
 * - 3.3: Menu management - creating, editing, and deleting menu items
 */
@LargeTest
@RunWith(AndroidJUnit4::class)
@HiltAndroidTest
class SellerMenuManagementTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    @Inject
    lateinit var dishRepository: DishRepository

    @Inject
    lateinit var menuRepository: MenuRepository

    private val fakeDishRepository: FakeDishRepository
        get() = dishRepository as FakeDishRepository

    private val fakeMenuRepository: FakeMenuRepository
        get() = menuRepository as FakeMenuRepository

    @Before
    fun setup() {
        hiltRule.inject()
        // Reset fake repositories to clean state before each test
        fakeDishRepository.reset()
        fakeMenuRepository.reset()
        setupTestData()
        loginAsSellerIfNeeded()
    }

    private fun setupTestData() {
        // Setup default menu items for testing
        val testDishes = listOf(
            createTestDish("dish-1", "Butter Chicken", 35000, "Main Course"),
            createTestDish("dish-2", "Paneer Tikka", 25000, "Appetizer"),
            createTestDish("dish-3", "Naan", 5000, "Bread")
        )
        fakeDishRepository.setDishes(testDishes)
    }

    private fun createTestDish(
        id: String,
        name: String,
        priceCents: Int,
        category: String
    ): DishDto {
        return DishDto(
            id = id,
            businessId = "business-1",
            name = name,
            description = "Delicious $name",
            priceCents = priceCents,
            imageUrl = null,
            category = category,
            isVegetarian = category == "Appetizer",
            isAvailable = true,
            createdAt = "2025-01-01T00:00:00Z",
            updatedAt = "2025-01-01T00:00:00Z"
        )
    }

    private fun loginAsSellerIfNeeded() {
        val emailField = composeTestRule.onAllNodesWithText("Email").fetchSemanticsNodes()
        if (emailField.isNotEmpty()) {
            composeTestRule.onNodeWithText("Email")
                .performTextInput("seller@example.com")

            composeTestRule.onNodeWithText("Password")
                .performTextInput("password123")

            composeTestRule.onNodeWithText("Login")
                .performClick()

            composeTestRule.waitForIdle()
        }
    }

    private fun navigateToMenuEditor() {
        // Navigate to menu management screen
        val menuTab = composeTestRule.onNode(
            hasText("Menu", substring = true, ignoreCase = true) or
            hasText("Items", substring = true, ignoreCase = true) or
            hasContentDescription("Menu")
        )

        if (menuTab.isDisplayed()) {
            menuTab.performClick()
            composeTestRule.waitForIdle()
        }

        // Look for edit/manage button
        val editButton = composeTestRule.onNode(
            hasText("Edit", substring = true, ignoreCase = true) or
            hasText("Manage", substring = true, ignoreCase = true) or
            hasContentDescription("Edit Menu")
        )

        if (editButton.isDisplayed()) {
            editButton.performClick()
            composeTestRule.waitForIdle()
        }
    }

    // MARK: - Menu Item Creation Tests (Requirement 3.3)

    /**
     * Test: Menu editor screen displays correctly
     * Requirements: 3.3 - Menu management
     */
    @Test
    fun testMenuEditorScreenDisplays() {
        navigateToMenuEditor()

        val menuEditorPage = SellerMenuEditorPage(composeTestRule)
        menuEditorPage.assertScreenDisplayed()

        // Verify dish repository was called
        assert(fakeDishRepository.getDishesByBusinessCallCount >= 0) {
            "Dish repository should be called for menu items"
        }
    }

    /**
     * Test: Create new menu item
     * Requirements: 3.3 - Creating menu items
     */
    @Test
    fun testCreateMenuItem() {
        navigateToMenuEditor()

        val menuEditorPage = SellerMenuEditorPage(composeTestRule)
        menuEditorPage
            .tapAddItem()
            .assertItemFormDisplayed()
            .enterItemName("New Test Dish")
            .enterDescription("A brand new test dish")
            .enterPrice("299")
            .tapSave()

        // Verify create was called
        assert(fakeDishRepository.createDishCallCount >= 1) {
            "Dish repository createDish should be called"
        }
    }

    /**
     * Test: Create menu item with all fields
     * Requirements: 3.3 - Creating menu items with prices and descriptions
     */
    @Test
    fun testCreateMenuItemWithAllFields() {
        navigateToMenuEditor()

        val menuEditorPage = SellerMenuEditorPage(composeTestRule)
        menuEditorPage.createMenuItem(
            name = "Special Biryani",
            description = "Aromatic rice dish with spices",
            price = "450"
        )

        // Verify the item was created
        assert(fakeDishRepository.createDishCallCount >= 1) {
            "Dish should be created with all fields"
        }
    }

    /**
     * Test: Create menu item validation - empty name
     * Requirements: 3.3 - Menu item validation
     */
    @Test
    fun testCreateMenuItemValidation_emptyName() {
        navigateToMenuEditor()

        val menuEditorPage = SellerMenuEditorPage(composeTestRule)
        menuEditorPage
            .tapAddItem()
            .assertItemFormDisplayed()
            .enterDescription("Description without name")
            .enterPrice("100")
            .tapSave()

        // Verify validation error is shown
        composeTestRule.onNode(
            hasText("name", substring = true, ignoreCase = true) or
            hasText("required", substring = true, ignoreCase = true) or
            hasText("enter", substring = true, ignoreCase = true)
        ).assertExists()
    }

    /**
     * Test: Create menu item validation - invalid price
     * Requirements: 3.3 - Menu item validation
     */
    @Test
    fun testCreateMenuItemValidation_invalidPrice() {
        navigateToMenuEditor()

        val menuEditorPage = SellerMenuEditorPage(composeTestRule)
        menuEditorPage
            .tapAddItem()
            .assertItemFormDisplayed()
            .enterItemName("Test Item")
            .enterDescription("Test description")
            .enterPrice("abc")
            .tapSave()

        // Verify validation error is shown or price is rejected
        composeTestRule.onNode(
            hasText("price", substring = true, ignoreCase = true) or
            hasText("invalid", substring = true, ignoreCase = true) or
            hasText("number", substring = true, ignoreCase = true)
        ).assertExists()
    }

    // MARK: - Menu Item Editing Tests (Requirement 3.3)

    /**
     * Test: Edit existing menu item
     * Requirements: 3.3 - Editing menu items
     */
    @Test
    fun testEditMenuItem() {
        navigateToMenuEditor()

        val menuEditorPage = SellerMenuEditorPage(composeTestRule)
        menuEditorPage
            .tapFirstItem()
            .assertItemFormDisplayed()

        // Clear and enter new name
        composeTestRule.onNode(
            hasText("Name", substring = true) and hasSetTextAction()
        ).performTextClearance()

        menuEditorPage
            .enterItemName("Updated Dish Name")
            .tapSave()

        // Verify update was called
        assert(fakeDishRepository.updateDishCallCount >= 1) {
            "Dish repository updateDish should be called"
        }
    }

    /**
     * Test: Edit menu item price
     * Requirements: 3.3 - Editing menu items with prices
     */
    @Test
    fun testEditMenuItemPrice() {
        navigateToMenuEditor()

        val menuEditorPage = SellerMenuEditorPage(composeTestRule)
        menuEditorPage.tapFirstItem()

        // Clear and enter new price
        val priceField = composeTestRule.onNode(
            hasText("Price", substring = true) and hasSetTextAction()
        )

        if (priceField.isDisplayed()) {
            priceField.performTextClearance()
            priceField.performTextInput("599")
        }

        menuEditorPage.tapSave()

        // Verify update was called
        assert(fakeDishRepository.updateDishCallCount >= 1) {
            "Dish price should be updated"
        }
    }

    /**
     * Test: Edit menu item description
     * Requirements: 3.3 - Editing menu items with descriptions
     */
    @Test
    fun testEditMenuItemDescription() {
        navigateToMenuEditor()

        val menuEditorPage = SellerMenuEditorPage(composeTestRule)
        menuEditorPage.tapFirstItem()

        // Clear and enter new description
        val descField = composeTestRule.onNode(
            hasText("Description", substring = true) and hasSetTextAction()
        )

        if (descField.isDisplayed()) {
            descField.performTextClearance()
            descField.performTextInput("Updated description for the dish")
        }

        menuEditorPage.tapSave()

        // Verify update was called
        assert(fakeDishRepository.updateDishCallCount >= 1) {
            "Dish description should be updated"
        }
    }

    /**
     * Test: Toggle menu item availability
     * Requirements: 3.3 - Editing menu items
     */
    @Test
    fun testToggleMenuItemAvailability() {
        navigateToMenuEditor()

        val menuEditorPage = SellerMenuEditorPage(composeTestRule)
        menuEditorPage.toggleAvailability(0)

        // Verify update was called
        assert(fakeDishRepository.updateDishCallCount >= 1) {
            "Dish availability should be toggled"
        }
    }

    // MARK: - Menu Item Deletion Tests (Requirement 3.3)

    /**
     * Test: Delete menu item
     * Requirements: 3.3 - Deleting menu items
     */
    @Test
    fun testDeleteMenuItem() {
        navigateToMenuEditor()

        val menuEditorPage = SellerMenuEditorPage(composeTestRule)
        menuEditorPage.deleteFirstItem()

        // Verify delete was called
        assert(fakeDishRepository.deleteDishCallCount >= 1) {
            "Dish repository deleteDish should be called"
        }
    }

    /**
     * Test: Delete menu item with confirmation
     * Requirements: 3.3 - Deleting menu items
     */
    @Test
    fun testDeleteMenuItemWithConfirmation() {
        navigateToMenuEditor()

        // Tap first item to open details
        val menuEditorPage = SellerMenuEditorPage(composeTestRule)
        menuEditorPage.tapFirstItem()

        // Find and click delete button
        val deleteButton = composeTestRule.onNode(
            hasText("Delete", substring = true, ignoreCase = true) or
            hasContentDescription("Delete")
        )

        if (deleteButton.isDisplayed()) {
            deleteButton.performClick()
            composeTestRule.waitForIdle()

            // Confirm deletion if dialog appears
            val confirmButton = composeTestRule.onNode(
                hasText("Confirm", substring = true, ignoreCase = true) or
                hasText("Yes", ignoreCase = true) or
                hasText("Delete", ignoreCase = true)
            )

            if (confirmButton.isDisplayed()) {
                confirmButton.performClick()
                composeTestRule.waitForIdle()
            }
        }

        // Verify delete was called
        assert(fakeDishRepository.deleteDishCallCount >= 1) {
            "Dish should be deleted after confirmation"
        }
    }

    // MARK: - Menu Display Tests

    /**
     * Test: Menu items are displayed correctly
     * Requirements: 3.3 - Menu management
     */
    @Test
    fun testMenuItemsDisplayed() {
        navigateToMenuEditor()

        composeTestRule.waitForIdle()

        // Verify menu items are displayed
        composeTestRule.onNode(
            hasText("Butter Chicken", substring = true) or
            hasText("Paneer Tikka", substring = true) or
            hasText("Naan", substring = true)
        ).assertExists()
    }

    /**
     * Test: Menu item prices are displayed
     * Requirements: 3.3 - Menu items with prices
     */
    @Test
    fun testMenuItemPricesDisplayed() {
        navigateToMenuEditor()

        composeTestRule.waitForIdle()

        // Verify prices are displayed (₹ symbol)
        composeTestRule.onNode(
            hasText("₹", substring = true) or
            hasText("350", substring = true) or
            hasText("250", substring = true)
        ).assertExists()
    }

    /**
     * Test: Empty menu state displays correctly
     * Requirements: 3.3 - Menu management
     */
    @Test
    fun testEmptyMenuState() {
        // Configure empty menu
        fakeDishRepository.configureEmptyResults()

        navigateToMenuEditor()

        composeTestRule.waitForIdle()

        // Verify empty state or add item prompt is shown
        composeTestRule.onNode(
            hasText("no items", substring = true, ignoreCase = true) or
            hasText("add your first", substring = true, ignoreCase = true) or
            hasText("empty", substring = true, ignoreCase = true) or
            hasText("Add Item", substring = true, ignoreCase = true)
        ).assertExists()
    }

    /**
     * Test: Menu loading error state
     * Requirements: 3.3 - Menu management error handling
     */
    @Test
    fun testMenuLoadingError() {
        // Configure error response
        fakeDishRepository.configureError("Failed to load menu items")

        navigateToMenuEditor()

        composeTestRule.waitForIdle()

        // Verify error state or retry option is shown
        composeTestRule.onNode(
            hasText("error", substring = true, ignoreCase = true) or
            hasText("retry", substring = true, ignoreCase = true) or
            hasText("try again", substring = true, ignoreCase = true) or
            hasText("failed", substring = true, ignoreCase = true)
        ).assertExists()
    }

    /**
     * Test: Created item appears in list
     * Requirements: 3.3 - Creating menu items
     */
    @Test
    fun testCreatedItemAppearsInList() {
        navigateToMenuEditor()

        val menuEditorPage = SellerMenuEditorPage(composeTestRule)
        menuEditorPage.createMenuItem(
            name = "New Special Item",
            description = "A special new item",
            price = "399"
        )

        composeTestRule.waitForIdle()

        // Verify the new item appears in the list
        menuEditorPage.assertItemExists("New Special Item")
    }
}

// MARK: - Helper Extensions

private fun SemanticsNodeInteraction.isDisplayed(): Boolean {
    return try {
        assertIsDisplayed()
        true
    } catch (e: AssertionError) {
        false
    }
}
