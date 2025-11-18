import SwiftUI

// MARK: - Custom Text Fields

struct CustomTextField: View {
    let placeholder: String
    @Binding var text: String
    var keyboardType: UIKeyboardType = .default
    var icon: String? = nil

    var body: some View {
        HStack(spacing: 12) {
            if let icon = icon {
                Image(systemName: icon)
                    .foregroundColor(.theme.textSecondary)
            }

            TextField(placeholder, text: $text)
                .keyboardType(keyboardType)
                .autocapitalization(.none)
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(AppConstants.UI.cornerRadius)
    }
}

struct CustomSecureField: View {
    let placeholder: String
    @Binding var text: String
    var icon: String = "lock"

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundColor(.theme.textSecondary)

            SecureField(placeholder, text: $text)
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(AppConstants.UI.cornerRadius)
    }
}

// MARK: - Buttons

struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .frame(maxWidth: .infinity)
            .frame(height: AppConstants.UI.buttonHeight)
            .background(Color.theme.primary)
            .foregroundColor(.white)
            .cornerRadius(AppConstants.UI.cornerRadius)
            .opacity(configuration.isPressed ? 0.8 : 1.0)
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .frame(maxWidth: .infinity)
            .frame(height: AppConstants.UI.buttonHeight)
            .background(Color.theme.surface)
            .foregroundColor(.theme.primary)
            .cornerRadius(AppConstants.UI.cornerRadius)
            .overlay(
                RoundedRectangle(cornerRadius: AppConstants.UI.cornerRadius)
                    .stroke(Color.theme.primary, lineWidth: 1)
            )
            .opacity(configuration.isPressed ? 0.8 : 1.0)
    }
}

// MARK: - Search Bar

struct SearchBar: View {
    @Binding var text: String
    var placeholder: String = "Search..."

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "magnifyingglass")
                .foregroundColor(.theme.textSecondary)

            TextField(placeholder, text: $text)

            if !text.isEmpty {
                Button(action: { text = "" }) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.theme.textSecondary)
                }
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(AppConstants.UI.cornerRadius)
    }
}

// MARK: - Badge

struct Badge: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text)
            .font(.caption)
            .fontWeight(.medium)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color.opacity(0.2))
            .foregroundColor(color)
            .cornerRadius(8)
    }
}

// MARK: - Empty State

struct EmptyState: View {
    let icon: String
    let title: String
    let message: String

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 60))
                .foregroundColor(.theme.textSecondary)

            VStack(spacing: 8) {
                Text(title)
                    .font(.title3)
                    .fontWeight(.semibold)

                Text(message)
                    .font(.subheadline)
                    .foregroundColor(.theme.textSecondary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }
}

// MARK: - Loading Overlay

struct LoadingOverlay: View {
    let message: String?

    var body: some View {
        ZStack {
            Color.black.opacity(0.3)
                .edgesIgnoringSafeArea(.all)

            VStack(spacing: 16) {
                ProgressView()
                    .tint(.white)
                    .scaleEffect(1.5)

                if let message = message {
                    Text(message)
                        .foregroundColor(.white)
                        .fontWeight(.medium)
                }
            }
            .padding(32)
            .background(Color.theme.surface)
            .cornerRadius(AppConstants.UI.cornerRadius)
        }
    }
}

// MARK: - Error Banner

struct ErrorBanner: View {
    let message: String
    let onDismiss: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(.theme.error)

            Text(message)
                .font(.subheadline)
                .foregroundColor(.theme.text)

            Spacer()

            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .foregroundColor(.theme.textSecondary)
            }
        }
        .padding()
        .background(Color.theme.error.opacity(0.1))
        .cornerRadius(AppConstants.UI.smallCornerRadius)
    }
}

// MARK: - Section Header

struct SectionHeader: View {
    let title: String
    var action: (() -> Void)? = nil
    var actionTitle: String = "See All"

    var body: some View {
        HStack {
            Text(title)
                .font(.headline)

            Spacer()

            if let action = action {
                Button(actionTitle, action: action)
                    .font(.subheadline)
                    .foregroundColor(.theme.primary)
            }
        }
        .padding(.horizontal)
    }
}

// MARK: - Card Container

struct CardContainer<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .padding()
            .background(Color.theme.surface)
            .cornerRadius(AppConstants.UI.cornerRadius)
            .shadow(color: .black.opacity(0.05), radius: 8, x: 0, y: 2)
    }
}

// MARK: - Star Rating

struct StarRating: View {
    let rating: Double
    let maxRating: Int = 5
    let size: CGFloat = 16

    var body: some View {
        HStack(spacing: 2) {
            ForEach(0..<maxRating, id: \.self) { index in
                Image(systemName: starType(for: index))
                    .font(.system(size: size))
                    .foregroundColor(.yellow)
            }
        }
    }

    private func starType(for index: Int) -> String {
        let currentRating = Double(index) + 1
        if rating >= currentRating {
            return "star.fill"
        } else if rating >= currentRating - 0.5 {
            return "star.leadinghalf.filled"
        } else {
            return "star"
        }
    }
}

// MARK: - Divider with Text

struct DividerWithText: View {
    let text: String

    var body: some View {
        HStack {
            Rectangle()
                .fill(Color.theme.textSecondary.opacity(0.3))
                .frame(height: 1)

            Text(text)
                .font(.caption)
                .foregroundColor(.theme.textSecondary)
                .padding(.horizontal, 8)

            Rectangle()
                .fill(Color.theme.textSecondary.opacity(0.3))
                .frame(height: 1)
        }
    }
}

// MARK: - Image Placeholder

struct ImagePlaceholder: View {
    let icon: String
    let size: CGFloat

    var body: some View {
        ZStack {
            Color.theme.surface

            Image(systemName: icon)
                .font(.system(size: size / 2))
                .foregroundColor(.theme.textSecondary)
        }
        .frame(width: size, height: size)
    }
}

// MARK: - Info Row

struct InfoRow: View {
    let icon: String
    let title: String
    let value: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(.theme.primary)
                .frame(width: 30)

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.caption)
                    .foregroundColor(.theme.textSecondary)

                Text(value)
                    .font(.subheadline)
                    .fontWeight(.medium)
            }

            Spacer()
        }
    }
}

// MARK: - Filter Chip

struct FilterChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline)
                .fontWeight(isSelected ? .semibold : .regular)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(isSelected ? Color.theme.primary : Color.theme.surface)
                .foregroundColor(isSelected ? .white : .primary)
                .cornerRadius(20)
        }
    }
}

#Preview {
    VStack(spacing: 20) {
        CustomTextField(placeholder: "Email", text: .constant(""))
        CustomSecureField(placeholder: "Password", text: .constant(""))
        SearchBar(text: .constant(""))
        Badge(text: "Active", color: .green)
        StarRating(rating: 4.5)
    }
    .padding()
}
