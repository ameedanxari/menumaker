package com.menumaker.pageobjects

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.ComposeTestRule

/**
 * Page Object for Checkout Screen
 */
class CheckoutPage(private val composeTestRule: ComposeTestRule) {

    // Elements
    private val deliveryAddressField = composeTestRule.onNodeWithText("Address", substring = true, ignoreCase = true)
    private val cashPaymentOption = composeTestRule.onNodeWithText("Cash", substring = true, ignoreCase = true)
    private val cardPaymentOption = composeTestRule.onNodeWithText("Card", substring = true, ignoreCase = true)
    private val upiPaymentOption = composeTestRule.onNodeWithText("UPI", substring = true, ignoreCase = true)
    private val placeOrderButton = composeTestRule.onNodeWithText("Place Order", ignoreCase = true)
    private val orderTotal = composeTestRule.onNode(hasTestTag("OrderTotal"))

    // Actions
    fun enterDeliveryAddress(address: String): CheckoutPage {
        deliveryAddressField.performClick()
        deliveryAddressField.performTextInput(address)
        return this
    }

    fun selectPaymentMethod(method: PaymentMethod): CheckoutPage {
        when (method) {
            PaymentMethod.CASH -> cashPaymentOption.performScrollTo().performClick()
            PaymentMethod.CARD -> cardPaymentOption.performScrollTo().performClick()
            PaymentMethod.UPI -> upiPaymentOption.performScrollTo().performClick()
        }
        Thread.sleep(500)
        return this
    }

    fun placeOrder(): CheckoutPage {
        placeOrderButton.performScrollTo()
        placeOrderButton.performClick()
        Thread.sleep(3000)
        return this
    }

    // Assertions
    fun assertScreenDisplayed(): CheckoutPage {
        placeOrderButton.assertExists()
        return this
    }

    fun assertPaymentMethodsDisplayed(): CheckoutPage {
        cashPaymentOption.assertExists()
        return this
    }

    fun assertOrderTotalDisplayed(): CheckoutPage {
        orderTotal.assertExists()
        return this
    }

    enum class PaymentMethod {
        CASH, CARD, UPI
    }
}
