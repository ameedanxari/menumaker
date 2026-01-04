package com.menumaker.ui

import com.google.common.truth.Truth.assertThat
import com.menumaker.data.remote.models.MockChargeData
import com.menumaker.data.remote.models.MockChargeRequest
import com.menumaker.data.remote.models.MockChargeResponse
import com.menumaker.data.repository.PaymentRepository
import com.menumaker.services.AnalyticsService
import com.menumaker.viewmodel.CustomerPaymentViewModel
import com.menumaker.viewmodel.PaymentMethodType
import io.kotest.property.Arb
import io.kotest.property.arbitrary.arbitrary
import io.kotest.property.arbitrary.int
import io.kotest.property.arbitrary.string
import io.kotest.property.checkAll
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.mockito.Mock
import org.mockito.Mockito.`when`
import org.mockito.MockitoAnnotations
import org.mockito.kotlin.any

/**
 * **Feature: android-test-coverage, Property 21: Checkout Validation**
 * **Validates: Requirements 8.4**
 *
 * Property: For any checkout attempt with missing required fields, the checkout SHALL be blocked
 * with validation errors.
 *
 * This property test verifies that the CustomerPaymentViewModel correctly validates checkout
 * inputs and blocks payment processing when required fields are missing or invalid.
 */
@ExperimentalCoroutinesApi
class CheckoutValidationPropertyTest {

    @Mock
    private lateinit var paymentRepository: PaymentRepository

    @Mock
    private lateinit var analyticsService: AnalyticsService

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

    // Arb for invalid card numbers (too short or empty)
    // Note: The ViewModel filters non-digits and truncates to 19 digits,
    // so we only test values that remain invalid after sanitization
    private fun arbInvalidCardNumber(): Arb<String> = arbitrary { rs ->
        val invalidPatterns = listOf(
            // Empty string
            "",
            // Too short (less than 13 digits)
            "1234",
            "123456789",
            "12345678901",
            "123456789012",
            // Non-numeric only (becomes empty after filtering)
            "abcdefghijklm",
            "card-number"
        )
        invalidPatterns.random(rs.random)
    }

    // Arb for valid card numbers (13-19 digits)
    private fun arbValidCardNumber(): Arb<String> = arbitrary { rs ->
        val validPatterns = listOf(
            "4111111111111111",  // 16 digits (Visa test)
            "5500000000000004",  // 16 digits (Mastercard test)
            "340000000000009",   // 15 digits (Amex test)
            "4111111111111",     // 13 digits
            "4111111111111111111" // 19 digits
        )
        validPatterns.random(rs.random)
    }

    // Arb for invalid expiry dates
    private fun arbInvalidExpiryDate(): Arb<String> = arbitrary { rs ->
        val invalidPatterns = listOf(
            // Empty string
            "",
            // Invalid format
            "1225",
            "12-25",
            "12.25",
            // Invalid month
            "00/25",
            "13/25",
            "99/25",
            // Missing parts
            "12/",
            "/25",
            "12",
            // Non-numeric
            "ab/cd"
        )
        invalidPatterns.random(rs.random)
    }

    // Arb for valid expiry dates
    private fun arbValidExpiryDate(): Arb<String> = arbitrary { rs ->
        val validPatterns = listOf(
            "01/25",
            "06/26",
            "12/27",
            "03/28",
            "09/30"
        )
        validPatterns.random(rs.random)
    }

    // Arb for invalid CVV (too short or empty)
    // Note: The ViewModel truncates CVV to 4 digits and filters non-digits,
    // so we only test values that remain invalid after sanitization
    private fun arbInvalidCvv(): Arb<String> = arbitrary { rs ->
        val invalidPatterns = listOf(
            // Empty string
            "",
            // Too short (less than 3 digits)
            "1",
            "12",
            // Non-numeric only (becomes empty after filtering)
            "abc",
            "xyz"
        )
        invalidPatterns.random(rs.random)
    }

    // Arb for valid CVV (3-4 digits)
    private fun arbValidCvv(): Arb<String> = arbitrary { rs ->
        val validPatterns = listOf(
            "123",
            "456",
            "789",
            "1234",
            "5678"
        )
        validPatterns.random(rs.random)
    }

    // Arb for invalid UPI IDs
    private fun arbInvalidUpiId(): Arb<String> = arbitrary { rs ->
        val invalidPatterns = listOf(
            // Empty string
            "",
            // Missing @ symbol
            "username",
            "usernamebank",
            // Missing username
            "@bank",
            // Missing bank
            "username@",
            // Invalid characters
            "user name@bank",
            "user@bank name",
            // Multiple @ symbols
            "user@@bank",
            "user@bank@other"
        )
        invalidPatterns.random(rs.random)
    }

    // Arb for valid UPI IDs
    private fun arbValidUpiId(): Arb<String> = arbitrary { rs ->
        val validPatterns = listOf(
            "user@upi",
            "john.doe@okaxis",
            "test123@ybl",
            "payment@paytm",
            "user.name@icici"
        )
        validPatterns.random(rs.random)
    }

    /**
     * Property: For any invalid card number, checkout with card payment SHALL be blocked.
     */
    @Test
    fun `property - invalid card numbers block checkout`() = runTest {
        checkAll(
            iterations = 100,
            arbInvalidCardNumber()
        ) { invalidCardNumber ->
            // Given - card payment method selected
            viewModel.setPaymentMethod(PaymentMethodType.CARD)
            viewModel.resetForm()

            // When - invalid card number is entered with other valid fields
            viewModel.updateCardNumber(invalidCardNumber)
            viewModel.updateCardHolderName("John Doe")
            viewModel.updateExpiryDate("12/25")
            viewModel.updateCvv("123")

            // Then - pay button should be disabled
            assertFalse(
                "Checkout with invalid card number '$invalidCardNumber' should be blocked",
                viewModel.isPayButtonEnabled()
            )
        }
    }

    /**
     * Property: For any invalid expiry date, checkout with card payment SHALL be blocked.
     */
    @Test
    fun `property - invalid expiry dates block checkout`() = runTest {
        checkAll(
            iterations = 100,
            arbInvalidExpiryDate()
        ) { invalidExpiry ->
            // Given - card payment method selected
            viewModel.setPaymentMethod(PaymentMethodType.CARD)
            viewModel.resetForm()

            // When - invalid expiry date is entered with other valid fields
            viewModel.updateCardNumber("4111111111111111")
            viewModel.updateCardHolderName("John Doe")
            viewModel.updateExpiryDate(invalidExpiry)
            viewModel.updateCvv("123")

            // Then - pay button should be disabled
            assertFalse(
                "Checkout with invalid expiry date '$invalidExpiry' should be blocked",
                viewModel.isPayButtonEnabled()
            )
        }
    }

    /**
     * Property: For any invalid CVV, checkout with card payment SHALL be blocked.
     */
    @Test
    fun `property - invalid CVV blocks checkout`() = runTest {
        checkAll(
            iterations = 100,
            arbInvalidCvv()
        ) { invalidCvv ->
            // Given - card payment method selected
            viewModel.setPaymentMethod(PaymentMethodType.CARD)
            viewModel.resetForm()

            // When - invalid CVV is entered with other valid fields
            viewModel.updateCardNumber("4111111111111111")
            viewModel.updateCardHolderName("John Doe")
            viewModel.updateExpiryDate("12/25")
            viewModel.updateCvv(invalidCvv)

            // Then - pay button should be disabled
            assertFalse(
                "Checkout with invalid CVV '$invalidCvv' should be blocked",
                viewModel.isPayButtonEnabled()
            )
        }
    }

    /**
     * Property: For any empty cardholder name, checkout with card payment SHALL be blocked.
     */
    @Test
    fun `property - empty cardholder name blocks checkout`() = runTest {
        // Given - card payment method selected
        viewModel.setPaymentMethod(PaymentMethodType.CARD)
        viewModel.resetForm()

        // When - empty cardholder name with other valid fields
        viewModel.updateCardNumber("4111111111111111")
        viewModel.updateCardHolderName("")
        viewModel.updateExpiryDate("12/25")
        viewModel.updateCvv("123")

        // Then - pay button should be disabled
        assertFalse(
            "Checkout with empty cardholder name should be blocked",
            viewModel.isPayButtonEnabled()
        )
    }

    /**
     * Property: For any invalid UPI ID, checkout with UPI payment SHALL be blocked.
     */
    @Test
    fun `property - invalid UPI IDs block checkout`() = runTest {
        checkAll(
            iterations = 100,
            arbInvalidUpiId()
        ) { invalidUpiId ->
            // Given - UPI payment method selected
            viewModel.setPaymentMethod(PaymentMethodType.UPI)
            viewModel.resetForm()

            // When - invalid UPI ID is entered
            viewModel.updateUpiId(invalidUpiId)

            // Then - pay button should be disabled
            assertFalse(
                "Checkout with invalid UPI ID '$invalidUpiId' should be blocked",
                viewModel.isPayButtonEnabled()
            )
        }
    }

    /**
     * Property: For valid card details, checkout with card payment SHALL be allowed.
     */
    @Test
    fun `property - valid card details allow checkout`() = runTest {
        checkAll(
            iterations = 100,
            arbValidCardNumber(),
            arbValidExpiryDate(),
            arbValidCvv()
        ) { validCardNumber, validExpiry, validCvv ->
            // Given - card payment method selected
            viewModel.setPaymentMethod(PaymentMethodType.CARD)
            viewModel.resetForm()

            // When - all valid card details are entered
            viewModel.updateCardNumber(validCardNumber)
            viewModel.updateCardHolderName("John Doe")
            viewModel.updateExpiryDate(validExpiry)
            viewModel.updateCvv(validCvv)

            // Then - pay button should be enabled
            assertTrue(
                "Checkout with valid card details should be allowed",
                viewModel.isPayButtonEnabled()
            )
        }
    }

    /**
     * Property: For valid UPI ID, checkout with UPI payment SHALL be allowed.
     */
    @Test
    fun `property - valid UPI IDs allow checkout`() = runTest {
        checkAll(
            iterations = 100,
            arbValidUpiId()
        ) { validUpiId ->
            // Given - UPI payment method selected
            viewModel.setPaymentMethod(PaymentMethodType.UPI)
            viewModel.resetForm()

            // When - valid UPI ID is entered
            viewModel.updateUpiId(validUpiId)

            // Then - pay button should be enabled
            assertTrue(
                "Checkout with valid UPI ID '$validUpiId' should be allowed",
                viewModel.isPayButtonEnabled()
            )
        }
    }

    /**
     * Property: Cash payment SHALL always allow checkout (no validation required).
     */
    @Test
    fun `property - cash payment always allows checkout`() = runTest {
        // Given - cash payment method selected
        viewModel.setPaymentMethod(PaymentMethodType.CASH)
        viewModel.resetForm()

        // Then - pay button should always be enabled for cash
        assertTrue(
            "Checkout with cash payment should always be allowed",
            viewModel.isPayButtonEnabled()
        )
    }

    /**
     * Property: Validation error messages SHALL be displayed for invalid card numbers.
     */
    @Test
    fun `property - validation error displayed for invalid card numbers`() = runTest {
        // Given - card payment method selected
        viewModel.setPaymentMethod(PaymentMethodType.CARD)
        viewModel.resetForm()

        // When - invalid card number is entered
        viewModel.updateCardNumber("1234")

        // Then - validation error should be set
        assertThat(viewModel.cardValidationError.value).isNotNull()
        assertThat(viewModel.cardValidationError.value).contains("Invalid")
    }

    /**
     * Property: Validation error messages SHALL be displayed for invalid UPI IDs.
     */
    @Test
    fun `property - validation error displayed for invalid UPI IDs`() = runTest {
        // Given - UPI payment method selected
        viewModel.setPaymentMethod(PaymentMethodType.UPI)
        viewModel.resetForm()

        // When - invalid UPI ID is entered
        viewModel.updateUpiId("invalid-upi")

        // Then - validation error should be set
        assertThat(viewModel.upiValidationError.value).isNotNull()
        assertThat(viewModel.upiValidationError.value).contains("Invalid")
    }

    /**
     * Property: For any combination of missing required fields, checkout SHALL be blocked.
     */
    @Test
    fun `property - multiple missing fields block checkout`() = runTest {
        // Given - card payment method selected with no fields filled
        viewModel.setPaymentMethod(PaymentMethodType.CARD)
        viewModel.resetForm()

        // Then - pay button should be disabled
        assertFalse(
            "Checkout with all empty fields should be blocked",
            viewModel.isPayButtonEnabled()
        )

        // When - only card number is filled
        viewModel.updateCardNumber("4111111111111111")

        // Then - still blocked
        assertFalse(
            "Checkout with only card number should be blocked",
            viewModel.isPayButtonEnabled()
        )

        // When - card number and name filled
        viewModel.updateCardHolderName("John Doe")

        // Then - still blocked
        assertFalse(
            "Checkout with missing expiry and CVV should be blocked",
            viewModel.isPayButtonEnabled()
        )

        // When - card number, name, and expiry filled
        viewModel.updateExpiryDate("12/25")

        // Then - still blocked
        assertFalse(
            "Checkout with missing CVV should be blocked",
            viewModel.isPayButtonEnabled()
        )

        // When - all fields filled
        viewModel.updateCvv("123")

        // Then - finally allowed
        assertTrue(
            "Checkout with all valid fields should be allowed",
            viewModel.isPayButtonEnabled()
        )
    }
}
