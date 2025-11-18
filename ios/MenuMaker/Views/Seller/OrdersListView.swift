import SwiftUI

struct OrdersListView: View {
    @StateObject private var viewModel = OrderViewModel()
    @State private var selectedTab = 0  // 0=New, 1=Active, 2=Completed

    var body: some View {
        VStack(spacing: 0) {
            // Tab Picker
            Picker("Order Status", selection: $selectedTab) {
                Text("New").tag(0)
                Text("Active").tag(1)
                Text("Completed").tag(2)
            }
            .pickerStyle(.segmented)
            .padding()
            .accessibilityIdentifier("order-status-tabs")

            // Orders List
            ScrollView {
                LazyVStack(spacing: 12) {
                    if displayedOrders.isEmpty && !viewModel.isLoading {
                        EmptyState(
                            icon: "bag",
                            title: emptyStateTitle,
                            message: emptyStateMessage
                        )
                        .padding(.top, 40)
                    } else {
                        ForEach(displayedOrders) { order in
                            SellerOrderCard(order: order, viewModel: viewModel, tab: selectedTab)
                                .accessibilityIdentifier("OrderCard")
                        }
                    }
                }
                .padding()
            }
            .refreshable {
                await viewModel.refreshOrders()
            }
        }
        .background(Color.theme.background)
        .navigationTitle("Orders")
        .accessibilityIdentifier("orders-screen")
        .overlay(
            Group {
                if viewModel.isLoading {
                    ProgressView()
                        .padding()
                        .background(Color.theme.background.opacity(0.8))
                }
            }
        )
        .task {
            await viewModel.loadOrders()
        }
    }

    private var displayedOrders: [Order] {
        switch selectedTab {
        case 0: return viewModel.pendingOrders
        case 1: return viewModel.activeOrders
        case 2: return viewModel.completedOrders
        default: return []
        }
    }

    private var emptyStateTitle: String {
        switch selectedTab {
        case 0: return "No New Orders"
        case 1: return "No Active Orders"
        case 2: return "No Completed Orders"
        default: return "No Orders"
        }
    }

    private var emptyStateMessage: String {
        switch selectedTab {
        case 0: return "New orders will appear here"
        case 1: return "Active orders will appear here"
        case 2: return "Completed orders will appear here"
        default: return ""
        }
    }
}

// MARK: - Seller Order Card

struct SellerOrderCard: View {
    let order: Order
    @ObservedObject var viewModel: OrderViewModel
    let tab: Int
    @State private var showDetail = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("#\(order.id)")
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundColor(.theme.textSecondary)

                    Text(order.customerName)
                        .font(.headline)
                        .accessibilityIdentifier("CustomerName")

                    Text(order.formattedDate)
                        .font(.caption)
                        .foregroundColor(.theme.textSecondary)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 4) {
                    Badge(text: order.orderStatus.displayName, color: order.statusColor)

                    Text(order.formattedTotal)
                        .font(.title3)
                        .fontWeight(.bold)
                        .foregroundColor(.theme.primary)
                }
            }

            Divider()

            // Items Preview
            ForEach(order.items.prefix(3)) { item in
                HStack {
                    Text("\(item.quantity)x")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(.theme.textSecondary)
                        .frame(width: 30, alignment: .leading)

                    Text(item.dishName)
                        .font(.subheadline)

                    Spacer()

                    Text(item.formattedTotal)
                        .font(.subheadline)
                        .fontWeight(.medium)
                }
            }

            if order.items.count > 3 {
                Text("+\(order.items.count - 3) more items")
                    .font(.caption)
                    .foregroundColor(.theme.textSecondary)
            }

            // Action Buttons
            if tab == 0 && order.orderStatus == .pending {
                Divider()

                HStack(spacing: 12) {
                    Button(action: { showDetail = true }) {
                        HStack {
                            Image(systemName: "checkmark.circle")
                            Text("Accept")
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.green)
                    .accessibility(label: Text("Accept"))

                    Button(action: { showDetail = true }) {
                        HStack {
                            Image(systemName: "xmark.circle")
                            Text("Reject")
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .tint(.red)
                    .accessibility(label: Text("Reject"))
                }
            } else if tab == 1 {
                Divider()

                HStack {
                    if order.orderStatus == .confirmed {
                        Button(action: {
                            Task {
                                await viewModel.updateOrderStatus(order.id, to: .preparing)
                            }
                        }) {
                            HStack {
                                Image(systemName: "flame")
                                Text("Start Preparing")
                            }
                            .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.orange)
                        .accessibility(label: Text("Start Preparing"))
                    } else if order.orderStatus == .preparing {
                        Button(action: {
                            Task {
                                await viewModel.updateOrderStatus(order.id, to: .ready)
                            }
                        }) {
                            HStack {
                                Image(systemName: "checkmark.circle.fill")
                                Text("Mark Ready")
                            }
                            .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.blue)
                        .accessibility(label: Text("Ready"))
                    } else if order.orderStatus == .ready {
                        Text("Ready for pickup/delivery")
                            .font(.subheadline)
                            .foregroundColor(.theme.textSecondary)
                    }
                }
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(AppConstants.UI.cornerRadius)
        .onTapGesture {
            showDetail = true
        }
        .sheet(isPresented: $showDetail) {
            SellerOrderDetailView(order: order, viewModel: viewModel)
        }
    }
}

// MARK: - Seller Order Detail View

struct SellerOrderDetailView: View {
    let order: Order
    @ObservedObject var viewModel: OrderViewModel
    @Environment(\.dismiss) var dismiss
    @State private var showRejectDialog = false
    @State private var rejectionReason = ""

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Order Header
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("Order #\(order.id)")
                                .font(.title2)
                                .fontWeight(.bold)

                            Spacer()

                            Badge(text: order.orderStatus.displayName, color: order.statusColor)
                        }

                        Text(order.formattedDate)
                            .font(.subheadline)
                            .foregroundColor(.theme.textSecondary)
                    }
                    .padding()
                    .background(Color.theme.surface)
                    .cornerRadius(AppConstants.UI.cornerRadius)

                    // Customer Info
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Customer Information")
                            .font(.headline)

                        HStack {
                            Label(order.customerName, systemImage: "person.fill")
                            Spacer()
                        }
                        .accessibilityIdentifier("CustomerName")

                        if let address = order.deliveryAddress {
                            Label(address, systemImage: "location.fill")
                                .font(.subheadline)
                        }
                    }
                    .padding()
                    .background(Color.theme.surface)
                    .cornerRadius(AppConstants.UI.cornerRadius)

                    // Order Items
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Order Items")
                            .font(.headline)

                        ForEach(order.items) { item in
                            HStack {
                                Text("\(item.quantity)x")
                                    .font(.subheadline)
                                    .fontWeight(.semibold)
                                    .frame(width: 30, alignment: .leading)

                                VStack(alignment: .leading, spacing: 2) {
                                    Text(item.dishName)
                                        .font(.subheadline)

                                    if let specialInstructions = item.specialInstructions {
                                        Text(specialInstructions)
                                            .font(.caption)
                                            .foregroundColor(.theme.textSecondary)
                                            .italic()
                                    }
                                }

                                Spacer()

                                Text(item.formattedTotal)
                                    .font(.subheadline)
                                    .fontWeight(.medium)
                            }
                            .padding(.vertical, 4)

                            if item.id != order.items.last?.id {
                                Divider()
                            }
                        }
                    }
                    .padding()
                    .background(Color.theme.surface)
                    .cornerRadius(AppConstants.UI.cornerRadius)

                    // Order Total
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("Subtotal")
                            Spacer()
                            Text(order.formattedSubtotal)
                        }
                        .font(.subheadline)

                        if order.deliveryFeeCents > 0 {
                            HStack {
                                Text("Delivery Fee")
                                Spacer()
                                Text(order.formattedDeliveryFee)
                            }
                            .font(.subheadline)
                        }

                        Divider()

                        HStack {
                            Text("Total")
                                .fontWeight(.bold)
                            Spacer()
                            Text(order.formattedTotal)
                                .fontWeight(.bold)
                                .foregroundColor(.theme.primary)
                        }
                        .font(.headline)
                    }
                    .padding()
                    .background(Color.theme.surface)
                    .cornerRadius(AppConstants.UI.cornerRadius)

                    // Action Buttons
                    if order.orderStatus == .pending {
                        VStack(spacing: 12) {
                            Button(action: {
                                Task {
                                    await viewModel.updateOrderStatus(order.id, to: .confirmed)
                                    dismiss()
                                }
                            }) {
                                HStack {
                                    Image(systemName: "checkmark.circle.fill")
                                    Text("Accept Order")
                                }
                                .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(.green)
                            .controlSize(.large)
                            .accessibility(label: Text("Accept"))

                            Button(action: {
                                showRejectDialog = true
                            }) {
                                HStack {
                                    Image(systemName: "xmark.circle")
                                    Text("Reject Order")
                                }
                                .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.bordered)
                            .tint(.red)
                            .controlSize(.large)
                            .accessibility(label: Text("Reject"))
                        }
                        .padding()
                    } else if order.orderStatus == .confirmed {
                        Button(action: {
                            Task {
                                await viewModel.updateOrderStatus(order.id, to: .preparing)
                                dismiss()
                            }
                        }) {
                            HStack {
                                Image(systemName: "flame")
                                Text("Start Preparing")
                            }
                            .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.orange)
                        .controlSize(.large)
                        .padding()
                        .accessibility(label: Text("Preparing"))
                    } else if order.orderStatus == .preparing {
                        Button(action: {
                            Task {
                                await viewModel.updateOrderStatus(order.id, to: .ready)
                                dismiss()
                            }
                        }) {
                            HStack {
                                Image(systemName: "checkmark.circle.fill")
                                Text("Mark as Ready")
                            }
                            .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.blue)
                        .controlSize(.large)
                        .padding()
                        .accessibility(label: Text("Ready"))
                    }
                }
                .padding()
            }
            .background(Color.theme.background)
            .navigationTitle("Order Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .sheet(isPresented: $showRejectDialog) {
                RejectOrderDialog(
                    rejectionReason: $rejectionReason,
                    onConfirm: {
                        Task {
                            await viewModel.rejectOrder(order.id, reason: rejectionReason)
                            dismiss()
                        }
                    },
                    isPresented: $showRejectDialog
                )
            }
        }
    }
}

// MARK: - Reject Order Dialog

struct RejectOrderDialog: View {
    @Binding var rejectionReason: String
    let onConfirm: () -> Void
    @Binding var isPresented: Bool

    var body: some View {
        NavigationView {
            Form {
                Section("Rejection Reason") {
                    TextEditor(text: $rejectionReason)
                        .frame(minHeight: 100)
                        .overlay(
                            Group {
                                if rejectionReason.isEmpty {
                                    Text("Enter reason for rejection")
                                        .foregroundColor(.gray)
                                        .padding(.leading, 4)
                                        .padding(.top, 8)
                                        .allowsHitTesting(false)
                                }
                            },
                            alignment: .topLeading
                        )
                        .accessibilityIdentifier("rejection-reason-field")
                }

                Section {
                    Button(action: {
                        onConfirm()
                        isPresented = false
                    }) {
                        HStack {
                            Image(systemName: "xmark.circle.fill")
                            Text("Reject Order")
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.red)
                    .disabled(rejectionReason.isEmpty)
                    .accessibility(label: Text("Reject"))
                }
            }
            .navigationTitle("Reject Order")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        isPresented = false
                    }
                }
            }
        }
    }
}

// MARK: - Badge Component

struct Badge: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text)
            .font(.caption)
            .fontWeight(.semibold)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color.opacity(0.2))
            .foregroundColor(color)
            .cornerRadius(6)
    }
}

#Preview {
    NavigationView {
        OrdersListView()
    }
}
