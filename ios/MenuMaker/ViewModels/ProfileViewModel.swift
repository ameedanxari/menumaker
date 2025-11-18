import Foundation
import Combine

@MainActor
class ProfileViewModel: ObservableObject {
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var successMessage: String?

    private let apiClient = APIClient.shared
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Profile Update

    func updateProfile(name: String?, phone: String?, address: String?) async -> Bool {
        isLoading = true
        errorMessage = nil
        successMessage = nil

        do {
            let request = UpdateProfileRequest(
                name: name,
                phone: phone,
                address: address
            )

            let response: UserResponse = try await apiClient.request(
                endpoint: AppConstants.API.Endpoints.updateProfile,
                method: .patch,
                body: request
            )

            // Update the user in AuthViewModel
            NotificationCenter.default.post(
                name: NSNotification.Name("UserProfileUpdated"),
                object: nil,
                userInfo: ["user": response.data.user]
            )

            successMessage = "Profile updated successfully"
            isLoading = false
            return true
        } catch let error as APIError {
            errorMessage = error.errorDescription
            isLoading = false
            return false
        } catch {
            errorMessage = "Failed to update profile"
            isLoading = false
            return false
        }
    }

    // MARK: - Change Password

    func changePassword(currentPassword: String, newPassword: String, confirmPassword: String) async -> Bool {
        isLoading = true
        errorMessage = nil
        successMessage = nil

        // Validate inputs
        guard !currentPassword.isEmpty else {
            errorMessage = "Current password is required"
            isLoading = false
            return false
        }

        guard !newPassword.isEmpty else {
            errorMessage = "New password is required"
            isLoading = false
            return false
        }

        guard newPassword.count >= AppConstants.Validation.minPasswordLength else {
            errorMessage = "Password must be at least \(AppConstants.Validation.minPasswordLength) characters"
            isLoading = false
            return false
        }

        guard newPassword == confirmPassword else {
            errorMessage = "Passwords do not match"
            isLoading = false
            return false
        }

        do {
            let request = ChangePasswordRequest(
                currentPassword: currentPassword,
                newPassword: newPassword
            )

            let _: MessageResponse = try await apiClient.request(
                endpoint: AppConstants.API.Endpoints.changePassword,
                method: .post,
                body: request
            )

            successMessage = "Password changed successfully"
            isLoading = false
            return true
        } catch let error as APIError {
            errorMessage = error.errorDescription
            isLoading = false
            return false
        } catch {
            errorMessage = "Failed to change password"
            isLoading = false
            return false
        }
    }

    // MARK: - Validation

    func validateName(_ name: String) -> String? {
        guard !name.isEmpty else {
            return "Name cannot be empty"
        }

        guard name.count >= 2 else {
            return "Name must be at least 2 characters"
        }

        guard name.count <= AppConstants.Validation.maxNameLength else {
            return "Name is too long"
        }

        return nil
    }

    func validatePhone(_ phone: String) -> String? {
        guard !phone.isEmpty else {
            return nil // Phone is optional
        }

        let numericPhone = phone.filter { $0.isNumber }
        guard numericPhone.count >= 10 else {
            return "Phone number must be at least 10 digits"
        }

        return nil
    }

    // MARK: - Clear Messages

    func clearMessages() {
        errorMessage = nil
        successMessage = nil
    }
}
