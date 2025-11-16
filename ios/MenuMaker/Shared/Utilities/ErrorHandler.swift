import Foundation
import SwiftUI

// MARK: - Error Handler

/// Centralized error handling for the application
class ErrorHandler {
    static let shared = ErrorHandler()

    private init() {}

    /// Handle error and return user-friendly message
    func handle(_ error: Error) -> String {
        if let apiError = error as? APIError {
            return handleAPIError(apiError)
        }

        if let urlError = error as? URLError {
            return handleURLError(urlError)
        }

        if let decodingError = error as? DecodingError {
            return handleDecodingError(decodingError)
        }

        return error.localizedDescription
    }

    /// Log error for debugging
    func log(_ error: Error, context: String? = nil) {
        #if DEBUG
        if let context = context {
            print("Error in \(context): \(error)")
        } else {
            print("Error: \(error)")
        }

        if let apiError = error as? APIError {
            print("API Error Details: \(apiError.errorDescription ?? "Unknown")")
        }
        #endif
    }

    // MARK: - Private Methods

    private func handleAPIError(_ error: APIError) -> String {
        return error.errorDescription ?? "error_unknown".localized
    }

    private func handleURLError(_ error: URLError) -> String {
        switch error.code {
        case .notConnectedToInternet:
            return "error_network".localized
        case .timedOut:
            return "Request timed out. Please try again."
        case .cannotFindHost, .cannotConnectToHost:
            return "Cannot connect to server. Please check your connection."
        case .networkConnectionLost:
            return "Network connection lost. Please try again."
        default:
            return "error_network".localized
        }
    }

    private func handleDecodingError(_ error: DecodingError) -> String {
        switch error {
        case .dataCorrupted(let context):
            #if DEBUG
            print("Data corrupted: \(context.debugDescription)")
            #endif
            return "Invalid data received from server."

        case .keyNotFound(let key, let context):
            #if DEBUG
            print("Key '\(key.stringValue)' not found: \(context.debugDescription)")
            #endif
            return "Invalid data structure received from server."

        case .typeMismatch(let type, let context):
            #if DEBUG
            print("Type mismatch for type \(type): \(context.debugDescription)")
            #endif
            return "Invalid data type received from server."

        case .valueNotFound(let type, let context):
            #if DEBUG
            print("Value not found for type \(type): \(context.debugDescription)")
            #endif
            return "Missing data received from server."

        @unknown default:
            return "Failed to process server response."
        }
    }
}

// MARK: - Error Alert Modifier

struct ErrorAlert: ViewModifier {
    @Binding var error: Error?

    func body(content: Content) -> some View {
        content
            .alert("error_occurred".localized, isPresented: .constant(error != nil)) {
                Button("ok".localized) {
                    error = nil
                }
            } message: {
                if let error = error {
                    Text(ErrorHandler.shared.handle(error))
                }
            }
    }
}

extension View {
    func errorAlert(_ error: Binding<Error?>) -> some View {
        modifier(ErrorAlert(error: error))
    }
}

// MARK: - Result Extensions for Error Handling

extension Result {
    /// Get value or throw error
    func get() throws -> Success {
        switch self {
        case .success(let value):
            return value
        case .failure(let error):
            throw error
        }
    }

    /// Get value or return nil
    var value: Success? {
        switch self {
        case .success(let value):
            return value
        case .failure:
            return nil
        }
    }

    /// Get error or return nil
    var error: Failure? {
        switch self {
        case .success:
            return nil
        case .failure(let error):
            return error
        }
    }

    /// Map success value
    func map<NewSuccess>(_ transform: (Success) -> NewSuccess) -> Result<NewSuccess, Failure> {
        switch self {
        case .success(let value):
            return .success(transform(value))
        case .failure(let error):
            return .failure(error)
        }
    }

    /// Map error value
    func mapError<NewFailure>(_ transform: (Failure) -> NewFailure) -> Result<Success, NewFailure> {
        switch self {
        case .success(let value):
            return .success(value)
        case .failure(let error):
            return .failure(transform(error))
        }
    }
}

// MARK: - Validation Error

enum ValidationError: LocalizedError {
    case emptyField(String)
    case invalidEmail
    case invalidPhone
    case passwordTooShort(minLength: Int)
    case invalidFormat(String)
    case outOfRange(field: String, min: Double?, max: Double?)
    case custom(String)

    var errorDescription: String? {
        switch self {
        case .emptyField(let field):
            return "\(field) cannot be empty"
        case .invalidEmail:
            return "error_invalid_email".localized
        case .invalidPhone:
            return "Please enter a valid phone number"
        case .passwordTooShort(let minLength):
            return "Password must be at least \(minLength) characters"
        case .invalidFormat(let field):
            return "\(field) has invalid format"
        case .outOfRange(let field, let min, let max):
            if let min = min, let max = max {
                return "\(field) must be between \(min) and \(max)"
            } else if let min = min {
                return "\(field) must be at least \(min)"
            } else if let max = max {
                return "\(field) must be at most \(max)"
            } else {
                return "\(field) is out of valid range"
            }
        case .custom(let message):
            return message
        }
    }
}

// MARK: - Input Validator

struct InputValidator {
    /// Validate email format
    static func validateEmail(_ email: String) -> Result<String, ValidationError> {
        let trimmed = email.trimmed
        guard !trimmed.isEmpty else {
            return .failure(.emptyField("Email"))
        }
        guard trimmed.isValidEmail else {
            return .failure(.invalidEmail)
        }
        return .success(trimmed)
    }

    /// Validate password
    static func validatePassword(_ password: String, minLength: Int = 6) -> Result<String, ValidationError> {
        guard !password.isEmpty else {
            return .failure(.emptyField("Password"))
        }
        guard password.count >= minLength else {
            return .failure(.passwordTooShort(minLength: minLength))
        }
        return .success(password)
    }

    /// Validate phone number
    static func validatePhone(_ phone: String) -> Result<String, ValidationError> {
        let trimmed = phone.trimmed
        guard !trimmed.isEmpty else {
            return .failure(.emptyField("Phone"))
        }
        guard trimmed.isValidPhone else {
            return .failure(.invalidPhone)
        }
        return .success(trimmed)
    }

    /// Validate non-empty field
    static func validateNonEmpty(_ value: String, fieldName: String) -> Result<String, ValidationError> {
        let trimmed = value.trimmed
        guard !trimmed.isEmpty else {
            return .failure(.emptyField(fieldName))
        }
        return .success(trimmed)
    }

    /// Validate number range
    static func validateRange(_ value: Double, fieldName: String, min: Double? = nil, max: Double? = nil) -> Result<Double, ValidationError> {
        if let min = min, value < min {
            return .failure(.outOfRange(field: fieldName, min: min, max: max))
        }
        if let max = max, value > max {
            return .failure(.outOfRange(field: fieldName, min: min, max: max))
        }
        return .success(value)
    }

    /// Validate price (must be positive)
    static func validatePrice(_ priceCents: Int, fieldName: String = "Price") -> Result<Int, ValidationError> {
        guard priceCents > 0 else {
            return .failure(.outOfRange(field: fieldName, min: 0.01, max: nil))
        }
        return .success(priceCents)
    }

    /// Validate rating (1-5)
    static func validateRating(_ rating: Int) -> Result<Int, ValidationError> {
        guard (1...5).contains(rating) else {
            return .failure(.outOfRange(field: "Rating", min: 1, max: 5))
        }
        return .success(rating)
    }
}

// MARK: - Async Error Handling Helpers

extension Task where Failure == Error {
    /// Retry operation with exponential backoff
    @discardableResult
    static func retry(
        maxAttempts: Int = 3,
        delay: TimeInterval = 1.0,
        operation: @escaping () async throws -> Success
    ) -> Task<Success, Error> {
        Task {
            var lastError: Error?

            for attempt in 0..<maxAttempts {
                do {
                    return try await operation()
                } catch {
                    lastError = error
                    ErrorHandler.shared.log(error, context: "Retry attempt \(attempt + 1)/\(maxAttempts)")

                    if attempt < maxAttempts - 1 {
                        let backoffDelay = delay * pow(2.0, Double(attempt))
                        try await Task<Never, Never>.sleep(seconds: backoffDelay)
                    }
                }
            }

            throw lastError ?? APIError.unknown
        }
    }
}
