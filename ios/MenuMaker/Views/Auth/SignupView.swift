import SwiftUI

struct SignupView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @Environment(\.dismiss) var dismiss
    @State private var name = ""
    @State private var email = ""
    @State private var phone = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var attemptedSubmit = false

    private var validationError: String? {
        guard attemptedSubmit else { return nil }

        if name.isEmpty {
            return "Please enter your name"
        }

        if email.isEmpty {
            return "Please enter your email"
        }

        if password.isEmpty {
            return "Please enter a password"
        }

        if password.count < 8 {
            return "Password must be at least 8 characters"
        }

        if confirmPassword.isEmpty {
            return "Please confirm your password"
        }

        if password != confirmPassword {
            return "Passwords do not match"
        }

        return nil
    }

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    // Header
                    VStack(spacing: 8) {
                        Text("Create Account")
                            .font(.largeTitle)
                            .fontWeight(.bold)

                        Text("Start managing your restaurant")
                            .font(.subheadline)
                            .foregroundColor(.theme.textSecondary)
                    }
                    .padding(.top, 20)

                    // Form
                    VStack(spacing: 16) {
                        CustomTextField(
                            placeholder: "Full Name",
                            text: $name
                        )
                        .accessibilityIdentifier("name-field")

                        CustomTextField(
                            placeholder: "Email",
                            text: $email,
                            keyboardType: .emailAddress
                        )
                        .accessibilityIdentifier("email-field")

                        CustomTextField(
                            placeholder: "Phone (Optional)",
                            text: $phone,
                            keyboardType: .phonePad
                        )
                        .accessibilityIdentifier("phone-field")

                        CustomSecureField(
                            placeholder: "Password",
                            text: $password
                        )
                        .textContentType(.newPassword)
                        .autocorrection(.no)
                        .accessibilityIdentifier("password-field")

                        CustomSecureField(
                            placeholder: "Confirm Password",
                            text: $confirmPassword
                        )
                        .textContentType(.newPassword)
                        .autocorrection(.no)
                        .accessibilityIdentifier("confirm-password-field")

                        if let errorMessage = validationError ?? authViewModel.errorMessage {
                            Text(errorMessage)
                                .font(.caption)
                                .foregroundColor(.theme.error)
                                .padding(.horizontal)
                                .accessibilityIdentifier("error-message")
                        }

                        Button(action: signup) {
                            if authViewModel.isLoading {
                                ProgressView()
                                    .tint(.white)
                            } else {
                                Text("Sign Up")
                                    .fontWeight(.semibold)
                            }
                        }
                        .buttonStyle(PrimaryButtonStyle())
                        .disabled(authViewModel.isLoading)
                        .accessibilityIdentifier("signup-button")
                    }
                    .padding(.horizontal, 24)
                }
            }
            .background(Color.theme.background)
            .navigationBarTitleDisplayMode(.inline)
            .accessibilityIdentifier("signup-screen")
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .accessibilityIdentifier("cancel-button")
                }
            }
        }
    }

    private var isFormValid: Bool {
        !name.isEmpty && !email.isEmpty && !password.isEmpty &&
        password == confirmPassword && password.count >= 8
    }

    private func signup() {
        attemptedSubmit = true

        // Clear previous API errors
        authViewModel.errorMessage = nil

        // Check validation
        guard validationError == nil else {
            return
        }

        Task {
            await authViewModel.signup(
                email: email,
                password: password,
                name: name,
                phone: phone.isEmpty ? nil : phone
            )
        }
    }
}

#Preview {
    SignupView()
        .environmentObject(AuthViewModel())
}
