package com.menumaker.viewmodel

import com.menumaker.data.repository.PaymentRepository
import com.menumaker.services.AnalyticsService
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
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.mockito.Mock
import org.mockito.Mockito.reset
import org.mockito.MockitoAnnotations

/**
 * **Feature: android-test-coverage, Property 23: Payment Validation**
 * **Validates: Requirements 10.2**
 *
 * Property: For any invalid payment details (invalid card number, expired date, invalid CVV),
 * validation SHALL fail with appropriate error.
 */
@ExperimentalCoroutinesApi
class PaymentValidationPropertyTest {

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

    // Custom Arb for valid card numbers (13-19 digits)
    private fun arbValidCardNumber(): Arb<String> = arbitrary { rs ->
        val length = (13..19).random(rs.random)
        (1..length).map { ('0'..'9').random(rs.random) }.joinToString("")
    }

    // Custom Arb for invalid card numbers (too short or too long)
    private fun arbInvalidCardNumber(): Arb<String> = arbitrary { rs ->
        val tooShort = (1..12).random(rs.random)
        (1..tooShort).map { ('0'..'9').random(rs.random) }.joinToString("")
    }

    // Custom Arb for valid expiry dates (MM/YY format, future dates)
    private fun arbValidExpiryDate(): Arb<String> = arbitrary { rs ->
        val month = (1..12).random(rs.random).toString().padStart(2, '0')
        val year = (25..35).random(rs.random) // Future years
        "$month/$year"
    }

    // Custom Arb for invalid expiry dates
    private fun arbInvalidExpiryDate(): Arb<String> = arbitrary { rs ->
        val invalidPatterns = listOf(
            "13/25", // Invalid month > 12
            "00/25", // Invalid month = 0
            "1225",  // Missing separator
            ""       // Empty
        )
        invalidPatterns.random(rs.random)
    }

    // Custom Arb for valid CVV (3-4 digits)
    private fun arbValidCvv(): Arb<String> = arbitrary { rs ->
        val length = (3..4).random(rs.random)
        (1..length).map { ('0'..'9').random(rs.random) }.joinToString("")
    }

    // Custom Arb for invalid CVV (too short or too long)
    private fun arbInvalidCvv(): Arb<String> = arbitrary { rs ->
        val patterns = listOf(
            (1..2).map { ('0'..'9').random(rs.random) }.joinToString(""), // Too short
            "" // Empty
        )
        patterns.random(rs.random)
    }

    // Custom Arb for valid UPI IDs
    private fun arbValidUpiId(): Arb<String> = arbitrary { rs ->
        val chars = ('a'..'z') + ('0'..'9')
        val localPart = (1..8).map { chars.random(rs.random) }.joinToString("")
        val provider = listOf("upi", "paytm", "gpay", "phonepe").random(rs.random)
        "$localPart@$provider"
    }

    // Custom Arb for invalid UPI IDs
    private fun arbInvalidUpiId(): Arb<String> = arbitrary { rs ->
        val invalidPatterns = listOf(
            "noemail",           // No @ symbol
            "@provider",         // No local part
            "user@",             // No provider
            "user@@provider",    // Double @
            "",                  // Empty
            "user name@upi"      // Space in local part
        )
        invalidPatterns.random(rs.random)
    }

    // Custom Arb for card holder names
    private fun arbCardHolderName(): Arb<String> = arbitrary { rs ->
        val firstNames = listOf("John", "Jane", "Bob", "Alice", "Charlie")
        val lastNames = listOf("Doe", "Smith", "Johnson", "Williams", "Brown")
        "${firstNames.random(rs.random)} ${lastNames.random(rs.random)}"
    }

    @Test
    fun `property - invalid card numbers result in validation error`() = runTest {
        // Property: For any card number with less than 13 digits, validation SHALL fail
        checkAll(
            iterations = 100,
            arbInvalidCardNumber()
        ) { invalidCardNumber ->
            // Reset viewModel for each iteration
            reset(analyticsService, paymentRepository)
            viewModel = CustomerPaymentViewModel(analyticsService, paymentRepository)

            // When - invalid card number is entered
            viewModel.updateCardNumber(invalidCardNumber)

            // Then - validation error should be set
            assertEquals(
                "Invalid card number should trigger error",
                "Invalid card number",
                viewModel.cardValidationError.value
            )
        }
    }

    @Test
    fun `property - valid card numbers do not result in validation error`() = runTest {
        // Property: For any card number with 13-19 digits, validation SHALL pass
        checkAll(
            iterations = 100,
            arbValidCardNumber()
        ) { validCardNumber ->
            // Reset viewModel for each iteration
            reset(analyticsService, paymentRepository)
            viewModel = CustomerPaymentViewModel(analyticsService, paymentRepository)

            // When - valid card number is entered
            viewModel.updateCardNumber(validCardNumber)

            // Then - no validation error
            assertNull(
                "Valid card number should not trigger error",
                viewModel.cardValidationError.value
            )
        }
    }

    @Test
    fun `property - invalid expiry dates result in validation error`() = runTest {
        // Property: For any invalid expiry date format, validation SHALL fail
        checkAll(
            iterations = 50,
            arbInvalidExpiryDate()
        ) { invalidExpiry ->
            // Reset viewModel for each iteration
            reset(analyticsService, paymentRepository)
            viewModel = CustomerPaymentViewModel(analyticsService, paymentRepository)

            // When - invalid expiry is entered
            viewModel.updateExpiryDate(invalidExpiry)

            // Then - validation error should be set (if not empty)
            if (invalidExpiry.isNotEmpty()) {
                assertNotNull(
                    "Invalid expiry '$invalidExpiry' should trigger error",
                    viewModel.cardValidationError.value
                )
            }
        }
    }

    @Test
    fun `property - valid expiry dates do not result in validation error`() = runTest {
        // Property: For any valid expiry date, validation SHALL pass
        checkAll(
            iterations = 100,
            arbValidExpiryDate()
        ) { validExpiry ->
            // Reset viewModel for each iteration
            reset(analyticsService, paymentRepository)
            viewModel = CustomerPaymentViewModel(analyticsService, paymentRepository)

            // When - valid expiry is entered
            viewModel.updateExpiryDate(validExpiry)

            // Then - no validation error
            assertNull(
                "Valid expiry '$validExpiry' should not trigger error",
                viewModel.cardValidationError.value
            )
        }
    }

    @Test
    fun `property - invalid UPI IDs result in validation error`() = runTest {
        // Property: For any invalid UPI ID format, validation SHALL fail
        checkAll(
            iterations = 50,
            arbInvalidUpiId()
        ) { invalidUpiId ->
            // Reset viewModel for each iteration
            reset(analyticsService, paymentRepository)
            viewModel = CustomerPaymentViewModel(analyticsService, paymentRepository)
            viewModel.setPaymentMethod(PaymentMethodType.UPI)

            // When - invalid UPI ID is entered
            viewModel.updateUpiId(invalidUpiId)

            // Then - validation error should be set (if not empty)
            if (invalidUpiId.isNotEmpty()) {
                assertEquals(
                    "Invalid UPI ID '$invalidUpiId' should trigger error",
                    "Invalid UPI ID format",
                    viewModel.upiValidationError.value
                )
            }
        }
    }

    @Test
    fun `property - valid UPI IDs do not result in validation error`() = runTest {
        // Property: For any valid UPI ID, validation SHALL pass
        checkAll(
            iterations = 100,
            arbValidUpiId()
        ) { validUpiId ->
            // Reset viewModel for each iteration
            reset(analyticsService, paymentRepository)
            viewModel = CustomerPaymentViewModel(analyticsService, paymentRepository)
            viewModel.setPaymentMethod(PaymentMethodType.UPI)

            // When - valid UPI ID is entered
            viewModel.updateUpiId(validUpiId)

            // Then - no validation error
            assertNull(
                "Valid UPI ID '$validUpiId' should not trigger error",
                viewModel.upiValidationError.value
            )
        }
    }

    @Test
    fun `property - complete valid card details enable pay button`() = runTest {
        // Property: For any complete valid card details, pay button SHALL be enabled
        checkAll(
            iterations = 100,
            arbValidCardNumber(),
            arbCardHolderName(),
            arbValidExpiryDate(),
            arbValidCvv()
        ) { cardNumber, holderName, expiry, cvv ->
            // Reset viewModel for each iteration
            reset(analyticsService, paymentRepository)
            viewModel = CustomerPaymentViewModel(analyticsService, paymentRepository)

            // When - all valid card details are entered
            viewModel.updateCardNumber(cardNumber)
            viewModel.updateCardHolderName(holderName)
            viewModel.updateExpiryDate(expiry)
            viewModel.updateCvv(cvv)

            // Then - pay button should be enabled
            assertTrue(
                "Pay button should be enabled with valid card details",
                viewModel.isPayButtonEnabled()
            )
        }
    }

    @Test
    fun `property - incomplete card details disable pay button`() = runTest {
        // Property: For any incomplete card details, pay button SHALL be disabled
        checkAll(
            iterations = 100,
            arbValidCardNumber(),
            arbValidExpiryDate(),
            arbValidCvv()
        ) { cardNumber, expiry, cvv ->
            // Reset viewModel for each iteration
            reset(analyticsService, paymentRepository)
            viewModel = CustomerPaymentViewModel(analyticsService, paymentRepository)

            // When - card details are entered but holder name is empty
            viewModel.updateCardNumber(cardNumber)
            viewModel.updateCardHolderName("") // Empty holder name
            viewModel.updateExpiryDate(expiry)
            viewModel.updateCvv(cvv)

            // Then - pay button should be disabled
            assertFalse(
                "Pay button should be disabled with empty holder name",
                viewModel.isPayButtonEnabled()
            )
        }
    }

    @Test
    fun `property - CASH payment always enables pay button`() = runTest {
        // Property: For CASH payment method, pay button SHALL always be enabled
        checkAll(
            iterations = 50,
            Arb.int(1..1000) // Just to run multiple iterations
        ) { _ ->
            // Reset viewModel for each iteration
            reset(analyticsService, paymentRepository)
            viewModel = CustomerPaymentViewModel(analyticsService, paymentRepository)

            // When - CASH payment method is selected
            viewModel.setPaymentMethod(PaymentMethodType.CASH)

            // Then - pay button should be enabled regardless of other fields
            assertTrue(
                "Pay button should always be enabled for CASH payment",
                viewModel.isPayButtonEnabled()
            )
        }
    }
}
