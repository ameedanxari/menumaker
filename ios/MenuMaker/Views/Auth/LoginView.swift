import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @State private var email = ""
    @State private var password = ""
    @State private var showSignup = false
    @State private var showBiometric = false
    @State private var showForgotPassword = false

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Logo and Title
                VStack(spacing: 12) {
                    // MenuMaker Logo
                    ZStack {
                        Circle()
                            .fill(Color.theme.primary)
                            .frame(width: 80, height: 80)

                        Image(systemName: "fork.knife")
                            .font(.system(size: 36))
                            .foregroundColor(.white)
                    }

                    Text("MenuMaker")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                        .foregroundColor(.theme.text)

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
                        keyboardType: .emailAddress,
                        accessibilityId: "email-field"
                    )

                    CustomSecureField(
                        placeholder: "Password",
                        text: $password,
                        accessibilityId: "password-field"
                    )
                    .textContentType(.password)

                    if let errorMessage = authViewModel.errorMessage {
                        Text(errorMessage)
                            .font(.caption)
                            .foregroundColor(.theme.error)
                            .padding(.horizontal)
                            .accessibilityIdentifier("error-message")
                    }

                    Button(action: login) {
                        if authViewModel.isLoading {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Text("Sign In")
                                .fontWeight(.semibold)
                        }
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(authViewModel.isLoading)
                    .accessibilityIdentifier("login-button")

                    // Forgot Password Link
                    Button("Forgot Password?") {
                        showForgotPassword = true
                    }
                    .foregroundColor(.theme.textSecondary)
                    .font(.body)
                    .accessibilityIdentifier("forgot-password-link")

                    // Biometric Login
                    if BiometricService.shared.isAvailable {
                        Button(action: { showBiometric = true }) {
                            HStack {
                                Image(systemName: BiometricService.shared.biometricType == .faceID ? "faceid" : "touchid")
                                Text("Login with \(BiometricService.shared.biometricType.displayName)")
                            }
                        }
                        .buttonStyle(SecondaryButtonStyle())
                        .accessibilityIdentifier("biometric-login-button")
                    }

                    // Sign Up Link
                    HStack {
                        Text("Don't have an account?")
                            .foregroundColor(.theme.textSecondary)

                        Button("Sign Up") {
                            showSignup = true
                        }
                        .foregroundColor(.theme.primary)
                        .font(.body.weight(.semibold))
                        .accessibilityIdentifier("signup-link-button")
                    }
                    .padding(.top, 8)
                }
                .padding(.horizontal, 24)

                Spacer()
            }
        }
        .background(Color.theme.background)
        .accessibilityIdentifier("login-screen")
        .sheet(isPresented: $showSignup) {
            SignupView()
        }
        .sheet(isPresented: $showForgotPassword) {
            ForgotPasswordView()
        }
        .onChange(of: authViewModel.isAuthenticated) { isAuthenticated in
            // Dismiss sheets when user becomes authenticated
            if isAuthenticated {
                showSignup = false
                showForgotPassword = false
            }
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
