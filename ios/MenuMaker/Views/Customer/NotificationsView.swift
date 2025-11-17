import SwiftUI

struct NotificationsView: View {
    @StateObject private var viewModel = NotificationViewModel()
    @State private var showingSettings = false

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                if viewModel.isLoading && viewModel.notifications.isEmpty {
                    ProgressView()
                        .padding()
                } else if viewModel.notifications.isEmpty {
                    EmptyState(
                        icon: "bell.slash",
                        title: "No Notifications",
                        message: "You're all caught up!"
                    )
                    .accessibilityIdentifier("empty-notifications")
                } else {
                    notificationsList
                }
            }
            .navigationTitle("Notifications")
            .accessibilityIdentifier("notifications-screen")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Menu {
                        Button(action: { Task { await viewModel.markAllAsRead() } }) {
                            Label("Mark All Read", systemImage: "checkmark.circle")
                        }
                        .accessibilityIdentifier("mark-all-read-button")

                        Button(action: { showingSettings = true }) {
                            Label("Settings", systemImage: "gear")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .accessibilityIdentifier("notification-menu-button")
                    }
                }
            }
            .refreshable {
                await viewModel.refreshNotifications()
            }
            .sheet(isPresented: $showingSettings) {
                NotificationSettingsView()
            }
        }
    }

    private var notificationsList: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(viewModel.notifications) { notification in
                    NotificationRow(
                        notification: notification,
                        onTap: { Task { await viewModel.markAsRead(notification.id) } }
                    )
                    .accessibilityIdentifier("notification-\(notification.id)")

                    Divider()
                }
            }
        }
        .accessibilityIdentifier("notifications-list")
    }
}

struct NotificationRow: View {
    let notification: Notification
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                // Icon
                iconView

                // Content
                VStack(alignment: .leading, spacing: 4) {
                    Text(notification.title)
                        .font(.subheadline)
                        .fontWeight(notification.isRead ? .regular : .semibold)
                        .foregroundColor(.primary)
                        .accessibilityIdentifier("notification-title")

                    Text(notification.message)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                        .accessibilityIdentifier("notification-message")

                    Text(notification.createdAt, style: .relative)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                        .accessibilityIdentifier("notification-time")
                }

                Spacer()

                // Unread indicator
                if !notification.isRead {
                    Circle()
                        .fill(Color.blue)
                        .frame(width: 8, height: 8)
                        .accessibilityIdentifier("unread-indicator")
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(notification.isRead ? Color.clear : Color.blue.opacity(0.05))
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var iconView: some View {
        let config = notificationIconConfig(for: notification.type)

        ZStack {
            Circle()
                .fill(config.backgroundColor)
                .frame(width: 40, height: 40)

            Image(systemName: config.iconName)
                .foregroundColor(config.iconColor)
        }
    }

    private func notificationIconConfig(for type: NotificationType) -> (iconName: String, iconColor: Color, backgroundColor: Color) {
        switch type {
        case .orderUpdate:
            return ("bag.fill", .white, .blue)
        case .promotion:
            return ("tag.fill", .white, .green)
        case .review:
            return ("star.fill", .white, .yellow)
        case .system:
            return ("bell.fill", .white, .gray)
        }
    }
}

struct NotificationSettingsView: View {
    @StateObject private var viewModel = NotificationViewModel()
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationView {
            Form {
                Section("Notification Types") {
                    Toggle("Order Updates", isOn: $viewModel.orderNotificationsEnabled)
                        .accessibilityIdentifier("toggle-order-notifications")

                    Toggle("Promotions", isOn: $viewModel.promotionNotificationsEnabled)
                        .accessibilityIdentifier("toggle-promotion-notifications")

                    Toggle("Reviews", isOn: $viewModel.reviewNotificationsEnabled)
                        .accessibilityIdentifier("toggle-review-notifications")
                }

                Section("Delivery") {
                    Toggle("Push Notifications", isOn: $viewModel.pushNotificationsEnabled)
                        .accessibilityIdentifier("toggle-push-notifications")

                    Toggle("Email Notifications", isOn: $viewModel.emailNotificationsEnabled)
                        .accessibilityIdentifier("toggle-email-notifications")
                }
            }
            .navigationTitle("Notification Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}

#Preview {
    NotificationsView()
}
