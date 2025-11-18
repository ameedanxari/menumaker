package com.menumaker.data.remote.models

import com.google.gson.annotations.SerializedName

/**
 * Data Transfer Object for Menu
 * Represents a menu within a business/seller's offerings
 */
data class MenuDto(
    @SerializedName("id") val id: String,
    @SerializedName("business_id") val businessId: String,
    @SerializedName("name") val name: String,
    @SerializedName("description") val description: String?,
    @SerializedName("is_active") val isActive: Boolean,
    @SerializedName("display_order") val displayOrder: Int,
    @SerializedName("created_at") val createdAt: String,
    @SerializedName("updated_at") val updatedAt: String
)

/**
 * API Response for a single menu
 */
data class MenuResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: MenuData
)

data class MenuData(
    @SerializedName("menu") val menu: MenuDto
)

/**
 * API Response for a list of menus
 */
data class MenuListResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: MenuListData
)

data class MenuListData(
    @SerializedName("menus") val menus: List<MenuDto>
)

/**
 * Request to create a new menu
 */
data class CreateMenuRequest(
    @SerializedName("business_id") val businessId: String,
    @SerializedName("name") val name: String,
    @SerializedName("description") val description: String?,
    @SerializedName("is_active") val isActive: Boolean,
    @SerializedName("display_order") val displayOrder: Int
)

/**
 * Request to update an existing menu
 */
data class UpdateMenuRequest(
    @SerializedName("name") val name: String?,
    @SerializedName("description") val description: String?,
    @SerializedName("is_active") val isActive: Boolean?,
    @SerializedName("display_order") val displayOrder: Int?
)
