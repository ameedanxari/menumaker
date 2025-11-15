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
}
