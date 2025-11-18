import SwiftUI

struct MyOrdersView: View {
    @StateObject private var viewModel = OrderViewModel()
    @State private var selectedTab = 0
    @State private var showFilterSheet = false
    @State private var dateFilterRange: DateFilterRange = .all

    var body: some View {
        VStack(spacing: 0) {
            // Search Bar
            if !viewModel.orders.isEmpty {
                SearchBar(text: $viewModel.searchQuery)
                    .padding(.horizontal)
                    .padding(.top)
                    .accessibilityIdentifier("order-search-bar")
            }

            // Tab Selector
            Picker("Order Type", selection: $selectedTab) {
                Text("Active").tag(0)
                Text("Completed").tag(1)
                Text("Cancelled").tag(2)
            }
            .pickerStyle(.segmented)
            .padding()
            .accessibilityIdentifier("order-tabs")

            // Orders List
            if viewModel.isLoading {
                ProgressView()
                    .frame(maxHeight: .infinity)
            } else if displayedOrders.isEmpty {
                EmptyState(
                    icon: "tray",
                    title: "No Orders",
                    message: emptyStateMessage
                )
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(displayedOrders) { order in
                            OrderCardWithActions(
                                order: order,
                                showReorder: selectedTab == 1,
                                showTrack: selectedTab == 0,
                                onReorder: {
                                    await reorderOrder(order)
                                },
                                onTrack: {
                                    // Navigation happens via NavigationLink
                                }
                            )
                            .accessibilityIdentifier("OrderItem")
                        }
                    }
                    .padding()
                }
            }
        }
        .background(Color.theme.background)
        .navigationTitle("My Orders")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: {
                    showFilterSheet = true
                }) {
                    Image(systemName: "line.3.horizontal.decrease.circle")
                }
                .accessibilityLabel("Filter")
                .accessibilityIdentifier("filter-button")
            }
        }
        .sheet(isPresented: $showFilterSheet) {
            DateFilterView(selectedRange: $dateFilterRange)
        }
        .refreshable {
            await viewModel.refreshOrders()
        }
        .task {
            await viewModel.fetchOrders()
        }
    }

    private var displayedOrders: [Order] {
        let filtered: [Order]
        switch selectedTab {
        case 0:
            filtered = viewModel.activeOrders
        case 1:
            filtered = viewModel.completedOrders
        case 2:
            filtered = viewModel.cancelledOrders
        default:
            filtered = []
        }

        return filterByDateRange(filtered)
    }

    private var emptyStateMessage: String {
        switch selectedTab {
        case 0: return "You don't have any active orders"
        case 1: return "You haven't completed any orders yet"
        case 2: return "You don't have any cancelled orders"
        default: return "No orders found"
        }
    }

    private func filterByDateRange(_ orders: [Order]) -> [Order] {
        guard dateFilterRange != .all else { return orders }

        let calendar = Calendar.current
        let now = Date()

        return orders.filter { order in
            guard let date = ISO8601DateFormatter().date(from: order.createdAt) else {
                return false
            }

            switch dateFilterRange {
            case .all:
                return true
            case .last7Days:
                return calendar.dateComponents([.day], from: date, to: now).day ?? 0 <= 7
            case .last30Days:
                return calendar.dateComponents([.day], from: date, to: now).day ?? 0 <= 30
            case .last3Months:
                return calendar.dateComponents([.month], from: date, to: now).month ?? 0 <= 3
            }
        }
    }

    private func reorderOrder(_ order: Order) async {
        // Add all items from the order to the cart
        let cartRepository = CartRepository.shared

        for item in order.items {
            // Create a Dish object from OrderItem
            let dish = Dish(
                id: item.dishId,
                businessId: order.businessId,
                name: item.dishName,
                description: nil,
                priceCents: item.priceCents,
                imageUrl: nil,
                category: nil,
                isVegetarian: false,
                isAvailable: true,
                createdAt: order.createdAt,
                updatedAt: order.updatedAt
            )

            // Add item with the original quantity
            for _ in 0..<item.quantity {
                cartRepository.addItem(dish, businessId: order.businessId)
            }
        }
    }
}

enum DateFilterRange: String, CaseIterable {
    case all = "All Time"
    case last7Days = "Last 7 Days"
    case last30Days = "Last 30 Days"
    case last3Months = "Last 3 Months"
}

struct OrderCardWithActions: View {
    let order: Order
    let showReorder: Bool
    let showTrack: Bool
    let onReorder: () async -> Void
    let onTrack: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            NavigationLink(destination: OrderTrackingView(order: order)) {
                VStack(alignment: .leading, spacing: 12) {
                    // Order Header
                    HStack {
                        Text(order.orderId)
                            .font(.headline)
                            .fontWeight(.bold)
                            .foregroundColor(.primary)

                        Spacer()

                        HStack(spacing: 6) {
                            Circle()
                                .fill(order.statusColor)
                                .frame(width: 8, height: 8)

                            Text(order.orderStatus.displayName)
                                .font(.caption)
                                .foregroundColor(order.statusColor)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(order.statusColor.opacity(0.1))
                        .cornerRadius(12)
                    }

                    // Items Summary
                    Text("\(order.itemsCount) items")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    // Total and Date
                    HStack {
                        Text(order.formattedTotal)
                            .font(.headline)
                            .fontWeight(.bold)
                            .foregroundColor(.primary)

                        Spacer()

                        Text(order.formattedDate)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }
            .buttonStyle(PlainButtonStyle())

            // Action Buttons
            if showReorder || showTrack {
                Divider()

                HStack(spacing: 12) {
                    if showTrack {
                        NavigationLink(destination: OrderTrackingView(order: order)) {
                            HStack {
                                Image(systemName: "location.fill")
                                Text("Track")
                            }
                            .frame(maxWidth: .infinity)
                            .font(.subheadline)
                        }
                        .buttonStyle(.bordered)
                        .accessibilityIdentifier("track-button")
                    }

                    if showReorder {
                        Button(action: {
                            Task {
                                await onReorder()
                            }
                        }) {
                            HStack {
                                Image(systemName: "arrow.clockwise")
                                Text("Reorder")
                            }
                            .frame(maxWidth: .infinity)
                            .font(.subheadline)
                        }
                        .buttonStyle(.borderedProminent)
                        .accessibilityIdentifier("reorder-button")
                    }
                }
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(AppConstants.UI.cornerRadius)
    }
}

struct OrderCard: View {
    let order: Order

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Order Header
            HStack {
                Text(order.orderId)
                    .font(.headline)
                    .fontWeight(.bold)

                Spacer()

                HStack(spacing: 6) {
                    Circle()
                        .fill(order.statusColor)
                        .frame(width: 8, height: 8)

                    Text(order.orderStatus.displayName)
                        .font(.caption)
                        .foregroundColor(order.statusColor)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(order.statusColor.opacity(0.1))
                .cornerRadius(12)
            }

            // Items Summary
            Text("\(order.itemsCount) items")
                .font(.caption)
                .foregroundColor(.secondary)

            // Total and Date
            HStack {
                Text(order.formattedTotal)
                    .font(.headline)
                    .fontWeight(.bold)

                Spacer()

                Text(order.formattedDate)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(AppConstants.UI.cornerRadius)
        .accessibilityIdentifier("OrderItem")
    }
}

struct DateFilterView: View {
    @Environment(\.dismiss) var dismiss
    @Binding var selectedRange: DateFilterRange

    var body: some View {
        NavigationView {
            List {
                ForEach(DateFilterRange.allCases, id: \.self) { range in
                    Button(action: {
                        selectedRange = range
                        dismiss()
                    }) {
                        HStack {
                            Text(range.rawValue)
                                .foregroundColor(.primary)

                            Spacer()

                            if selectedRange == range {
                                Image(systemName: "checkmark")
                                    .foregroundColor(.blue)
                            }
                        }
                    }
                    .accessibilityIdentifier(range.rawValue)
                }
            }
            .navigationTitle("Filter by Date")
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
    NavigationView {
        MyOrdersView()
    }
}
