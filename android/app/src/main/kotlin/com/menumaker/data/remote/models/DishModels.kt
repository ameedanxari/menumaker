package com.menumaker.data.remote.models

import com.google.gson.annotations.SerializedName

data class DishDto(
    @SerializedName("id") val id: String,
    @SerializedName("business_id") val businessId: String,
    @SerializedName("name") val name: String,
    @SerializedName("description") val description: String?,
    @SerializedName("price_cents") val priceCents: Int,
    @SerializedName("image_url") val imageUrl: String?,
    @SerializedName("category") val category: String?,
    @SerializedName("is_vegetarian") val isVegetarian: Boolean,
    @SerializedName("is_available") val isAvailable: Boolean,
    @SerializedName("created_at") val createdAt: String,
    @SerializedName("updated_at") val updatedAt: String
)

data class DishResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: DishData
)

data class DishData(
    @SerializedName("dish") val dish: DishDto
)

data class DishListResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: DishListData
)

data class DishListData(
    @SerializedName("dishes") val dishes: List<DishDto>
)
