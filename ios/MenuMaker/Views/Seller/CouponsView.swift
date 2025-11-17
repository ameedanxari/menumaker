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

            // Coupons List
            if viewModel.isLoading {
                ProgressView()
                    .padding()
            } else if displayedCoupons.isEmpty {
                EmptyState(
                    icon: "ticket",
                    title: "No Coupons",
                    message: showActive ? "Create your first coupon" : "No expired coupons"
                )
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(displayedCoupons) { coupon in
                            CouponCard(coupon: coupon, viewModel: viewModel)
                        }
                    }
                    .padding()
                }
            }
        }
        .background(Color.theme.background)
        .navigationTitle("Coupons")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: { showAddCoupon = true }) {
                    Image(systemName: "plus.circle.fill")
                }
            }
        }
        .sheet(isPresented: $showAddCoupon) {
            AddCouponView(viewModel: viewModel)
        }
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
    @State private var validUntil: Date? = nil

    var body: some View {
        NavigationView {
            Form {
                Section("Coupon Details") {
                    TextField("Code (e.g., SAVE20)", text: $code)
                        .textCase(.uppercase)

                    Picker("Discount Type", selection: $discountType) {
                        ForEach(DiscountType.allCases, id: \.self) { type in
                            Text(type.displayName).tag(type)
                        }
                    }

                    TextField("Discount Value", text: $discountValue)
                        .keyboardType(.numberPad)

                    TextField("Minimum Order Value", text: $minOrderValue)
                        .keyboardType(.decimalPad)
                }

                Section("Validity") {
                    DatePicker("Valid Until (Optional)", selection: Binding(
                        get: { validUntil ?? Date() },
                        set: { validUntil = $0 }
                    ), displayedComponents: .date)
                }
            }
            .navigationTitle("Create Coupon")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") { dismiss() }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Create") {
                        Task {
                            await createCoupon()
                        }
                    }
                    .disabled(!isFormValid)
                }
            }
        }
    }

    private var isFormValid: Bool {
        !code.isEmpty && !discountValue.isEmpty && !minOrderValue.isEmpty
    }

    private func createCoupon() async {
        guard let discount = Int(discountValue),
              let minOrder = Double(minOrderValue) else { return }

        await viewModel.createCoupon(CouponViewModel.CreateCouponParams(
            code: code,
            discountType: discountType,
            discountValue: discount,
            maxDiscount: nil,
            minOrderValue: minOrder,
            validUntil: validUntil,
            usageLimitType: .unlimited,
            totalUsageLimit: nil
        ))

        dismiss()
    }
}

#Preview {
    NavigationView {
        CouponsView()
    }
}
