import SwiftUI

struct NotificationsView: View {
    @StateObject private var viewModel = NotificationViewModel()
    @State private var showingSettings = false

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Filter buttons
                if !viewModel.notifications.isEmpty {
                    filterButtons
                }

                if viewModel.isLoading && viewModel.notifications.isEmpty {
                    ProgressView()
                        .padding()
                } else if viewModel.filteredNotifications.isEmpty {
                    EmptyState(
                        icon: "bell.slash",
                        title: "No Notifications",
                        message: viewModel.notifications.isEmpty ? "You're all caught up!" : "No notifications match this filter"
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
                    HStack(spacing: 16) {
                        if !viewModel.notifications.isEmpty {
                            Button(action: { Task { await viewModel.clearAllNotifications() } }) {
                                Text("Clear All")
                                    .font(.caption)
                            }
                            .accessibilityLabel("Clear All")
                            .accessibilityIdentifier("clear-all-button")

                            Button(action: { Task { await viewModel.markAllAsRead() } }) {
                                Text("Mark All Read")
                                    .font(.caption)
                            }
                            .accessibilityLabel("Mark All Read")
                            .accessibilityIdentifier("mark-all-read-button")
                        }

                        Button(action: { showingSettings = true }) {
                            Image(systemName: "gear")
                        }
                        .accessibilityLabel("Settings")
                        .accessibilityIdentifier("settings-button")
                    }
                }
            }
            .refreshable {
                await viewModel.refreshNotifications()
            }
            .sheet(isPresented: $showingSettings) {
                NavigationView {
                    SettingsView()
                }
            }
        }
    }

    private var filterButtons: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(NotificationFilter.allCases, id: \.self) { filter in
                    Button(action: {
                        viewModel.selectedFilter = filter
                    }) {
                        Text(filter.rawValue)
                            .font(.subheadline)
                            .fontWeight(viewModel.selectedFilter == filter ? .semibold : .regular)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                            .background(
                                viewModel.selectedFilter == filter ?
                                Color.blue : Color.gray.opacity(0.2)
                            )
                            .foregroundColor(viewModel.selectedFilter == filter ? .white : .primary)
                            .cornerRadius(20)
                    }
                    .accessibilityLabel(filter.rawValue)
                    .accessibilityIdentifier("filter-\(filter.rawValue.lowercased())")
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
    }

    private var notificationsList: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(viewModel.filteredNotifications) { notification in
                    if notification.type == .orderUpdate, let orderId = notification.data?["orderId"] {
                        NavigationLink(destination: OrderTrackingView(orderId: orderId)) {
                            NotificationRow(
                                notification: notification,
                                onTap: { Task { await viewModel.markAsRead(notification.id) } }
                            )
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("NotificationItem")
                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                            Button(role: .destructive) {
                                Task {
                                    await viewModel.deleteNotification(notification.id)
                                }
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                    } else {
                        NotificationRow(
                            notification: notification,
                            onTap: { Task { await viewModel.markAsRead(notification.id) } }
                        )
                        .accessibilityIdentifier("NotificationItem")
                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                            Button(role: .destructive) {
                                Task {
                                    await viewModel.deleteNotification(notification.id)
                                }
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                    }

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

#Preview {
    NotificationsView()
}
