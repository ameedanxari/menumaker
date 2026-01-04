package com.menumaker.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.menumaker.services.AnalyticsService
import com.menumaker.data.repository.PaymentRepository
import com.menumaker.data.remote.models.MockChargeRequest
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Payment method types
 */
enum class PaymentMethodType {
    CARD, CASH, UPI
}

/**
 * Saved card data model
 */
data class SavedCard(
    val id: String,
    val last4Digits: String,
    val expiryMonth: String,
    val expiryYear: String,
    val cardHolderName: String
)

/**
 * ViewModel for customer payment processing
 */
@HiltViewModel
class CustomerPaymentViewModel @Inject constructor(
    private val analyticsService: AnalyticsService,
    private val paymentRepository: PaymentRepository
) : ViewModel() {

    // Payment method selection
    private val _selectedPaymentMethod = MutableStateFlow(PaymentMethodType.CARD)
    val selectedPaymentMethod: StateFlow<PaymentMethodType> = _selectedPaymentMethod.asStateFlow()

    private val _isProcessing = MutableStateFlow(false)
    val isProcessing: StateFlow<Boolean> = _isProcessing.asStateFlow()

    private val _showPaymentSuccess = MutableStateFlow(false)
    val showPaymentSuccess: StateFlow<Boolean> = _showPaymentSuccess.asStateFlow()

    private val _showPaymentFailed = MutableStateFlow(false)
    val showPaymentFailed: StateFlow<Boolean> = _showPaymentFailed.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private val _completedOrderId = MutableStateFlow<String?>(null)
    val completedOrderId: StateFlow<String?> = _completedOrderId.asStateFlow()

    // Card payment fields
    private val _cardNumber = MutableStateFlow("")
    val cardNumber: StateFlow<String> = _cardNumber.asStateFlow()

    private val _cardHolderName = MutableStateFlow("")
    val cardHolderName: StateFlow<String> = _cardHolderName.asStateFlow()

    private val _expiryDate = MutableStateFlow("")
    val expiryDate: StateFlow<String> = _expiryDate.asStateFlow()

    private val _cvv = MutableStateFlow("")
    val cvv: StateFlow<String> = _cvv.asStateFlow()

    private val _saveCard = MutableStateFlow(false)
    val saveCard: StateFlow<Boolean> = _saveCard.asStateFlow()

    private val _cardValidationError = MutableStateFlow<String?>(null)
    val cardValidationError: StateFlow<String?> = _cardValidationError.asStateFlow()

    // UPI payment fields
    private val _upiId = MutableStateFlow("")
    val upiId: StateFlow<String> = _upiId.asStateFlow()

    private val _upiValidationError = MutableStateFlow<String?>(null)
    val upiValidationError: StateFlow<String?> = _upiValidationError.asStateFlow()

    // Saved cards
    private val _savedCards = MutableStateFlow<List<SavedCard>>(emptyList())
    val savedCards: StateFlow<List<SavedCard>> = _savedCards.asStateFlow()

    private val _selectedSavedCardIndex = MutableStateFlow<Int?>(null)
    val selectedSavedCardIndex: StateFlow<Int?> = _selectedSavedCardIndex.asStateFlow()

    private val _showNewCardForm = MutableStateFlow(false)
    val showNewCardForm: StateFlow<Boolean> = _showNewCardForm.asStateFlow()

    init {
        loadSavedCards()
    }

    /**
     * Check if pay button should be enabled
     */
    fun isPayButtonEnabled(): Boolean {
        return when (_selectedPaymentMethod.value) {
            PaymentMethodType.CARD -> {
                _selectedSavedCardIndex.value != null || isCardValid()
            }
            PaymentMethodType.CASH -> true
            PaymentMethodType.UPI -> isUpiValid()
        }
    }

    /**
     * Validate card details
     */
    private fun isCardValid(): Boolean {
        val number = _cardNumber.value
        val holder = _cardHolderName.value
        val expiry = _expiryDate.value
        val cvvValue = _cvv.value

        return number.length in 13..19 &&
                holder.isNotEmpty() &&
                isValidExpiryDate(expiry) &&
                cvvValue.length in 3..4
    }

    /**
     * Validate UPI ID
     */
    private fun isUpiValid(): Boolean {
        val upiPattern = Regex("^[\\w.]+@[\\w]+$")
        return upiPattern.matches(_upiId.value)
    }

    /**
     * Validate expiry date
     */
    private fun isValidExpiryDate(expiry: String): Boolean {
        val parts = expiry.split("/")
        if (parts.size != 2) return false

        val month = parts[0].toIntOrNull() ?: return false
        val year = parts[1].toIntOrNull() ?: return false

        if (month !in 1..12) return false

        // Add validation for current/future date
        return true
    }

    /**
     * Update payment method
     */
    fun setPaymentMethod(method: PaymentMethodType) {
        _selectedPaymentMethod.value = method
    }

    /**
     * Update card fields
     */
    fun updateCardNumber(number: String) {
        _cardNumber.value = number.filter { it.isDigit() }.take(19)
        validateCardNumber()
    }

    fun updateCardHolderName(name: String) {
        _cardHolderName.value = name
    }

    fun updateExpiryDate(date: String) {
        _expiryDate.value = date
        validateExpiryDate()
    }

    fun updateCvv(value: String) {
        _cvv.value = value.filter { it.isDigit() }.take(4)
    }

    fun updateSaveCard(save: Boolean) {
        _saveCard.value = save
    }

    /**
     * Update UPI ID
     */
    fun updateUpiId(id: String) {
        _upiId.value = id
        validateUpiId()
    }

    /**
     * Validation methods
     */
    private fun validateCardNumber() {
        val number = _cardNumber.value
        _cardValidationError.value = if (number.isNotEmpty() && number.length !in 13..19) {
            "Invalid card number"
        } else null
    }

    private fun validateExpiryDate() {
        val expiry = _expiryDate.value
        _cardValidationError.value = if (expiry.isNotEmpty() && !isValidExpiryDate(expiry)) {
            "Invalid expiry date"
        } else null
    }

    private fun validateUpiId() {
        val upiPattern = Regex("^[\\w.]+@[\\w]+$")
        _upiValidationError.value = if (_upiId.value.isNotEmpty() && !upiPattern.matches(_upiId.value)) {
            "Invalid UPI ID format"
        } else null
    }

    /**
     * Load saved cards
     */
    private fun loadSavedCards() {
        // Mock data - in production, load from secure storage
        _savedCards.value = listOf(
            SavedCard(
                id = "card1",
                last4Digits = "4242",
                expiryMonth = "12",
                expiryYear = "25",
                cardHolderName = "John Doe"
            )
        )
    }

    /**
     * Select saved card
     */
    fun selectSavedCard(index: Int) {
        _selectedSavedCardIndex.value = index
        _showNewCardForm.value = false
    }

    /**
     * Process payment
     */
    fun processPayment(amount: Double, onSuccess: (String) -> Unit) {
        viewModelScope.launch {
            _isProcessing.value = true
            _errorMessage.value = null

            try {
                val orderId = "ORD-${(10000..99999).random()}"
                val amountCents = (amount * 100).toInt()

                when (_selectedPaymentMethod.value) {
                    PaymentMethodType.CARD -> processCardPayment(amountCents, orderId)
                    PaymentMethodType.CASH -> processCashPayment(amount, orderId)
                    PaymentMethodType.UPI -> processUPIPayment(amountCents, orderId)
                }

                _completedOrderId.value = orderId
                _showPaymentSuccess.value = true
                _isProcessing.value = false
                onSuccess(orderId)

            } catch (e: Exception) {
                _errorMessage.value = e.message ?: "Payment failed"
                _showPaymentFailed.value = true
                _isProcessing.value = false
            }
        }
    }

    private suspend fun processCardPayment(amountCents: Int, orderId: String) {
        paymentRepository.mockCharge(
            MockChargeRequest(
                amountCents = amountCents,
                method = "card",
                reference = orderId
            )
        )

        analyticsService.track("card_payment_processed", mapOf(
            "amount_cents" to amountCents,
            "order_id" to orderId
        ))
    }

    private fun processCashPayment(amount: Double, orderId: String) {
        analyticsService.track("cash_payment_selected", mapOf(
            "amount" to amount,
            "order_id" to orderId
        ))
    }

    private suspend fun processUPIPayment(amountCents: Int, orderId: String) {
        paymentRepository.mockCharge(
            MockChargeRequest(
                amountCents = amountCents,
                method = "upi",
                reference = orderId
            )
        )

        analyticsService.track("upi_payment_processed", mapOf(
            "amount_cents" to amountCents,
            "order_id" to orderId,
            "upi_id" to _upiId.value
        ))
    }

    /**
     * Reset form
     */
    fun resetForm() {
        _cardNumber.value = ""
        _cardHolderName.value = ""
        _expiryDate.value = ""
        _cvv.value = ""
        _saveCard.value = false
        _upiId.value = ""
        _selectedSavedCardIndex.value = null
        _showNewCardForm.value = false
        _cardValidationError.value = null
        _upiValidationError.value = null
    }
}
