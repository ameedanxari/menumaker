package com.menumaker.data.remote.models

import com.google.gson.annotations.SerializedName

// Marketplace
data class MarketplaceSellerDto(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("slug") val slug: String,
    @SerializedName("description") val description: String?,
    @SerializedName("logo_url") val logoUrl: String?,
    @SerializedName("cuisine_type") val cuisineType: String?,
    @SerializedName("rating") val rating: Double,
    @SerializedName("review_count") val reviewCount: Int,
    @SerializedName("latitude") val latitude: Double?,
    @SerializedName("longitude") val longitude: Double?,
    @SerializedName("distance_km") val distanceKm: Double?
)

data class MarketplaceResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: MarketplaceData
)

data class MarketplaceData(
    @SerializedName("sellers") val sellers: List<MarketplaceSellerDto>,
    @SerializedName("total") val total: Int
)

// Cart
data class CartItemDto(
    @SerializedName("dish_id") val dishId: String,
    @SerializedName("dish_name") val dishName: String,
    @SerializedName("quantity") val quantity: Int,
    @SerializedName("price_cents") val priceCents: Int
)

data class CartDto(
    @SerializedName("items") val items: List<CartItemDto>,
    @SerializedName("total_cents") val totalCents: Int,
    @SerializedName("business_id") val businessId: String
)
