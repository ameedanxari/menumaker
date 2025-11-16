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
            }
        }
        .navigationTitle("More")
        .confirmationDialog("Logout", isPresented: $showLogoutConfirmation) {
            Button("Logout", role: .destructive) {
                Task {
                    await authViewModel.logout()
                }
            }
        } message: {
            Text("Are you sure you want to logout?")
        }
    }
}

struct SettingsView: View {
    @AppStorage("notificationsEnabled") private var notificationsEnabled = true
    @AppStorage("biometricAuthEnabled") private var biometricAuthEnabled = false
    @State private var selectedTheme: ColorScheme? = nil

    var body: some View {
        Form {
            Section("Notifications") {
                Toggle("Push Notifications", isOn: $notificationsEnabled)
            }

            Section("Security") {
                if BiometricService.shared.isAvailable {
                    Toggle(BiometricService.shared.biometricType.displayName, isOn: $biometricAuthEnabled)
                }

                NavigationLink("Change Password") {
                    Text("Change Password")
                }
            }

            Section("Appearance") {
                Picker("Theme", selection: $selectedTheme) {
                    Text("System").tag(nil as ColorScheme?)
                    Text("Light").tag(ColorScheme.light as ColorScheme?)
                    Text("Dark").tag(ColorScheme.dark as ColorScheme?)
                }
            }

            Section("Data") {
                Button("Clear Cache") {
                    ImageService.shared.clearCache()
                }

                Button("Clear Cart") {
                    CartRepository.shared.clearCart()
                }
            }
        }
        .navigationTitle("Settings")
    }
}

#Preview {
    NavigationStack {
        MoreView()
            .environmentObject(AuthViewModel())
    }
}
