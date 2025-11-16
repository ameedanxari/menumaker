import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @State private var email = ""
    @State private var password = ""
    @State private var showSignup = false
    @State private var showBiometric = false

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Logo and Title
                VStack(spacing: 12) {
                    Image(systemName: "fork.knife.circle.fill")
                        .font(.system(size: 80))
                        .foregroundColor(.theme.primary)

                    Text("MenuMaker")
                        .font(.largeTitle)
                        .fontWeight(.bold)

                    Text("Manage your restaurant business")
                        .font(.subheadline)
                        .foregroundColor(.theme.textSecondary)
                }
                .padding(.top, 60)

                // Login Form
                VStack(spacing: 16) {
                    CustomTextField(
                        placeholder: "Email",
                        text: $email,
                        keyboardType: .emailAddress
                    )

                    CustomSecureField(
                        placeholder: "Password",
                        text: $password
                    )

                    if let errorMessage = authViewModel.errorMessage {
                        Text(errorMessage)
                            .font(.caption)
                            .foregroundColor(.theme.error)
                            .padding(.horizontal)
                    }

                    Button(action: login) {
                        if authViewModel.isLoading {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Text("Log In")
                                .fontWeight(.semibold)
                        }
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(authViewModel.isLoading || email.isEmpty || password.isEmpty)

                    // Biometric Login
                    if BiometricService.shared.isAvailable {
                        Button(action: { showBiometric = true }) {
                            HStack {
                                Image(systemName: BiometricService.shared.biometricType == .faceID ? "faceid" : "touchid")
                                Text("Login with \(BiometricService.shared.biometricType.displayName)")
                            }
                        }
                        .buttonStyle(SecondaryButtonStyle())
                    }

                    // Sign Up Link
                    HStack {
                        Text("Don't have an account?")
                            .foregroundColor(.theme.textSecondary)

                        Button("Sign Up") {
                            showSignup = true
                        }
                        .foregroundColor(.theme.primary)
                        .fontWeight(.semibold)
                    }
                    .padding(.top, 8)
                }
                .padding(.horizontal, 24)

                Spacer()
            }
        }
        .background(Color.theme.background)
        .sheet(isPresented: $showSignup) {
            SignupView()
        }
        .task {
            if showBiometric {
                await authViewModel.loginWithBiometrics()
                showBiometric = false
            }
        }
    }

    private func login() {
        Task {
            await authViewModel.login(email: email, password: password)
        }
    }
}

#Preview {
    LoginView()
        .environmentObject(AuthViewModel())
}
