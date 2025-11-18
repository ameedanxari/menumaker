import SwiftUI

// MARK: - Payment View

struct PaymentView: View {
    @StateObject private var viewModel = CustomerPaymentViewModel()
    @Environment(\.dismiss) var dismiss
    let orderTotal: Double
    let onPaymentSuccess: (String) -> Void  // Pass order ID

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Order Total Section
                OrderTotalSection(total: orderTotal)

                // Secure Payment Badge
                SecurePaymentBadge()

                // Payment Method Selection
                PaymentMethodSelectionView(selectedMethod: $viewModel.selectedPaymentMethod)

                // Payment Method Forms
                if viewModel.selectedPaymentMethod == .card {
                    CardPaymentForm(viewModel: viewModel)
                } else if viewModel.selectedPaymentMethod == .upi {
                    UPIPaymentForm(viewModel: viewModel)
                }

                // Pay Button
                PayButton(
                    viewModel: viewModel,
                    orderTotal: orderTotal,
                    onSuccess: onPaymentSuccess
                )

                // Cancel Button
                Button("Cancel") {
                    dismiss()
                }
                .foregroundColor(.theme.textSecondary)
                .accessibility(label: Text("Cancel"))
            }
            .padding()
        }
        .background(Color.theme.background)
        .navigationTitle("Payment")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Payment Failed", isPresented: $viewModel.showPaymentFailed) {
            Button("Retry", role: .cancel) {
                viewModel.showPaymentFailed = false
            }
            .accessibility(label: Text("Retry"))
        } message: {
            Text(viewModel.errorMessage ?? "Payment could not be processed. Please try again.")
        }
        .alert("Payment Successful", isPresented: $viewModel.showPaymentSuccess) {
            Button("OK") {
                if let orderId = viewModel.completedOrderId {
                    onPaymentSuccess(orderId)
                }
                dismiss()
            }
        } message: {
            Text("Your order has been placed successfully!")
        }
        .overlay(
            Group {
                if viewModel.isProcessing {
                    ZStack {
                        Color.black.opacity(0.3)
                            .edgesIgnoringSafeArea(.all)

                        ProgressView("Processing Payment...")
                            .padding()
                            .background(Color.theme.surface)
                            .cornerRadius(12)
                    }
                }
            }
        )
    }
}

// MARK: - Order Total Section

struct OrderTotalSection: View {
    let total: Double

    var body: some View {
        VStack(spacing: 8) {
            HStack {
                Text("Order Total")
                    .font(.headline)
                Spacer()
                Text("₹\(String(format: "%.2f", total))")
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundColor(.theme.primary)
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(AppConstants.UI.cornerRadius)
    }
}

// MARK: - Secure Payment Badge

struct SecurePaymentBadge: View {
    var body: some View {
        HStack {
            Image(systemName: "lock.shield.fill")
                .foregroundColor(.green)
            Text("Secure Payment")
                .font(.caption)
                .fontWeight(.medium)
        }
        .foregroundColor(.green)
    }
}

// MARK: - Payment Method Selection

enum PaymentMethodType: String, CaseIterable {
    case card = "Card"
    case cash = "Cash on Delivery"
    case upi = "UPI"

    var icon: String {
        switch self {
        case .card: return "creditcard"
        case .cash: return "banknote"
        case .upi: return "qrcode"
        }
    }
}

struct PaymentMethodSelectionView: View {
    @Binding var selectedMethod: PaymentMethodType

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Select Payment Method")
                .font(.headline)

            ForEach(PaymentMethodType.allCases, id: \.self) { method in
                PaymentMethodButton(
                    method: method,
                    isSelected: selectedMethod == method
                ) {
                    selectedMethod = method
                }
            }
        }
    }
}

struct PaymentMethodButton: View {
    let method: PaymentMethodType
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                Image(systemName: method.icon)
                    .font(.title3)
                    .frame(width: 30)

                Text(method.rawValue)
                    .font(.subheadline)
                    .fontWeight(.medium)

                Spacer()

                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.theme.primary)
                }
            }
            .padding()
            .background(isSelected ? Color.theme.primary.opacity(0.1) : Color.theme.surface)
            .cornerRadius(AppConstants.UI.cornerRadius)
            .overlay(
                RoundedRectangle(cornerRadius: AppConstants.UI.cornerRadius)
                    .stroke(isSelected ? Color.theme.primary : Color.clear, lineWidth: 2)
            )
        }
        .foregroundColor(.primary)
        .accessibility(label: Text(method.rawValue))
    }
}

// MARK: - Card Payment Form

struct CardPaymentForm: View {
    @ObservedObject var viewModel: CustomerPaymentViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Card Details")
                .font(.headline)

            // Saved Cards Section
            if !viewModel.savedCards.isEmpty {
                Text("Saved Cards")
                    .font(.subheadline)
                    .foregroundColor(.theme.textSecondary)

                ForEach(viewModel.savedCards.indices, id: \.self) { index in
                    SavedCardRow(
                        card: viewModel.savedCards[index],
                        isSelected: viewModel.selectedSavedCardIndex == index
                    ) {
                        viewModel.selectSavedCard(at: index)
                    }
                    .accessibilityIdentifier("SavedCard")
                }

                Button(action: { viewModel.showNewCardForm = true }) {
                    HStack {
                        Image(systemName: "plus.circle")
                        Text("Add New Card")
                    }
                }
                .foregroundColor(.theme.primary)
                .accessibility(label: Text("Add New Card"))

                if !viewModel.showNewCardForm {
                    return AnyView(EmptyView())
                }
            }

            // New Card Form
            VStack(spacing: 12) {
                TextField("Card Number", text: $viewModel.cardNumber)
                    .keyboardType(.numberPad)
                    .textContentType(.creditCardNumber)
                    .padding()
                    .background(Color.theme.surface)
                    .cornerRadius(8)
                    .accessibilityIdentifier("card-number-field")

                TextField("Cardholder Name", text: $viewModel.cardHolderName)
                    .textContentType(.name)
                    .autocapitalization(.words)
                    .padding()
                    .background(Color.theme.surface)
                    .cornerRadius(8)
                    .accessibilityIdentifier("cardholder-field")

                HStack(spacing: 12) {
                    TextField("MM/YY", text: $viewModel.expiryDate)
                        .keyboardType(.numberPad)
                        .padding()
                        .background(Color.theme.surface)
                        .cornerRadius(8)
                        .accessibilityIdentifier("expiry-field")

                    TextField("CVV", text: $viewModel.cvv)
                        .keyboardType(.numberPad)
                        .textContentType(.creditCardNumber)
                        .padding()
                        .background(Color.theme.surface)
                        .cornerRadius(8)
                        .accessibilityIdentifier("cvv-field")
                }

                Toggle("Save card for future payments", isOn: $viewModel.saveCard)
                    .accessibilityIdentifier("saveCardToggle")
            }

            if let error = viewModel.cardValidationError {
                Text(error)
                    .font(.caption)
                    .foregroundColor(.theme.error)
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(AppConstants.UI.cornerRadius)
    }
}

struct SavedCardRow: View {
    let card: SavedCard
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                Image(systemName: "creditcard.fill")
                    .foregroundColor(.theme.primary)

                VStack(alignment: .leading, spacing: 4) {
                    Text("•••• \(card.last4Digits)")
                        .font(.subheadline)
                        .fontWeight(.medium)

                    Text("Expires \(card.expiryMonth)/\(card.expiryYear)")
                        .font(.caption)
                        .foregroundColor(.theme.textSecondary)
                }

                Spacer()

                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.theme.primary)
                }
            }
            .padding()
            .background(isSelected ? Color.theme.primary.opacity(0.1) : Color.theme.surface)
            .cornerRadius(8)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(isSelected ? Color.theme.primary : Color.clear, lineWidth: 2)
            )
        }
        .foregroundColor(.primary)
    }
}

// MARK: - UPI Payment Form

struct UPIPaymentForm: View {
    @ObservedObject var viewModel: CustomerPaymentViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("UPI Details")
                .font(.headline)

            TextField("UPI ID (e.g., user@upi)", text: $viewModel.upiId)
                .keyboardType(.emailAddress)
                .autocapitalization(.none)
                .padding()
                .background(Color.theme.surface)
                .cornerRadius(8)
                .accessibilityIdentifier("upi-id-field")

            if let error = viewModel.upiValidationError {
                Text(error)
                    .font(.caption)
                    .foregroundColor(.theme.error)
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(AppConstants.UI.cornerRadius)
    }
}

// MARK: - Pay Button

struct PayButton: View {
    @ObservedObject var viewModel: CustomerPaymentViewModel
    let orderTotal: Double
    let onSuccess: (String) -> Void

    var body: some View {
        Button(action: {
            Task {
                await viewModel.processPayment(amount: orderTotal, onSuccess: onSuccess)
            }
        }) {
            HStack {
                if viewModel.isProcessing {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                } else {
                    Text("Pay ₹\(String(format: "%.2f", orderTotal))")
                        .fontWeight(.semibold)
                }
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(viewModel.isPayButtonEnabled ? Color.theme.primary : Color.gray)
            .foregroundColor(.white)
            .cornerRadius(AppConstants.UI.cornerRadius)
        }
        .disabled(!viewModel.isPayButtonEnabled || viewModel.isProcessing)
        .accessibility(label: Text("Pay"))
    }
}

// MARK: - Models

struct SavedCard: Identifiable {
    let id: String
    let last4Digits: String
    let expiryMonth: String
    let expiryYear: String
    let cardHolderName: String
}

#Preview {
    NavigationView {
        PaymentView(orderTotal: 500.00) { orderId in
            print("Payment successful for order: \(orderId)")
        }
    }
}
