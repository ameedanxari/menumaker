import SwiftUI

struct ProfileView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @StateObject private var viewModel = ProfileViewModel()
    @State private var showEditProfile = false
    @State private var showChangePassword = false
    @State private var showLogoutConfirmation = false

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Profile Header
                if let user = authViewModel.currentUser {
                    ProfileHeader(user: user, onEditPhoto: {
                        // TODO: Implement photo upload
                    })
                }

                // Profile Info
                if let user = authViewModel.currentUser {
                    ProfileInfoSection(user: user)
                }

                // Edit Profile Button
                Button(action: { showEditProfile = true }) {
                    HStack {
                        Image(systemName: "person.circle")
                        Text("Edit Profile")
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.caption)
                            .foregroundColor(.theme.textSecondary)
                    }
                }
                .buttonStyle(ProfileMenuButtonStyle())

                // Menu Options
                ProfileMenuSection(
                    onOrders: {},
                    onFavorites: {},
                    onSettings: {},
                    onReferrals: {},
                    onHelp: {},
                    onChangePassword: { showChangePassword = true }
                )

                // Logout Button
                Button(action: { showLogoutConfirmation = true }) {
                    HStack {
                        Image(systemName: "arrow.right.square")
                        Text("Logout")
                        Spacer()
                    }
                    .foregroundColor(.theme.error)
                }
                .accessibilityIdentifier("logout-button")
                .buttonStyle(ProfileMenuButtonStyle())
            }
            .padding()
        }
        .background(Color.theme.background)
        .accessibilityIdentifier("more-screen")
        .navigationTitle("Profile")
        .navigationBarTitleDisplayMode(.large)
        .sheet(isPresented: $showEditProfile) {
            if let user = authViewModel.currentUser {
                EditProfileSheet(
                    user: user,
                    viewModel: viewModel,
                    isPresented: $showEditProfile
                )
            }
        }
        .sheet(isPresented: $showChangePassword) {
            ChangePasswordSheet(
                viewModel: viewModel,
                isPresented: $showChangePassword
            )
        }
        .confirmationDialog("Logout", isPresented: $showLogoutConfirmation) {
            Button("Logout", role: .destructive) {
                Task {
                    await authViewModel.logout()
                }
            }
            .accessibility(identifier: "confirm-logout-button")
        } message: {
            Text("Are you sure you want to logout?")
        }
        .alert(item: Binding(
            get: { viewModel.errorMessage.map { ErrorWrapper(message: $0) } },
            set: { _ in viewModel.clearMessages() }
        )) { error in
            Alert(title: Text("Error"), message: Text(error.message), dismissButton: .default(Text("OK")))
        }
        .alert(item: Binding(
            get: { viewModel.successMessage.map { SuccessWrapper(message: $0) } },
            set: { _ in viewModel.clearMessages() }
        )) { success in
            Alert(title: Text("Success"), message: Text(success.message), dismissButton: .default(Text("OK")))
        }
    }
}

// MARK: - Profile Header

struct ProfileHeader: View {
    let user: User
    let onEditPhoto: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            // Profile Photo
            ZStack(alignment: .bottomTrailing) {
                if let photoUrl = user.photoUrl {
                    AsyncImage(url: URL(string: photoUrl)) { image in
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                    } placeholder: {
                        Circle()
                            .fill(Color.theme.surface)
                            .overlay(
                                Image(systemName: "person.fill")
                                    .font(.system(size: 40))
                                    .foregroundColor(.theme.textSecondary)
                            )
                    }
                    .frame(width: 100, height: 100)
                    .clipShape(Circle())
                    .accessibilityIdentifier("ProfilePhoto")
                } else {
                    Circle()
                        .fill(Color.theme.surface)
                        .frame(width: 100, height: 100)
                        .overlay(
                            Image(systemName: "person.fill")
                                .font(.system(size: 40))
                                .foregroundColor(.theme.textSecondary)
                        )
                        .accessibilityIdentifier("ProfilePhoto")
                }

                // Edit Photo Button
                Button(action: onEditPhoto) {
                    Image(systemName: "camera.fill")
                        .font(.caption)
                        .foregroundColor(.white)
                        .frame(width: 32, height: 32)
                        .background(Color.theme.primary)
                        .clipShape(Circle())
                }
                .accessibility(label: Text("Edit photo"))
            }
        }
    }
}

// MARK: - Profile Info Section

struct ProfileInfoSection: View {
    let user: User

    var body: some View {
        VStack(spacing: 16) {
            ProfileInfoRow(
                label: "Name",
                value: user.name,
                identifier: "UserName"
            )

            ProfileInfoRow(
                label: "Email",
                value: user.email,
                identifier: "UserEmail"
            )

            ProfileInfoRow(
                label: "Phone",
                value: user.formattedPhone,
                identifier: "UserPhone"
            )
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(AppConstants.UI.cornerRadius)
    }
}

struct ProfileInfoRow: View {
    let label: String
    let value: String
    let identifier: String

    var body: some View {
        HStack {
            Text(label)
                .font(.subheadline)
                .foregroundColor(.theme.textSecondary)
            Spacer()
            Text(value)
                .font(.subheadline)
                .fontWeight(.medium)
                .accessibilityIdentifier(identifier)
        }
    }
}

// MARK: - Profile Menu Section

struct ProfileMenuSection: View {
    let onOrders: () -> Void
    let onFavorites: () -> Void
    let onSettings: () -> Void
    let onReferrals: () -> Void
    let onHelp: () -> Void
    let onChangePassword: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            NavigationLink(destination: MyOrdersView()) {
                MenuRow(icon: "bag", title: "My Orders")
            }
            .accessibility(label: Text("My Orders"))

            Divider().padding(.leading, 48)

            NavigationLink(destination: FavoritesView()) {
                MenuRow(icon: "heart", title: "Favorites")
            }
            .accessibility(label: Text("Favorites"))

            Divider().padding(.leading, 48)

            NavigationLink(destination: SettingsView()) {
                MenuRow(icon: "gearshape", title: "Settings")
            }
            .accessibility(label: Text("Settings"))

            Divider().padding(.leading, 48)

            NavigationLink(destination: ReferralView()) {
                MenuRow(icon: "person.2", title: "Referrals")
            }
            .accessibility(label: Text("Referrals"))

            Divider().padding(.leading, 48)

            NavigationLink(destination: Text("Help & Support")) {
                MenuRow(icon: "questionmark.circle", title: "Help & Support")
            }
            .accessibility(label: Text("Help"))

            Divider().padding(.leading, 48)

            Button(action: onChangePassword) {
                MenuRow(icon: "lock", title: "Change Password")
            }
            .accessibility(label: Text("Change Password"))
        }
        .background(Color.theme.surface)
        .cornerRadius(AppConstants.UI.cornerRadius)
    }
}

struct MenuRow: View {
    let icon: String
    let title: String

    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(.theme.primary)
                .frame(width: 32)

            Text(title)
                .font(.subheadline)
                .foregroundColor(.primary)

            Spacer()

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(.theme.textSecondary)
        }
        .padding()
    }
}

// MARK: - Edit Profile Sheet

struct EditProfileSheet: View {
    let user: User
    @ObservedObject var viewModel: ProfileViewModel
    @Binding var isPresented: Bool

    @State private var name: String
    @State private var phone: String
    @State private var address: String

    init(user: User, viewModel: ProfileViewModel, isPresented: Binding<Bool>) {
        self.user = user
        self.viewModel = viewModel
        self._isPresented = isPresented
        self._name = State(initialValue: user.name)
        self._phone = State(initialValue: user.phone ?? "")
        self._address = State(initialValue: user.address ?? "")
    }

    var body: some View {
        NavigationView {
            Form {
                Section("Personal Information") {
                    TextField("Name", text: $name)
                        .textContentType(.name)
                        .autocorrectionDisabled()

                    TextField("Phone", text: $phone)
                        .keyboardType(.numberPad)
                        .textContentType(.telephoneNumber)

                    TextField("Email", text: .constant(user.email))
                        .disabled(true)
                        .foregroundColor(.theme.textSecondary)
                }

                Section("Address") {
                    TextField("Address", text: $address)
                        .textContentType(.fullStreetAddress)
                        .autocorrectionDisabled()
                }
            }
            .navigationTitle("Edit Profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        isPresented = false
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save") {
                        Task {
                            let success = await viewModel.updateProfile(
                                name: name,
                                phone: phone.isEmpty ? nil : phone,
                                address: address.isEmpty ? nil : address
                            )

                            if success {
                                isPresented = false
                            }
                        }
                    }
                    .disabled(viewModel.isLoading || !isFormValid)
                }
            }
        }
    }

    private var isFormValid: Bool {
        !name.isEmpty && viewModel.validateName(name) == nil && viewModel.validatePhone(phone) == nil
    }
}

// MARK: - Change Password Sheet

struct ChangePasswordSheet: View {
    @ObservedObject var viewModel: ProfileViewModel
    @Binding var isPresented: Bool

    @State private var currentPassword = ""
    @State private var newPassword = ""
    @State private var confirmPassword = ""

    var body: some View {
        NavigationView {
            Form {
                Section("Current Password") {
                    SecureField("Current Password", text: $currentPassword)
                        .textContentType(.password)
                }

                Section("New Password") {
                    SecureField("New Password", text: $newPassword)
                        .textContentType(.newPassword)

                    SecureField("Confirm Password", text: $confirmPassword)
                        .textContentType(.newPassword)
                }

                if !newPassword.isEmpty && !confirmPassword.isEmpty && newPassword != confirmPassword {
                    Section {
                        Text("Passwords do not match")
                            .font(.caption)
                            .foregroundColor(.theme.error)
                    }
                }
            }
            .navigationTitle("Change Password")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        isPresented = false
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save") {
                        Task {
                            let success = await viewModel.changePassword(
                                currentPassword: currentPassword,
                                newPassword: newPassword,
                                confirmPassword: confirmPassword
                            )

                            if success {
                                isPresented = false
                            }
                        }
                    }
                    .disabled(viewModel.isLoading || !isFormValid)
                }
            }
        }
    }

    private var isFormValid: Bool {
        !currentPassword.isEmpty &&
        !newPassword.isEmpty &&
        !confirmPassword.isEmpty &&
        newPassword == confirmPassword &&
        newPassword.count >= AppConstants.Validation.minPasswordLength
    }
}

// MARK: - Custom Button Style

struct ProfileMenuButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .padding()
            .background(Color.theme.surface)
            .cornerRadius(AppConstants.UI.cornerRadius)
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
    }
}

// MARK: - Alert Wrappers

struct ErrorWrapper: Identifiable {
    let id = UUID()
    let message: String
}

struct SuccessWrapper: Identifiable {
    let id = UUID()
    let message: String
}

#Preview {
    NavigationView {
        ProfileView()
            .environmentObject(AuthViewModel())
    }
}
