import Foundation
import Combine

/// Customer coupon view model for browsing and applying coupons
@MainActor
class CustomerCouponViewModel: ObservableObject {
    @Published var availableCoupons: [Coupon] = []
    @Published var searchResults: [Coupon] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var searchQuery = ""
    @Published var showActiveOnly = true
    
    private let apiClient = APIClient.shared
    
    // MARK: - Data Loading
    
    func loadAvailableCoupons(businessId: String) async {
        isLoading = true
        errorMessage = nil
        
        do {
            let response: CouponListResponse = try await apiClient.request(
                endpoint: AppConstants.API.Endpoints.coupons + "?business_id=\(businessId)",
                method: .get
            )
            
            availableCoupons = response.data.coupons.filter { $0.isActive && !$0.isExpired }
            searchResults = availableCoupons
            
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    // MARK: - Coupon Validation
    
    func validateCoupon(code: String, businessId: String) async -> Coupon? {
        isLoading = true
        errorMessage = nil
        
        do {
            let response: CouponResponse = try await apiClient.request(
                endpoint: AppConstants.API.Endpoints.coupons + "/validate/\(code)?business_id=\(businessId)",
                method: .get
            )
            
            let coupon = response.data.coupon
            
            // Additional validation
            guard coupon.isActive else {
                errorMessage = "This coupon is not active"
                isLoading = false
                return nil
            }
            
            guard !coupon.isExpired else {
                errorMessage = "This coupon has expired"
                isLoading = false
                return nil
            }
            
            isLoading = false
            return coupon
            
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
            return nil
        }
    }
    
    // MARK: - Search & Filter
    
    func searchCoupons(query: String) {
        searchQuery = query
        
        if query.isEmpty {
            searchResults = filterByActive(availableCoupons)
        } else {
            let filtered = availableCoupons.filter { coupon in
                coupon.code.localizedCaseInsensitiveContains(query)
            }
            searchResults = filterByActive(filtered)
        }
    }
    
    func filterCoupons(activeOnly: Bool) {
        showActiveOnly = activeOnly
        searchCoupons(query: searchQuery)
    }
    
    private func filterByActive(_ coupons: [Coupon]) -> [Coupon] {
        if showActiveOnly {
            return coupons.filter { $0.isActive && !$0.isExpired }
        } else {
            return coupons
        }
    }
    
    // MARK: - Error Handling
    
    func clearError() {
        errorMessage = nil
    }
}
