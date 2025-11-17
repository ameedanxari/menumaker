import SwiftUI

struct CartView: View {
    @StateObject private var viewModel = CartViewModel()
    @State private var showCheckout = false
    @State private var couponCode = ""

    var body: some View {
        VStack(spacing: 0) {
            if viewModel.isEmpty() {
                EmptyState(
                    icon: "cart",
                    title: "Empty Cart",
                    message: "Add items to your cart to get started"
                )
            } else {
                // Cart Items
                ScrollView {
                    VStack(spacing: 16) {
                        // Items List
                        ForEach(viewModel.cart?.items ?? []) { item in
                            CartItemRow(item: item, viewModel: viewModel)
                        }

                        // Coupon Section
                        CouponSection(
                            couponCode: $couponCode,
                            appliedCoupon: viewModel.appliedCoupon,
                            onApply: { await viewModel.applyCoupon(couponCode) },
                            onRemove: { viewModel.removeCoupon() }
                        )

                        // Summary
                        CartSummary(viewModel: viewModel)
                    }
                    .padding()
                }

                // Checkout Button
                Button(action: { showCheckout = true }) {
                    Text("Proceed to Checkout")
                        .fontWeight(.semibold)
                }
                .buttonStyle(PrimaryButtonStyle())
                .padding()
            }
        }
        .background(Color.theme.background)
        .navigationTitle("Cart (\(viewModel.getItemCount()))")
        .sheet(isPresented: $showCheckout) {
            CheckoutView(viewModel: viewModel)
        }
    }
}

struct CartItemRow: View {
    let item: CartItem
    @ObservedObject var viewModel: CartViewModel

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(item.dishName)
                    .font(.subheadline)
                    .fontWeight(.semibold)

                Text(item.formattedPrice)
                    .font(.caption)
                    .foregroundColor(.theme.textSecondary)
            }

            Spacer()

            // Quantity Controls
            HStack(spacing: 12) {
                Button(action: { viewModel.decrementQuantity(item.dishId) }) {
                    Image(systemName: "minus.circle.fill")
                        .font(.title3)
                        .foregroundColor(.theme.primary)
                }

                Text("\(item.quantity)")
                    .font(.headline)
                    .frame(minWidth: 30)

                Button(action: { viewModel.incrementQuantity(item.dishId) }) {
                    Image(systemName: "plus.circle.fill")
                        .font(.title3)
                        .foregroundColor(.theme.primary)
                }
            }

            // Total
            Text(item.formattedTotal)
                .font(.subheadline)
                .fontWeight(.semibold)
                .frame(minWidth: 60, alignment: .trailing)
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(AppConstants.UI.smallCornerRadius)
    }
}

struct CouponSection: View {
    @Binding var couponCode: String
    let appliedCoupon: Coupon?
    let onApply: () async -> Void
    let onRemove: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            if let coupon = appliedCoupon {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Coupon Applied: \(coupon.code)")
                            .font(.subheadline)
                            .fontWeight(.semibold)

                        Text(coupon.formattedDiscount)
                            .font(.caption)
                            .foregroundColor(.theme.textSecondary)
                    }

                    Spacer()

                    Button("Remove") {
                        onRemove()
                    }
                    .font(.caption)
                    .foregroundColor(.theme.error)
                }
            } else {
                HStack {
                    TextField("Enter Coupon Code", text: $couponCode)
                        .textCase(.uppercase)

                    Button("Apply") {
                        Task {
                            await onApply()
                        }
                    }
                    .buttonStyle(.bordered)
                    .disabled(couponCode.isEmpty)
                }
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(AppConstants.UI.cornerRadius)
    }
}

struct CartSummary: View {
    @ObservedObject var viewModel: CartViewModel

    var body: some View {
        VStack(spacing: 12) {
            DetailRow(label: "Subtotal", value: viewModel.getFormattedSubtotal())

            if viewModel.discount > 0 {
                DetailRow(label: "Discount", value: "-\(viewModel.getFormattedDiscount())")
                    .foregroundColor(.green)
            }

            Divider()

            HStack {
                Text("Total")
                    .font(.headline)

                Spacer()

                Text(viewModel.getFormattedTotal())
                    .font(.title3)
                    .fontWeight(.bold)
                    .foregroundColor(.theme.primary)
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(AppConstants.UI.cornerRadius)
    }
}

struct CheckoutView: View {
    @ObservedObject var viewModel: CartViewModel
    @Environment(\.dismiss) var dismiss
    @State private var customerName = ""
    @State private var customerPhone = ""
    @State private var customerEmail = ""

    var body: some View {
        NavigationView {
            Form {
                Section("Customer Information") {
                    TextField("Name", text: $customerName)
                    TextField("Phone", text: $customerPhone)
                        .keyboardType(.phonePad)
                    TextField("Email", text: $customerEmail)
                        .keyboardType(.emailAddress)
                }

                Section("Order Summary") {
                    DetailRow(label: "Total", value: viewModel.getFormattedTotal())
                }
            }
            .navigationTitle("Checkout")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") { dismiss() }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Place Order") {
                        Task {
                            await placeOrder()
                        }
                    }
                    .disabled(!isFormValid)
                }
            }
        }
    }

    private var isFormValid: Bool {
        !customerName.isEmpty && !customerPhone.isEmpty
    }

    private func placeOrder() async {
        let order = await viewModel.checkout(
            customerName: customerName,
            customerPhone: customerPhone,
            customerEmail: customerEmail.isEmpty ? nil : customerEmail
        )

        if order != nil {
            dismiss()
        }
    }
}

#Preview {
    NavigationView {
        CartView()
    }
}
