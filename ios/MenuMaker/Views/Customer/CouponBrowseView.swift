import SwiftUI

struct CouponBrowseView: View {
    let businessId: String
    let onApply: (Coupon) -> Void
    
    @StateObject private var viewModel = CustomerCouponViewModel()
    @Environment(\.dismiss) var dismiss
    @State private var selectedCoupon: Coupon?
    @State private var showCouponDetail = false
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Search Bar
                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(.gray)
                    TextField("Search coupons...", text: $viewModel.searchQuery)
                        .textFieldStyle(.plain)
                        .onChange(of: viewModel.searchQuery) { newValue in
                            viewModel.searchCoupons(query: newValue)
                        }
                        .accessibilityIdentifier("search-coupon-field")
                    
                    if !viewModel.searchQuery.isEmpty {
                        Button(action: {
                            viewModel.searchQuery = ""
                            viewModel.searchCoupons(query: "")
                        }) {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundColor(.gray)
                        }
                    }
                }
                .padding()
                .background(Color.theme.surface)
                
                // Filter Buttons
                HStack(spacing: 12) {
                    FilterButton(
                        title: "Active",
                        isSelected: viewModel.showActiveOnly,
                        action: { viewModel.filterCoupons(activeOnly: true) }
                    )
                    
                    FilterButton(
                        title: "All",
                        isSelected: !viewModel.showActiveOnly,
                        action: { viewModel.filterCoupons(activeOnly: false) }
                    )
                    
                    Spacer()
                }
                .padding(.horizontal)
                .padding(.vertical, 8)
                .accessibilityIdentifier("filter-buttons")
                
                // Coupon List
                if viewModel.isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if viewModel.searchResults.isEmpty {
                    EmptyState(
                        icon: "ticket",
                        title: "No Coupons Found",
                        message: viewModel.searchQuery.isEmpty ? "No available coupons" : "Try a different search"
                    )
                } else {
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            ForEach(Array(viewModel.searchResults.enumerated()), id: \.element.id) { index, coupon in
                                CouponBrowseCard(coupon: coupon)
                                    .accessibilityIdentifier("AvailableCoupon")
                                    .onTapGesture {
                                        selectedCoupon = coupon
                                        showCouponDetail = true
                                    }
                                    .contextMenu {
                                        Button(action: {
                                            onApply(coupon)
                                            dismiss()
                                        }) {
                                            Label("Apply Coupon", systemImage: "checkmark.circle")
                                        }
                                    }
                            }
                        }
                        .padding()
                    }
                }
            }
            .navigationTitle("Available Coupons")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .sheet(isPresented: $showCouponDetail) {
                if let coupon = selectedCoupon {
                    CouponDetailView(coupon: coupon) {
                        onApply(coupon)
                        showCouponDetail = false
                        dismiss()
                    }
                }
            }
        }
        .task {
            await viewModel.loadAvailableCoupons(businessId: businessId)
        }
        .onAppear {
            if ProcessInfo.processInfo.arguments.contains("UI-Testing") && viewModel.availableCoupons.isEmpty {
                let seeded = CouponRepository.shared.loadFixtureCoupons() ?? APIClient.mockCoupons
                viewModel.availableCoupons = seeded.filter { $0.isActive && !$0.isExpired }
                viewModel.searchResults = viewModel.availableCoupons
            }
        }
    }
}

struct CouponBrowseCard: View {
    let coupon: Coupon
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Coupon Code
            HStack {
                Text(coupon.code)
                    .font(.title3)
                    .fontWeight(.bold)
                    .foregroundColor(.theme.primary)
                
                Spacer()
                
                if !coupon.isActive {
                    Text("Inactive")
                        .font(.caption)
                        .foregroundColor(.red)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.red.opacity(0.1))
                        .cornerRadius(4)
                } else if coupon.isExpired {
                    Text("Expired")
                        .font(.caption)
                        .foregroundColor(.orange)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.orange.opacity(0.1))
                        .cornerRadius(4)
                }
            }
            
            // Discount
            Text(coupon.formattedDiscount)
                .font(.headline)
                .foregroundColor(.theme.text)
            
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

struct FilterButton: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline)
                .fontWeight( isSelected ? .semibold : .regular)
                .foregroundColor(isSelected ? .white : .theme.text)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(isSelected ? Color.theme.primary : Color.theme.surface)
                .cornerRadius(8)
        }
    }
}

#Preview {
    CouponBrowseView(businessId: "business1") { coupon in
        print("Applied: \(coupon.code)")
    }
}
