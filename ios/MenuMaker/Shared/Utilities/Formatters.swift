import Foundation

// MARK: - Common Formatters

/// Collection of reusable formatters for the application
struct Formatters {
    // MARK: - Currency Formatters

    /// Shared currency formatter for Indian Rupees
    static let currency: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "INR"
        formatter.currencySymbol = "₹"
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        return formatter
    }()

    /// Format cents to rupees currency string
    static func currencyFromCents(_ cents: Int) -> String {
        let amount = Double(cents) / 100.0
        return currency.string(from: NSNumber(value: amount)) ?? "₹0.00"
    }

    // MARK: - Number Formatters

    /// Decimal formatter with 2 decimal places
    static let decimal: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 2
        return formatter
    }()

    /// Percentage formatter
    static let percentage: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .percent
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 1
        return formatter
    }()

    /// Format number with compact notation (1K, 1M, etc.)
    static func compact(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = 1

        switch abs(value) {
        case 1_000_000...:
            return formatter.string(from: NSNumber(value: value / 1_000_000))! + "M"
        case 1_000...:
            return formatter.string(from: NSNumber(value: value / 1_000))! + "K"
        default:
            formatter.maximumFractionDigits = 0
            return formatter.string(from: NSNumber(value: value)) ?? "0"
        }
    }

    // MARK: - Date Formatters

    /// ISO8601 date formatter for API responses
    static let iso8601: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        return formatter
    }()

    /// ISO8601 date formatter without fractional seconds
    static let iso8601Simple: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    /// Medium date formatter (e.g., "Jan 15, 2024")
    static let mediumDate: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        formatter.locale = Locale.current
        return formatter
    }()

    /// Short date formatter (e.g., "1/15/24")
    static let shortDate: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .none
        formatter.locale = Locale.current
        return formatter
    }()

    /// Medium date and time formatter (e.g., "Jan 15, 2024 at 3:30 PM")
    static let mediumDateTime: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        formatter.locale = Locale.current
        return formatter
    }()

    /// Time only formatter (e.g., "3:30 PM")
    static let time: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        formatter.locale = Locale.current
        return formatter
    }()

    /// Relative date formatter (e.g., "2 hours ago")
    static let relative: RelativeDateTimeFormatter = {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .full
        formatter.locale = Locale.current
        return formatter
    }()

    /// Parse ISO8601 date string
    static func parseISO8601(_ string: String) -> Date? {
        return iso8601.date(from: string) ?? iso8601Simple.date(from: string)
    }

    /// Format date as ISO8601 string
    static func formatISO8601(_ date: Date) -> String {
        return iso8601.string(from: date)
    }

    // MARK: - Distance Formatters

    /// Format distance in meters/kilometers
    static func distance(_ meters: Double) -> String {
        if meters < 1000 {
            return String(format: "%.0f m", meters)
        } else {
            return String(format: "%.1f km", meters / 1000)
        }
    }

    /// Format distance in kilometers
    static func distanceKm(_ km: Double) -> String {
        if km < 1.0 {
            let meters = Int(km * 1000)
            return "\(meters) m"
        } else {
            return String(format: "%.1f km", km)
        }
    }

    // MARK: - Rating Formatters

    /// Format rating as stars (e.g., "⭐️⭐️⭐️⭐️⭐️")
    static func stars(_ rating: Double, outOf: Int = 5) -> String {
        let fullStars = Int(rating)
        let hasHalfStar = rating - Double(fullStars) >= 0.5
        let emptyStars = max(0, outOf - fullStars - (hasHalfStar ? 1 : 0))

        var result = String(repeating: "⭐️", count: fullStars)
        if hasHalfStar {
            result += "⭐️"
        }
        result += String(repeating: "☆", count: emptyStars)

        return result
    }

    /// Format rating as number with one decimal (e.g., "4.5")
    static func ratingNumber(_ rating: Double) -> String {
        return String(format: "%.1f", rating)
    }

    // MARK: - Phone Formatters

    /// Format phone number for display
    static func phone(_ phoneNumber: String) -> String {
        let cleaned = phoneNumber.components(separatedBy: CharacterSet.decimalDigits.inverted).joined()

        // Indian phone number format: +91 XXXXX XXXXX
        if cleaned.count == 10 {
            let areaCode = cleaned.prefix(5)
            let lastFive = cleaned.suffix(5)
            return "+91 \(areaCode) \(lastFive)"
        } else if cleaned.count == 12 && cleaned.hasPrefix("91") {
            let prefix = cleaned.prefix(2)
            let areaCode = cleaned.dropFirst(2).prefix(5)
            let lastFive = cleaned.suffix(5)
            return "+\(prefix) \(areaCode) \(lastFive)"
        }

        return phoneNumber
    }

    // MARK: - Duration Formatters

    /// Format duration in seconds to human readable string
    static func duration(_ seconds: TimeInterval) -> String {
        let hours = Int(seconds) / 3600
        let minutes = (Int(seconds) % 3600) / 60
        let secs = Int(seconds) % 60

        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, secs)
        } else if minutes > 0 {
            return String(format: "%d:%02d", minutes, secs)
        } else {
            return String(format: "0:%02d", secs)
        }
    }

    /// Format duration as text (e.g., "2 hours 30 minutes")
    static func durationText(_ seconds: TimeInterval) -> String {
        let hours = Int(seconds) / 3600
        let minutes = (Int(seconds) % 3600) / 60

        var parts: [String] = []

        if hours > 0 {
            parts.append("\(hours) \(hours == 1 ? "hour" : "hours")")
        }

        if minutes > 0 {
            parts.append("\(minutes) \(minutes == 1 ? "minute" : "minutes")")
        }

        if parts.isEmpty {
            return "Less than a minute"
        }

        return parts.joined(separator: " ")
    }

    // MARK: - File Size Formatters

    /// Format file size in bytes to human readable string
    static func fileSize(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        formatter.allowedUnits = [.useAll]
        return formatter.string(fromByteCount: bytes)
    }
}

// MARK: - Date Utility Extensions

extension Date {
    /// Format date using formatter
    func formatted(using formatter: DateFormatter) -> String {
        return formatter.string(from: self)
    }

    /// Get relative time string
    var relativeString: String {
        return Formatters.relative.localizedString(for: self, relativeTo: Date())
    }

    /// Format as ISO8601 string
    var iso8601String: String {
        return Formatters.formatISO8601(self)
    }
}

// MARK: - String Date Parsing

extension String {
    /// Parse ISO8601 date string
    var iso8601Date: Date? {
        return Formatters.parseISO8601(self)
    }

    /// Parse date with given format
    func parseDate(format: String) -> Date? {
        let formatter = DateFormatter()
        formatter.dateFormat = format
        formatter.locale = Locale.current
        return formatter.date(from: self)
    }
}

// MARK: - Number Extensions

extension Double {
    /// Format as currency
    var asCurrency: String {
        return Formatters.currency.string(from: NSNumber(value: self)) ?? "₹0.00"
    }

    /// Format as compact number
    var asCompact: String {
        return Formatters.compact(self)
    }

    /// Format as percentage
    var asPercentage: String {
        return Formatters.percentage.string(from: NSNumber(value: self / 100)) ?? "0%"
    }
}

extension Int {
    /// Format cents as currency
    var centsAsCurrency: String {
        return Formatters.currencyFromCents(self)
    }

    /// Format as compact number
    var asCompact: String {
        return Formatters.compact(Double(self))
    }
}
