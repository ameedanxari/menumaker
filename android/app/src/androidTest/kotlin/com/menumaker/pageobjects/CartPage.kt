package com.menumaker.pageobjects

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.ComposeTestRule

/**
 * Page Object for Cart Screen
 */
class CartPage(private val composeTestRule: ComposeTestRule) {

    // Elements
    private val cartItems = composeTestRule.onAllNodes(hasTestTag("CartItem"))
    private val firstCartItem = cartItems.onFirst()
    private val removeButtons = composeTestRule.onAllNodes(hasText("Remove", ignoreCase = true))
    private val totalPrice = composeTestRule.onNode(hasTestTag("TotalPrice"))
    private val checkoutButton = composeTestRule.onNodeWithText("Checkout", ignoreCase = true)
    private val couponField = composeTestRule.onNodeWithText("Coupon", substring = true, ignoreCase = true)
    private val applyCouponButton = composeTestRule.onNodeWithText("Apply", substring = true, ignoreCase = true)
    private val emptyCartMessage = composeTestRule.onNodeWithText("empty", substring = true, ignoreCase = true)

    // Actions
    fun removeFirstItem(): CartPage {
        removeButtons.onFirst().performClick()
        Thread.sleep(500)
        return this
    }

    fun applyCoupon(code: String): CartPage {
        couponField.performClick()
        couponField.performTextInput(code)
        applyCouponButton.performClick()
        Thread.sleep(1000)
        return this
    }

    fun proceedToCheckout(): CheckoutPage {
        checkoutButton.performScrollTo()
        checkoutButton.performClick()
        Thread.sleep(1000)
        return CheckoutPage(composeTestRule)
    }

    fun increaseQuantity(index: Int = 0): CartPage {
        val increaseButton = composeTestRule.onAllNodes(hasContentDescription("Increase", substring = true))[index]
        increaseButton.performClick()
        Thread.sleep(500)
        return this
    }

    fun decreaseQuantity(index: Int = 0): CartPage {
        val decreaseButton = composeTestRule.onAllNodes(hasContentDescription("Decrease", substring = true))[index]
        decreaseButton.performClick()
        Thread.sleep(500)
        return this
    }

    // Assertions
    fun assertScreenDisplayed(): CartPage {
        checkoutButton.assertExists()
        return this
    }

    fun assertCartNotEmpty(): CartPage {
        firstCartItem.assertExists()
        return this
    }

    fun assertCartEmpty(): CartPage {
        emptyCartMessage.assertExists()
        return this
    }

    fun assertItemCount(count: Int): CartPage {
        assert(cartItems.fetchSemanticsNodes().size == count) {
            "Expected $count items in cart"
        }
        return this
    }

    fun assertTotalDisplayed(): CartPage {
        totalPrice.assertExists()
        return this
    }
}
