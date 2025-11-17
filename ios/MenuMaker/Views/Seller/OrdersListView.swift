import SwiftUI

struct OrdersListView: View {
    @StateObject private var viewModel = OrderViewModel()
    @State private var selectedFilter: OrderStatus?

    var body: some View {
        VStack(spacing: 0) {
            // Status Filter
            OrderStatusFilter(selectedStatus: $selectedFilter)

            // Orders List
            if viewModel.isLoading {
                ProgressView()
                    .padding()
            } else if viewModel.filteredOrders.isEmpty {
                EmptyState(
                    icon: "bag",
                    title: "No Orders",
                    message: "No orders found"
                )
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(viewModel.filteredOrders) { order in
                            OrderDetailCard(order: order, viewModel: viewModel)
                        }
                    }
                    .padding()
                }
            }
        }
        .background(Color.theme.background)
        .navigationTitle("Orders")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: { Task { await viewModel.refreshOrders() } }) {
                    Image(systemName: "arrow.clockwise")
                }
            }
        }
        .refreshable {
            await viewModel.refreshOrders()
        }
        .onChange(of: selectedFilter) { newValue in
            viewModel.filterByStatus(newValue)
        }
    }
}

struct OrderStatusFilter: View {
    @Binding var selectedStatus: OrderStatus?

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                FilterChip(title: "All", isSelected: selectedStatus == nil) {
                    selectedStatus = nil
                }

                ForEach(OrderStatus.allCases, id: \.self) { status in
                    FilterChip(title: status.displayName, isSelected: selectedStatus == status) {
                        selectedStatus = status
                    }
                }
            }
            .padding()
        }
        .background(Color.theme.surface)
    }
}

struct OrderDetailCard: View {
    let order: Order
    @ObservedObject var viewModel: OrderViewModel
    @State private var showDetails = false

    var body: some View {
        VStack(spacing: 12) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(order.customerName)
                        .font(.headline)

                    Text(order.formattedDate)
                        .font(.caption)
                        .foregroundColor(.theme.textSecondary)
                }

                Spacer()

                Badge(text: order.status.capitalized, color: order.statusColor)
            }

            Divider()

            // Items
            VStack(alignment: .leading, spacing: 6) {
                ForEach(order.items) { item in
                    HStack {
                        Text("\(item.quantity)x \(item.dishName)")
                            .font(.subheadline)

                        Spacer()

                        Text(item.formattedTotal)
                            .font(.subheadline)
                            .fontWeight(.medium)
                    }
                }
            }

            Divider()

            // Total and Actions
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Total")
                        .font(.caption)
                        .foregroundColor(.theme.textSecondary)

                    Text(order.formattedTotal)
                        .font(.title3)
                        .fontWeight(.bold)
                        .foregroundColor(.theme.primary)
                }

                Spacer()

                // Status Actions
                if order.orderStatus == .pending {
                    Button("Confirm") {
                        Task {
                            await viewModel.updateOrderStatus(order.id, to: .confirmed)
                        }
                    }
                    .buttonStyle(.bordered)
                    .tint(.blue)
                } else if order.orderStatus == .confirmed {
                    Button("Mark Ready") {
                        Task {
                            await viewModel.updateOrderStatus(order.id, to: .ready)
                        }
                    }
                    .buttonStyle(.bordered)
                    .tint(.purple)
                } else if order.orderStatus == .ready {
                    Button("Fulfill") {
                        Task {
                            await viewModel.updateOrderStatus(order.id, to: .fulfilled)
                        }
                    }
                    .buttonStyle(.bordered)
                    .tint(.green)
                }
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(AppConstants.UI.cornerRadius)
    }
}

#Preview {
    NavigationView {
        OrdersListView()
    }
}
