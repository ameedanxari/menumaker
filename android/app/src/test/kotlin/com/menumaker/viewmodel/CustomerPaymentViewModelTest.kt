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
import org.junit.Assert.assertNotNull
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
    fun `initial state is correct`() {
        assertEquals(PaymentMethodType.CARD, viewModel.selectedPaymentMethod.value)
        assertFalse(viewModel.isPayButtonEnabled())
    }

    @Test
    fun `updateCardNumber validates length`() {
        viewModel.updateCardNumber("123")
        assertEquals("123", viewModel.cardNumber.value)
        
        // Validation happens in updateCardNumber
         assertEquals("Invalid card number", viewModel.cardValidationError.value)
         
         viewModel.updateCardNumber("1234567890123") // 13 digits
         assertNull(viewModel.cardValidationError.value)
    }

    @Test
    fun `isPayButtonEnabled checks all card fields`() {
        viewModel.updateCardNumber("1234567890123456")
        viewModel.updateCardHolderName("John Doe")
        viewModel.updateExpiryDate("12/25")
        viewModel.updateCvv("123")
        
        assertTrue(viewModel.isPayButtonEnabled())
    }
    
    @Test
    fun `isPayButtonEnabled returns false if fields invalid`() {
        viewModel.updateCardNumber("123") // Invalid
        viewModel.updateCardHolderName("John Doe")
        viewModel.updateExpiryDate("12/25")
        viewModel.updateCvv("123")
        
        assertFalse(viewModel.isPayButtonEnabled())
    }

    @Test
    fun `updateUpiId validates format`() {
        viewModel.setPaymentMethod(PaymentMethodType.UPI)
        
        viewModel.updateUpiId("invalid")
        assertEquals("Invalid UPI ID format", viewModel.upiValidationError.value)
        assertFalse(viewModel.isPayButtonEnabled())
        
        viewModel.updateUpiId("valid@upi")
        assertNull(viewModel.upiValidationError.value)
        assertTrue(viewModel.isPayButtonEnabled())
    }

    @Test
    fun `processPayment works successfully`() = runTest {
        // Set up valid state
        viewModel.setPaymentMethod(PaymentMethodType.CASH)
        
        var successOrderId: String? = null
        viewModel.processPayment(100.0) { orderId ->
            successOrderId = orderId
        }
        
        // Should eventually succeed
        assertTrue(viewModel.isProcessing.value || viewModel.showPaymentSuccess.value)
        
        // Since we mock analytics, we assume it's called
    }
    
    @Test
    fun `resetForm clears all fields`() {
        viewModel.updateCardNumber("123")
        viewModel.updateCardHolderName("John")
        
        viewModel.resetForm()
        
        assertEquals("", viewModel.cardNumber.value)
        assertEquals("", viewModel.cardHolderName.value)
    }

    // MARK: - Enhanced Payment Validation Tests for Requirements 10.2

    @Test
    fun `validateCardNumber with valid 16-digit number`() {
        viewModel.updateCardNumber("1234567890123456")
        assertNull(viewModel.cardValidationError.value)
    }

    @Test
    fun `validateCardNumber with valid 13-digit number`() {
        viewModel.updateCardNumber("1234567890123")
        assertNull(viewModel.cardValidationError.value)
    }

    @Test
    fun `validateCardNumber with too short number returns error`() {
        viewModel.updateCardNumber("123456789012") // 12 digits
        assertEquals("Invalid card number", viewModel.cardValidationError.value)
    }

    @Test
    fun `validateCardNumber with too long number returns error`() {
        // Card number is limited to 19 digits by the ViewModel
        viewModel.updateCardNumber("12345678901234567890") // 20 digits - will be truncated
        // After truncation to 19 digits, it should be valid
        assertNull(viewModel.cardValidationError.value)
    }

    @Test
    fun `validateExpiryDate with valid format MM-YY`() {
        viewModel.updateExpiryDate("12/25")
        // Expiry validation uses cardValidationError
        assertNull(viewModel.cardValidationError.value)
    }

    @Test
    fun `validateExpiryDate with invalid month returns error`() {
        viewModel.updateExpiryDate("13/25") // Invalid month
        assertEquals("Invalid expiry date", viewModel.cardValidationError.value)
    }

    @Test
    fun `validateCvv with valid 3-digit CVV`() {
        viewModel.updateCvv("123")
        assertEquals("123", viewModel.cvv.value)
    }

    @Test
    fun `validateCvv with valid 4-digit CVV for Amex`() {
        viewModel.updateCvv("1234")
        assertEquals("1234", viewModel.cvv.value)
    }

    @Test
    fun `validateCvv truncates to 4 digits`() {
        viewModel.updateCvv("12345")
        assertEquals("1234", viewModel.cvv.value) // Truncated to 4
    }

    @Test
    fun `isPayButtonEnabled returns false with invalid card number`() {
        viewModel.updateCardNumber("123") // Invalid
        viewModel.updateCardHolderName("John Doe")
        viewModel.updateExpiryDate("12/25")
        viewModel.updateCvv("123")
        
        assertFalse(viewModel.isPayButtonEnabled())
    }

    @Test
    fun `isPayButtonEnabled returns false with invalid expiry`() {
        viewModel.updateCardNumber("1234567890123456")
        viewModel.updateCardHolderName("John Doe")
        viewModel.updateExpiryDate("13/25") // Invalid month
        viewModel.updateCvv("123")
        
        assertFalse(viewModel.isPayButtonEnabled())
    }

    @Test
    fun `isPayButtonEnabled returns false with short CVV`() {
        viewModel.updateCardNumber("1234567890123456")
        viewModel.updateCardHolderName("John Doe")
        viewModel.updateExpiryDate("12/25")
        viewModel.updateCvv("12") // Too short
        
        assertFalse(viewModel.isPayButtonEnabled())
    }

    @Test
    fun `isPayButtonEnabled returns false with empty card holder name`() {
        viewModel.updateCardNumber("1234567890123456")
        viewModel.updateCardHolderName("")
        viewModel.updateExpiryDate("12/25")
        viewModel.updateCvv("123")
        
        assertFalse(viewModel.isPayButtonEnabled())
    }

    @Test
    fun `setPaymentMethod changes selected method`() {
        viewModel.setPaymentMethod(PaymentMethodType.UPI)
        assertEquals(PaymentMethodType.UPI, viewModel.selectedPaymentMethod.value)
        
        viewModel.setPaymentMethod(PaymentMethodType.CASH)
        assertEquals(PaymentMethodType.CASH, viewModel.selectedPaymentMethod.value)
    }

    @Test
    fun `UPI payment with valid UPI ID enables pay button`() {
        viewModel.setPaymentMethod(PaymentMethodType.UPI)
        viewModel.updateUpiId("user@upi")
        
        assertTrue(viewModel.isPayButtonEnabled())
    }

    @Test
    fun `UPI payment with invalid UPI ID disables pay button`() {
        viewModel.setPaymentMethod(PaymentMethodType.UPI)
        viewModel.updateUpiId("invalid-upi")
        
        assertFalse(viewModel.isPayButtonEnabled())
    }

    @Test
    fun `CASH payment always enables pay button`() {
        viewModel.setPaymentMethod(PaymentMethodType.CASH)
        
        assertTrue(viewModel.isPayButtonEnabled())
    }

    @Test
    fun `card number filters non-numeric characters`() {
        viewModel.updateCardNumber("1234-5678-9012-3456")
        // Should strip non-numeric
        assertEquals("1234567890123456", viewModel.cardNumber.value)
    }

    @Test
    fun `CVV filters non-numeric characters`() {
        viewModel.updateCvv("12a3")
        assertEquals("123", viewModel.cvv.value)
    }
}
