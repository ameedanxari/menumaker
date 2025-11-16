import Foundation
import Vision
import UIKit

/// OCR result
struct OCRResult {
    let text: String
    let confidence: Float
    let boundingBox: CGRect
}

/// OCR service for text recognition
@MainActor
class OCRService: ObservableObject {
    static let shared = OCRService()

    @Published var isProcessing = false
    @Published var recognizedText: String = ""

    private init() {}

    // MARK: - Text Recognition

    func recognizeText(in image: UIImage) async throws -> [OCRResult] {
        isProcessing = true
        defer { isProcessing = false }

        guard let cgImage = image.cgImage else {
            throw OCRError.invalidImage
        }

        return try await withCheckedThrowingContinuation { continuation in
            let request = VNRecognizeTextRequest { request, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }

                guard let observations = request.results as? [VNRecognizedTextObservation] else {
                    continuation.resume(throwing: OCRError.recognitionFailed)
                    return
                }

                let results = observations.compactMap { observation -> OCRResult? in
                    guard let topCandidate = observation.topCandidates(1).first else {
                        return nil
                    }

                    return OCRResult(
                        text: topCandidate.string,
                        confidence: topCandidate.confidence,
                        boundingBox: observation.boundingBox
                    )
                }

                continuation.resume(returning: results)
            }

            // Configure recognition level
            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = true

            // Perform request
            let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])

            do {
                try handler.perform([request])
            } catch {
                continuation.resume(throwing: error)
            }
        }
    }

    func recognizeTextSimple(in image: UIImage) async throws -> String {
        let results = try await recognizeText(in: image)
        return results.map { $0.text }.joined(separator: "\n")
    }

    // MARK: - Menu Scanning

    func scanMenu(from image: UIImage) async throws -> [String] {
        let results = try await recognizeText(in: image)

        // Filter and clean menu items
        return results
            .filter { $0.confidence > 0.5 }
            .map { $0.text.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    // MARK: - Price Detection

    func detectPrices(in image: UIImage) async throws -> [Double] {
        let text = try await recognizeTextSimple(in: image)

        // Regular expression to match prices
        // Matches patterns like: Rs. 100, ₹100, 100.00, etc.
        let pattern = #"(?:Rs\.?\s*|₹\s*)?(\d{1,5}(?:\.\d{2})?)"#

        guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else {
            return []
        }

        let matches = regex.matches(
            in: text,
            options: [],
            range: NSRange(text.startIndex..., in: text)
        )

        return matches.compactMap { match in
            guard let range = Range(match.range(at: 1), in: text) else {
                return nil
            }

            let priceString = String(text[range])
            return Double(priceString)
        }
    }

    // MARK: - Receipt Scanning

    func scanReceipt(from image: UIImage) async throws -> ReceiptData {
        let results = try await recognizeText(in: image)
        let text = results.map { $0.text }.joined(separator: "\n")

        // Extract receipt information
        let items = extractItems(from: text)
        let total = extractTotal(from: text)
        let date = extractDate(from: text)

        return ReceiptData(
            items: items,
            total: total,
            date: date,
            rawText: text
        )
    }

    // MARK: - Helpers

    private func extractItems(from text: String) -> [String] {
        // Simple line-based extraction
        text.components(separatedBy: .newlines)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty && $0.count > 3 }
    }

    private func extractTotal(from text: String) -> Double? {
        // Look for "Total" or "Amount" followed by a number
        let pattern = #"(?:Total|Amount|Grand Total).*?(\d{1,6}(?:\.\d{2})?)"#

        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive),
              let match = regex.firstMatch(in: text, options: [], range: NSRange(text.startIndex..., in: text)),
              let range = Range(match.range(at: 1), in: text) else {
            return nil
        }

        let totalString = String(text[range])
        return Double(totalString)
    }

    private func extractDate(from text: String) -> Date? {
        // Simple date extraction - could be improved
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "dd/MM/yyyy"

        let pattern = #"\d{1,2}/\d{1,2}/\d{4}"#

        guard let regex = try? NSRegularExpression(pattern: pattern, options: []),
              let match = regex.firstMatch(in: text, options: [], range: NSRange(text.startIndex..., in: text)),
              let range = Range(match.range, in: text) else {
            return nil
        }

        let dateString = String(text[range])
        return dateFormatter.date(from: dateString)
    }
}

// MARK: - OCR Error

enum OCRError: Error, LocalizedError {
    case invalidImage
    case recognitionFailed
    case noTextFound

    var errorDescription: String? {
        switch self {
        case .invalidImage:
            return "Invalid image for OCR"
        case .recognitionFailed:
            return "Text recognition failed"
        case .noTextFound:
            return "No text found in image"
        }
    }
}

// MARK: - Receipt Data

struct ReceiptData {
    let items: [String]
    let total: Double?
    let date: Date?
    let rawText: String
}
