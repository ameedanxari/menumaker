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
        // Resize and compress
        guard let resizedImage = resizeToFit(image),
              let imageData = compress(resizedImage) else {
            throw ImageError.compressionFailed
        }

        // Upload to backend
        let responseData = try await APIClient.shared.uploadImage(
            endpoint: endpoint,
            image: imageData,
            fileName: "image_\(UUID().uuidString).jpg"
        )

        // Parse response to get image URL
        struct UploadResponse: Decodable {
            let url: String
        }

        let decoder = JSONDecoder()
        let response = try decoder.decode(UploadResponse.self, from: responseData)

        return response.url
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
}

// MARK: - Image Error

enum ImageError: Error, LocalizedError {
    case invalidURL
    case invalidData
    case compressionFailed
    case uploadFailed
    case downloadFailed

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
        }
    }
}

// MARK: - SwiftUI Image Picker

struct ImagePicker: UIViewControllerRepresentable {
    @Binding var image: UIImage?
    @Environment(\.dismiss) var dismiss

    var sourceType: UIImagePickerController.SourceType = .photoLibrary

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = sourceType
        picker.allowsEditing = true
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: ImagePicker

        init(_ parent: ImagePicker) {
            self.parent = parent
        }

        func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey : Any]
        ) {
            if let image = info[.editedImage] as? UIImage {
                parent.image = image
            } else if let image = info[.originalImage] as? UIImage {
                parent.image = image
            }

            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}
