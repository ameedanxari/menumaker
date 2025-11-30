import SwiftUI

struct CartView: View {
    @EnvironmentObject private var viewModel: CartViewModel
    @State private var showCheckout = false
    @State private var couponCode = ""
    @State private var showCouponBrowse = false

    var body: some View {
        VStack(spacing: 0) {
            if viewModel.isEmpty() {
                EmptyState(
                    icon: "cart",
                    title: "Empty Cart",
                    message: "Add items to your cart to get started"
                )
                .accessibilityIdentifier("empty-cart-state")
            } else {
                // Cart Items
                ScrollView {
                    VStack(spacing: 16) {
                        // Items List
                        ForEach(viewModel.cart?.items ?? []) { item in
                            CartItemRow(item: item, viewModel: viewModel)
                                .accessibilityIdentifier("CartItem")
                        }

                        // Coupon Section
                        CouponSection(
                            couponCode: $couponCode,
                            appliedCoupon: viewModel.appliedCoupon,
                            businessId: viewModel.cart?.businessId ?? "",
                            onApply: { await viewModel.applyCoupon(couponCode) },
                            onRemove: { viewModel.removeCoupon() },
                            onBrowse: { showCouponBrowse = true }
                        )
                        .accessibilityIdentifier("coupon-section")

                        // Summary
                        CartSummary(viewModel: viewModel)
                            .accessibilityIdentifier("cart-summary")
                    }
                    .padding()
                }
                .accessibilityIdentifier("cart-items-list")

                // Checkout Button
                Button(action: { showCheckout = true }) {
                    Text("Proceed to Checkout")
                        .fontWeight(.semibold)
                }
                .buttonStyle(PrimaryButtonStyle())
                .padding()
                .accessibilityIdentifier("checkout-button")
            }
        }
        .background(Color.theme.background)
        .navigationTitle("Cart (\(viewModel.getItemCount()))")
        .accessibilityIdentifier("cart-screen")
        .sheet(isPresented: $showCheckout) {
            CheckoutView(viewModel: viewModel)
        }
        .sheet(isPresented: $showCouponBrowse) {
            if let businessId = viewModel.cart?.businessId {
                CouponBrowseView(businessId: businessId) { coupon in
                    couponCode = coupon.code
                    Task {
                        await viewModel.applyCoupon(coupon.code)
                    }
                }
            }
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
                    Text("-")
                        .font(.title3)
                        .fontWeight(.semibold)
                        .foregroundColor(.theme.primary)
                        .frame(width: 32, height: 32)
                }
                .accessibilityLabel("-")

                Text("\(item.quantity)")
                    .font(.headline)
                    .frame(minWidth: 30)

                Button(action: { viewModel.incrementQuantity(item.dishId) }) {
                    Text("+")
                        .font(.title3)
                        .fontWeight(.semibold)
                        .foregroundColor(.theme.primary)
                        .frame(width: 32, height: 32)
                }
                .accessibilityLabel("+")
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
    let businessId: String
    let onApply: () async -> Void
    let onRemove: () -> Void
    let onBrowse: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            if let coupon = appliedCoupon {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Coupon Applied: \(coupon.code)")
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .accessibilityIdentifier("applied-coupon-code")

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
                    .accessibilityIdentifier("remove-coupon-button")
                }
            } else {
                VStack(spacing: 12) {
                    HStack {
                        TextField("Enter Coupon Code", text: $couponCode)
                            .textCase(.uppercase)
                            .accessibilityIdentifier("coupon-field")

                        Button("Apply") {
                            Task {
                                await onApply()
                            }
                        }
                        .buttonStyle(.bordered)
                        .disabled(couponCode.isEmpty)
                        .accessibilityIdentifier("apply-coupon-button")
                    }
                    
                    Button(action: onBrowse) {
                        HStack {
                            Image(systemName: "ticket")
                            Text("View All Coupons")
                        }
                        .font(.subheadline)
                        .foregroundColor(.theme.primary)
                    }
                    .accessibilityIdentifier("view-all-coupons-button")
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
                        .accessibilityIdentifier("customer-name-field")
                    TextField("Phone", text: $customerPhone)
                        .keyboardType(.phonePad)
                        .accessibilityIdentifier("customer-phone-field")
                    TextField("Email", text: $customerEmail)
                        .keyboardType(.emailAddress)
                        .accessibilityIdentifier("customer-email-field")
                }

                Section("Order Summary") {
                    DetailRow(label: "Total", value: viewModel.getFormattedTotal())
                        .accessibilityIdentifier("checkout-total")
                }
            }
            .navigationTitle("Checkout")
            .navigationBarTitleDisplayMode(.inline)
            .accessibilityIdentifier("checkout-screen")
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") { dismiss() }
                        .accessibilityIdentifier("cancel-checkout-button")
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Place Order") {
                        Task {
                            await placeOrder()
                        }
                    }
                    .disabled(!isFormValid)
                    .accessibilityIdentifier("place-order-button")
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
