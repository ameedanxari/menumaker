import SwiftUI

struct MoreView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @State private var showLogoutConfirmation = false

    var body: some View {
        List {
            // Profile Section
            Section {
                if let user = authViewModel.currentUser {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(user.name)
                            .font(.headline)

                        Text(user.email)
                            .font(.subheadline)
                            .foregroundColor(.theme.textSecondary)
                    }
                    .padding(.vertical, 8)
                }
            }

            // Menu Sections
            Section("Business") {
                NavigationLink(destination: CouponsView()) {
                    Label("Coupons", systemImage: "ticket")
                }
                .accessibilityIdentifier("coupons-link")

                NavigationLink(destination: Text("Reviews")) {
                    Label("Reviews", systemImage: "star")
                }

                NavigationLink(destination: Text("Referrals")) {
                    Label("Referrals", systemImage: "person.2")
                }

                NavigationLink(destination: Text("Integrations")) {
                    Label("Integrations", systemImage: "link")
                }
            }

            Section("Settings") {
                NavigationLink(destination: SettingsView()) {
                    Label("Settings", systemImage: "gearshape")
                }

                NavigationLink(destination: Text("Help & Support")) {
                    Label("Help & Support", systemImage: "questionmark.circle")
                }

                NavigationLink(destination: Text("About")) {
                    Label("About", systemImage: "info.circle")
                }
            }

            Section {
                Button(action: { showLogoutConfirmation = true }) {
                    Label("Logout", systemImage: "arrow.right.square")
                        .foregroundColor(.theme.error)
                }
                .accessibilityIdentifier("logout-button")
            }
        }
        .navigationTitle("More")
        .accessibilityIdentifier("more-screen")
        .confirmationDialog("Logout", isPresented: $showLogoutConfirmation) {
            Button("Logout", role: .destructive) {
                Task {
                    await authViewModel.logout()
                }
            }
            .accessibilityIdentifier("confirm-logout-button")
        } message: {
            Text("Are you sure you want to logout?")
        }
    }
}

struct SettingsView: View {
    @AppStorage("orderNotificationsEnabled") private var orderNotificationsEnabled = true
    @AppStorage("promoNotificationsEnabled") private var promoNotificationsEnabled = true
    @AppStorage("pushNotificationsEnabled") private var pushNotificationsEnabled = true
    @AppStorage("whatsappNotificationsEnabled") private var whatsappNotificationsEnabled = false
    @AppStorage("soundEnabled") private var soundEnabled = true
    @AppStorage("darkModeEnabled") private var darkModeEnabled = false
    @AppStorage("preferredLanguage") private var preferredLanguage = "en"
    @AppStorage("biometricAuthEnabled") private var biometricAuthEnabled = false

    @State private var showLanguageSheet = false
    @State private var showClearCacheConfirmation = false

    var body: some View {
        Form {
            // Notifications Section
            Section {
                NavigationLink("Notifications") {
                    NotificationSettingsView(
                        orderNotificationsEnabled: $orderNotificationsEnabled,
                        promoNotificationsEnabled: $promoNotificationsEnabled,
                        pushNotificationsEnabled: $pushNotificationsEnabled,
                        whatsappNotificationsEnabled: $whatsappNotificationsEnabled
                    )
                }
                .accessibility(label: Text("Notifications"))
            }

            // Language Section
            Section {
                Button(action: { showLanguageSheet = true }) {
                    HStack {
                        Text("Language")
                            .foregroundColor(.primary)
                        Spacer()
                        Text(languageDisplayName)
                            .foregroundColor(.secondary)
                        Image(systemName: "chevron.right")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                .accessibility(label: Text("Language"))
            }

            // Appearance Section
            Section("Appearance") {
                Toggle("Dark Mode", isOn: $darkModeEnabled)
                    .accessibilityIdentifier("darkModeToggle")

                Toggle("Sound", isOn: $soundEnabled)
                    .accessibilityIdentifier("soundToggle")
            }

            // Security Section
            Section("Security") {
                if BiometricService.shared.isAvailable {
                    Toggle(BiometricService.shared.biometricType.displayName, isOn: $biometricAuthEnabled)
                        .accessibilityIdentifier("biometric-auth-toggle")
                }

                NavigationLink("Change Password") {
                    Text("Change Password Screen")
                }
                .accessibilityIdentifier("change-password-link")
            }

            // Privacy Section
            Section {
                NavigationLink("Privacy") {
                    PrivacySettingsView()
                }
                .accessibility(label: Text("Privacy"))
            }

            // Help & Support Section
            Section {
                NavigationLink("Help & Support") {
                    HelpAndSupportView()
                }
                .accessibility(label: Text("Help"))

                NavigationLink("FAQ") {
                    FAQView()
                }
                .accessibility(label: Text("FAQ"))
            }

            // Legal Section
            Section {
                NavigationLink("Terms and Conditions") {
                    TermsView()
                }
                .accessibility(label: Text("Terms"))

                NavigationLink("Privacy Policy") {
                    PrivacyPolicyView()
                }
                .accessibility(label: Text("Privacy Policy"))
            }

            // Data Management Section
            Section("Data") {
                Button("Clear Cache") {
                    showClearCacheConfirmation = true
                }
                .accessibility(label: Text("Clear Cache"))

                Button("Clear Cart") {
                    CartRepository.shared.clearCart()
                }
                .accessibilityIdentifier("clear-cart-button")
            }

            // About Section
            Section {
                NavigationLink("About") {
                    AboutView()
                }
                .accessibility(label: Text("About"))
            }
        }
        .navigationTitle("Settings")
        .accessibilityIdentifier("settings-screen")
        .sheet(isPresented: $showLanguageSheet) {
            LanguageSelectionSheet(selectedLanguage: $preferredLanguage, isPresented: $showLanguageSheet)
        }
        .confirmationDialog("Clear Cache", isPresented: $showClearCacheConfirmation) {
            Button("Clear Cache", role: .destructive) {
                ImageService.shared.clearCache()
            }
        } message: {
            Text("Are you sure you want to clear the cache?")
        }
    }

    private var languageDisplayName: String {
        switch preferredLanguage {
        case "hi": return "हिन्दी"
        case "en": return "English"
        default: return "English"
        }
    }
}

// MARK: - Notification Settings View

struct NotificationSettingsView: View {
    @Binding var orderNotificationsEnabled: Bool
    @Binding var promoNotificationsEnabled: Bool
    @Binding var pushNotificationsEnabled: Bool
    @Binding var whatsappNotificationsEnabled: Bool

    var body: some View {
        Form {
            Section("Order Updates") {
                Toggle("Order Notifications", isOn: $orderNotificationsEnabled)
                    .accessibilityIdentifier("orderNotificationToggle")
            }

            Section("Marketing") {
                Toggle("Promotional Notifications", isOn: $promoNotificationsEnabled)
                    .accessibilityIdentifier("promoNotificationToggle")
            }

            Section("Channels") {
                Toggle("Push Notifications", isOn: $pushNotificationsEnabled)
                    .accessibilityIdentifier("pushNotificationToggle")

                Toggle("WhatsApp Notifications", isOn: $whatsappNotificationsEnabled)
                    .accessibilityIdentifier("whatsappNotificationToggle")
            }
        }
        .navigationTitle("Notifications")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Language Selection Sheet

struct LanguageSelectionSheet: View {
    @Binding var selectedLanguage: String
    @Binding var isPresented: Bool

    var body: some View {
        NavigationView {
            List {
                Button(action: {
                    selectedLanguage = "en"
                    isPresented = false
                }) {
                    HStack {
                        Text("English")
                        Spacer()
                        if selectedLanguage == "en" {
                            Image(systemName: "checkmark")
                                .foregroundColor(.theme.primary)
                        }
                    }
                }

                Button(action: {
                    selectedLanguage = "hi"
                    isPresented = false
                }) {
                    HStack {
                        Text("हिन्दी")
                        Spacer()
                        if selectedLanguage == "hi" {
                            Image(systemName: "checkmark")
                                .foregroundColor(.theme.primary)
                        }
                    }
                }
            }
            .navigationTitle("Select Language")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        isPresented = false
                    }
                }
            }
        }
    }
}

// MARK: - Privacy Settings View

struct PrivacySettingsView: View {
    @AppStorage("locationSharingEnabled") private var locationSharingEnabled = true
    @AppStorage("analyticsEnabled") private var analyticsEnabled = true

    var body: some View {
        Form {
            Section("Data Sharing") {
                Toggle("Location Sharing", isOn: $locationSharingEnabled)
                Toggle("Analytics", isOn: $analyticsEnabled)
            }

            Section("Your Data") {
                NavigationLink("Download My Data") {
                    Text("Download Data Screen")
                }

                NavigationLink("Delete Account") {
                    Text("Delete Account Screen")
                }
            }
        }
        .navigationTitle("Privacy")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Help and Support View

struct HelpAndSupportView: View {
    var body: some View {
        List {
            Section("Contact Us") {
                HStack {
                    Text("Email")
                    Spacer()
                    Text("support@menumaker.com")
                        .foregroundColor(.theme.textSecondary)
                }

                HStack {
                    Text("Phone")
                    Spacer()
                    Text("+91 1800-123-456")
                        .foregroundColor(.theme.textSecondary)
                }
            }

            Section("Resources") {
                NavigationLink("User Guide") {
                    Text("User Guide Screen")
                }

                NavigationLink("Video Tutorials") {
                    Text("Video Tutorials Screen")
                }
            }
        }
        .navigationTitle("Help & Support")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - FAQ View

struct FAQView: View {
    var body: some View {
        List {
            Section("Account") {
                DisclosureGroup("How do I reset my password?") {
                    Text("You can reset your password from the login screen by tapping 'Forgot Password'.")
                        .font(.subheadline)
                        .foregroundColor(.theme.textSecondary)
                }

                DisclosureGroup("How do I delete my account?") {
                    Text("You can delete your account from Settings > Privacy > Delete Account.")
                        .font(.subheadline)
                        .foregroundColor(.theme.textSecondary)
                }
            }

            Section("Orders") {
                DisclosureGroup("How do I track my order?") {
                    Text("You can track your order from the Orders tab or by tapping on the order in your order history.")
                        .font(.subheadline)
                        .foregroundColor(.theme.textSecondary)
                }

                DisclosureGroup("Can I cancel my order?") {
                    Text("You can cancel your order within 5 minutes of placing it from the order details screen.")
                        .font(.subheadline)
                        .foregroundColor(.theme.textSecondary)
                }
            }

            Section("Payments") {
                DisclosureGroup("What payment methods are accepted?") {
                    Text("We accept credit/debit cards, UPI, net banking, and cash on delivery.")
                        .font(.subheadline)
                        .foregroundColor(.theme.textSecondary)
                }
            }
        }
        .navigationTitle("FAQ")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Terms View

struct TermsView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Terms and Conditions")
                    .font(.title)
                    .fontWeight(.bold)

                Text("Last updated: January 2025")
                    .font(.caption)
                    .foregroundColor(.theme.textSecondary)

                Text("1. Acceptance of Terms")
                    .font(.headline)
                    .padding(.top)

                Text("By accessing and using MenuMaker, you accept and agree to be bound by the terms and provision of this agreement.")
                    .font(.body)

                Text("2. Use License")
                    .font(.headline)
                    .padding(.top)

                Text("Permission is granted to temporarily download one copy of the materials on MenuMaker's app for personal, non-commercial transitory viewing only.")
                    .font(.body)

                Text("3. Disclaimer")
                    .font(.headline)
                    .padding(.top)

                Text("The materials on MenuMaker's app are provided on an 'as is' basis. MenuMaker makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.")
                    .font(.body)
            }
            .padding()
        }
        .navigationTitle("Terms")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Privacy Policy View

struct PrivacyPolicyView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Privacy Policy")
                    .font(.title)
                    .fontWeight(.bold)

                Text("Last updated: January 2025")
                    .font(.caption)
                    .foregroundColor(.theme.textSecondary)

                Text("1. Information We Collect")
                    .font(.headline)
                    .padding(.top)

                Text("We collect information you provide directly to us, such as when you create an account, place an order, or contact customer support.")
                    .font(.body)

                Text("2. How We Use Your Information")
                    .font(.headline)
                    .padding(.top)

                Text("We use the information we collect to provide, maintain, and improve our services, to process your orders, and to communicate with you.")
                    .font(.body)

                Text("3. Information Sharing")
                    .font(.headline)
                    .padding(.top)

                Text("We do not share your personal information with third parties except as described in this privacy policy.")
                    .font(.body)

                Text("4. Data Security")
                    .font(.headline)
                    .padding(.top)

                Text("We take reasonable measures to help protect your personal information from loss, theft, misuse, unauthorized access, disclosure, alteration, and destruction.")
                    .font(.body)
            }
            .padding()
        }
        .navigationTitle("Privacy Policy")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - About View

struct AboutView: View {
    var body: some View {
        List {
            Section {
                HStack {
                    Text("Version")
                    Spacer()
                    Text(appVersion)
                        .foregroundColor(.theme.textSecondary)
                }

                HStack {
                    Text("Build")
                    Spacer()
                    Text(buildNumber)
                        .foregroundColor(.theme.textSecondary)
                }
            }

            Section("Company") {
                HStack {
                    Text("Developer")
                    Spacer()
                    Text("MenuMaker Inc.")
                        .foregroundColor(.theme.textSecondary)
                }

                HStack {
                    Text("Website")
                    Spacer()
                    Text("menumaker.com")
                        .foregroundColor(.theme.textSecondary)
                }
            }

            Section("Legal") {
                NavigationLink("Terms and Conditions") {
                    TermsView()
                }

                NavigationLink("Privacy Policy") {
                    PrivacyPolicyView()
                }

                NavigationLink("Open Source Licenses") {
                    Text("Open Source Licenses Screen")
                }
            }
        }
        .navigationTitle("About")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var appVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
    }

    private var buildNumber: String {
        Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
    }
}

#Preview {
    NavigationView {
        MoreView()
            .environmentObject(AuthViewModel())
    }
}
