package com.menumaker.data.remote.models

import com.google.gson.annotations.SerializedName

data class MockChargeRequest(
    @SerializedName("amount_cents") val amountCents: Int,
    @SerializedName("currency") val currency: String = "INR",
    @SerializedName("method") val method: String,
    @SerializedName("reference") val reference: String? = null
)

data class MockChargeResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: MockChargeData
)

data class MockChargeData(
    @SerializedName("payment_id") val paymentId: String,
    @SerializedName("status") val status: String
)

// Payment Processor Models
data class PaymentProcessorListResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: PaymentProcessorListData
)

data class PaymentProcessorListData(
    @SerializedName("processors") val processors: List<PaymentProcessorDto>
)

data class PaymentProcessorResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: PaymentProcessorData
)

data class PaymentProcessorData(
    @SerializedName("processor") val processor: PaymentProcessorDto
)

data class PaymentProcessorDto(
    @SerializedName("id") val id: String,
    @SerializedName("processor_type") val processorType: String,
    @SerializedName("status") val status: String,
    @SerializedName("is_active") val isActive: Boolean,
    @SerializedName("priority") val priority: Int,
    @SerializedName("settlement_schedule") val settlementSchedule: String?,
    @SerializedName("min_payout_threshold_cents") val minPayoutThresholdCents: Int?,
    @SerializedName("fee_percentage") val feePercentage: Double?,
    @SerializedName("fixed_fee_cents") val fixedFeeCents: Int?,
    @SerializedName("last_transaction_at") val lastTransactionAt: String?,
    @SerializedName("verified_at") val verifiedAt: String?,
    @SerializedName("connection_error") val connectionError: String?,
    @SerializedName("metadata") val metadata: Map<String, Any>?,
    @SerializedName("created_at") val createdAt: String?
)

// Payout Models
data class PayoutListResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: PayoutListData
)

data class PayoutListData(
    @SerializedName("payouts") val payouts: List<PayoutDto>,
    @SerializedName("total") val total: Int,
    @SerializedName("limit") val limit: Int,
    @SerializedName("offset") val offset: Int
)

data class PayoutDto(
    @SerializedName("id") val id: String,
    @SerializedName("business_id") val businessId: String,
    @SerializedName("processor_id") val processorId: String?,
    @SerializedName("amount_cents") val amountCents: Int,
    @SerializedName("fee_cents") val feeCents: Int,
    @SerializedName("net_amount_cents") val netAmountCents: Int,
    @SerializedName("currency") val currency: String,
    @SerializedName("status") val status: String,
    @SerializedName("payout_reference") val payoutReference: String?,
    @SerializedName("failure_reason") val failureReason: String?,
    @SerializedName("initiated_at") val initiatedAt: String?,
    @SerializedName("completed_at") val completedAt: String?,
    @SerializedName("created_at") val createdAt: String
)
