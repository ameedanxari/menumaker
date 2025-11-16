package com.menumaker.data.remote.models

import com.google.gson.annotations.SerializedName

// Payment Processors
data class PaymentProcessorDto(
    @SerializedName("id") val id: String,
    @SerializedName("business_id") val businessId: String,
    @SerializedName("provider") val provider: String,
    @SerializedName("is_active") val isActive: Boolean,
    @SerializedName("account_id") val accountId: String?,
    @SerializedName("created_at") val createdAt: String
)

data class PaymentProcessorResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: PaymentProcessorData
)

data class PaymentProcessorData(
    @SerializedName("processor") val processor: PaymentProcessorDto,
    @SerializedName("authorization_url") val authorizationUrl: String?
)

data class PaymentProcessorListResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: PaymentProcessorListData
)

data class PaymentProcessorListData(
    @SerializedName("processors") val processors: List<PaymentProcessorDto>
)

// Payouts
data class PayoutDto(
    @SerializedName("id") val id: String,
    @SerializedName("business_id") val businessId: String,
    @SerializedName("amount_cents") val amountCents: Int,
    @SerializedName("status") val status: String,
    @SerializedName("scheduled_for") val scheduledFor: String?,
    @SerializedName("processed_at") val processedAt: String?,
    @SerializedName("created_at") val createdAt: String
)

data class PayoutScheduleDto(
    @SerializedName("id") val id: String,
    @SerializedName("business_id") val businessId: String,
    @SerializedName("frequency") val frequency: String,
    @SerializedName("minimum_threshold_cents") val minimumThresholdCents: Int,
    @SerializedName("auto_payout_enabled") val autoPayoutEnabled: Boolean
)

data class PayoutListResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: PayoutListData
)

data class PayoutListData(
    @SerializedName("payouts") val payouts: List<PayoutDto>,
    @SerializedName("schedule") val schedule: PayoutScheduleDto?
)
