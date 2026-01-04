package com.menumaker.ui

import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import com.menumaker.MainActivity
import com.menumaker.data.repository.PaymentRepository
import com.menumaker.fakes.FakePaymentRepository
import com.menumaker.pageobjects.PaymentPage
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import javax.inject.Inject

/**
 * UI tests for payment processing workflows
 *
 * These tests use FakePaymentRepository via Hilt test module for deterministic,
 * network-independent testing.
 *
 * Requirements covered:
 * - 10.1: Payment method selection and display
 * - 10.2: Payment validation for card number, expiry, and CVV
 */
@LargeTest
@RunWith(AndroidJUnit4::class)
@HiltAndroidTest
class PaymentFlowTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    @Inject
    lateinit var paymentRepository: PaymentRepository

    private val fakePaymentRepository: FakePaymentRepository
        get() = paymentRepository as FakePaymentRepository

    @Before
    fun setup() {
        hiltRule.inject()
        // Reset fake repository to clean state before each test
        fakePaymentRepository.reset()
    }

    // MARK: - Payment Tests with Mocked Dependencies (Requirements 10.1, 10.2)

    /**
     * Test: Successful card payment with mocked repository
     * Requirements: 10.1 - Payment method selection
     */
    @Test
    fun testPayWithCard_success_withMockedRepository() {
        // Configure successful payment
        fakePaymentRepository.configureSuccessfulPayment()

        val paymentPage = PaymentPage(composeTestRule)
        paymentPage
            .selectPaymentMethod(PaymentPage.PaymentMethod.CARD)
            .enterCardDetails("4111111111111111", "John Doe", "12/25", "123")
            .pay()
        
        // Verify repository was called
        assert(fakePaymentRepository.mockChargeCallCount >= 1) {
            "PaymentRepository mockCharge should be called"
        }
    }

    /**
     * Test: Failed card payment with mocked repository
     * Requirements: 10.1 - Handle payment failures
     */
    @Test
    fun testPayWithCard_failure_withMockedRepository() {
        // Configure failed payment
        fakePaymentRepository.configureFailedPayment("Card declined")

        val paymentPage = PaymentPage(composeTestRule)
        paymentPage
            .selectPaymentMethod(PaymentPage.PaymentMethod.CARD)
            .enterCardDetails("4000000000000002", "John Doe", "12/25", "123")
            .pay()
            .assertPaymentFailed()
    }

    /**
     * Test: Card validation with mocked repository
     * Requirements: 10.2 - Validate card number, expiry, and CVV
     */
    @Test
    fun testCardValidation_withMockedRepository() {
        val paymentPage = PaymentPage(composeTestRule)
        paymentPage
            .selectPaymentMethod(PaymentPage.PaymentMethod.CARD)
            .enterCardDetails("4111111111111111", "John Doe", "12/25", "123")
            .assertPayButtonEnabled()
    }

    /**
     * Test: UPI payment with mocked repository
     * Requirements: 10.1 - Payment method selection
     */
    @Test
    fun testPayWithUPI_withMockedRepository() {
        // Configure successful payment
        fakePaymentRepository.configureSuccessfulPayment()

        val paymentPage = PaymentPage(composeTestRule)
        paymentPage
            .selectPaymentMethod(PaymentPage.PaymentMethod.UPI)
            .enterUpiId("user@upi")
            .pay()
        
        // Verify repository was called
        assert(fakePaymentRepository.mockChargeCallCount >= 1) {
            "PaymentRepository mockCharge should be called"
        }
    }

    // MARK: - Original Payment Tests (kept for compatibility)

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
