import Foundation

// MARK: - Analytics Models

enum TimePeriod: String, CaseIterable {
    case today = "Today"
    case week = "Week"
    case month = "Month"
    case custom = "Custom"
}

struct AnalyticsData: Codable {
    let totalSales: Double
    let totalOrders: Int
    let totalRevenue: Double
    let averageOrderValue: Double
    let newCustomers: Int
    let repeatCustomers: Int
    let popularItems: [PopularItem]
    let salesData: [SalesDataPoint]
    let peakHours: [PeakHour]

    var formattedTotalSales: String {
        String(format: "₹%.2f", totalSales)
    }

    var formattedTotalRevenue: String {
        String(format: "₹%.2f", totalRevenue)
    }

    var formattedAverageOrderValue: String {
        String(format: "₹%.2f", averageOrderValue)
    }
}

struct PopularItem: Codable, Identifiable {
    let id: String
    let name: String
    let salesCount: Int
    let revenue: Double
    let imageUrl: String?

    var formattedRevenue: String {
        String(format: "₹%.2f", revenue)
    }
}

struct SalesDataPoint: Codable, Identifiable {
    let id: String
    let date: String
    let sales: Double
    let orders: Int

    var formattedSales: String {
        String(format: "₹%.2f", sales)
    }
}

struct PeakHour: Codable, Identifiable {
    let hour: Int
    let orderCount: Int

    var id: Int { hour }

    var displayHour: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "ha"
        let date = Calendar.current.date(bySettingHour: hour, minute: 0, second: 0, of: Date()) ?? Date()
        return formatter.string(from: date)
    }
}

struct CustomerInsights: Codable {
    let newCustomers: Int
    let repeatCustomers: Int
    let totalCustomers: Int
    let averageOrdersPerCustomer: Double

    var repeatRate: Double {
        guard totalCustomers > 0 else { return 0 }
        return Double(repeatCustomers) / Double(totalCustomers) * 100
    }

    var formattedRepeatRate: String {
        String(format: "%.1f%%", repeatRate)
    }
}

struct PayoutInfo: Codable {
    let pendingAmount: Double
    let completedAmount: Double
    let nextPayoutDate: String?

    var formattedPending: String {
        String(format: "₹%.2f", pendingAmount)
    }

    var formattedCompleted: String {
        String(format: "₹%.2f", completedAmount)
    }
}

// MARK: - Response Models

struct AnalyticsResponse: Decodable {
    let success: Bool
    let data: AnalyticsResponseData
}

struct AnalyticsResponseData: Decodable {
    let analytics: AnalyticsData
    let customerInsights: CustomerInsights
    let payouts: PayoutInfo
}

// MARK: - Export Models

enum ExportFormat: String, CaseIterable {
    case csv = "CSV"
    case pdf = "PDF"
    case excel = "Excel"
}

struct ExportRequest: Encodable {
    let businessId: String
    let period: String
    let format: String
    let startDate: String?
    let endDate: String?
}
