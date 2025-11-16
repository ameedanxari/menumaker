import Foundation
import Combine
import LocalAuthentication

/// Biometric authentication errors
enum BiometricError: Error, LocalizedError {
    case notAvailable
    case notEnrolled
    case authenticationFailed
    case userCancel
    case systemCancel
    case passcodeNotSet
    case biometryLockout
    case unknown

    var errorDescription: String? {
        switch self {
        case .notAvailable:
            return "Biometric authentication is not available on this device"
        case .notEnrolled:
            return "No biometric authentication is enrolled"
        case .authenticationFailed:
            return "Authentication failed"
        case .userCancel:
            return "User cancelled authentication"
        case .systemCancel:
            return "System cancelled authentication"
        case .passcodeNotSet:
            return "Passcode is not set"
        case .biometryLockout:
            return "Biometric authentication is locked. Please try again later."
        case .unknown:
            return "An unknown error occurred"
        }
    }
}

/// Biometric authentication type
enum BiometricType {
    case none
    case touchID
    case faceID

    var displayName: String {
        switch self {
        case .none:
            return "None"
        case .touchID:
            return "Touch ID"
        case .faceID:
            return "Face ID"
        }
    }
}

/// Biometric authentication service
@MainActor
class BiometricService: ObservableObject {
    static let shared = BiometricService()

    @Published var biometricType: BiometricType = .none
    @Published var isAvailable: Bool = false

    private let context = LAContext()
    private let reason = "Authenticate to access your account"

    private init() {
        checkBiometricAvailability()
    }

    // MARK: - Availability Check

    func checkBiometricAvailability() {
        var error: NSError?
        let canEvaluate = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)

        isAvailable = canEvaluate

        if canEvaluate {
            switch context.biometryType {
            case .faceID:
                biometricType = .faceID
            case .touchID:
                biometricType = .touchID
            case .opticID:
                biometricType = .faceID  // Treat opticID similar to faceID
            case .none:
                biometricType = .none
            @unknown default:
                biometricType = .none
            }
        } else {
            biometricType = .none
        }
    }

    // MARK: - Authentication

    func authenticate(reason: String? = nil) async throws -> Bool {
        let context = LAContext()
        var error: NSError?

        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            if let error = error {
                throw mapError(error)
            }
            throw BiometricError.notAvailable
        }

        do {
            let success = try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: reason ?? self.reason
            )
            return success
        } catch let error as LAError {
            throw mapLAError(error)
        } catch {
            throw BiometricError.unknown
        }
    }

    func authenticateWithPasscode(reason: String? = nil) async throws -> Bool {
        let context = LAContext()

        do {
            let success = try await context.evaluatePolicy(
                .deviceOwnerAuthentication,
                localizedReason: reason ?? self.reason
            )
            return success
        } catch let error as LAError {
            throw mapLAError(error)
        } catch {
            throw BiometricError.unknown
        }
    }

    // MARK: - Settings

    func isBiometricEnabled() -> Bool {
        UserDefaults.standard.bool(forKey: AppConstants.UserDefaultsKeys.biometricAuthEnabled)
    }

    func setBiometricEnabled(_ enabled: Bool) {
        UserDefaults.standard.set(enabled, forKey: AppConstants.UserDefaultsKeys.biometricAuthEnabled)
    }

    // MARK: - Error Mapping

    private func mapLAError(_ error: LAError) -> BiometricError {
        switch error.code {
        case .authenticationFailed:
            return .authenticationFailed
        case .userCancel:
            return .userCancel
        case .systemCancel:
            return .systemCancel
        case .passcodeNotSet:
            return .passcodeNotSet
        case .biometryNotAvailable:
            return .notAvailable
        case .biometryNotEnrolled:
            return .notEnrolled
        case .biometryLockout:
            return .biometryLockout
        default:
            return .unknown
        }
    }

    private func mapError(_ error: NSError) -> BiometricError {
        guard let laError = error as? LAError else {
            return .unknown
        }
        return mapLAError(laError)
    }
}
