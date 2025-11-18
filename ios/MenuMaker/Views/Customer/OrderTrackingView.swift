import SwiftUI
import MapKit

struct OrderTrackingView: View {
    let order: Order
    @Environment(\.dismiss) var dismiss
    @State private var showCancelConfirmation = false
    @State private var region = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 28.6139, longitude: 77.2090),
        span: MKCoordinateSpan(latitudeDelta: 0.05, longitudeDelta: 0.05)
    )

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Order ID and Status
                VStack(spacing: 12) {
                    Text(order.orderId)
                        .font(.title2)
                        .fontWeight(.bold)
                        .accessibilityIdentifier("order-id")

                    Text(order.orderStatus.displayName)
                        .font(.headline)
                        .foregroundColor(order.statusColor)
                        .accessibilityIdentifier("order-status")

                    if let estimatedTime = order.formattedEstimatedTime {
                        Text(estimatedTime)
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .accessibilityIdentifier("estimated-time")
                    }
                }
                .padding()

                // Map View (for out-for-delivery status)
                if order.orderStatus == .outForDelivery {
                    Map(coordinateRegion: .constant(region))
                        .frame(height: 200)
                        .cornerRadius(AppConstants.UI.cornerRadius)
                        .padding(.horizontal)
                        .accessibilityElement()
                        .accessibilityLabel("Delivery map")
                }

                // Tracking Steps
                VStack(alignment: .leading, spacing: 16) {
                    ForEach(OrderStatus.trackingStatuses, id: \.self) { status in
                        TrackingStepView(
                            status: status,
                            currentStatus: order.orderStatus,
                            isCompleted: status.stepNumber <= order.orderStatus.stepNumber
                        )
                        .accessibilityIdentifier("TrackingStep")
                    }
                }
                .padding()
                .background(Color.theme.surface)
                .cornerRadius(AppConstants.UI.cornerRadius)
                .padding(.horizontal)

                // Delivery Person Info (when out for delivery)
                if order.orderStatus == .outForDelivery || order.orderStatus == .delivered {
                    if let deliveryPerson = order.deliveryPersonName {
                        VStack(spacing: 12) {
                            HStack {
                                VStack(alignment: .leading) {
                                    Text("Delivery Partner")
                                        .font(.caption)
                                        .foregroundColor(.secondary)

                                    Text(deliveryPerson)
                                        .font(.headline)
                                        .accessibilityIdentifier("deliveryPerson-name")
                                }

                                Spacer()

                                if order.orderStatus == .outForDelivery, let phone = order.deliveryPersonPhone {
                                    HStack(spacing: 12) {
                                        Button(action: {
                                            callDeliveryPerson(phone)
                                        }) {
                                            Image(systemName: "phone.fill")
                                                .foregroundColor(.green)
                                        }
                                        .accessibilityLabel("Call delivery person")

                                        Button(action: {
                                            openWhatsApp(phone)
                                        }) {
                                            Image(systemName: "message.fill")
                                                .foregroundColor(.green)
                                        }
                                        .accessibilityLabel("WhatsApp delivery person")
                                    }
                                }
                            }
                        }
                        .padding()
                        .background(Color.theme.surface)
                        .cornerRadius(AppConstants.UI.cornerRadius)
                        .padding(.horizontal)
                    }
                }

                // Order Items
                VStack(alignment: .leading, spacing: 12) {
                    Text("Order Details")
                        .font(.headline)

                    ForEach(order.items) { item in
                        HStack {
                            Text("\(item.quantity)x")
                                .foregroundColor(.secondary)
                            Text(item.dishName)
                            Spacer()
                            Text(item.formattedTotal)
                                .fontWeight(.medium)
                        }
                        .accessibilityIdentifier("OrderItem")
                    }

                    Divider()

                    HStack {
                        Text("Total")
                            .fontWeight(.bold)
                        Spacer()
                        Text(order.formattedTotal)
                            .fontWeight(.bold)
                            .accessibilityIdentifier("total-amount")
                    }
                }
                .padding()
                .background(Color.theme.surface)
                .cornerRadius(AppConstants.UI.cornerRadius)
                .padding(.horizontal)

                // Delivery Address
                if let address = order.deliveryAddress {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Deliver to")
                            .font(.caption)
                            .foregroundColor(.secondary)

                        Text(address)
                            .font(.body)
                            .accessibilityIdentifier("delivery-address")
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
                    .background(Color.theme.surface)
                    .cornerRadius(AppConstants.UI.cornerRadius)
                    .padding(.horizontal)
                }

                // Action Buttons
                VStack(spacing: 12) {
                    if order.isDelivered {
                        Button(action: {
                            // Navigate to rate order
                        }) {
                            Text("Rate Order")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .accessibilityIdentifier("rate-order-button")
                    }

                    if order.canBeCancelled {
                        Button(action: {
                            showCancelConfirmation = true
                        }) {
                            Text("Cancel Order")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                        .tint(.red)
                        .accessibilityIdentifier("cancel-order-button")
                    }
                }
                .padding(.horizontal)
                .padding(.bottom)
            }
        }
        .navigationTitle("Track Order")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: {
                    // Refresh tracking
                }) {
                    Image(systemName: "arrow.clockwise")
                }
                .accessibilityLabel("Refresh")
            }
        }
        .confirmationDialog("Cancel Order", isPresented: $showCancelConfirmation) {
            Button("Yes, Cancel Order", role: .destructive) {
                // Cancel order
            }
        } message: {
            Text("Are you sure you want to cancel this order?")
        }
    }

    private func callDeliveryPerson(_ phone: String) {
        if let url = URL(string: "tel://\(phone)") {
            UIApplication.shared.open(url)
        }
    }

    private func openWhatsApp(_ phone: String) {
        let cleanPhone = phone.replacingOccurrences(of: "[^0-9]", with: "", options: .regularExpression)
        if let url = URL(string: "https://wa.me/\(cleanPhone)") {
            UIApplication.shared.open(url)
        }
    }
}

struct TrackingStepView: View {
    let status: OrderStatus
    let currentStatus: OrderStatus
    let isCompleted: Bool

    var body: some View {
        HStack(spacing: 16) {
            // Step Indicator
            ZStack {
                Circle()
                    .fill(isCompleted ? status.color : Color.gray.opacity(0.3))
                    .frame(width: 32, height: 32)

                if isCompleted {
                    Image(systemName: "checkmark")
                        .foregroundColor(.white)
                        .font(.caption.bold())
                }
            }

            // Step Info
            VStack(alignment: .leading, spacing: 4) {
                Text(status.displayName)
                    .font(.body)
                    .fontWeight(status == currentStatus ? .bold : .regular)
                    .foregroundColor(isCompleted ? .primary : .secondary)

                if status == currentStatus && status != .delivered {
                    Text("🔴 Live")
                        .font(.caption)
                        .foregroundColor(.orange)
                        .accessibilityIdentifier("live-indicator")
                }
            }

            Spacer()

            if isCompleted {
                Image(systemName: status.icon)
                    .foregroundColor(status.color)
            }
        }
    }
}

#Preview {
    NavigationView {
        OrderTrackingView(order: Order(
            id: "ABC123XYZ",
            businessId: "biz1",
            customerName: "Test User",
            customerPhone: "+919876543210",
            customerEmail: "test@example.com",
            totalCents: 45000,
            status: "out_for_delivery",
            items: [
                OrderItem(
                    id: "item1",
                    dishId: "dish1",
                    dishName: "Paneer Tikka",
                    quantity: 2,
                    priceCents: 15000,
                    totalCents: 30000
                ),
                OrderItem(
                    id: "item2",
                    dishId: "dish2",
                    dishName: "Naan",
                    quantity: 3,
                    priceCents: 5000,
                    totalCents: 15000
                )
            ],
            createdAt: ISO8601DateFormatter().string(from: Date()),
            updatedAt: ISO8601DateFormatter().string(from: Date()),
            deliveryAddress: "123 Test Street, Test City, 110001",
            estimatedDeliveryTime: ISO8601DateFormatter().string(from: Date().addingTimeInterval(1800)),
            deliveryPersonName: "Rajesh Kumar",
            deliveryPersonPhone: "+919876543210"
        ))
    }
}
