import Foundation
import Combine

@MainActor
class CustomerPaymentViewModel: ObservableObject {
    // MARK: - Published Properties

    @Published var selectedPaymentMethod: PaymentMethodType = .card
    @Published var isProcessing = false
    @Published var showPaymentSuccess = false
    @Published var showPaymentFailed = false
    @Published var errorMessage: String?
    @Published var completedOrderId: String?

    // Card Payment
    @Published var cardNumber = ""
    @Published var cardHolderName = ""
    @Published var expiryDate = ""
    @Published var cvv = ""
    @Published var saveCard = false
    @Published var cardValidationError: String?

    // UPI Payment
    @Published var upiId = ""
    @Published var upiValidationError: String?

    // Saved Cards
    @Published var savedCards: [SavedCard] = []
    @Published var selectedSavedCardIndex: Int?
    @Published var showNewCardForm = false

    private var cancellables = Set<AnyCancellable>()

    init() {
        setupValidation()
        loadSavedCards()
    }

    // MARK: - Computed Properties

    var isPayButtonEnabled: Bool {
        switch selectedPaymentMethod {
        case .card:
            if let index = selectedSavedCardIndex, index < savedCards.count {
                return true  // Using saved card
            }
            return isCardValid
        case .cash:
            return true
        case .upi:
            return isUpiValid
        }
    }

    private var isCardValid: Bool {
        let isNumberValid = cardNumber.count >= 13 && cardNumber.count <= 19
        let isHolderValid = !cardHolderName.isEmpty
        let isExpiryValid = isValidExpiryDate(expiryDate)
        let isCvvValid = cvv.count == 3 || cvv.count == 4

        return isNumberValid && isHolderValid && isExpiryValid && isCvvValid
    }

    private var isUpiValid: Bool {
        let upiPattern = "^[\\w.]+@[\\w]+$"
        let upiPredicate = NSPredicate(format: "SELF MATCHES %@", upiPattern)
        return upiPredicate.evaluate(with: upiId)
    }

    // MARK: - Setup

    private func setupValidation() {
        // Card Number Validation
        $cardNumber
            .debounce(for: .milliseconds(500), scheduler: DispatchQueue.main)
            .sink { [weak self] number in
                self?.validateCardNumber(number)
            }
            .store(in: &cancellables)

        // Expiry Date Validation
        $expiryDate
            .debounce(for: .milliseconds(500), scheduler: DispatchQueue.main)
            .sink { [weak self] expiry in
                self?.validateExpiryDate(expiry)
            }
            .store(in: &cancellables)

        // UPI ID Validation
        $upiId
            .debounce(for: .milliseconds(500), scheduler: DispatchQueue.main)
            .sink { [weak self] upiId in
                self?.validateUpiId(upiId)
            }
            .store(in: &cancellables)
    }

    // MARK: - Validation

    private func validateCardNumber(_ number: String) {
        guard !number.isEmpty else {
            cardValidationError = nil
            return
        }

        let numericOnly = number.filter { $0.isNumber }
        if numericOnly.count < 13 || numericOnly.count > 19 {
            cardValidationError = "Invalid card number"
        } else {
            cardValidationError = nil
        }
    }

    private func validateExpiryDate(_ expiry: String) {
        guard !expiry.isEmpty else {
            cardValidationError = nil
            return
        }

        if !isValidExpiryDate(expiry) {
            cardValidationError = "Invalid expiry date"
        } else {
            cardValidationError = nil
        }
    }

    private func isValidExpiryDate(_ expiry: String) -> Bool {
        let components = expiry.split(separator: "/")
        guard components.count == 2,
              let month = Int(components[0]),
              let year = Int(components[1]) else {
            return false
        }

        guard month >= 1 && month <= 12 else {
            return false
        }

        let currentYear = Calendar.current.component(.year, from: Date()) % 100
        let currentMonth = Calendar.current.component(.month, from: Date())

        if year < currentYear {
            return false
        } else if year == currentYear && month < currentMonth {
            return false
        }

        return true
    }

    private func validateUpiId(_ upiId: String) {
        guard !upiId.isEmpty else {
            upiValidationError = nil
            return
        }

        let upiPattern = "^[\\w.]+@[\\w]+$"
        let upiPredicate = NSPredicate(format: "SELF MATCHES %@", upiPattern)

        if !upiPredicate.evaluate(with: upiId) {
            upiValidationError = "Invalid UPI ID format"
        } else {
            upiValidationError = nil
        }
    }

    // MARK: - Saved Cards

    func loadSavedCards() {
        // Mock saved cards - in production, load from secure storage
        savedCards = [
            SavedCard(
                id: "card1",
                last4Digits: "4242",
                expiryMonth: "12",
                expiryYear: "25",
                cardHolderName: "John Doe"
            ),
            SavedCard(
                id: "card2",
                last4Digits: "5555",
                expiryMonth: "06",
                expiryYear: "26",
                cardHolderName: "John Doe"
            )
        ]
    }

    func selectSavedCard(at index: Int) {
        selectedSavedCardIndex = index
        showNewCardForm = false
    }

    // MARK: - Payment Processing

    func processPayment(amount: Double, onSuccess: @escaping (String) -> Void) async {
        isProcessing = true
        errorMessage = nil

        do {
            // Simulate payment processing
            try await Task.sleep(nanoseconds: 2_000_000_000)  // 2 seconds

            let orderId = "ORD-\(Int.random(in: 10000...99999))"

            switch selectedPaymentMethod {
            case .card:
                try await processCardPayment(amount: amount, orderId: orderId)
            case .cash:
                try await processCashPayment(amount: amount, orderId: orderId)
            case .upi:
                try await processUPIPayment(amount: amount, orderId: orderId)
            }

            // Success
            completedOrderId = orderId
            showPaymentSuccess = true
            isProcessing = false

        } catch {
            errorMessage = error.localizedDescription
            showPaymentFailed = true
            isProcessing = false
        }
    }

    private func processCardPayment(amount: Double, orderId: String) async throws {
        // Validate card details
        guard isCardValid || selectedSavedCardIndex != nil else {
            throw PaymentError.invalidCardDetails
        }

        // In production: integrate with payment gateway
        // For now, simulate success
        print("Processing card payment of ₹\(amount) for order \(orderId)")

        if saveCard && selectedSavedCardIndex == nil {
            // Save card (in production, save securely)
            let newCard = SavedCard(
                id: UUID().uuidString,
                last4Digits: String(cardNumber.suffix(4)),
                expiryMonth: String(expiryDate.prefix(2)),
                expiryYear: String(expiryDate.suffix(2)),
                cardHolderName: cardHolderName
            )
            savedCards.append(newCard)
        }
    }

    private func processCashPayment(amount: Double, orderId: String) async throws {
        // Cash on delivery doesn't need validation
        print("Cash on delivery payment of ₹\(amount) for order \(orderId)")
    }

    private func processUPIPayment(amount: Double, orderId: String) async throws {
        guard isUpiValid else {
            throw PaymentError.invalidUpiId
        }

        // In production: integrate with UPI payment gateway
        print("Processing UPI payment of ₹\(amount) to \(upiId) for order \(orderId)")
    }

    // MARK: - Reset

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
    }
}

// MARK: - Payment Error

enum PaymentError: LocalizedError {
    case invalidCardDetails
    case invalidUpiId
    case paymentDeclined
    case networkError

    var errorDescription: String? {
        switch self {
        case .invalidCardDetails:
            return "Invalid card details. Please check and try again."
        case .invalidUpiId:
            return "Invalid UPI ID. Please enter a valid UPI ID."
        case .paymentDeclined:
            return "Payment was declined. Please try a different payment method."
        case .networkError:
            return "Network error. Please check your connection and try again."
        }
    }
}
