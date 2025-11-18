import SwiftUI

struct SellerDashboardView: View {
    @EnvironmentObject var sellerViewModel: SellerViewModel
    @State private var showBusinessEdit = false

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Business Header
                if let business = sellerViewModel.business {
                    BusinessHeaderCard(business: business) {
                        showBusinessEdit = true
                    }
                }

                // Stats Cards
                StatsGridView(viewModel: sellerViewModel)

                // Today's Orders
                TodayOrdersSection(orders: sellerViewModel.todayOrders, viewModel: sellerViewModel)

                // Recent Reviews
                RecentReviewsSection(reviews: sellerViewModel.recentReviews)
            }
            .padding()
        }
        .background(Color.theme.background)
        .navigationTitle("MenuMaker")
        .accessibilityIdentifier("seller-dashboard-screen")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: { Task { await sellerViewModel.refreshData() } }) {
                    Image(systemName: "arrow.clockwise")
                }
                .accessibilityIdentifier("refresh-dashboard-button")
            }
        }
        .refreshable {
            await sellerViewModel.refreshData()
        }
    }
}

struct BusinessHeaderCard: View {
    let business: Business
    let onEdit: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            if let logoUrl = business.logoUrl {
                AsyncImage(url: URL(string: logoUrl)) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Image(systemName: "photo")
                }
                .frame(width: 80, height: 80)
                .clipShape(Circle())
            }

            Text(business.name)
                .font(.title2)
                .fontWeight(.bold)

            Text(business.displayDescription)
                .font(.subheadline)
                .foregroundColor(.theme.textSecondary)
                .multilineTextAlignment(.center)

            Button(action: onEdit) {
                Text("Edit Business")
                    .font(.caption)
            }
            .buttonStyle(.bordered)
            .accessibilityIdentifier("edit-business-button")
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(AppConstants.UI.cornerRadius)
    }
}

struct StatsGridView: View {
    @ObservedObject var viewModel: SellerViewModel

    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
            StatCard(title: "Today's Revenue", value: viewModel.getFormattedRevenue(), icon: "dollarsign.circle.fill", color: .green)
            StatCard(title: "Today's Orders", value: "\(viewModel.todayOrders.count)", icon: "bag.fill", color: .blue)
            StatCard(title: "Pending Orders", value: "\(viewModel.pendingOrders)", icon: "clock.fill", color: .orange)
            StatCard(title: "Average Rating", value: viewModel.getFormattedAverageRating(), icon: "star.fill", color: .yellow)
        }
    }
}

struct StatCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(color)
                Spacer()
            }

            Text(value)
                .font(.title2)
                .fontWeight(.bold)

            Text(title)
                .font(.caption)
                .foregroundColor(.theme.textSecondary)
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(AppConstants.UI.cornerRadius)
    }
}

struct TodayOrdersSection: View {
    let orders: [Order]
    @ObservedObject var viewModel: SellerViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Today's Orders")
                .font(.headline)
                .padding(.horizontal)

            if orders.isEmpty {
                Text("No orders today")
                    .foregroundColor(.theme.textSecondary)
                    .frame(maxWidth: .infinity)
                    .padding()
            } else {
                ForEach(orders.prefix(5)) { order in
                    OrderRowView(order: order, onStatusChange: { status in
                        Task { await viewModel.markOrderAsReady(order.id) }
                    })
                }
            }
        }
    }
}

struct OrderRowView: View {
    let order: Order
    let onStatusChange: (OrderStatus) -> Void

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(order.customerName)
                    .font(.subheadline)
                    .fontWeight(.semibold)

                Text("\(order.itemsCount) items • \(order.formattedTotal)")
                    .font(.caption)
                    .foregroundColor(.theme.textSecondary)
            }

            Spacer()

            Badge(text: order.status.capitalized, color: order.statusColor)
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(AppConstants.UI.smallCornerRadius)
        .padding(.horizontal)
    }
}

struct RecentReviewsSection: View {
    let reviews: [Review]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Recent Reviews")
                .font(.headline)
                .padding(.horizontal)

            if reviews.isEmpty {
                Text("No reviews yet")
                    .foregroundColor(.theme.textSecondary)
                    .frame(maxWidth: .infinity)
                    .padding()
            } else {
                ForEach(reviews) { review in
                    ReviewRowView(review: review)
                }
            }
        }
    }
}

struct ReviewRowView: View {
    let review: Review

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(review.customerName)
                    .font(.subheadline)
                    .fontWeight(.semibold)

                Spacer()

                Text(review.ratingStars)
                    .font(.caption)
            }

            Text(review.displayComment)
                .font(.caption)
                .foregroundColor(.theme.textSecondary)
                .lineLimit(2)
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(AppConstants.UI.smallCornerRadius)
        .padding(.horizontal)
    }
}

#Preview {
    NavigationView {
        SellerDashboardView()
            .environmentObject(SellerViewModel())
    }
}
