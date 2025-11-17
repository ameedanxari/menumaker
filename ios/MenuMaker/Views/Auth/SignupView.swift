import SwiftUI

struct SignupView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @Environment(\.dismiss) var dismiss
    @State private var name = ""
    @State private var email = ""
    @State private var phone = ""
    @State private var password = ""
    @State private var confirmPassword = ""

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

                        CustomTextField(
                            placeholder: "Email",
                            text: $email,
                            keyboardType: .emailAddress
                        )

                        CustomTextField(
                            placeholder: "Phone (Optional)",
                            text: $phone,
                            keyboardType: .phonePad
                        )

                        CustomSecureField(
                            placeholder: "Password",
                            text: $password
                        )

                        CustomSecureField(
                            placeholder: "Confirm Password",
                            text: $confirmPassword
                        )

                        if let errorMessage = authViewModel.errorMessage {
                            Text(errorMessage)
                                .font(.caption)
                                .foregroundColor(.theme.error)
                                .padding(.horizontal)
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
                        .disabled(authViewModel.isLoading || !isFormValid)
                    }
                    .padding(.horizontal, 24)
                }
            }
            .background(Color.theme.background)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
        }
    }

    private var isFormValid: Bool {
        !name.isEmpty && !email.isEmpty && !password.isEmpty &&
        password == confirmPassword
    }

    private func signup() {
        Task {
            await authViewModel.signup(
                email: email,
                password: password,
                name: name,
                phone: phone.isEmpty ? nil : phone
            )

            if authViewModel.isAuthenticated {
                dismiss()
            }
        }
    }
}

#Preview {
    SignupView()
        .environmentObject(AuthViewModel())
}
