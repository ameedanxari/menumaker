import Foundation
import Testing
@testable import MenuMaker

@MainActor
struct PaymentViewModelTests {
    @Test("Payment view model starts without fake saved cards")
    func startsWithoutFixturePaymentMethods() {
        let viewModel = CustomerPaymentViewModel()

        #expect(viewModel.savedCards.isEmpty)
        #expect(viewModel.tokenizedPaymentMethods.isEmpty)
        #expect(!viewModel.isPayButtonEnabled)
    }

    @Test("Raw PAN and CVV are never retained or sufficient for payment")
    func rawCardDataIsNotRetainedOrAccepted() {
        let viewModel = CustomerPaymentViewModel()

        viewModel.updateCardNumber("4242 4242 4242 4242")
        viewModel.updateCvv("123")

        #expect(viewModel.cardNumber == "•••• 4242")
        #expect(!viewModel.cardNumber.contains("4242 4242 4242"))
        #expect(viewModel.cvv.isEmpty)
        #expect(viewModel.cardValidationError != nil)
        #expect(!viewModel.isPayButtonEnabled)
    }

    @Test("Tokenized card authorizes and calls success")
    func tokenizedCardAuthorizesPayment() async {
        let viewModel = CustomerPaymentViewModel()
        viewModel.replaceTokenizedPaymentMethodsForTesting([Self.cardToken()])
        viewModel.selectSavedCard(at: 0)

        var completedOrderId: String?
        await viewModel.processPayment(amount: 42.50) { orderId in
            completedOrderId = orderId
        }

        #expect(viewModel.paymentIntentStatus == .authorized)
        #expect(viewModel.showPaymentSuccess)
        #expect(completedOrderId?.hasPrefix("PAY-") == true)
    }

    @Test("Expired tokenized card fails closed")
    func expiredCardFailsClosed() async {
        let viewModel = CustomerPaymentViewModel()
        viewModel.replaceTokenizedPaymentMethodsForTesting([Self.cardToken(expiryYear: 2000)])
        viewModel.selectSavedCard(at: 0)

        await viewModel.processPayment(amount: 12) { _ in
            Issue.record("Expired cards must not complete payment")
        }

        #expect(viewModel.showPaymentFailed)
        #expect(viewModel.paymentIntentStatus == .failed("Selected payment method is expired."))
        #expect(viewModel.errorMessage == "Selected payment method is expired.")
    }

    @Test("Pending provider verification is non-terminal")
    func pendingProviderVerificationDoesNotCallSuccess() async {
        let viewModel = CustomerPaymentViewModel()
        viewModel.replaceTokenizedPaymentMethodsForTesting([Self.cardToken(requiresVerification: true)])
        viewModel.selectSavedCard(at: 0)

        var didComplete = false
        await viewModel.processPayment(amount: 18) { _ in
            didComplete = true
        }

        #expect(viewModel.paymentIntentStatus == .pendingVerification)
        #expect(!viewModel.showPaymentSuccess)
        #expect(!viewModel.showPaymentFailed)
        #expect(!didComplete)
    }

    @Test("Tokenized UPI and cash paths are explicit")
    func tokenizedUPIAndCashPathsAuthorize() async {
        let upiViewModel = CustomerPaymentViewModel()
        upiViewModel.replaceTokenizedPaymentMethodsForTesting([
            Self.cardToken(),
            TokenizedPaymentMethod(
                id: "upi-1",
                type: .upi,
                provider: "Razorpay",
                tokenReference: "tok_upi_123",
                brand: nil,
                last4: nil,
                expiryMonth: nil,
                expiryYear: nil,
                billingName: "customer@upi",
                requiresVerification: false
            )
        ])
        upiViewModel.selectSavedCard(at: 1)

        var upiOrderId: String?
        await upiViewModel.processPayment(amount: 25) { orderId in
            upiOrderId = orderId
        }

        #expect(upiViewModel.selectedPaymentMethod == .upi)
        #expect(upiViewModel.paymentIntentStatus == .authorized)
        #expect(upiOrderId?.hasPrefix("PAY-") == true)

        let cashViewModel = CustomerPaymentViewModel()
        cashViewModel.selectedPaymentMethod = .cash
        var cashOrderId: String?
        await cashViewModel.processPayment(amount: 25) { orderId in
            cashOrderId = orderId
        }

        #expect(cashViewModel.paymentIntentStatus == .authorized)
        #expect(cashOrderId?.hasPrefix("PAY-") == true)
    }

    private static func cardToken(
        expiryMonth: Int = 12,
        expiryYear: Int = 2099,
        requiresVerification: Bool = false
    ) -> TokenizedPaymentMethod {
        TokenizedPaymentMethod(
            id: "card-1",
            type: .card,
            provider: "Stripe",
            tokenReference: "tok_card_123",
            brand: "Visa",
            last4: "4242",
            expiryMonth: expiryMonth,
            expiryYear: expiryYear,
            billingName: "Test Customer",
            requiresVerification: requiresVerification
        )
    }
}
