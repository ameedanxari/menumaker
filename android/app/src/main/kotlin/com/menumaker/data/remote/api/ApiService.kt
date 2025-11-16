package com.menumaker.data.remote.api

import com.menumaker.data.remote.models.*
import retrofit2.Response
import retrofit2.http.*

interface ApiService {

    // Authentication
    @POST("auth/signup")
    suspend fun signup(@Body request: SignupRequest): Response<AuthResponse>

    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): Response<AuthResponse>

    @POST("auth/refresh")
    suspend fun refreshToken(@Body request: RefreshTokenRequest): Response<AuthResponse>

    @POST("auth/logout")
    suspend fun logout(): Response<Unit>

    // Businesses
    @GET("businesses")
    suspend fun getBusinesses(): Response<BusinessListResponse>

    @GET("businesses/{id}")
    suspend fun getBusinessById(@Path("id") id: String): Response<BusinessResponse>

    @POST("businesses")
    suspend fun createBusiness(@Body business: Map<String, Any>): Response<BusinessResponse>

    @PATCH("businesses/{id}")
    suspend fun updateBusiness(
        @Path("id") id: String,
        @Body updates: Map<String, Any>
    ): Response<BusinessResponse>

    @DELETE("businesses/{id}")
    suspend fun deleteBusiness(@Path("id") id: String): Response<Unit>

    // Dishes
    @GET("dishes")
    suspend fun getDishesByBusiness(
        @Query("business_id") businessId: String
    ): Response<DishListResponse>

    @GET("dishes/{id}")
    suspend fun getDishById(@Path("id") id: String): Response<DishResponse>

    @POST("dishes")
    suspend fun createDish(@Body dish: Map<String, Any>): Response<DishResponse>

    @PATCH("dishes/{id}")
    suspend fun updateDish(
        @Path("id") id: String,
        @Body updates: Map<String, Any>
    ): Response<DishResponse>

    @DELETE("dishes/{id}")
    suspend fun deleteDish(@Path("id") id: String): Response<Unit>

    // Orders
    @GET("orders")
    suspend fun getOrdersByBusiness(
        @Query("business_id") businessId: String,
        @Query("page") page: Int? = null,
        @Query("limit") limit: Int? = null
    ): Response<OrderListResponse>

    @GET("orders/{id}")
    suspend fun getOrderById(@Path("id") id: String): Response<OrderResponse>

    @POST("orders")
    suspend fun createOrder(@Body order: Map<String, Any>): Response<OrderResponse>

    @PATCH("orders/{id}")
    suspend fun updateOrderStatus(
        @Path("id") id: String,
        @Body status: Map<String, String>
    ): Response<OrderResponse>

    @DELETE("orders/{id}")
    suspend fun deleteOrder(@Path("id") id: String): Response<Unit>

    // Payment Processors
    @GET("payment-processors")
    suspend fun getPaymentProcessors(
        @Query("business_id") businessId: String
    ): Response<PaymentProcessorListResponse>

    @POST("payment-processors/connect")
    suspend fun connectPaymentProcessor(
        @Body request: Map<String, String>
    ): Response<PaymentProcessorResponse>

    @DELETE("payment-processors/{id}")
    suspend fun disconnectPaymentProcessor(@Path("id") id: String): Response<Unit>

    // Payouts
    @GET("payouts")
    suspend fun getPayouts(
        @Query("business_id") businessId: String
    ): Response<PayoutListResponse>

    @POST("payouts/schedule")
    suspend fun updatePayoutSchedule(
        @Body schedule: Map<String, Any>
    ): Response<PayoutListResponse>

    // Coupons
    @GET("coupons")
    suspend fun getCoupons(
        @Query("business_id") businessId: String
    ): Response<CouponListResponse>

    @GET("coupons/{id}")
    suspend fun getCouponById(@Path("id") id: String): Response<CouponResponse>

    @POST("coupons")
    suspend fun createCoupon(@Body coupon: Map<String, Any>): Response<CouponResponse>

    @PATCH("coupons/{id}")
    suspend fun updateCoupon(
        @Path("id") id: String,
        @Body updates: Map<String, Any>
    ): Response<CouponResponse>

    @DELETE("coupons/{id}")
    suspend fun deleteCoupon(@Path("id") id: String): Response<Unit>

    // Reviews
    @GET("reviews")
    suspend fun getReviews(
        @Query("business_id") businessId: String
    ): Response<ReviewListResponse>

    @POST("reviews")
    suspend fun createReview(@Body review: Map<String, Any>): Response<ReviewResponse>

    // Marketplace
    @GET("marketplace/sellers")
    suspend fun searchSellers(
        @Query("latitude") latitude: Double?,
        @Query("longitude") longitude: Double?,
        @Query("cuisine") cuisine: String?,
        @Query("rating_min") ratingMin: Double?,
        @Query("distance_km") distanceKm: Double?
    ): Response<MarketplaceResponse>

    @GET("marketplace/sellers/{id}")
    suspend fun getSellerById(@Path("id") id: String): Response<BusinessResponse>

    // Referrals
    @GET("referrals/stats")
    suspend fun getReferralStats(): Response<ReferralStatsResponse>

    // Integrations
    @GET("integrations")
    suspend fun getIntegrations(
        @Query("business_id") businessId: String
    ): Response<IntegrationListResponse>

    @POST("pos/connect")
    suspend fun connectPOS(@Body request: Map<String, String>): Response<PaymentProcessorResponse>

    @POST("delivery/connect")
    suspend fun connectDelivery(@Body request: Map<String, String>): Response<PaymentProcessorResponse>

    @DELETE("integrations/{id}")
    suspend fun disconnectIntegration(@Path("id") id: String): Response<Unit>
}
