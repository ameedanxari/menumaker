package com.menumaker.data.remote.models

import com.google.gson.annotations.SerializedName

// MARK: - Analytics Models

enum class TimePeriod(val displayName: String) {
    TODAY("Today"),
    WEEK("Week"),
    MONTH("Month"),
    CUSTOM("Custom")
}

data class AnalyticsData(
    @SerializedName("total_sales") val totalSales: Double,
    @SerializedName("total_orders") val totalOrders: Int,
    @SerializedName("total_revenue") val totalRevenue: Double,
    @SerializedName("average_order_value") val averageOrderValue: Double,
    @SerializedName("new_customers") val newCustomers: Int,
    @SerializedName("repeat_customers") val repeatCustomers: Int,
    @SerializedName("popular_items") val popularItems: List<PopularItem>,
    @SerializedName("sales_data") val salesData: List<SalesDataPoint>,
    @SerializedName("peak_hours") val peakHours: List<PeakHour>
) {
    val formattedTotalSales: String
        get() = String.format("₹%.2f", totalSales)

    val formattedTotalRevenue: String
        get() = String.format("₹%.2f", totalRevenue)

    val formattedAverageOrderValue: String
        get() = String.format("₹%.2f", averageOrderValue)
}

data class PopularItem(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("sales_count") val salesCount: Int,
    @SerializedName("revenue") val revenue: Double,
    @SerializedName("image_url") val imageUrl: String?
) {
    val formattedRevenue: String
        get() = String.format("₹%.2f", revenue)
}

data class SalesDataPoint(
    @SerializedName("id") val id: String,
    @SerializedName("date") val date: String,
    @SerializedName("sales") val sales: Double,
    @SerializedName("orders") val orders: Int
) {
    val formattedSales: String
        get() = String.format("₹%.2f", sales)
}

data class PeakHour(
    @SerializedName("hour") val hour: Int,
    @SerializedName("order_count") val orderCount: Int
) {
    val displayHour: String
        get() {
            val period = if (hour < 12) "AM" else "PM"
            val displayHour = if (hour == 0) 12 else if (hour > 12) hour - 12 else hour
            return "$displayHour$period"
        }
}

data class CustomerInsights(
    @SerializedName("new_customers") val newCustomers: Int,
    @SerializedName("repeat_customers") val repeatCustomers: Int,
    @SerializedName("total_customers") val totalCustomers: Int,
    @SerializedName("average_orders_per_customer") val averageOrdersPerCustomer: Double
) {
    val repeatRate: Double
        get() = if (totalCustomers > 0) {
            (repeatCustomers.toDouble() / totalCustomers.toDouble()) * 100
        } else {
            0.0
        }

    val formattedRepeatRate: String
        get() = String.format("%.1f%%", repeatRate)
}

data class PayoutInfo(
    @SerializedName("pending_amount") val pendingAmount: Double,
    @SerializedName("completed_amount") val completedAmount: Double,
    @SerializedName("next_payout_date") val nextPayoutDate: String?
) {
    val formattedPending: String
        get() = String.format("₹%.2f", pendingAmount)

    val formattedCompleted: String
        get() = String.format("₹%.2f", completedAmount)
}

// MARK: - Response Models

data class AnalyticsResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: AnalyticsResponseData
)

data class AnalyticsResponseData(
    @SerializedName("analytics") val analytics: AnalyticsData,
    @SerializedName("customer_insights") val customerInsights: CustomerInsights,
    @SerializedName("payouts") val payouts: PayoutInfo
)

// MARK: - Export Models

enum class ExportFormat(val displayName: String) {
    CSV("CSV"),
    PDF("PDF"),
    EXCEL("Excel")
}

data class ExportRequest(
    @SerializedName("business_id") val businessId: String,
    @SerializedName("period") val period: String,
    @SerializedName("format") val format: String,
    @SerializedName("start_date") val startDate: String?,
    @SerializedName("end_date") val endDate: String?
)
