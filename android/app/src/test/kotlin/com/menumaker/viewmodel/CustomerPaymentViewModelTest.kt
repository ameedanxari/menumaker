package com.menumaker.viewmodel

import com.menumaker.data.repository.PaymentRepository
import com.menumaker.services.AnalyticsService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.mockito.Mock
import org.mockito.MockitoAnnotations

@ExperimentalCoroutinesApi
class CustomerPaymentViewModelTest {

    @Mock
    private lateinit var analyticsService: AnalyticsService

    @Mock
    private lateinit var paymentRepository: PaymentRepository

    private lateinit var viewModel: CustomerPaymentViewModel
    private val testDispatcher = UnconfinedTestDispatcher()

    @Before
    fun setup() {
        MockitoAnnotations.openMocks(this)
        Dispatchers.setMain(testDispatcher)
        viewModel = CustomerPaymentViewModel(analyticsService, paymentRepository)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `initial state has no fake saved cards`() {
        assertEquals(PaymentMethodType.CARD, viewModel.selectedPaymentMethod.value)
        assertTrue(viewModel.savedCards.value.isEmpty())
        assertTrue(viewModel.tokenizedPaymentMethods.value.isEmpty())
        assertFalse(viewModel.isPayButtonEnabled())
    }

    @Test
    fun `raw card and cvv input is not retained in ViewModel state`() {
        viewModel.updateCardNumber("4111-1111-1111-1111")
        viewModel.updateCvv("123")

        assertEquals("•••• 1111", viewModel.cardNumber.value)
        assertEquals("", viewModel.cvv.value)
        assertEquals("Security codes are collected only by the payment provider", viewModel.cardValidationError.value)
    }

    @Test
    fun `tokenized card enables payment and exposes only summary fields`() {
        viewModel.replaceTokenizedPaymentMethodsForTesting(listOf(validCard()))
        viewModel.selectSavedCard(0)

        assertTrue(viewModel.isPayButtonEnabled())
        assertEquals("4242", viewModel.savedCards.value.single().last4Digits)
        assertFalse(viewModel.savedCards.value.single().cardHolderName.contains("4111"))
    }

    @Test
    fun `expired tokenized card disables payment and fails closed`() = runTest {
        viewModel.replaceTokenizedPaymentMethodsForTesting(listOf(validCard(expiryYear = 2020)))
        viewModel.selectSavedCard(0)

        assertFalse(viewModel.isPayButtonEnabled())
        viewModel.processPayment(42.0) {}

        assertTrue(viewModel.showPaymentFailed.value)
        assertEquals(PaymentIntentStatus.Failed, viewModel.paymentIntentStatus.value)
    }

    @Test
    fun `tokenized card authorizes successful completion`() = runTest {
        viewModel.replaceTokenizedPaymentMethodsForTesting(listOf(validCard()))
        viewModel.selectSavedCard(0)

        var callbackOrderId: String? = null
        viewModel.processPayment(100.0) { callbackOrderId = it }

        assertEquals(PaymentIntentStatus.Authorized, viewModel.paymentIntentStatus.value)
        assertTrue(viewModel.showPaymentSuccess.value)
        assertTrue(callbackOrderId!!.startsWith("PAY-"))
    }

    @Test
    fun `provider pending verification does not report terminal success`() = runTest {
        viewModel.replaceTokenizedPaymentMethodsForTesting(listOf(validCard(requiresVerification = true)))
        viewModel.selectSavedCard(0)

        var callbackCalled = false
        viewModel.processPayment(100.0) { callbackCalled = true }

        assertEquals(PaymentIntentStatus.PendingVerification, viewModel.paymentIntentStatus.value)
        assertFalse(viewModel.showPaymentSuccess.value)
        assertFalse(callbackCalled)
    }

    @Test
    fun `tokenized UPI method is required for UPI payment`() {
        viewModel.setPaymentMethod(PaymentMethodType.UPI)
        viewModel.updateUpiId("user@upi")

        assertFalse(viewModel.isPayButtonEnabled())

        viewModel.replaceTokenizedPaymentMethodsForTesting(listOf(validUpi()))
        viewModel.selectSavedCard(0)

        assertTrue(viewModel.isPayButtonEnabled())
    }

    @Test
    fun `cash remains separately authorized`() = runTest {
        viewModel.setPaymentMethod(PaymentMethodType.CASH)

        var callbackOrderId: String? = null
        viewModel.processPayment(25.0) { callbackOrderId = it }

        assertEquals(PaymentIntentStatus.Authorized, viewModel.paymentIntentStatus.value)
        assertTrue(viewModel.showPaymentSuccess.value)
        assertTrue(callbackOrderId!!.startsWith("PAY-"))
    }

    @Test
    fun `resetForm clears non-sensitive summaries and status`() {
        viewModel.replaceTokenizedPaymentMethodsForTesting(listOf(validCard()))
        viewModel.selectSavedCard(0)
        viewModel.updateCardNumber("4111111111111111")

        viewModel.resetForm()

        assertEquals("", viewModel.cardNumber.value)
        assertNull(viewModel.selectedSavedCardIndex.value)
        assertEquals(PaymentIntentStatus.Idle, viewModel.paymentIntentStatus.value)
    }

    private fun validCard(
        expiryYear: Int = 2035,
        requiresVerification: Boolean = false
    ) = TokenizedPaymentMethod(
        id = "pm-card-1",
        type = PaymentMethodType.CARD,
        provider = "stripe",
        tokenReference = "pm_safe_card",
        brand = "visa",
        last4 = "4242",
        expiryMonth = 12,
        expiryYear = expiryYear,
        billingName = "Provider Customer",
        requiresVerification = requiresVerification
    )

    private fun validUpi() = TokenizedPaymentMethod(
        id = "pm-upi-1",
        type = PaymentMethodType.UPI,
        provider = "stripe",
        tokenReference = "upi_safe_token",
        brand = null,
        last4 = null,
        expiryMonth = null,
        expiryYear = null,
        billingName = "UPI Customer"
    )
}
