import Foundation
import Combine
import UIKit
import PhotosUI
import SwiftUI

/// Image service for handling image operations
@MainActor
class ImageService: ObservableObject {
    static let shared = ImageService()

    private let compressionQuality: CGFloat = 0.8
    private let maxImageSize: CGFloat = 1024
    static let maxUploadBytes = 10 * 1024 * 1024
    private static let supportedUploadMimeTypes: Set<String> = ["image/jpeg", "image/png", "image/heic", "image/heif"]
    private static let canonicalUploadEndpoint = "/media/upload"
    private static let legacyUploadEndpointAliases: Set<String> = [
        "/upload/business-logo",
        "/upload/dish-image",
        "/upload/review-image",
    ]
    private static let unsafeUploadMetadataScalarValues: Set<UInt32> = {
        var values = Set<UInt32>()
        values.formUnion(0x00...0x1F)
        values.formUnion(0x7F...0x9F)
        values.formUnion([
            0x00AD,
            0x061C,
            0x200B,
            0x200C,
            0x200D,
            0x200E,
            0x200F,
            0x202A,
            0x202B,
            0x202C,
            0x202D,
            0x202E,
            0x2060,
            0x2061,
            0x2062,
            0x2063,
            0x2064,
            0x2066,
            0x2067,
            0x2068,
            0x2069,
            0xFEFF,
        ])
        return values
    }()

    private init() {}

    // MARK: - Image Loading

    func loadImage(from url: URL) async throws -> UIImage {
        let (data, _) = try await URLSession.shared.data(from: url)

        guard let image = UIImage(data: data) else {
            throw ImageError.invalidData
        }

        return image
    }

    func loadImage(from urlString: String) async throws -> UIImage {
        guard let url = URL(string: urlString) else {
            throw ImageError.invalidURL
        }

        return try await loadImage(from: url)
    }

    // MARK: - Image Processing

    func compress(_ image: UIImage, quality: CGFloat? = nil) -> Data? {
        image.jpegData(compressionQuality: quality ?? compressionQuality)
    }

    func resize(_ image: UIImage, to size: CGSize) -> UIImage? {
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: size))
        }
    }

    func resizeToFit(_ image: UIImage, maxSize: CGFloat? = nil) -> UIImage? {
        let targetSize = maxSize ?? maxImageSize
        let size = image.size

        if size.width <= targetSize && size.height <= targetSize {
            return image
        }

        let aspectRatio = size.width / size.height
        var newSize: CGSize

        if size.width > size.height {
            newSize = CGSize(width: targetSize, height: targetSize / aspectRatio)
        } else {
            newSize = CGSize(width: targetSize * aspectRatio, height: targetSize)
        }

        return resize(image, to: newSize)
    }

    func thumbnail(_ image: UIImage, size: CGFloat = 100) -> UIImage? {
        resize(image, to: CGSize(width: size, height: size))
    }

    // MARK: - Image Upload

    func uploadImage(_ image: UIImage, to endpoint: String) async throws -> String {
        let uploadEndpoint = try normalizedUploadEndpoint(endpoint)

        // Resize and compress
        guard let resizedImage = resizeToFit(image),
              let imageData = compress(resizedImage) else {
            throw ImageError.compressionFailed
        }

        guard validateImageData(imageData) else {
            throw ImageError.oversized
        }

        // Upload to backend
        let responseData = try await APIClient.shared.uploadImage(
            endpoint: uploadEndpoint,
            image: imageData,
            fileName: "image_\(UUID().uuidString).jpg"
        )

        // Parse response to get image URL
        struct UploadEnvelope: Decodable {
            struct UploadData: Decodable {
                let url: String
            }

            let url: String?
            let data: UploadData?
        }

        let decoder = JSONDecoder()
        let response = try decoder.decode(UploadEnvelope.self, from: responseData)

        if let url = response.url ?? response.data?.url {
            return url
        }

        throw ImageError.uploadFailed
    }

    func normalizedUploadEndpoint(_ endpoint: String) throws -> String {
        guard !Self.containsUnsafeUploadMetadataControls(endpoint) else {
            throw ImageError.invalidUploadEndpoint("Upload endpoint contains unsafe control characters")
        }

        let normalizedEndpoint = endpoint.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedEndpoint.isEmpty else {
            throw ImageError.invalidUploadEndpoint("Upload endpoint is required")
        }

        guard normalizedEndpoint.rangeOfCharacter(from: .whitespacesAndNewlines) == nil else {
            throw ImageError.invalidUploadEndpoint("Upload endpoint contains unsafe control characters")
        }

        if normalizedEndpoint == Self.canonicalUploadEndpoint ||
            Self.legacyUploadEndpointAliases.contains(normalizedEndpoint) {
            return Self.canonicalUploadEndpoint
        }

        throw ImageError.invalidUploadEndpoint("Unsupported upload endpoint")
    }

    // MARK: - Image Picker

    func presentImagePicker(sourceType: UIImagePickerController.SourceType = .photoLibrary) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = sourceType
        picker.allowsEditing = true
        return picker
    }

    // MARK: - Photo Library

    func saveToPhotoLibrary(_ image: UIImage) async throws {
        try await PHPhotoLibrary.shared().performChanges {
            PHAssetChangeRequest.creationRequestForAsset(from: image)
        }
    }

    // MARK: - Cache Management

    private var imageCache = NSCache<NSString, UIImage>()

    func cacheImage(_ image: UIImage, forKey key: String) {
        imageCache.setObject(image, forKey: key as NSString)
    }

    func getCachedImage(forKey key: String) -> UIImage? {
        imageCache.object(forKey: key as NSString)
    }

    func clearCache() {
        imageCache.removeAllObjects()
    }

    // MARK: - Image Validation

    func validateImage(_ image: UIImage) -> Bool {
        let size = image.size
        return size.width > 0 && size.height > 0
    }

    func validateImageData(_ data: Data, maxSizeInMB: Double = 10) -> Bool {
        let sizeInMB = Double(data.count) / 1024 / 1024
        return sizeInMB <= maxSizeInMB
    }

    func normalizedUploadMimeType(_ mimeType: String) throws -> String {
        guard !Self.containsUnsafeUploadMetadataControls(mimeType) else {
            throw ImageError.invalidUploadMetadata("Upload MIME type contains unsafe control characters")
        }

        let normalizedMimeType = mimeType.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedMimeType.isEmpty else {
            throw ImageError.invalidUploadMetadata("Upload MIME type is required")
        }

        let forbiddenCharacters = CharacterSet(charactersIn: #"\";,"#)
        guard normalizedMimeType.rangeOfCharacter(from: .whitespacesAndNewlines) == nil,
              normalizedMimeType.rangeOfCharacter(from: forbiddenCharacters) == nil else {
            throw ImageError.invalidUploadMetadata("Upload MIME type contains unsafe control characters")
        }

        let parts = normalizedMimeType.split(separator: "/", omittingEmptySubsequences: false)
        guard parts.count == 2, !parts[0].isEmpty, !parts[1].isEmpty else {
            throw ImageError.invalidUploadMetadata("Upload MIME type is invalid")
        }

        return normalizedMimeType
    }

    func validateUploadData(_ data: Data, mimeType: String) throws {
        let normalizedMimeType = try normalizedUploadMimeType(mimeType)
        guard Self.supportedUploadMimeTypes.contains(normalizedMimeType) else {
            throw ImageError.unsupportedType
        }
        guard data.count <= Self.maxUploadBytes else {
            throw ImageError.oversized
        }
        guard UIImage(data: data) != nil else {
            throw ImageError.invalidData
        }
    }

    private static func containsUnsafeUploadMetadataControls(_ value: String) -> Bool {
        value.unicodeScalars.contains { unsafeUploadMetadataScalarValues.contains($0.value) }
    }
}

// MARK: - Image Error

enum ImageError: Error, LocalizedError {
    case invalidURL
    case invalidData
    case compressionFailed
    case uploadFailed
    case downloadFailed
    case oversized
    case unsupportedType
    case invalidUploadMetadata(String)
    case invalidUploadEndpoint(String)
    case cancelled

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid image URL"
        case .invalidData:
            return "Invalid image data"
        case .compressionFailed:
            return "Failed to compress image"
        case .uploadFailed:
            return "Failed to upload image"
        case .downloadFailed:
            return "Failed to download image"
        case .oversized:
            return "Image is too large. Choose an image under 10 MB."
        case .unsupportedType:
            return "Unsupported image type. Choose JPEG, PNG, HEIC, or HEIF."
        case .invalidUploadMetadata(let message):
            return message
        case .invalidUploadEndpoint(let message):
            return message
        case .cancelled:
            return "Image upload was cancelled."
        }
    }
}
