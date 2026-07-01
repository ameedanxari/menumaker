import Testing
import UIKit
@testable import MenuMaker

@MainActor
struct ImageServiceTests {
    @Test("Image upload validation accepts decodable supported image data")
    func validationAcceptsSupportedImageData() throws {
        let data = try #require(Self.testImageData())
        try ImageService.shared.validateUploadData(data, mimeType: "image/jpeg")
    }

    @Test("Image upload validation trims safe MIME metadata")
    func validationTrimsSafeMimeMetadata() throws {
        let data = try #require(Self.testImageData())

        try ImageService.shared.validateUploadData(data, mimeType: " image/jpeg ")
        #expect(try ImageService.shared.normalizedUploadMimeType(" image/png ") == "image/png")
    }

    @Test("Image upload validation rejects unsupported MIME types")
    func validationRejectsUnsupportedType() throws {
        do {
            try ImageService.shared.validateUploadData(Data("not-json".utf8), mimeType: "application/json")
            Issue.record("Expected unsupported image type")
        } catch ImageError.unsupportedType {
            #expect(true)
        }
    }

    @Test("Image upload validation rejects raw unsafe MIME controls before trimming")
    func validationRejectsUnsafeMimeControlsBeforeTrimming() throws {
        let data = try #require(Self.testImageData())

        do {
            try ImageService.shared.validateUploadData(data, mimeType: "\u{FEFF}image/jpeg")
            Issue.record("Expected unsafe MIME metadata rejection")
        } catch ImageError.invalidUploadMetadata(let message) {
            #expect(message.contains("unsafe control characters"))
        }
    }

    @Test("Image upload validation rejects blank MIME metadata")
    func validationRejectsBlankMimeMetadata() throws {
        let data = try #require(Self.testImageData())

        do {
            try ImageService.shared.validateUploadData(data, mimeType: "   ")
            Issue.record("Expected blank MIME metadata rejection")
        } catch ImageError.invalidUploadMetadata(let message) {
            #expect(message.contains("required"))
        }
    }

    @Test("Image upload validation rejects malformed MIME metadata")
    func validationRejectsMalformedMimeMetadata() throws {
        let data = try #require(Self.testImageData())

        do {
            try ImageService.shared.validateUploadData(data, mimeType: "image")
            Issue.record("Expected malformed MIME metadata rejection")
        } catch ImageError.invalidUploadMetadata(let message) {
            #expect(message.contains("invalid"))
        }
    }

    @Test("Image upload endpoint normalization keeps canonical media upload path")
    func uploadEndpointKeepsCanonicalMediaPath() throws {
        #expect(try ImageService.shared.normalizedUploadEndpoint(" /media/upload ") == "/media/upload")
    }

    @Test("Image upload endpoint normalization maps legacy aliases to media upload")
    func uploadEndpointMapsLegacyAliases() throws {
        #expect(try ImageService.shared.normalizedUploadEndpoint("/upload/dish-image") == "/media/upload")
        #expect(try ImageService.shared.normalizedUploadEndpoint("/upload/review-image") == "/media/upload")
        #expect(try ImageService.shared.normalizedUploadEndpoint("/upload/business-logo") == "/media/upload")
    }

    @Test("Image upload endpoint validation rejects raw unsafe controls before trimming")
    func uploadEndpointRejectsRawUnsafeControlsBeforeTrimming() throws {
        do {
            _ = try ImageService.shared.normalizedUploadEndpoint("\u{FEFF}/media/upload")
            Issue.record("Expected unsafe upload endpoint rejection")
        } catch ImageError.invalidUploadEndpoint(let message) {
            #expect(message.contains("unsafe control characters"))
        }
    }

    @Test("Image upload endpoint validation rejects blank endpoints")
    func uploadEndpointRejectsBlankValues() throws {
        do {
            _ = try ImageService.shared.normalizedUploadEndpoint("   ")
            Issue.record("Expected blank upload endpoint rejection")
        } catch ImageError.invalidUploadEndpoint(let message) {
            #expect(message.contains("required"))
        }
    }

    @Test("Image upload endpoint validation rejects unsupported upload routes")
    func uploadEndpointRejectsUnsupportedRoutes() throws {
        do {
            _ = try ImageService.shared.normalizedUploadEndpoint("/ocr/extract-from-image")
            Issue.record("Expected unsupported upload endpoint rejection")
        } catch ImageError.invalidUploadEndpoint(let message) {
            #expect(message.contains("Unsupported upload endpoint"))
        }
    }

    @Test("Image upload validation rejects oversized payloads before decode")
    func validationRejectsOversizedData() throws {
        let oversized = Data(repeating: 0xFF, count: ImageService.maxUploadBytes + 1)

        do {
            try ImageService.shared.validateUploadData(oversized, mimeType: "image/jpeg")
            Issue.record("Expected oversized image rejection")
        } catch ImageError.oversized {
            #expect(true)
        }
    }

    @Test("Image upload validation rejects corrupt image bytes")
    func validationRejectsInvalidImageData() throws {
        do {
            try ImageService.shared.validateUploadData(Data("not an image".utf8), mimeType: "image/jpeg")
            Issue.record("Expected invalid image data rejection")
        } catch ImageError.invalidData {
            #expect(true)
        }
    }

    @Test("Image processing resizes large images within the upload envelope")
    func resizeAndCompressionProduceBoundedImageData() throws {
        let image = UIGraphicsImageRenderer(size: CGSize(width: 2_000, height: 1_200)).image { context in
            UIColor.systemOrange.setFill()
            context.fill(CGRect(x: 0, y: 0, width: 2_000, height: 1_200))
        }

        let resized = try #require(ImageService.shared.resizeToFit(image, maxSize: 512))
        #expect(resized.size.width <= 512 || resized.size.height <= 512)

        let compressed = try #require(ImageService.shared.compress(resized))
        #expect(ImageService.shared.validateImageData(compressed))
        try ImageService.shared.validateUploadData(compressed, mimeType: "image/jpeg")
    }

    private static func testImageData() -> Data? {
        let image = UIGraphicsImageRenderer(size: CGSize(width: 8, height: 8)).image { context in
            UIColor.systemBlue.setFill()
            context.fill(CGRect(x: 0, y: 0, width: 8, height: 8))
        }
        return image.jpegData(compressionQuality: 0.9)
    }
}
