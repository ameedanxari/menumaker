package com.menumaker.data.remote.models

import com.google.gson.annotations.SerializedName

/**
 * Data Transfer Object for Favorite
 * Represents a user's favorited business/seller
 */
data class FavoriteDto(
    @SerializedName("id") val id: String,
    @SerializedName("user_id") val userId: String,
    @SerializedName("business_id") val businessId: String,
    @SerializedName("business") val business: BusinessDto?,
    @SerializedName("created_at") val createdAt: String
)

/**
 * API Response for a single favorite
 */
data class FavoriteResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: FavoriteData
)

data class FavoriteData(
    @SerializedName("favorite") val favorite: FavoriteDto
)

/**
 * API Response for a list of favorites
 */
data class FavoriteListResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: FavoriteListData
)

data class FavoriteListData(
    @SerializedName("favorites") val favorites: List<FavoriteDto>
)

/**
 * Request to add a business to favorites
 */
data class AddFavoriteRequest(
    @SerializedName("business_id") val businessId: String
)

/**
 * Request to remove a business from favorites
 */
data class RemoveFavoriteRequest(
    @SerializedName("business_id") val businessId: String
)
