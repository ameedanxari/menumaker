import Foundation
import Combine
import AVFoundation
import UIKit

/// Camera service for capturing photos
@MainActor
class CameraService: NSObject, ObservableObject {
    static let shared = CameraService()

    @Published var authorizationStatus: AVAuthorizationStatus = .notDetermined
    @Published var capturedImage: UIImage?

    private var captureSession: AVCaptureSession?
    private var photoOutput: AVCapturePhotoOutput?
    private var previewLayer: AVCaptureVideoPreviewLayer?

    override private init() {
        super.init()
        checkAuthorizationStatus()
    }

    // MARK: - Authorization

    func checkAuthorizationStatus() {
        authorizationStatus = AVCaptureDevice.authorizationStatus(for: .video)
    }

    func requestAuthorization() async -> Bool {
        await AVCaptureDevice.requestAccess(for: .video)
    }

    // MARK: - Camera Availability

    func isCameraAvailable() -> Bool {
        UIImagePickerController.isSourceTypeAvailable(.camera)
    }

    func hasFlash() -> Bool {
        guard let device = AVCaptureDevice.default(for: .video) else { return false }
        return device.hasFlash
    }

    // MARK: - Capture Session

    func setupCaptureSession() async throws -> AVCaptureVideoPreviewLayer {
        let session = AVCaptureSession()
        session.sessionPreset = .photo

        guard let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) else {
            throw CameraError.cameraNotAvailable
        }

        let input = try AVCaptureDeviceInput(device: camera)

        guard session.canAddInput(input) else {
            throw CameraError.cannotAddInput
        }

        session.addInput(input)

        let output = AVCapturePhotoOutput()

        guard session.canAddOutput(output) else {
            throw CameraError.cannotAddOutput
        }

        session.addOutput(output)

        self.captureSession = session
        self.photoOutput = output

        let previewLayer = AVCaptureVideoPreviewLayer(session: session)
        previewLayer.videoGravity = .resizeAspectFill

        self.previewLayer = previewLayer

        return previewLayer
    }

    func startSession() {
        Task {
            captureSession?.startRunning()
        }
    }

    func stopSession() {
        Task {
            captureSession?.stopRunning()
        }
    }

    // MARK: - Photo Capture

    func capturePhoto() async throws -> UIImage {
        guard let photoOutput = photoOutput else {
            throw CameraError.notConfigured
        }

        return try await withCheckedThrowingContinuation { continuation in
            let settings = AVCapturePhotoSettings()

            // Use HEVC if available for better compression
            if let hevcCodec = photoOutput.availablePhotoCodecTypes.first(where: { $0 == .hevc }) {
                let formatSettings: [String: Any] = [
                    AVVideoCodecKey: hevcCodec
                ]
                let photoSettings = AVCapturePhotoSettings(format: formatSettings)

                let delegate = PhotoCaptureDelegate { result in
                    continuation.resume(with: result)
                }

                photoOutput.capturePhoto(with: photoSettings, delegate: delegate)
            } else {
                // Use default settings
                let delegate = PhotoCaptureDelegate { result in
                    continuation.resume(with: result)
                }

                photoOutput.capturePhoto(with: settings, delegate: delegate)
            }
        }
    }

    // MARK: - Quick Capture

    func quickCapture() async throws -> UIImage {
        if authorizationStatus != .authorized {
            let granted = await requestAuthorization()
            guard granted else {
                throw CameraError.notAuthorized
            }
        }

        _ = try await setupCaptureSession()
        startSession()

        // Give camera time to warm up
        try await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds

        let image = try await capturePhoto()
        stopSession()

        return image
    }

    // MARK: - Flash Control

    func toggleFlash() throws {
        guard let device = AVCaptureDevice.default(for: .video),
              device.hasFlash else {
            throw CameraError.flashNotAvailable
        }

        try device.lockForConfiguration()

        if device.torchMode == .on {
            device.torchMode = .off
        } else {
            device.torchMode = .on
        }

        device.unlockForConfiguration()
    }
}

// MARK: - Camera Error

enum CameraError: Error, LocalizedError {
    case notAuthorized
    case cameraNotAvailable
    case cannotAddInput
    case cannotAddOutput
    case notConfigured
    case captureFailed
    case flashNotAvailable

    var errorDescription: String? {
        switch self {
        case .notAuthorized:
            return "Camera access not authorized"
        case .cameraNotAvailable:
            return "Camera is not available"
        case .cannotAddInput:
            return "Cannot add camera input"
        case .cannotAddOutput:
            return "Cannot add photo output"
        case .notConfigured:
            return "Camera not configured"
        case .captureFailed:
            return "Photo capture failed"
        case .flashNotAvailable:
            return "Flash is not available"
        }
    }
}

// MARK: - Photo Capture Delegate

private class PhotoCaptureDelegate: NSObject, AVCapturePhotoCaptureDelegate {
    private let completion: (Result<UIImage, Error>) -> Void

    init(completion: @escaping (Result<UIImage, Error>) -> Void) {
        self.completion = completion
    }

    func photoOutput(
        _ output: AVCapturePhotoOutput,
        didFinishProcessingPhoto photo: AVCapturePhoto,
        error: Error?
    ) {
        if let error = error {
            completion(.failure(error))
            return
        }

        guard let imageData = photo.fileDataRepresentation(),
              let image = UIImage(data: imageData) else {
            completion(.failure(CameraError.captureFailed))
            return
        }

        completion(.success(image))
    }
}
