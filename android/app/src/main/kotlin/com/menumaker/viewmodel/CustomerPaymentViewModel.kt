package com.menumaker.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.menumaker.services.AnalyticsService
import com.menumaker.data.repository.PaymentRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.Locale
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

data class TokenizedPaymentMethod(
    val id: String,
    val type: PaymentMethodType,
    val provider: String,
    val tokenReference: String,
    val brand: String?,
    val last4: String?,
    val expiryMonth: Int?,
    val expiryYear: Int?,
    val billingName: String?,
    val reusable: Boolean = true,
    val requiresVerification: Boolean = false
) {
    fun isExpired(now: YearMonth = YearMonth.now()): Boolean {
        val month = expiryMonth ?: return false
        val year = expiryYear ?: return false
        return YearMonth.of(normalizeExpiryYear(year), month).isBefore(now)
    }

    private fun normalizeExpiryYear(year: Int): Int = if (year < 100) 2000 + year else year
}

enum class PaymentIntentStatus {
    Idle,
    RequiresProviderAction,
    PendingVerification,
    Authorized,
    Failed
}

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

    // Card payment fields intentionally retain only masked/non-sensitive summaries.
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

    private val _tokenizedPaymentMethods = MutableStateFlow<List<TokenizedPaymentMethod>>(emptyList())
    val tokenizedPaymentMethods: StateFlow<List<TokenizedPaymentMethod>> = _tokenizedPaymentMethods.asStateFlow()

    private val _paymentIntentStatus = MutableStateFlow(PaymentIntentStatus.Idle)
    val paymentIntentStatus: StateFlow<PaymentIntentStatus> = _paymentIntentStatus.asStateFlow()

    private val _selectedSavedCardIndex = MutableStateFlow<Int?>(null)
    val selectedSavedCardIndex: StateFlow<Int?> = _selectedSavedCardIndex.asStateFlow()

    private val _showNewCardForm = MutableStateFlow(false)
    val showNewCardForm: StateFlow<Boolean> = _showNewCardForm.asStateFlow()

    init {
        loadTokenizedPaymentMethods()
    }

    /**
     * Check if pay button should be enabled
     */
    fun isPayButtonEnabled(): Boolean {
        return when (_selectedPaymentMethod.value) {
            PaymentMethodType.CARD -> {
                selectedTokenizedMethod()?.type == PaymentMethodType.CARD &&
                    selectedTokenizedMethod()?.isExpired() == false
            }
            PaymentMethodType.CASH -> true
            PaymentMethodType.UPI -> selectedTokenizedMethod()?.type == PaymentMethodType.UPI
        }
    }

    /**
     * Validate card details
     */
    private fun isCardValid(): Boolean {
        val holder = _cardHolderName.value
        val expiry = _expiryDate.value
        return holder.isNotEmpty() && isValidExpiryDate(expiry)
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
        val digits = number.filter { it.isDigit() }
        _cardNumber.value = if (digits.length >= 4) "•••• ${digits.takeLast(4)}" else ""
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
        _cvv.value = ""
        _cardValidationError.value = if (value.isNotBlank()) {
            "Security codes are collected only by the payment provider"
        } else null
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
        _cardValidationError.value = if (_cardNumber.value.isNotEmpty()) {
            "Use a saved tokenized card or add a card through the payment provider"
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

    private fun loadTokenizedPaymentMethods() {
        _tokenizedPaymentMethods.value = emptyList()
        syncLegacySavedCards()
    }

    fun replaceTokenizedPaymentMethodsForTesting(methods: List<TokenizedPaymentMethod>) {
        _tokenizedPaymentMethods.value = methods
        _selectedSavedCardIndex.value = null
        syncLegacySavedCards()
    }

    /**
     * Select saved card
     */
    fun selectSavedCard(index: Int) {
        val method = _tokenizedPaymentMethods.value.getOrNull(index)
        if (method == null) {
            _selectedSavedCardIndex.value = null
            _errorMessage.value = "Payment method not found"
        } else {
            _selectedSavedCardIndex.value = index
            _selectedPaymentMethod.value = method.type
            _showNewCardForm.value = false
            _errorMessage.value = null
        }
    }

    /**
     * Process payment
     */
    fun processPayment(amount: Double, onSuccess: (String) -> Unit) {
        viewModelScope.launch {
            _isProcessing.value = true
            _errorMessage.value = null

            try {
                val orderId = "PAY-${System.currentTimeMillis()}"
                val amountCents = (amount * 100).toInt()

                when (_selectedPaymentMethod.value) {
                    PaymentMethodType.CARD -> processTokenizedPayment(amountCents, orderId, PaymentMethodType.CARD)
                    PaymentMethodType.CASH -> processCashPayment(amount, orderId)
                    PaymentMethodType.UPI -> processTokenizedPayment(amountCents, orderId, PaymentMethodType.UPI)
                }

                _completedOrderId.value = orderId
                _showPaymentSuccess.value = _paymentIntentStatus.value == PaymentIntentStatus.Authorized
                _isProcessing.value = false
                if (_showPaymentSuccess.value) onSuccess(orderId)

            } catch (e: Exception) {
                _errorMessage.value = e.message ?: "Payment failed"
                _paymentIntentStatus.value = PaymentIntentStatus.Failed
                _showPaymentFailed.value = true
                _isProcessing.value = false
            }
        }
    }

    private fun processTokenizedPayment(amountCents: Int, orderId: String, methodType: PaymentMethodType) {
        val method = selectedTokenizedMethod()
            ?: throw IllegalStateException("Choose a saved provider-tokenized ${methodType.name.lowercase(Locale.US)} method")
        if (method.type != methodType) {
            throw IllegalStateException("Selected payment method does not match ${methodType.name.lowercase(Locale.US)}")
        }
        if (method.isExpired()) {
            throw IllegalStateException("Selected payment method is expired")
        }
        if (method.tokenReference.isBlank()) {
            throw IllegalStateException("Payment provider token is missing")
        }

        _paymentIntentStatus.value = if (method.requiresVerification) {
            PaymentIntentStatus.PendingVerification
        } else {
            PaymentIntentStatus.Authorized
        }

        analyticsService.track("tokenized_payment_authorized", mapOf(
            "amount_cents" to amountCents,
            "order_id" to orderId,
            "provider" to method.provider,
            "method_type" to methodType.name.lowercase(Locale.US)
        ))
    }

    private fun processCashPayment(amount: Double, orderId: String) {
        _paymentIntentStatus.value = PaymentIntentStatus.Authorized
        analyticsService.track("cash_payment_selected", mapOf(
            "amount" to amount,
            "order_id" to orderId
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
        _paymentIntentStatus.value = PaymentIntentStatus.Idle
    }

    private fun selectedTokenizedMethod(): TokenizedPaymentMethod? {
        return _selectedSavedCardIndex.value?.let { _tokenizedPaymentMethods.value.getOrNull(it) }
    }

    private fun syncLegacySavedCards() {
        _savedCards.value = _tokenizedPaymentMethods.value
            .filter { it.type == PaymentMethodType.CARD }
            .map {
                SavedCard(
                    id = it.id,
                    last4Digits = it.last4 ?: "",
                    expiryMonth = it.expiryMonth?.toString()?.padStart(2, '0') ?: "",
                    expiryYear = it.expiryYear?.toString() ?: "",
                    cardHolderName = it.billingName ?: "Provider saved card"
                )
            }
    }
}
