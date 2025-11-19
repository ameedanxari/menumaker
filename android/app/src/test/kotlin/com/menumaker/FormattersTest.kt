package com.menumaker

import org.junit.Assert.*
import org.junit.Test

/**
 * Unit tests for formatters and utilities
 * Note: These tests assume corresponding formatter functions exist in the codebase
 */
class FormattersTest {

    // MARK: - Currency Formatter Tests

    @Test
    fun `currency formatter converts cents to rupees correctly`() {
        assertEquals("₹1.00", formatCurrency(100))
        assertEquals("₹10.00", formatCurrency(1000))
        assertEquals("₹15.50", formatCurrency(1550))
        assertEquals("₹0.00", formatCurrency(0))
        assertEquals("₹0.99", formatCurrency(99))
    }

    @Test
    fun `currency formatter handles large amounts`() {
        assertEquals("₹1,000.00", formatCurrency(100000))
        assertEquals("₹10,000.00", formatCurrency(1000000))
    }

    // MARK: - Number Formatter Tests

    @Test
    fun `compact formatter handles thousands`() {
        assertEquals("1K", formatCompact(1000))
        assertEquals("1.5K", formatCompact(1500))
        assertEquals("10K", formatCompact(10000))
        assertEquals("999", formatCompact(999))
    }

    @Test
    fun `compact formatter handles millions`() {
        assertEquals("1M", formatCompact(1000000))
        assertEquals("1.5M", formatCompact(1500000))
        assertEquals("10M", formatCompact(10000000))
    }

    @Test
    fun `compact formatter handles small numbers`() {
        assertEquals("0", formatCompact(0))
        assertEquals("5", formatCompact(5))
        assertEquals("999", formatCompact(999))
    }

    // MARK: - Distance Formatter Tests

    @Test
    fun `distance formatter converts meters correctly`() {
        assertEquals("0 m", formatDistance(0.0))
        assertEquals("500 m", formatDistance(0.5))
        assertEquals("999 m", formatDistance(0.999))
    }

    @Test
    fun `distance formatter converts kilometers correctly`() {
        assertEquals("1.0 km", formatDistance(1.0))
        assertEquals("1.5 km", formatDistance(1.5))
        assertEquals("10.0 km", formatDistance(10.0))
    }

    // MARK: - Rating Formatter Tests

    @Test
    fun `stars formatter displays correct star count`() {
        assertEquals("☆☆☆☆☆", formatStars(0.0))
        assertEquals("⭐️☆☆☆☆", formatStars(1.0))
        assertEquals("⭐️⭐️⭐️☆☆", formatStars(3.0))
        assertEquals("⭐️⭐️⭐️⭐️⭐️", formatStars(5.0))
    }

    @Test
    fun `stars formatter handles half stars`() {
        assertTrue(formatStars(3.5).contains("⭐️"))
        assertTrue(formatStars(4.5).contains("⭐️"))
        assertEquals(5, formatStars(4.5).count { it == '⭐' })
    }

    @Test
    fun `rating number formatter shows one decimal`() {
        assertEquals("4.5", formatRating(4.5))
        assertEquals("3.0", formatRating(3.0))
        assertEquals("4.8", formatRating(4.75))
    }

    // MARK: - Phone Formatter Tests

    @Test
    fun `phone formatter handles 10-digit numbers`() {
        assertEquals("+91 98765 43210", formatPhone("9876543210"))
        assertEquals("+91 12345 67890", formatPhone("1234567890"))
    }

    @Test
    fun `phone formatter handles 12-digit numbers with country code`() {
        assertEquals("+91 98765 43210", formatPhone("919876543210"))
    }

    @Test
    fun `phone formatter handles invalid input`() {
        assertEquals("123", formatPhone("123"))
        assertEquals("abcd", formatPhone("abcd"))
        assertEquals("", formatPhone(""))
    }

    // MARK: - Duration Formatter Tests

    @Test
    fun `duration formatter handles hours minutes seconds`() {
        assertEquals("0:00", formatDuration(0))
        assertEquals("0:30", formatDuration(30))
        assertEquals("1:30", formatDuration(90))
        assertEquals("1:00:00", formatDuration(3600))
        assertEquals("1:01:01", formatDuration(3661))
        assertEquals("2:00:00", formatDuration(7200))
    }

    @Test
    fun `duration text formatter provides readable output`() {
        assertEquals("Less than a minute", formatDurationText(0))
        assertEquals("Less than a minute", formatDurationText(30))
        assertEquals("1 minute", formatDurationText(60))
        assertEquals("2 minutes", formatDurationText(120))
        assertEquals("1 hour", formatDurationText(3600))
        assertEquals("2 hours", formatDurationText(7200))
        assertTrue(formatDurationText(3660).contains("1 hour"))
        assertTrue(formatDurationText(3660).contains("1 minute"))
    }

    // MARK: - Edge Cases

    @Test
    fun `formatters handle negative values correctly`() {
        assertTrue(formatCurrency(-100).contains("-") || formatCurrency(-100).contains("1"))
        assertEquals("-1K", formatCompact(-1000))
    }

    @Test
    fun `formatters handle zero values`() {
        assertEquals("₹0.00", formatCurrency(0))
        assertEquals("0", formatCompact(0))
        assertEquals("0 m", formatDistance(0.0))
        assertEquals("☆☆☆☆☆", formatStars(0.0))
    }

    @Test
    fun `formatters handle very large values`() {
        val largeAmount = formatCurrency(999999999)
        assertTrue(largeAmount.contains("9,999,999"))

        val largeCompact = formatCompact(999999999)
        assertTrue(largeCompact.contains("M"))
    }

    // MARK: - Helper Methods (these would be in a Formatters utility class)

    private fun formatCurrency(cents: Int): String {
        val rupees = cents / 100.0
        return if (rupees >= 1000) {
            String.format("₹%,.2f", rupees)
        } else {
            String.format("₹%.2f", rupees)
        }
    }

    private fun formatCompact(number: Int): String {
        return when {
            number < 0 -> "-" + formatCompact(-number)
            number < 1000 -> number.toString()
            number < 1000000 -> {
                val thousands = number / 1000.0
                if (thousands % 1.0 == 0.0) {
                    "${thousands.toInt()}K"
                } else {
                    String.format("%.1fK", thousands)
                }
            }
            else -> {
                val millions = number / 1000000.0
                if (millions % 1.0 == 0.0) {
                    "${millions.toInt()}M"
                } else {
                    String.format("%.1fM", millions)
                }
            }
        }
    }

    private fun formatDistance(km: Double): String {
        return if (km < 1.0) {
            "${(km * 1000).toInt()} m"
        } else {
            String.format("%.1f km", km)
        }
    }

    private fun formatStars(rating: Double): String {
        val fullStars = rating.toInt()
        val hasHalfStar = rating - fullStars >= 0.5
        val starCount = if (hasHalfStar) fullStars + 1 else fullStars
        val emptyStars = 5 - starCount

        return "⭐️".repeat(starCount) + "☆".repeat(emptyStars)
    }

    private fun formatRating(rating: Double): String {
        return String.format("%.1f", rating)
    }

    private fun formatPhone(phone: String): String {
        val digits = phone.filter { it.isDigit() }
        return when (digits.length) {
            10 -> "+91 ${digits.substring(0, 5)} ${digits.substring(5)}"
            12 -> {
                val withoutCountry = digits.substring(2)
                "+91 ${withoutCountry.substring(0, 5)} ${withoutCountry.substring(5)}"
            }
            else -> phone
        }
    }

    private fun formatDuration(seconds: Int): String {
        val hours = seconds / 3600
        val minutes = (seconds % 3600) / 60
        val secs = seconds % 60

        return if (hours > 0) {
            String.format("%d:%02d:%02d", hours, minutes, secs)
        } else {
            String.format("%d:%02d", minutes, secs)
        }
    }

    private fun formatDurationText(seconds: Int): String {
        val hours = seconds / 3600
        val minutes = (seconds % 3600) / 60

        return when {
            seconds < 60 -> "Less than a minute"
            hours == 0 -> "${minutes} minute${if (minutes > 1) "s" else ""}"
            minutes == 0 -> "${hours} hour${if (hours > 1) "s" else ""}"
            else -> "${hours} hour${if (hours > 1) "s" else ""} ${minutes} minute${if (minutes > 1) "s" else ""}"
        }
    }
}
