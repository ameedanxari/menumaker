import SwiftUI

struct MyOrdersView: View {
    @StateObject private var viewModel = OrderViewModel()
    @State private var selectedTab = 0

    var body: some View {
        VStack(spacing: 0) {
            // Tab Selector
            Picker("Order Type", selection: $selectedTab) {
                Text("Active").tag(0)
                Text("Completed").tag(1)
            }
            .pickerStyle(.segmented)
            .padding()

            // Orders List
            if viewModel.isLoading {
                ProgressView()
                    .frame(maxHeight: .infinity)
            } else if displayedOrders.isEmpty {
                EmptyState(
                    icon: "tray",
                    title: "No Orders",
                    message: selectedTab == 0 ? "You don't have any active orders" : "You haven't completed any orders yet"
                )
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(displayedOrders) { order in
                            NavigationLink(destination: OrderTrackingView(order: order)) {
                                OrderCard(order: order)
                            }
                            .buttonStyle(PlainButtonStyle())
                        }
                    }
                    .padding()
                }
            }
        }
        .background(Color.theme.background)
        .navigationTitle("My Orders")
        .refreshable {
            await viewModel.refreshOrders()
        }
        .task {
            await viewModel.fetchOrders()
        }
    }

    private var displayedOrders: [Order] {
        selectedTab == 0 ? viewModel.activeOrders : viewModel.completedOrders
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

#Preview {
    NavigationView {
        MyOrdersView()
    }
}
