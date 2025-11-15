package com.menumaker.data.remote.models

import com.google.gson.annotations.SerializedName

// Reviews
data class ReviewDto(
    @SerializedName("id") val id: String,
    @SerializedName("business_id") val businessId: String,
    @SerializedName("customer_name") val customerName: String,
    @SerializedName("rating") val rating: Int,
    @SerializedName("comment") val comment: String?,
    @SerializedName("image_urls") val imageUrls: List<String>?,
    @SerializedName("created_at") val createdAt: String
)

data class ReviewResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: ReviewData
)

data class ReviewData(
    @SerializedName("review") val review: ReviewDto
)

data class ReviewListResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: ReviewListData
)

data class ReviewListData(
    @SerializedName("reviews") val reviews: List<ReviewDto>,
    @SerializedName("average_rating") val averageRating: Double,
    @SerializedName("total_reviews") val totalReviews: Int
)
