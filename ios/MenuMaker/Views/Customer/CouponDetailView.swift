import SwiftUI

struct CouponDetailView: View {
    let coupon: Coupon
    let onApply: () -> Void
    
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    // Coupon Code Header
                    VStack(spacing: 8) {
                        Text(coupon.code)
                            .font(.system(size: 32, weight: .bold))
                            .foregroundColor(.theme.primary)
                        
                        Text(coupon.formattedDiscount)
                            .font(.title2)
                            .foregroundColor(.theme.text)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 24)
                    .background(Color.theme.surface)
                    .cornerRadius(AppConstants.UI.cornerRadius)
                    
                    // Details Section
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Details")
                            .font(.headline)
                            .foregroundColor(.theme.text)
                        
                        DetailRow(label: "Discount Type", value: coupon.discountTypeEnum.displayName)
                        
                        if coupon.discountTypeEnum == .percentage {
                            DetailRow(label: "Discount", value: "\(coupon.discountValue)%")
                        } else {
                            DetailRow(label: "Discount", value: "₹\(coupon.discountValue)")
                        }
                        
                        DetailRow(label: "Minimum Order", value: coupon.formattedMinOrder)
                        
                        if let maxDiscount = coupon.formattedMaxDiscount {
                            DetailRow(label: "Maximum Discount", value: maxDiscount)
                        }
                        
                        if let validUntil = coupon.formattedValidUntil {
                            DetailRow(label: "Valid Until", value: validUntil)
                        } else {
                            DetailRow(label: "Validity", value: "No expiry date")
                        }
                        
                        DetailRow(
                            label: "Usage Limit",
                            value: usageLimitText
                        )
                    }
                    .padding()
                    .background(Color.theme.surface)
                    .cornerRadius(AppConstants.UI.cornerRadius)
                    
                    // Terms Section
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Terms & Conditions")
                            .font(.headline)
                            .foregroundColor(.theme.text)
                        
                        VStack(alignment: .leading, spacing: 8) {
                            TermsRow(text: "Applicable on minimum order of \(coupon.formattedMinOrder)")
                            
                            if coupon.discountTypeEnum == .percentage, let maxDiscount = coupon.formattedMaxDiscount {
                                TermsRow(text: "Maximum discount capped at \(maxDiscount)")
                            }
                            
                            if !coupon.isActive {
                                TermsRow(text: "This coupon is currently inactive", isWarning: true)
                            }
                            
                            if coupon.isExpired {
                                TermsRow(text: "This coupon has expired", isWarning: true)
                            } else if let validUntil = coupon.formattedValidUntil {
                                TermsRow(text: "Valid until \(validUntil)")
                            }
                        }
                    }
                    .padding()
                    .background(Color.theme.surface)
                    .cornerRadius(AppConstants.UI.cornerRadius)
                    
                    Spacer()
                }
                .padding()
            }
            .background(Color.theme.background)
            .navigationTitle("Coupon Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Close") {
                        dismiss()
                    }
                }
            }
            .safeAreaInset(edge: .bottom) {
                Button(action: {
                    onApply()
                }) {
                    Text("Apply Coupon")
                        .font(.headline)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(canApply ? Color.theme.primary : Color.gray)
                        .cornerRadius(AppConstants.UI.cornerRadius)
                }
                .disabled(!canApply)
                .padding()
                .background(Color.theme.background)
            }
        }
        .accessibilityIdentifier("coupon-detail-view")
    }
    
    private var canApply: Bool {
        coupon.isActive && !coupon.isExpired
    }
    
    private var usageLimitText: String {
        switch coupon.usageLimitType {
        case "unlimited":
            return "Unlimited"
        case "total":
            if let limit = coupon.totalUsageLimit {
                return "\(limit) total uses"
            }
            return "Limited"
        case "per_user":
            if let limit = coupon.totalUsageLimit {
                return "\(limit) per user"
            }
            return "Limited per user"
        default:
            return "Limited"
        }
    }
}

struct TermsRow: View {
    let text: String
    var isWarning: Bool = false
    
    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: isWarning ? "exclamationmark.triangle.fill" : "checkmark.circle.fill")
                .foregroundColor(isWarning ? .orange : .green)
                .font(.caption)
            
            Text(text)
                .font(.caption)
                .foregroundColor(.theme.textSecondary)
        }
    }
}

#Preview {
    CouponDetailView(
        coupon: Coupon(
            id: "1",
            businessId: "biz1",
            code: "SAVE20",
            discountType: "percentage",
            discountValue: 20,
            maxDiscountCents: 50000,
            minOrderValueCents: 50000,
            validUntil: nil,
            usageLimitType: "unlimited",
            totalUsageLimit: nil,
            isActive: true,
            createdAt: ISO8601DateFormatter().string(from: Date())
        )
    ) {
        print("Applied")
    }
}
