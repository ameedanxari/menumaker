import SwiftUI

struct ForgotPasswordView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @Environment(\.dismiss) var dismiss
    @State private var email = ""
    @State private var showSuccess = false

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    // Header
                    VStack(spacing: 8) {
                        Image(systemName: "lock.rotation")
                            .font(.system(size: 60))
                            .foregroundColor(.theme.primary)
                            .padding(.top, 20)

                        Text("Forgot Password?")
                            .font(.largeTitle)
                            .fontWeight(.bold)
                            .foregroundColor(.theme.text)

                        Text("Enter your email address and we'll send you instructions to reset your password")
                            .font(.subheadline)
                            .foregroundColor(.theme.textSecondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                    }
                    .padding(.top, 20)

                    // Form
                    VStack(spacing: 16) {
                        CustomTextField(
                            placeholder: "Email",
                            text: $email,
                            keyboardType: .emailAddress
                        )
                        .accessibilityIdentifier("email-field")

                        if let errorMessage = authViewModel.errorMessage {
                            Text(errorMessage)
                                .font(.caption)
                                .foregroundColor(.theme.error)
                                .padding(.horizontal)
                                .accessibilityIdentifier("error-message")
                        }

                        if showSuccess {
                            HStack(spacing: 8) {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(.green)
                                Text("Password reset instructions have been sent to your email")
                                    .font(.caption)
                                    .foregroundColor(.theme.text)
                            }
                            .padding()
                            .background(Color.green.opacity(0.1))
                            .cornerRadius(8)
                            .accessibilityIdentifier("success-message")
                        }

                        Button(action: sendResetInstructions) {
                            if authViewModel.isLoading {
                                ProgressView()
                                    .tint(.white)
                            } else {
                                Text("Send Reset Link")
                                    .fontWeight(.semibold)
                            }
                        }
                        .buttonStyle(PrimaryButtonStyle())
                        .disabled(authViewModel.isLoading || email.isEmpty)
                        .accessibilityIdentifier("submit-button")
                    }
                    .padding(.horizontal, 24)

                    Spacer()
                }
            }
            .background(Color.theme.background)
            .accessibilityIdentifier("forgot-password-screen")
            .navigationBarTitleDisplayMode(.inline)
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

    private func sendResetInstructions() {
        Task {
            await authViewModel.sendPasswordReset(email: email)

            if authViewModel.errorMessage == nil {
                showSuccess = true

                // Dismiss after showing success message
                try? await Task.sleep(nanoseconds: 2_000_000_000) // 2 seconds
                dismiss()
            }
        }
    }
}

#Preview {
    ForgotPasswordView()
        .environmentObject(AuthViewModel())
}
