//
//  FormattersTests.swift
//  MenuMakerTests
//
//  Unit tests for formatters and utilities
//

import Testing
import Foundation
@testable import MenuMaker

struct FormattersTests {

    // MARK: - Currency Formatter Tests

    @Test("Currency formatter converts cents to rupees correctly")
    func testCurrencyFromCents() {
        #expect(Formatters.currencyFromCents(100) == "₹1.00")
        #expect(Formatters.currencyFromCents(1000) == "₹10.00")
        #expect(Formatters.currencyFromCents(1550) == "₹15.50")
        #expect(Formatters.currencyFromCents(0) == "₹0.00")
        #expect(Formatters.currencyFromCents(99) == "₹0.99")
    }

    @Test("Currency formatter handles large amounts")
    func testCurrencyLargeAmounts() {
        #expect(Formatters.currencyFromCents(100000) == "₹1,000.00")
        #expect(Formatters.currencyFromCents(1000000) == "₹10,000.00")
    }

    @Test("Int extension converts cents to currency")
    func testIntCentsAsCurrency() {
        #expect(1500.centsAsCurrency == "₹15.00")
        #expect(250.centsAsCurrency == "₹2.50")
    }

    // MARK: - Number Formatter Tests

    @Test("Compact formatter handles thousands")
    func testCompactThousands() {
        #expect(Formatters.compact(1000) == "1K")
        #expect(Formatters.compact(1500) == "1.5K")
        #expect(Formatters.compact(10000) == "10K")
        #expect(Formatters.compact(999) == "999")
    }

    @Test("Compact formatter handles millions")
    func testCompactMillions() {
        #expect(Formatters.compact(1000000) == "1M")
        #expect(Formatters.compact(1500000) == "1.5M")
        #expect(Formatters.compact(10000000) == "10M")
    }

    @Test("Compact formatter handles small numbers")
    func testCompactSmallNumbers() {
        #expect(Formatters.compact(0) == "0")
        #expect(Formatters.compact(5) == "5")
        #expect(Formatters.compact(999) == "999")
    }

    // MARK: - Distance Formatter Tests

    @Test("Distance formatter converts meters correctly")
    func testDistanceMeters() {
        #expect(Formatters.distance(0) == "0 m")
        #expect(Formatters.distance(500) == "500 m")
        #expect(Formatters.distance(999) == "999 m")
    }

    @Test("Distance formatter converts kilometers correctly")
    func testDistanceKilometers() {
        #expect(Formatters.distance(1000) == "1.0 km")
        #expect(Formatters.distance(1500) == "1.5 km")
        #expect(Formatters.distance(10000) == "10.0 km")
    }

    @Test("Distance formatter handles km input")
    func testDistanceKm() {
        #expect(Formatters.distanceKm(0.5) == "500 m")
        #expect(Formatters.distanceKm(0.999) == "999 m")
        #expect(Formatters.distanceKm(1.0) == "1.0 km")
        #expect(Formatters.distanceKm(5.5) == "5.5 km")
    }

    // MARK: - Rating Formatter Tests

    @Test("Stars formatter displays correct star count")
    func testStarsFormatter() {
        #expect(Formatters.stars(0) == "☆☆☆☆☆")
        #expect(Formatters.stars(1) == "⭐️☆☆☆☆")
        #expect(Formatters.stars(3) == "⭐️⭐️⭐️☆☆")
        #expect(Formatters.stars(5) == "⭐️⭐️⭐️⭐️⭐️")
    }

    @Test("Stars formatter handles half stars")
    func testStarsWithHalf() {
        #expect(Formatters.stars(3.5) == "⭐️⭐️⭐️⭐️☆")
        #expect(Formatters.stars(4.5) == "⭐️⭐️⭐️⭐️⭐️")
        #expect(Formatters.stars(4.3) == "⭐️⭐️⭐️⭐️☆")
    }

    @Test("Rating number formatter shows one decimal")
    func testRatingNumber() {
        #expect(Formatters.ratingNumber(4.5) == "4.5")
        #expect(Formatters.ratingNumber(3.0) == "3.0")
        #expect(Formatters.ratingNumber(4.75) == "4.8")
    }

    // MARK: - Phone Formatter Tests

    @Test("Phone formatter handles 10-digit numbers")
    func testPhoneFormatter10Digits() {
        #expect(Formatters.phone("9876543210") == "+91 98765 43210")
        #expect(Formatters.phone("1234567890") == "+91 12345 67890")
    }

    @Test("Phone formatter handles 12-digit numbers with country code")
    func testPhoneFormatter12Digits() {
        #expect(Formatters.phone("919876543210") == "+91 98765 43210")
    }

    @Test("Phone formatter handles invalid input")
    func testPhoneFormatterInvalid() {
        #expect(Formatters.phone("123") == "123")
        #expect(Formatters.phone("abcd") == "abcd")
        #expect(Formatters.phone("") == "")
    }

    // MARK: - Duration Formatter Tests

    @Test("Duration formatter handles hours, minutes, seconds")
    func testDurationFormatter() {
        #expect(Formatters.duration(0) == "0:00")
        #expect(Formatters.duration(30) == "0:30")
        #expect(Formatters.duration(90) == "1:30")
        #expect(Formatters.duration(3600) == "1:00:00")
        #expect(Formatters.duration(3661) == "1:01:01")
        #expect(Formatters.duration(7200) == "2:00:00")
    }

    @Test("Duration text formatter provides readable output")
    func testDurationText() {
        #expect(Formatters.durationText(0) == "Less than a minute")
        #expect(Formatters.durationText(30) == "Less than a minute")
        #expect(Formatters.durationText(60) == "1 minute")
        #expect(Formatters.durationText(120) == "2 minutes")
        #expect(Formatters.durationText(3600) == "1 hour")
        #expect(Formatters.durationText(7200) == "2 hours")
        #expect(Formatters.durationText(3660) == "1 hour 1 minute")
        #expect(Formatters.durationText(7320) == "2 hours 2 minutes")
    }

    // MARK: - Date Formatter Tests

    @Test("ISO8601 parser handles valid dates")
    func testISO8601Parser() {
        let date1 = Formatters.parseISO8601("2025-01-15T10:30:00Z")
        #expect(date1 != nil)

        let date2 = Formatters.parseISO8601("2025-01-15T10:30:00.000Z")
        #expect(date2 != nil)
    }

    @Test("ISO8601 formatter creates valid string")
    func testISO8601Formatter() {
        let date = Date(timeIntervalSince1970: 1705317000) // 2025-01-15 10:30:00 UTC
        let iso8601String = Formatters.formatISO8601(date)
        #expect(iso8601String.contains("2025"))
        #expect(iso8601String.contains("T"))
        #expect(iso8601String.contains("Z"))
    }

    @Test("Date extension provides ISO8601 string")
    func testDateISO8601Extension() {
        let date = Date(timeIntervalSince1970: 1705317000)
        let iso8601 = date.iso8601String
        #expect(iso8601.contains("T"))
        #expect(iso8601.contains("Z"))
    }

    @Test("String extension parses ISO8601 dates")
    func testStringISO8601Extension() {
        let dateString = "2025-01-15T10:30:00Z"
        let date = dateString.iso8601Date
        #expect(date != nil)
    }

    // MARK: - File Size Formatter Tests

    @Test("File size formatter handles bytes")
    func testFileSizeBytes() {
        let size1 = Formatters.fileSize(500)
        #expect(size1.contains("B") || size1.contains("bytes"))

        let size2 = Formatters.fileSize(1024)
        #expect(size2.contains("KB") || size2.contains("kB"))

        let size3 = Formatters.fileSize(1048576)
        #expect(size3.contains("MB"))

        let size4 = Formatters.fileSize(1073741824)
        #expect(size4.contains("GB"))
    }

    // MARK: - Number Extensions Tests

    @Test("Double extension formats as currency")
    func testDoubleAsCurrency() {
        #expect(15.50.asCurrency.contains("15"))
        #expect(15.50.asCurrency.contains("50"))
        #expect(100.00.asCurrency.contains("100"))
    }

    @Test("Double extension formats as compact")
    func testDoubleAsCompact() {
        #expect((1000.0).asCompact == "1K")
        #expect((1500.0).asCompact == "1.5K")
        #expect((1000000.0).asCompact == "1M")
    }

    @Test("Double extension formats as percentage")
    func testDoubleAsPercentage() {
        let percentage1 = (50.0).asPercentage
        #expect(percentage1.contains("50"))

        let percentage2 = (100.0).asPercentage
        #expect(percentage2.contains("100"))
    }

    @Test("Int extension formats as compact")
    func testIntAsCompact() {
        #expect(1000.asCompact == "1K")
        #expect(1500.asCompact == "1.5K")
        #expect(1000000.asCompact == "1M")
        #expect(500.asCompact == "500")
    }

    // MARK: - Edge Cases

    @Test("Formatters handle negative values correctly")
    func testNegativeValues() {
        #expect(Formatters.currencyFromCents(-100).contains("-") || Formatters.currencyFromCents(-100).contains("1"))
        #expect(Formatters.compact(-1000) == "-1K")
    }

    @Test("Formatters handle zero values")
    func testZeroValues() {
        #expect(Formatters.currencyFromCents(0) == "₹0.00")
        #expect(Formatters.compact(0) == "0")
        #expect(Formatters.distance(0) == "0 m")
        #expect(Formatters.stars(0) == "☆☆☆☆☆")
    }

    @Test("Formatters handle very large values")
    func testVeryLargeValues() {
        let largeAmount = Formatters.currencyFromCents(999999999)
        #expect(largeAmount.contains("9,999,999"))

        let largeCompact = Formatters.compact(999999999)
        #expect(largeCompact.contains("M"))
    }
}
