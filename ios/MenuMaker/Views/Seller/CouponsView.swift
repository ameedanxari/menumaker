import SwiftUI

struct CouponsView: View {
    @StateObject private var viewModel = CouponViewModel()
    @State private var showAddCoupon = false
    @State private var showActive = true

    var body: some View {
        VStack(spacing: 0) {
            // Filter Toggle
            Picker("Filter", selection: $showActive) {
                Text("Active").tag(true)
                Text("Expired").tag(false)
            }
            .pickerStyle(.segmented)
            .padding()
            .accessibilityIdentifier("coupon-filter")

            // Coupons List
            if displayedCoupons.isEmpty && !viewModel.isLoading {
                EmptyState(
                    icon: "ticket",
                    title: "No Coupons",
                    message: showActive ? "Create your first coupon" : "No expired coupons"
                )
                .accessibilityIdentifier("empty-coupons-state")
            } else {
                ScrollView {
                    VStack(spacing: 12) {
                        ForEach(displayedCoupons) { coupon in
                            CouponCard(coupon: coupon, viewModel: viewModel)
                                .accessibilityIdentifier("CouponItem")
                        }
                    }
                    .padding()
                }
                .accessibilityIdentifier("coupons-list")
            }
        }
        .background(Color.theme.background)
        .navigationTitle("Coupons")
        .accessibilityIdentifier("coupons-screen")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: { showAddCoupon = true }) {
                    Image(systemName: "plus.circle.fill")
                }
                .accessibilityLabel("Create Coupon")
                .accessibilityIdentifier("add-coupon-button")
            }
        }
        .sheet(isPresented: $showAddCoupon) {
            AddCouponView(viewModel: viewModel)
        }
        .overlay(
            Group {
                if viewModel.isLoading {
                    ProgressView()
                        .padding()
                        .background(Color.theme.background.opacity(0.8))
                        .accessibilityIdentifier("loading-indicator")
                }
            }
        )
        .refreshable {
            await viewModel.refreshCoupons()
        }
    }

    private var displayedCoupons: [Coupon] {
        showActive ? viewModel.activeCoupons : viewModel.expiredCoupons
    }
}

struct CouponCard: View {
    let coupon: Coupon
    @ObservedObject var viewModel: CouponViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Code
            HStack {
                Text(coupon.code)
                    .font(.title3)
                    .fontWeight(.bold)
                    .foregroundColor(.theme.primary)
                    .accessibilityIdentifier(coupon.code)

                Spacer()

                Toggle("", isOn: Binding(
                    get: { coupon.isActive },
                    set: { _ in
                        Task {
                            await viewModel.toggleCouponStatus(coupon.id)
                        }
                    }
                ))
                .labelsHidden()
                .accessibilityIdentifier("coupon-active-toggle")
            }

            // Discount
            Text(coupon.formattedDiscount)
                .font(.headline)

            // Details
            VStack(alignment: .leading, spacing: 4) {
                DetailRow(label: "Min. Order", value: coupon.formattedMinOrder)

                if let maxDiscount = coupon.formattedMaxDiscount {
                    DetailRow(label: "Max. Discount", value: maxDiscount)
                }

                if let validUntil = coupon.formattedValidUntil {
                    DetailRow(label: "Valid Until", value: validUntil)
                }
            }
            .font(.caption)
            .foregroundColor(.theme.textSecondary)
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(AppConstants.UI.cornerRadius)
        .accessibilityIdentifier("CouponItem")
    }
}

struct DetailRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
            Spacer()
            Text(value)
                .fontWeight(.medium)
        }
    }
}

struct AddCouponView: View {
    @ObservedObject var viewModel: CouponViewModel
    @Environment(\.dismiss) var dismiss
    @State private var code = ""
    @State private var discountType: DiscountType = .percentage
    @State private var discountValue = ""
    @State private var minOrderValue = ""
    @State private var maxDiscount = ""
    @State private var usageLimit = ""
    @State private var validUntil: Date? = nil

    var body: some View {
        NavigationView {
            Form {
                Section("Coupon Details") {
                    TextField("Coupon Code (e.g., SAVE20)", text: $code)
                        .textCase(.uppercase)
                        .accessibilityIdentifier("coupon-code-field")

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Discount Type")
                            .font(.subheadline)
                            .foregroundColor(.secondary)

                        HStack(spacing: 12) {
                            Button(action: { discountType = .percentage }) {
                                HStack {
                                    Image(systemName: discountType == .percentage ? "checkmark.circle.fill" : "circle")
                                    Text("Percentage (%)")
                                }
                                .foregroundColor(discountType == .percentage ? .theme.primary : .theme.text)
                            }
                            .accessibilityIdentifier("percentage-button")

                            Button(action: { discountType = .fixed }) {
                                HStack {
                                    Image(systemName: discountType == .fixed ? "checkmark.circle.fill" : "circle")
                                    Text("Fixed Amount (₹)")
                                }
                                .foregroundColor(discountType == .fixed ? .theme.primary : .theme.text)
                            }
                            .accessibilityIdentifier("fixed-amount-button")
                        }
                    }
                    .padding(.vertical, 4)

                    TextField("Discount Value", text: $discountValue)
                        .keyboardType(.numberPad)
                        .accessibilityIdentifier("discount-value-field")

                    TextField("Minimum Order Value", text: $minOrderValue)
                        .keyboardType(.decimalPad)
                        .accessibilityIdentifier("min-order-field")
                }

                Section("Optional Settings") {
                    TextField("Max Discount Amount (Optional)", text: $maxDiscount)
                        .keyboardType(.decimalPad)
                        .accessibilityIdentifier("max-discount-field")

                    TextField("Usage Limit (Optional)", text: $usageLimit)
                        .keyboardType(.numberPad)
                        .accessibilityIdentifier("usage-limit-field")
                }

                Section("Validity") {
                    DatePicker("Valid Until (Optional)", selection: Binding(
                        get: { validUntil ?? Date() },
                        set: { validUntil = $0 }
                    ), displayedComponents: .date)
                    .accessibilityIdentifier("valid-until-picker")
                }
            }
            .navigationTitle("Create Coupon")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") { dismiss() }
                        .accessibilityIdentifier("cancel-button")
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Create") {
                        Task {
                            await createCoupon()
                        }
                    }
                    .disabled(!isFormValid)
                    .accessibilityIdentifier("save-coupon-button")
                }

                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Done") {
                        hideKeyboard()
                    }
                }
            }
        }
    }

    private var isFormValid: Bool {
        !code.isEmpty && !discountValue.isEmpty && !minOrderValue.isEmpty
    }

    private func hideKeyboard() {
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder),
                                       to: nil, from: nil, for: nil)
    }

    private func createCoupon() async {
        guard let discount = Int(discountValue),
              let minOrder = Double(minOrderValue) else { return }

        let maxDiscountValue = maxDiscount.isEmpty ? nil : Double(maxDiscount)
        let usageLimitValue = usageLimit.isEmpty ? nil : Int(usageLimit)
        let usageLimitType: UsageLimitType = usageLimitValue != nil ? .total : .unlimited

        await viewModel.createCoupon(CouponViewModel.CreateCouponParams(
            code: code,
            discountType: discountType,
            discountValue: discount,
            maxDiscount: maxDiscountValue,
            minOrderValue: minOrder,
            validUntil: validUntil,
            usageLimitType: usageLimitType,
            totalUsageLimit: usageLimitValue
        ))

        dismiss()
    }
}

#Preview {
    NavigationView {
        CouponsView()
    }
}
