package com.menumaker.ui

import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import com.menumaker.MainActivity
import com.menumaker.pageobjects.PaymentPage
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * UI tests for payment processing workflows
 */
@LargeTest
@RunWith(AndroidJUnit4::class)
@HiltAndroidTest
class PaymentFlowTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    @Before
    fun setup() {
        hiltRule.inject()
    }

    @Test
    fun testPaymentScreenDisplays() {
        val paymentPage = PaymentPage(composeTestRule)
        paymentPage.assertScreenDisplayed()
    }

    @Test
    fun testPaymentMethodsDisplay() {
        val paymentPage = PaymentPage(composeTestRule)
        paymentPage
            .assertPaymentMethodsDisplayed()
            .assertOrderTotalDisplayed()
    }

    @Test
    fun testSelectCardPayment() {
        val paymentPage = PaymentPage(composeTestRule)
        paymentPage
            .selectPaymentMethod(PaymentPage.PaymentMethod.CARD)
            .assertCardFormDisplayed()
    }

    @Test
    fun testEnterCardDetails() {
        val paymentPage = PaymentPage(composeTestRule)
        paymentPage
            .selectPaymentMethod(PaymentPage.PaymentMethod.CARD)
            .enterCardDetails("4111111111111111", "John Doe", "12/25", "123")
            .assertPayButtonEnabled()
    }

    @Test
    fun testPayWithCard() {
        val paymentPage = PaymentPage(composeTestRule)
        paymentPage
            .selectPaymentMethod(PaymentPage.PaymentMethod.CARD)
            .enterCardDetails("4111111111111111", "John Doe", "12/25", "123")
            .pay()
            .assertPaymentSuccess()
    }

    @Test
    fun testSelectCashPayment() {
        val paymentPage = PaymentPage(composeTestRule)
        paymentPage
            .selectPaymentMethod(PaymentPage.PaymentMethod.CASH)
            .assertPayButtonEnabled()
    }

    @Test
    fun testSelectUPIPayment() {
        val paymentPage = PaymentPage(composeTestRule)
        paymentPage
            .selectPaymentMethod(PaymentPage.PaymentMethod.UPI)
            .assertUpiFormDisplayed()
    }

    @Test
    fun testEnterUPIId() {
        val paymentPage = PaymentPage(composeTestRule)
        paymentPage
            .selectPaymentMethod(PaymentPage.PaymentMethod.UPI)
            .enterUpiId("user@upi")
            .assertPayButtonEnabled()
    }

    @Test
    fun testPayWithUPI() {
        val paymentPage = PaymentPage(composeTestRule)
        paymentPage
            .selectPaymentMethod(PaymentPage.PaymentMethod.UPI)
            .enterUpiId("user@upi")
            .pay()
            .assertPaymentSuccess()
    }

    @Test
    fun testSaveCardOption() {
        val paymentPage = PaymentPage(composeTestRule)
        paymentPage
            .selectPaymentMethod(PaymentPage.PaymentMethod.CARD)
            .enterCardDetails("4111111111111111", "John Doe", "12/25", "123")
            .toggleSaveCard()
            .pay()
    }

    @Test
    fun testUseSavedCard() {
        val paymentPage = PaymentPage(composeTestRule)
        paymentPage
            .selectPaymentMethod(PaymentPage.PaymentMethod.CARD)
            .assertSavedCardsDisplayed()
            .selectSavedCard(0)
            .pay()
            .assertPaymentSuccess()
    }

    @Test
    fun testCancelPayment() {
        val paymentPage = PaymentPage(composeTestRule)
        paymentPage
            .selectPaymentMethod(PaymentPage.PaymentMethod.CARD)
            .cancelPayment()
            .assertScreenDisplayed()
    }

    @Test
    fun testPaymentFailure() {
        val paymentPage = PaymentPage(composeTestRule)
        paymentPage
            .selectPaymentMethod(PaymentPage.PaymentMethod.CARD)
            .enterCardDetails("4000000000000002", "John Doe", "12/25", "123")
            .pay()
            .assertPaymentFailed()
    }

    @Test
    fun testRetryPayment() {
        val paymentPage = PaymentPage(composeTestRule)
        paymentPage
            .selectPaymentMethod(PaymentPage.PaymentMethod.CARD)
            .enterCardDetails("4000000000000002", "John Doe", "12/25", "123")
            .pay()
            .assertPaymentFailed()
            .retryPayment()
    }

    @Test
    fun testSecureBadgeDisplays() {
        val paymentPage = PaymentPage(composeTestRule)
        paymentPage
            .assertSecurePaymentBadgeVisible()
    }
}
