package com.menumaker.pageobjects

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.ComposeTestRule

/**
 * Page Object for Payment Processing Screen
 * Provides fluent API for payment interactions
 */
class PaymentPage(private val composeTestRule: ComposeTestRule) {

    // Payment method options
    private val cardPaymentOption = composeTestRule.onNode(
        hasText("card", substring = true, ignoreCase = true) or
        hasText("debit", substring = true, ignoreCase = true) or
        hasText("credit", substring = true, ignoreCase = true)
    )
    private val cashPaymentOption = composeTestRule.onNode(
        hasText("cash", substring = true, ignoreCase = true) or
        hasText("cod", substring = true, ignoreCase = true)
    )
    private val upiPaymentOption = composeTestRule.onNodeWithText("upi", substring = true, ignoreCase = true)
    private val walletPaymentOption = composeTestRule.onNodeWithText("wallet", substring = true, ignoreCase = true)
    private val netBankingOption = composeTestRule.onNodeWithText("net banking", substring = true, ignoreCase = true)

    // Card payment fields
    private val cardNumberField = composeTestRule.onNode(hasTestTag("card-number-field"))
    private val cardHolderField = composeTestRule.onNode(hasTestTag("card-holder-field"))
    private val expiryField = composeTestRule.onNode(hasTestTag("expiry-field"))
    private val cvvField = composeTestRule.onNode(hasTestTag("cvv-field"))

    // UPI fields
    private val upiIdField = composeTestRule.onNode(hasTestTag("upi-id-field"))

    // Saved cards
    private val saveCardCheckbox = composeTestRule.onNode(hasTestTag("save-card-checkbox"))
    private val savedCardsList = composeTestRule.onAllNodesWithTag("SavedCard")
    private val addNewCardButton = composeTestRule.onNodeWithText("add", substring = true, ignoreCase = true)

    // Action buttons
    private val payButton = composeTestRule.onNode(
        hasText("pay", substring = true, ignoreCase = true) or
        hasText("proceed", substring = true, ignoreCase = true)
    )
    private val cancelButton = composeTestRule.onNodeWithText("cancel", substring = true, ignoreCase = true)
    private val retryButton = composeTestRule.onNode(
        hasText("retry", substring = true, ignoreCase = true) or
        hasText("try again", substring = true, ignoreCase = true)
    )

    // Status indicators
    private val orderTotalLabel = composeTestRule.onNode(hasText("₹", substring = true))
    private val processingIndicator = composeTestRule.onNode(hasTestTag("payment-processing"))
    private val paymentSuccessMessage = composeTestRule.onNode(
        hasText("success", substring = true, ignoreCase = true) or
        hasText("confirmed", substring = true, ignoreCase = true) or
        hasText("placed", substring = true, ignoreCase = true)
    )
    private val paymentFailedMessage = composeTestRule.onNode(
        hasText("failed", substring = true, ignoreCase = true) or
        hasText("error", substring = true, ignoreCase = true) or
        hasText("declined", substring = true, ignoreCase = true)
    )
    private val securePaymentBadge = composeTestRule.onNodeWithText("secure", substring = true, ignoreCase = true)

    // Actions
    fun selectPaymentMethod(method: PaymentMethod): PaymentPage {
        when (method) {
            PaymentMethod.CARD -> cardPaymentOption.performClick()
            PaymentMethod.CASH -> cashPaymentOption.performClick()
            PaymentMethod.UPI -> upiPaymentOption.performClick()
            PaymentMethod.WALLET -> walletPaymentOption.performClick()
            PaymentMethod.NET_BANKING -> netBankingOption.performClick()
        }
        Thread.sleep(1000)
        return this
    }

    fun enterCardDetails(number: String, holder: String, expiry: String, cvv: String): PaymentPage {
        cardNumberField.performTextInput(number)
        cardHolderField.performTextInput(holder)
        expiryField.performTextInput(expiry)
        cvvField.performTextInput(cvv)
        return this
    }

    fun enterUpiId(upiId: String): PaymentPage {
        upiIdField.performTextInput(upiId)
        return this
    }

    fun toggleSaveCard(): PaymentPage {
        saveCardCheckbox.performClick()
        return this
    }

    fun selectSavedCard(index: Int = 0): PaymentPage {
        val nodes = savedCardsList.fetchSemanticsNodes()
        assert(nodes.isNotEmpty()) { "No saved cards found to select" }
        
        if (nodes.isNotEmpty()) {
            savedCardsList[index].performClick()
            Thread.sleep(1000)
        }
        return this
    }

    fun tapAddNewCard(): PaymentPage {
        addNewCardButton.performClick()
        Thread.sleep(1000)
        return this
    }

    fun pay(): PaymentPage {
        payButton.performClick()
        Thread.sleep(3000) // Wait for payment processing
        return this
    }

    fun cancelPayment(): PaymentPage {
        cancelButton.performClick()
        Thread.sleep(1000)
        return this
    }

    fun retryPayment(): PaymentPage {
        retryButton.performClick()
        Thread.sleep(1000)
        return this
    }

    // Assertions
    fun assertScreenDisplayed(): PaymentPage {
        composeTestRule.waitUntil(timeoutMillis = 2000) {
            try { cardPaymentOption.assertExists(); true } catch (e: AssertionError) { false } ||
            try { cashPaymentOption.assertExists(); true } catch (e: AssertionError) { false }
        }
        return this
    }

    fun assertPaymentMethodsDisplayed(): PaymentPage {
        // At least one payment method should be visible
        cardPaymentOption.assertExists()
        return this
    }

    fun assertCardFormDisplayed(): PaymentPage {
        cardNumberField.assertExists()
        cardHolderField.assertExists()
        expiryField.assertExists()
        cvvField.assertExists()
        return this
    }

    fun assertUpiFormDisplayed(): PaymentPage {
        upiIdField.assertExists()
        return this
    }

    fun assertSavedCardsDisplayed(): PaymentPage {
        assert(savedCardsList.fetchSemanticsNodes().isNotEmpty()) {
            "Saved cards should be displayed"
        }
        return this
    }

    fun assertOrderTotalDisplayed(): PaymentPage {
        orderTotalLabel.assertExists()
        return this
    }

    fun assertPaymentProcessing(): PaymentPage {
        processingIndicator.assertExists()
        return this
    }

    fun assertPaymentSuccess(): PaymentPage {
        paymentSuccessMessage.assertExists()
        return this
    }

    fun assertPaymentFailed(): PaymentPage {
        paymentFailedMessage.assertExists()
        return this
    }

    fun assertSecurePaymentBadgeVisible(): PaymentPage {
        securePaymentBadge.assertExists()
        return this
    }

    fun assertPayButtonEnabled(): PaymentPage {
        payButton.assertIsEnabled()
        return this
    }

    fun assertPayButtonDisabled(): PaymentPage {
        payButton.assertIsNotEnabled()
        return this
    }

    // Payment method enum
    enum class PaymentMethod {
        CARD,
        CASH,
        UPI,
        WALLET,
        NET_BANKING
    }
}
