package com.menumaker.data.remote.models

import com.google.gson.annotations.SerializedName

data class BusinessDto(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("slug") val slug: String,
    @SerializedName("description") val description: String?,
    @SerializedName("logo_url") val logoUrl: String?,
    @SerializedName("owner_id") val ownerId: String,
    @SerializedName("is_active") val isActive: Boolean,
    @SerializedName("created_at") val createdAt: String,
    @SerializedName("updated_at") val updatedAt: String
)

data class BusinessResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: BusinessData
)

data class BusinessData(
    @SerializedName("business") val business: BusinessDto
)

data class BusinessListResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: BusinessListData
)

data class BusinessListData(
    @SerializedName("businesses") val businesses: List<BusinessDto>
)
