package com.menumaker.testutils

import com.menumaker.data.remote.api.ApiService
import com.menumaker.data.remote.models.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.ResponseBody.Companion.toResponseBody
import retrofit2.Response
import java.io.IOException

/**
 * Fake implementation of ApiService for unit testing.
 * Provides configurable responses for all API endpoints to ensure deterministic test results.
 *
 * Requirements: 1.4 - Use mocked ApiService and DAO dependencies to ensure deterministic results
 * Requirements: 6.4 - Use mocked network responses to simulate connectivity states
 *
 * Usage:
 * ```
 * val fakeApiService = FakeApiService()
 * fakeApiService.loginResponse = Response.success(TestDataFactory.createAuthResponse())
 * // or simulate error
 * fakeApiService.shouldThrowException = IOException("Network error")
 * ```
 */
class FakeApiService : ApiService {

    // ==================== Error Simulation ====================
    
    /**
     * When set, all API calls will throw this exception.
     * Useful for testing error handling.
     */
    var shouldThrowException: Exception? = null

    /**
     * When set, all API calls will return this HTTP error code.
     */
    var errorCode: Int? = null
    var errorMessage: String = "Error"

    private fun <T> checkForError(): Response<T>? {
        shouldThrowException?.let { throw it }
        errorCode?.let { code ->
            return Response.error(
                code,
                errorMessage.toResponseBody("application/json".toMediaTypeOrNull())
            )
        }
        return null
    }

    // ==================== Auth Responses ====================

    var signupResponse: Response<AuthResponse>? = null
    var loginResponse: Response<AuthResponse>? = null
    var getCurrentUserResponse: Response<MeResponse>? = null
    var refreshTokenResponse: Response<AuthResponse>? = null
    var logoutResponse: Response<Unit>? = null
    var sendPasswordResetResponse: Response<Unit>? = null
    var changePasswordResponse: Response<Unit>? = null

    override suspend fun signup(request: SignupRequest): Response<AuthResponse> {
        checkForError<AuthResponse>()?.let { return it }
        return signupResponse ?: Response.success(TestDataFactory.createAuthResponse())
    }

    override suspend fun login(request: LoginRequest): Response<AuthResponse> {
        checkForError<AuthResponse>()?.let { return it }
        return loginResponse ?: Response.success(TestDataFactory.createAuthResponse())
    }

    override suspend fun getCurrentUser(): Response<MeResponse> {
        checkForError<MeResponse>()?.let { return it }
        return getCurrentUserResponse ?: Response.success(
            MeResponse(success = true, data = MeData(user = TestDataFactory.createUser()))
        )
    }

    override suspend fun refreshToken(request: RefreshTokenRequest): Response<AuthResponse> {
        checkForError<AuthResponse>()?.let { return it }
        return refreshTokenResponse ?: Response.success(TestDataFactory.createAuthResponse())
    }

    override suspend fun logout(): Response<Unit> {
        checkForError<Unit>()?.let { return it }
        return logoutResponse ?: Response.success(Unit)
    }

    override suspend fun sendPasswordReset(request: Map<String, String>): Response<Unit> {
        checkForError<Unit>()?.let { return it }
        return sendPasswordResetResponse ?: Response.success(Unit)
    }

    override suspend fun changePassword(request: Map<String, String>): Response<Unit> {
        checkForError<Unit>()?.let { return it }
        return changePasswordResponse ?: Response.success(Unit)
    }

    // ==================== Business Responses ====================

    var getBusinessesResponse: Response<BusinessListResponse>? = null
    var getBusinessByIdResponse: Response<BusinessResponse>? = null
    var createBusinessResponse: Response<BusinessResponse>? = null
    var updateBusinessResponse: Response<BusinessResponse>? = null
    var deleteBusinessResponse: Response<Unit>? = null

    override suspend fun getBusinesses(): Response<BusinessListResponse> {
        checkForError<BusinessListResponse>()?.let { return it }
        return getBusinessesResponse ?: Response.success(TestDataFactory.createBusinessListResponse())
    }

    override suspend fun getBusinessById(id: String): Response<BusinessResponse> {
        checkForError<BusinessResponse>()?.let { return it }
        return getBusinessByIdResponse ?: Response.success(TestDataFactory.createBusinessResponse())
    }

    override suspend fun createBusiness(business: Map<String, Any>): Response<BusinessResponse> {
        checkForError<BusinessResponse>()?.let { return it }
        return createBusinessResponse ?: Response.success(TestDataFactory.createBusinessResponse())
    }

    override suspend fun updateBusiness(id: String, updates: Map<String, Any>): Response<BusinessResponse> {
        checkForError<BusinessResponse>()?.let { return it }
        return updateBusinessResponse ?: Response.success(TestDataFactory.createBusinessResponse())
    }

    override suspend fun deleteBusiness(id: String): Response<Unit> {
        checkForError<Unit>()?.let { return it }
        return deleteBusinessResponse ?: Response.success(Unit)
    }


    // ==================== Dish Responses ====================

    var getDishesByBusinessResponse: Response<DishListResponse>? = null
    var getDishByIdResponse: Response<DishResponse>? = null
    var createDishResponse: Response<DishResponse>? = null
    var updateDishResponse: Response<DishResponse>? = null
    var deleteDishResponse: Response<Unit>? = null

    override suspend fun getDishesByBusiness(businessId: String): Response<DishListResponse> {
        checkForError<DishListResponse>()?.let { return it }
        return getDishesByBusinessResponse ?: Response.success(TestDataFactory.createDishListResponse())
    }

    override suspend fun getDishById(id: String): Response<DishResponse> {
        checkForError<DishResponse>()?.let { return it }
        return getDishByIdResponse ?: Response.success(TestDataFactory.createDishResponse())
    }

    override suspend fun createDish(dish: Map<String, Any>): Response<DishResponse> {
        checkForError<DishResponse>()?.let { return it }
        return createDishResponse ?: Response.success(TestDataFactory.createDishResponse())
    }

    override suspend fun updateDish(id: String, updates: Map<String, Any>): Response<DishResponse> {
        checkForError<DishResponse>()?.let { return it }
        return updateDishResponse ?: Response.success(TestDataFactory.createDishResponse())
    }

    override suspend fun deleteDish(id: String): Response<Unit> {
        checkForError<Unit>()?.let { return it }
        return deleteDishResponse ?: Response.success(Unit)
    }

    // ==================== Order Responses ====================

    var getOrdersByBusinessResponse: Response<OrderListResponse>? = null
    var getCustomerOrdersResponse: Response<OrderListResponse>? = null
    var getOrderByIdResponse: Response<OrderResponse>? = null
    var createOrderResponse: Response<OrderResponse>? = null
    var updateOrderStatusResponse: Response<OrderResponse>? = null
    var deleteOrderResponse: Response<Unit>? = null

    override suspend fun getOrdersByBusiness(
        businessId: String,
        page: Int?,
        limit: Int?
    ): Response<OrderListResponse> {
        checkForError<OrderListResponse>()?.let { return it }
        return getOrdersByBusinessResponse ?: Response.success(TestDataFactory.createOrderListResponse())
    }

    override suspend fun getCustomerOrders(
        status: String?,
        limit: Int?,
        offset: Int?
    ): Response<OrderListResponse> {
        checkForError<OrderListResponse>()?.let { return it }
        return getCustomerOrdersResponse ?: Response.success(TestDataFactory.createOrderListResponse())
    }

    override suspend fun getOrderById(id: String): Response<OrderResponse> {
        checkForError<OrderResponse>()?.let { return it }
        return getOrderByIdResponse ?: Response.success(TestDataFactory.createOrderResponse())
    }

    override suspend fun createOrder(order: Map<String, Any>): Response<OrderResponse> {
        checkForError<OrderResponse>()?.let { return it }
        return createOrderResponse ?: Response.success(TestDataFactory.createOrderResponse())
    }

    override suspend fun updateOrderStatus(id: String, status: Map<String, String>): Response<OrderResponse> {
        checkForError<OrderResponse>()?.let { return it }
        return updateOrderStatusResponse ?: Response.success(TestDataFactory.createOrderResponse())
    }

    override suspend fun deleteOrder(id: String): Response<Unit> {
        checkForError<Unit>()?.let { return it }
        return deleteOrderResponse ?: Response.success(Unit)
    }

    // ==================== Payment Processor Responses ====================

    var getPaymentProcessorsResponse: Response<PaymentProcessorListResponse>? = null
    var connectPaymentProcessorResponse: Response<PaymentProcessorResponse>? = null
    var disconnectPaymentProcessorResponse: Response<Unit>? = null

    override suspend fun getPaymentProcessors(businessId: String): Response<PaymentProcessorListResponse> {
        checkForError<PaymentProcessorListResponse>()?.let { return it }
        return getPaymentProcessorsResponse ?: Response.success(TestDataFactory.createPaymentProcessorListResponse())
    }

    override suspend fun connectPaymentProcessor(request: Map<String, String>): Response<PaymentProcessorResponse> {
        checkForError<PaymentProcessorResponse>()?.let { return it }
        return connectPaymentProcessorResponse ?: Response.success(TestDataFactory.createPaymentProcessorResponse())
    }

    override suspend fun disconnectPaymentProcessor(id: String): Response<Unit> {
        checkForError<Unit>()?.let { return it }
        return disconnectPaymentProcessorResponse ?: Response.success(Unit)
    }

    // ==================== Payout Responses ====================

    var getPayoutsResponse: Response<PayoutListResponse>? = null
    var updatePayoutScheduleResponse: Response<PayoutListResponse>? = null

    override suspend fun getPayouts(businessId: String): Response<PayoutListResponse> {
        checkForError<PayoutListResponse>()?.let { return it }
        return getPayoutsResponse ?: Response.success(TestDataFactory.createPayoutListResponse())
    }

    override suspend fun updatePayoutSchedule(schedule: Map<String, Any>): Response<PayoutListResponse> {
        checkForError<PayoutListResponse>()?.let { return it }
        return updatePayoutScheduleResponse ?: Response.success(TestDataFactory.createPayoutListResponse())
    }

    // ==================== Coupon Responses ====================

    var getCouponsResponse: Response<CouponListResponse>? = null
    var getCouponByIdResponse: Response<CouponResponse>? = null
    var createCouponResponse: Response<CouponResponse>? = null
    var updateCouponResponse: Response<CouponResponse>? = null
    var deleteCouponResponse: Response<Unit>? = null

    override suspend fun getCoupons(businessId: String): Response<CouponListResponse> {
        checkForError<CouponListResponse>()?.let { return it }
        return getCouponsResponse ?: Response.success(TestDataFactory.createCouponListResponse())
    }

    override suspend fun getCouponById(id: String): Response<CouponResponse> {
        checkForError<CouponResponse>()?.let { return it }
        return getCouponByIdResponse ?: Response.success(TestDataFactory.createCouponResponse())
    }

    override suspend fun createCoupon(coupon: Map<String, Any>): Response<CouponResponse> {
        checkForError<CouponResponse>()?.let { return it }
        return createCouponResponse ?: Response.success(TestDataFactory.createCouponResponse())
    }

    override suspend fun updateCoupon(id: String, updates: Map<String, Any>): Response<CouponResponse> {
        checkForError<CouponResponse>()?.let { return it }
        return updateCouponResponse ?: Response.success(TestDataFactory.createCouponResponse())
    }

    override suspend fun deleteCoupon(id: String): Response<Unit> {
        checkForError<Unit>()?.let { return it }
        return deleteCouponResponse ?: Response.success(Unit)
    }

    // ==================== Review Responses ====================

    var getReviewsResponse: Response<ReviewListResponse>? = null
    var createReviewResponse: Response<ReviewResponse>? = null

    override suspend fun getReviews(businessId: String): Response<ReviewListResponse> {
        checkForError<ReviewListResponse>()?.let { return it }
        return getReviewsResponse ?: Response.success(TestDataFactory.createReviewListResponse())
    }

    override suspend fun createReview(review: Map<String, Any>): Response<ReviewResponse> {
        checkForError<ReviewResponse>()?.let { return it }
        return createReviewResponse ?: Response.success(TestDataFactory.createReviewResponse())
    }


    // ==================== Marketplace Responses ====================

    var searchSellersResponse: Response<MarketplaceResponse>? = null
    var getSellerByIdResponse: Response<BusinessResponse>? = null

    override suspend fun searchSellers(
        latitude: Double?,
        longitude: Double?,
        cuisine: String?,
        ratingMin: Double?,
        distanceKm: Double?
    ): Response<MarketplaceResponse> {
        checkForError<MarketplaceResponse>()?.let { return it }
        return searchSellersResponse ?: Response.success(TestDataFactory.createMarketplaceResponse())
    }

    override suspend fun getSellerById(id: String): Response<BusinessResponse> {
        checkForError<BusinessResponse>()?.let { return it }
        return getSellerByIdResponse ?: Response.success(TestDataFactory.createBusinessResponse())
    }

    // ==================== Referral Responses ====================

    var getReferralStatsResponse: Response<ReferralStatsResponse>? = null
    var getReferralHistoryResponse: Response<ReferralHistoryResponse>? = null
    var applyReferralCodeResponse: Response<ApplyReferralResponse>? = null

    override suspend fun getReferralStats(): Response<ReferralStatsResponse> {
        checkForError<ReferralStatsResponse>()?.let { return it }
        return getReferralStatsResponse ?: Response.success(TestDataFactory.createReferralStatsResponse())
    }

    override suspend fun getReferralHistory(): Response<ReferralHistoryResponse> {
        checkForError<ReferralHistoryResponse>()?.let { return it }
        return getReferralHistoryResponse ?: Response.success(TestDataFactory.createReferralHistoryResponse())
    }

    override suspend fun applyReferralCode(request: Map<String, String>): Response<ApplyReferralResponse> {
        checkForError<ApplyReferralResponse>()?.let { return it }
        return applyReferralCodeResponse ?: Response.success(TestDataFactory.createApplyReferralResponse())
    }

    // ==================== Integration Responses ====================

    var getIntegrationsResponse: Response<IntegrationListResponse>? = null
    var connectPOSResponse: Response<PaymentProcessorResponse>? = null
    var connectDeliveryResponse: Response<PaymentProcessorResponse>? = null
    var disconnectIntegrationResponse: Response<Unit>? = null

    override suspend fun getIntegrations(businessId: String): Response<IntegrationListResponse> {
        checkForError<IntegrationListResponse>()?.let { return it }
        return getIntegrationsResponse ?: Response.success(TestDataFactory.createIntegrationListResponse())
    }

    override suspend fun connectPOS(request: Map<String, String>): Response<PaymentProcessorResponse> {
        checkForError<PaymentProcessorResponse>()?.let { return it }
        return connectPOSResponse ?: Response.success(TestDataFactory.createPaymentProcessorResponse())
    }

    override suspend fun connectDelivery(request: Map<String, String>): Response<PaymentProcessorResponse> {
        checkForError<PaymentProcessorResponse>()?.let { return it }
        return connectDeliveryResponse ?: Response.success(TestDataFactory.createPaymentProcessorResponse())
    }

    override suspend fun disconnectIntegration(id: String): Response<Unit> {
        checkForError<Unit>()?.let { return it }
        return disconnectIntegrationResponse ?: Response.success(Unit)
    }

    // ==================== Favorite Responses ====================

    var getFavoritesResponse: Response<FavoriteListResponse>? = null
    var addFavoriteResponse: Response<FavoriteResponse>? = null
    var removeFavoriteResponse: Response<Unit>? = null
    var removeFavoriteByBusinessIdResponse: Response<Unit>? = null

    override suspend fun getFavorites(): Response<FavoriteListResponse> {
        checkForError<FavoriteListResponse>()?.let { return it }
        return getFavoritesResponse ?: Response.success(TestDataFactory.createFavoriteListResponse())
    }

    override suspend fun addFavorite(request: AddFavoriteRequest): Response<FavoriteResponse> {
        checkForError<FavoriteResponse>()?.let { return it }
        return addFavoriteResponse ?: Response.success(TestDataFactory.createFavoriteResponse())
    }

    override suspend fun removeFavorite(id: String): Response<Unit> {
        checkForError<Unit>()?.let { return it }
        return removeFavoriteResponse ?: Response.success(Unit)
    }

    override suspend fun removeFavoriteByBusinessId(businessId: String): Response<Unit> {
        checkForError<Unit>()?.let { return it }
        return removeFavoriteByBusinessIdResponse ?: Response.success(Unit)
    }

    // ==================== Notification Responses ====================

    var registerDeviceResponse: Response<DeviceRegistrationResponse>? = null
    var getNotificationsResponse: Response<NotificationListResponse>? = null
    var markNotificationAsReadResponse: Response<NotificationResponse>? = null
    var markAllNotificationsAsReadResponse: Response<Unit>? = null

    override suspend fun registerDevice(request: DeviceRegistrationRequest): Response<DeviceRegistrationResponse> {
        checkForError<DeviceRegistrationResponse>()?.let { return it }
        return registerDeviceResponse ?: Response.success(DeviceRegistrationResponse(success = true))
    }

    override suspend fun getNotifications(): Response<NotificationListResponse> {
        checkForError<NotificationListResponse>()?.let { return it }
        return getNotificationsResponse ?: Response.success(TestDataFactory.createNotificationListResponse())
    }

    override suspend fun markNotificationAsRead(id: String): Response<NotificationResponse> {
        checkForError<NotificationResponse>()?.let { return it }
        return markNotificationAsReadResponse ?: Response.success(
            TestDataFactory.createNotificationResponse(
                notification = TestDataFactory.createNotification(id = id, isRead = true)
            )
        )
    }

    override suspend fun markAllNotificationsAsRead(): Response<Unit> {
        checkForError<Unit>()?.let { return it }
        return markAllNotificationsAsReadResponse ?: Response.success(Unit)
    }

    // ==================== Payment Responses ====================

    var mockChargeResponse: Response<MockChargeResponse>? = null

    override suspend fun mockCharge(request: MockChargeRequest): Response<MockChargeResponse> {
        checkForError<MockChargeResponse>()?.let { return it }
        return mockChargeResponse ?: Response.success(TestDataFactory.createMockChargeResponse())
    }

    // ==================== Menu Responses ====================

    var getMenusResponse: Response<MenuListResponse>? = null
    var getMenuByIdResponse: Response<MenuResponse>? = null
    var createMenuResponse: Response<MenuResponse>? = null
    var updateMenuResponse: Response<MenuResponse>? = null
    var deleteMenuResponse: Response<Unit>? = null

    override suspend fun getMenus(businessId: String): Response<MenuListResponse> {
        checkForError<MenuListResponse>()?.let { return it }
        return getMenusResponse ?: Response.success(TestDataFactory.createMenuListResponse())
    }

    override suspend fun getMenuById(id: String): Response<MenuResponse> {
        checkForError<MenuResponse>()?.let { return it }
        return getMenuByIdResponse ?: Response.success(TestDataFactory.createMenuResponse())
    }

    override suspend fun createMenu(request: CreateMenuRequest): Response<MenuResponse> {
        checkForError<MenuResponse>()?.let { return it }
        return createMenuResponse ?: Response.success(TestDataFactory.createMenuResponse())
    }

    override suspend fun updateMenu(id: String, request: UpdateMenuRequest): Response<MenuResponse> {
        checkForError<MenuResponse>()?.let { return it }
        return updateMenuResponse ?: Response.success(TestDataFactory.createMenuResponse())
    }

    override suspend fun deleteMenu(id: String): Response<Unit> {
        checkForError<Unit>()?.let { return it }
        return deleteMenuResponse ?: Response.success(Unit)
    }

    // ==================== Profile Responses ====================

    var getUserProfileResponse: Response<AuthResponse>? = null
    var updateUserProfileResponse: Response<AuthResponse>? = null

    override suspend fun getUserProfile(): Response<AuthResponse> {
        checkForError<AuthResponse>()?.let { return it }
        return getUserProfileResponse ?: Response.success(TestDataFactory.createAuthResponse())
    }

    override suspend fun updateUserProfile(updates: Map<String, Any>): Response<AuthResponse> {
        checkForError<AuthResponse>()?.let { return it }
        return updateUserProfileResponse ?: Response.success(TestDataFactory.createAuthResponse())
    }

    // ==================== Analytics Responses ====================

    var getAnalyticsResponse: Response<AnalyticsResponse>? = null
    var exportAnalyticsResponse: Response<Unit>? = null

    override suspend fun getAnalytics(businessId: String, period: String): Response<AnalyticsResponse> {
        checkForError<AnalyticsResponse>()?.let { return it }
        return getAnalyticsResponse ?: Response.success(TestDataFactory.createAnalyticsResponse())
    }

    override suspend fun exportAnalytics(request: ExportRequest): Response<Unit> {
        checkForError<Unit>()?.let { return it }
        return exportAnalyticsResponse ?: Response.success(Unit)
    }

    // ==================== Helper Methods ====================

    /**
     * Resets all configured responses and error states to defaults.
     */
    fun reset() {
        shouldThrowException = null
        errorCode = null
        errorMessage = "Error"
        
        // Reset all response fields to null
        signupResponse = null
        loginResponse = null
        getCurrentUserResponse = null
        refreshTokenResponse = null
        logoutResponse = null
        sendPasswordResetResponse = null
        changePasswordResponse = null
        getBusinessesResponse = null
        getBusinessByIdResponse = null
        createBusinessResponse = null
        updateBusinessResponse = null
        deleteBusinessResponse = null
        getDishesByBusinessResponse = null
        getDishByIdResponse = null
        createDishResponse = null
        updateDishResponse = null
        deleteDishResponse = null
        getOrdersByBusinessResponse = null
        getCustomerOrdersResponse = null
        getOrderByIdResponse = null
        createOrderResponse = null
        updateOrderStatusResponse = null
        deleteOrderResponse = null
        getPaymentProcessorsResponse = null
        connectPaymentProcessorResponse = null
        disconnectPaymentProcessorResponse = null
        getPayoutsResponse = null
        updatePayoutScheduleResponse = null
        getCouponsResponse = null
        getCouponByIdResponse = null
        createCouponResponse = null
        updateCouponResponse = null
        deleteCouponResponse = null
        getReviewsResponse = null
        createReviewResponse = null
        searchSellersResponse = null
        getSellerByIdResponse = null
        getReferralStatsResponse = null
        getReferralHistoryResponse = null
        applyReferralCodeResponse = null
        getIntegrationsResponse = null
        connectPOSResponse = null
        connectDeliveryResponse = null
        disconnectIntegrationResponse = null
        getFavoritesResponse = null
        addFavoriteResponse = null
        removeFavoriteResponse = null
        removeFavoriteByBusinessIdResponse = null
        registerDeviceResponse = null
        getNotificationsResponse = null
        markNotificationAsReadResponse = null
        markAllNotificationsAsReadResponse = null
        mockChargeResponse = null
        getMenusResponse = null
        getMenuByIdResponse = null
        createMenuResponse = null
        updateMenuResponse = null
        deleteMenuResponse = null
        getUserProfileResponse = null
        updateUserProfileResponse = null
        getAnalyticsResponse = null
        exportAnalyticsResponse = null
    }
}
