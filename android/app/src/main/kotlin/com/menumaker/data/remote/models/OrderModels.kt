package com.menumaker.data.remote.models

import com.google.gson.annotations.SerializedName

data class OrderDto(
    @SerializedName("id") val id: String,
    @SerializedName("business_id") val businessId: String,
    @SerializedName("customer_name") val customerName: String,
    @SerializedName("customer_phone") val customerPhone: String?,
    @SerializedName("customer_email") val customerEmail: String?,
    @SerializedName("total_cents") val totalCents: Int,
    @SerializedName("status") val status: String,
    @SerializedName("items") val items: List<OrderItemDto>,
    @SerializedName("created_at") val createdAt: String,
    @SerializedName("updated_at") val updatedAt: String
)

data class OrderItemDto(
    @SerializedName("id") val id: String,
    @SerializedName("dish_id") val dishId: String,
    @SerializedName("dish_name") val dishName: String,
    @SerializedName("quantity") val quantity: Int,
    @SerializedName("price_cents") val priceCents: Int,
    @SerializedName("total_cents") val totalCents: Int
)

data class OrderResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: OrderData
)

data class OrderData(
    @SerializedName("order") val order: OrderDto
)

data class OrderListResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: OrderListData
)

data class OrderListData(
    @SerializedName("orders") val orders: List<OrderDto>,
    @SerializedName("total") val total: Int
)
