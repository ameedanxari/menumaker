import SwiftUI

struct SellerDashboardView: View {
    @EnvironmentObject var sellerViewModel: SellerViewModel
    @State private var showBusinessEdit = false
    @State private var showNotifications = false
    @State private var showExportOptions = false

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Business Header
                if let business = sellerViewModel.business {
                    BusinessHeaderCard(business: business) {
                        showBusinessEdit = true
                    }
                }

                // Time Period Tabs
                TimePeriodTabs(viewModel: sellerViewModel)

                // Stats Cards
                StatsGridView(viewModel: sellerViewModel)

                // Sales Chart
                if let analyticsData = sellerViewModel.analyticsData {
                    SalesChartSection(salesData: analyticsData.salesData)
                }

                // Popular Items
                if !sellerViewModel.getPopularItems().isEmpty {
                    PopularItemsSection(items: sellerViewModel.getPopularItems())
                }

                // Customer Insights
                if let insights = sellerViewModel.customerInsights {
                    CustomerInsightsSection(insights: insights)
                }

                // Payouts
                if let payouts = sellerViewModel.payoutInfo {
                    PayoutsSection(payouts: payouts)
                }

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
                HStack(spacing: 16) {
                    Button(action: { showExportOptions = true }) {
                        Image(systemName: "square.and.arrow.down")
                    }
                    .accessibilityLabel("Export")
                    .accessibilityIdentifier("export-button")

                    NavigationLink(destination: NotificationsView(), isActive: $showNotifications) {
                        Button(action: { showNotifications = true }) {
                            Image(systemName: "bell")
                        }
                    }
                    .accessibilityLabel("Notifications")
                    .accessibilityIdentifier("notifications-button")

                    Button(action: { Task { await sellerViewModel.refreshData() } }) {
                        Image(systemName: "arrow.clockwise")
                    }
                    .accessibilityIdentifier("refresh-dashboard-button")
                }
            }
        }
        .refreshable {
            await sellerViewModel.refreshData()
        }
        .confirmationDialog("Export Analytics", isPresented: $showExportOptions) {
            Button("CSV") {
                Task { await sellerViewModel.exportAnalytics(format: .csv) }
            }
            Button("PDF") {
                Task { await sellerViewModel.exportAnalytics(format: .pdf) }
            }
            Button("Cancel", role: .cancel) {}
        }
        .onAppear {
            Task {
                if sellerViewModel.analyticsData == nil {
                    await sellerViewModel.loadAnalytics(for: .today)
                }
            }
        }
    }
}

// MARK: - Time Period Tabs

struct TimePeriodTabs: View {
    @ObservedObject var viewModel: SellerViewModel

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(TimePeriod.allCases, id: \.self) { period in
                    Button(action: {
                        Task {
                            await viewModel.switchPeriod(to: period)
                        }
                    }) {
                        Text(period.rawValue)
                            .font(.subheadline)
                            .fontWeight(viewModel.selectedPeriod == period ? .semibold : .regular)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                            .background(
                                viewModel.selectedPeriod == period ?
                                Color.blue : Color.gray.opacity(0.2)
                            )
                            .foregroundColor(viewModel.selectedPeriod == period ? .white : .primary)
                            .cornerRadius(20)
                    }
                    .accessibilityLabel(period.rawValue)
                    .accessibilityIdentifier("\(period.rawValue.lowercased())-tab")
                }
            }
            .padding(.horizontal)
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
            if let analytics = viewModel.analyticsData {
                StatCard(
                    title: "Total Sales",
                    value: analytics.formattedTotalSales,
                    icon: "dollarsign.circle.fill",
                    color: .green
                )
                StatCard(
                    title: "Total Orders",
                    value: "\(analytics.totalOrders)",
                    icon: "bag.fill",
                    color: .blue
                )
                StatCard(
                    title: "Revenue",
                    value: analytics.formattedTotalRevenue,
                    icon: "chart.line.uptrend.xyaxis",
                    color: .purple
                )
                StatCard(
                    title: "Average Order",
                    value: analytics.formattedAverageOrderValue,
                    icon: "cart.fill",
                    color: .orange
                )
            } else {
                StatCard(title: "Today's Revenue", value: viewModel.getFormattedRevenue(), icon: "dollarsign.circle.fill", color: .green)
                StatCard(title: "Today's Orders", value: "\(viewModel.todayOrders.count)", icon: "bag.fill", color: .blue)
                StatCard(title: "Pending Orders", value: "\(viewModel.pendingOrders)", icon: "clock.fill", color: .orange)
                StatCard(title: "Average Rating", value: viewModel.getFormattedAverageRating(), icon: "star.fill", color: .yellow)
            }
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
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("DashboardCard")
    }
}

// MARK: - Sales Chart Section

struct SalesChartSection: View {
    let salesData: [SalesDataPoint]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Sales Overview")
                .font(.headline)
                .padding(.horizontal)

            VStack {
                // Simple bar chart representation
                HStack(alignment: .bottom, spacing: 8) {
                    ForEach(salesData) { dataPoint in
                        VStack {
                            Text(dataPoint.formattedSales)
                                .font(.caption2)
                                .foregroundColor(.theme.textSecondary)

                            Rectangle()
                                .fill(Color.blue)
                                .frame(width: 40, height: CGFloat(dataPoint.sales / 500))

                            Text("\(dataPoint.orders)")
                                .font(.caption2)
                                .foregroundColor(.theme.textSecondary)
                        }
                    }
                }
                .padding()
            }
            .background(Color.theme.surface)
            .cornerRadius(AppConstants.UI.cornerRadius)
            .accessibilityIdentifier("SalesChart")
        }
    }
}

// MARK: - Popular Items Section

struct PopularItemsSection: View {
    let items: [PopularItem]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Top Selling Items")
                .font(.headline)
                .padding(.horizontal)

            ForEach(items) { item in
                HStack(spacing: 12) {
                    if let imageUrl = item.imageUrl, let url = URL(string: imageUrl) {
                        AsyncImage(url: url) { image in
                            image.resizable().scaledToFill()
                        } placeholder: {
                            Image(systemName: "photo")
                                .foregroundColor(.gray)
                        }
                        .frame(width: 60, height: 60)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text(item.name)
                            .font(.subheadline)
                            .fontWeight(.semibold)

                        Text("\(item.salesCount) sold • \(item.formattedRevenue)")
                            .font(.caption)
                            .foregroundColor(.theme.textSecondary)
                    }

                    Spacer()
                }
                .padding()
                .background(Color.theme.surface)
                .cornerRadius(AppConstants.UI.smallCornerRadius)
                .accessibilityIdentifier("PopularItem")
            }
        }
    }
}

// MARK: - Customer Insights Section

struct CustomerInsightsSection: View {
    let insights: CustomerInsights

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Customer Insights")
                .font(.headline)
                .padding(.horizontal)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                InsightCard(
                    title: "New Customers",
                    value: "\(insights.newCustomers)",
                    icon: "person.badge.plus",
                    color: .green
                )

                InsightCard(
                    title: "Repeat Customers",
                    value: "\(insights.repeatCustomers)",
                    icon: "arrow.triangle.2.circlepath",
                    color: .blue
                )

                InsightCard(
                    title: "Total Customers",
                    value: "\(insights.totalCustomers)",
                    icon: "person.3",
                    color: .purple
                )

                InsightCard(
                    title: "Repeat Rate",
                    value: insights.formattedRepeatRate,
                    icon: "percent",
                    color: .orange
                )
            }
        }
    }
}

struct InsightCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: icon)
                .foregroundColor(color)

            Text(value)
                .font(.title3)
                .fontWeight(.bold)

            Text(title)
                .font(.caption)
                .foregroundColor(.theme.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(AppConstants.UI.cornerRadius)
    }
}

// MARK: - Payouts Section

struct PayoutsSection: View {
    let payouts: PayoutInfo

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Payouts")
                .font(.headline)
                .padding(.horizontal)

            VStack(spacing: 12) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Pending Payout")
                            .font(.caption)
                            .foregroundColor(.theme.textSecondary)

                        Text(payouts.formattedPending)
                            .font(.title3)
                            .fontWeight(.bold)
                    }

                    Spacer()

                    VStack(alignment: .trailing, spacing: 4) {
                        Text("Completed")
                            .font(.caption)
                            .foregroundColor(.theme.textSecondary)

                        Text(payouts.formattedCompleted)
                            .font(.title3)
                            .fontWeight(.bold)
                            .foregroundColor(.green)
                    }
                }

                if let nextPayoutDate = payouts.nextPayoutDate {
                    Divider()

                    HStack {
                        Image(systemName: "calendar")
                            .foregroundColor(.theme.primary)

                        Text("Next Payout: \(nextPayoutDate)")
                            .font(.caption)
                            .foregroundColor(.theme.textSecondary)
                    }
                }
            }
            .padding()
            .background(Color.theme.surface)
            .cornerRadius(AppConstants.UI.cornerRadius)
        }
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
