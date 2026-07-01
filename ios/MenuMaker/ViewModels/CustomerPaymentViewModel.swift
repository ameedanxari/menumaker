import Foundation
import Combine

struct TokenizedPaymentMethod: Identifiable, Equatable {
    let id: String
    let type: PaymentMethodType
    let provider: String
    let tokenReference: String
    let brand: String?
    let last4: String?
    let expiryMonth: Int?
    let expiryYear: Int?
    let billingName: String?
    let requiresVerification: Bool

    var isExpired: Bool {
        guard let expiryMonth, let expiryYear else { return false }
        let normalizedYear = expiryYear < 100 ? 2000 + expiryYear : expiryYear
        let components = Calendar.current.dateComponents([.year, .month], from: Date())
        guard let currentYear = components.year, let currentMonth = components.month else { return false }
        return normalizedYear < currentYear || (normalizedYear == currentYear && expiryMonth < currentMonth)
    }
}

enum PaymentIntentStatus: Equatable {
    case idle
    case pendingVerification
    case authorized
    case failed(String)
}

@MainActor
class CustomerPaymentViewModel: ObservableObject {
    @Published var selectedPaymentMethod: PaymentMethodType = .card
    @Published var isProcessing = false
    @Published var showPaymentSuccess = false
    @Published var showPaymentFailed = false
    @Published var errorMessage: String?
    @Published var completedOrderId: String?

    @Published var cardNumber = ""
    @Published var cardHolderName = ""
    @Published var expiryDate = ""
    @Published var cvv = ""
    @Published var saveCard = false
    @Published var cardValidationError: String?

    @Published var upiId = ""
    @Published var upiValidationError: String?

    @Published var savedCards: [SavedCard] = []
    @Published var tokenizedPaymentMethods: [TokenizedPaymentMethod] = []
    @Published var selectedSavedCardIndex: Int?
    @Published var showNewCardForm = false
    @Published var paymentIntentStatus: PaymentIntentStatus = .idle

    var isPayButtonEnabled: Bool {
        switch selectedPaymentMethod {
        case .card:
            guard let method = selectedTokenizedMethod else { return false }
            return method.type == .card && !method.isExpired && !method.tokenReference.isEmpty
        case .cash:
            return true
        case .upi:
            guard let method = selectedTokenizedMethod else { return false }
            return method.type == .upi && !method.tokenReference.isEmpty
        }
    }

    init() {
        loadTokenizedPaymentMethods()
    }

    func loadTokenizedPaymentMethods() {
        tokenizedPaymentMethods = []
        syncSavedCardSummaries()
    }

    func replaceTokenizedPaymentMethodsForTesting(_ methods: [TokenizedPaymentMethod]) {
        tokenizedPaymentMethods = methods
        selectedSavedCardIndex = nil
        syncSavedCardSummaries()
    }

    func selectSavedCard(at index: Int) {
        guard tokenizedPaymentMethods.indices.contains(index) else {
            selectedSavedCardIndex = nil
            errorMessage = "Payment method not found"
            return
        }
        selectedSavedCardIndex = index
        selectedPaymentMethod = tokenizedPaymentMethods[index].type
        showNewCardForm = false
        errorMessage = nil
    }

    func updateCardNumber(_ input: String) {
        let digits = input.filter(\.isNumber)
        cardNumber = digits.count >= 4 ? "•••• \(digits.suffix(4))" : ""
        cardValidationError = input.isEmpty ? nil : "Add or select a card through the payment provider"
    }

    func updateCvv(_ input: String) {
        cvv = ""
        cardValidationError = input.isEmpty ? cardValidationError : "Security codes are collected only by the payment provider"
    }

    func updateUpiId(_ input: String) {
        upiId = input
        upiValidationError = input.isEmpty ? nil : "Authorize UPI through the payment provider"
    }

    func processPayment(amount: Double, onSuccess: @escaping (String) -> Void) async {
        isProcessing = true
        errorMessage = nil
        showPaymentFailed = false
        showPaymentSuccess = false

        do {
            let orderId = "PAY-\(Int(Date().timeIntervalSince1970 * 1000))"

            switch selectedPaymentMethod {
            case .card:
                try authorizeTokenizedPayment(type: .card, amount: amount, orderId: orderId)
            case .upi:
                try authorizeTokenizedPayment(type: .upi, amount: amount, orderId: orderId)
            case .cash:
                paymentIntentStatus = .authorized
            }

            completedOrderId = orderId
            isProcessing = false

            if paymentIntentStatus == .authorized {
                showPaymentSuccess = true
                onSuccess(orderId)
            }
        } catch {
            let message = error.localizedDescription
            paymentIntentStatus = .failed(message)
            errorMessage = message
            showPaymentFailed = true
            isProcessing = false
        }
    }

    func resetForm() {
        cardNumber = ""
        cardHolderName = ""
        expiryDate = ""
        cvv = ""
        saveCard = false
        upiId = ""
        selectedSavedCardIndex = nil
        showNewCardForm = false
        cardValidationError = nil
        upiValidationError = nil
        paymentIntentStatus = .idle
    }

    private var selectedTokenizedMethod: TokenizedPaymentMethod? {
        guard let index = selectedSavedCardIndex,
              tokenizedPaymentMethods.indices.contains(index) else {
            return nil
        }
        return tokenizedPaymentMethods[index]
    }

    private func authorizeTokenizedPayment(type: PaymentMethodType, amount: Double, orderId: String) throws {
        guard let method = selectedTokenizedMethod else {
            throw PaymentError.providerAuthorizationRequired
        }
        guard method.type == type else {
            throw PaymentError.providerAuthorizationRequired
        }
        guard !method.isExpired else {
            throw PaymentError.expiredPaymentMethod
        }
        guard !method.tokenReference.isEmpty else {
            throw PaymentError.providerAuthorizationRequired
        }

        // Server-created payment intent/provider client-secret integration lives behind the transport boundary.
        // Until the generated operation is fully migrated, this ViewModel only accepts provider-tokenized summaries
        // and never treats raw card/UPI entry as a successful payment.
        paymentIntentStatus = method.requiresVerification ? .pendingVerification : .authorized
        print("Authorized \(type.rawValue) payment via \(method.provider) for order \(orderId), amount \(amount)")
    }

    private func syncSavedCardSummaries() {
        savedCards = tokenizedPaymentMethods
            .filter { $0.type == .card }
            .map {
                SavedCard(
                    id: $0.id,
                    last4Digits: $0.last4 ?? "",
                    expiryMonth: $0.expiryMonth.map { String(format: "%02d", $0) } ?? "",
                    expiryYear: $0.expiryYear.map(String.init) ?? "",
                    cardHolderName: $0.billingName ?? "Provider saved card"
                )
            }
    }
}

enum PaymentError: LocalizedError {
    case providerAuthorizationRequired
    case expiredPaymentMethod
    case paymentDeclined
    case networkError

    var errorDescription: String? {
        switch self {
        case .providerAuthorizationRequired:
            return "Authorize this payment with the payment provider."
        case .expiredPaymentMethod:
            return "Selected payment method is expired."
        case .paymentDeclined:
            return "Payment was declined. Please try a different method."
        case .networkError:
            return "Network error. Please check your connection and try again."
        }
    }
}
