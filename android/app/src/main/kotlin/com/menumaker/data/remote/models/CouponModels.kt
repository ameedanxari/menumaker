package com.menumaker.data.remote.models

import com.google.gson.annotations.SerializedName

// Coupons
data class CouponDto(
    @SerializedName("id") val id: String,
    @SerializedName("business_id") val businessId: String,
    @SerializedName("code") val code: String,
    @SerializedName("discount_type") val discountType: String,
    @SerializedName("discount_value") val discountValue: Int,
    @SerializedName("max_discount_cents") val maxDiscountCents: Int?,
    @SerializedName("min_order_value_cents") val minOrderValueCents: Int,
    @SerializedName("valid_until") val validUntil: String?,
    @SerializedName("usage_limit_type") val usageLimitType: String,
    @SerializedName("total_usage_limit") val totalUsageLimit: Int?,
    @SerializedName("is_active") val isActive: Boolean,
    @SerializedName("created_at") val createdAt: String
)

data class CouponResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: CouponData
)

data class CouponData(
    @SerializedName("coupon") val coupon: CouponDto
)

data class CouponListResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: CouponListData
)

data class CouponListData(
    @SerializedName("coupons") val coupons: List<CouponDto>
)
