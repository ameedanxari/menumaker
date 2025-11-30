package com.menumaker.ui.screens.seller

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.menumaker.data.remote.models.*
import com.menumaker.viewmodel.SellerViewModel

/**
 * Seller Dashboard Screen
 *
 * Comprehensive analytics dashboard with real-time business insights.
 * Matches iOS SellerDashboardView functionality.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    viewModel: SellerViewModel = hiltViewModel(),
    onNavigateToOrders: () -> Unit = {},
    onNavigateToMenu: () -> Unit = {},
    onNavigateToNotifications: () -> Unit = {}
) {
    val business by viewModel.business.collectAsState()
    val analyticsData by viewModel.analyticsData.collectAsState()
    val customerInsights by viewModel.customerInsights.collectAsState()
    val payoutInfo by viewModel.payoutInfo.collectAsState()
    val todayOrders by viewModel.todayOrders.collectAsState()
    val recentReviews by viewModel.recentReviews.collectAsState()
    val selectedPeriod by viewModel.selectedPeriod.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()

    var showExportOptions by remember { mutableStateOf(false) }
    var showBusinessEdit by remember { mutableStateOf(false) }

    // Load analytics on appear
    LaunchedEffect(Unit) {
        if (analyticsData == null) {
            viewModel.loadAnalytics(TimePeriod.TODAY)
        }
    }

    // Export options dialog
    if (showExportOptions) {
        AlertDialog(
            onDismissRequest = { showExportOptions = false },
            title = { Text("Export Analytics") },
            text = { Text("Choose export format") },
            confirmButton = {
                Column {
                    TextButton(onClick = {
                        viewModel.exportAnalytics(ExportFormat.CSV)
                        showExportOptions = false
                    }) {
                        Text("CSV")
                    }
                    TextButton(onClick = {
                        viewModel.exportAnalytics(ExportFormat.PDF)
                        showExportOptions = false
                    }) {
                        Text("PDF")
                    }
                }
            },
            dismissButton = {
                TextButton(onClick = { showExportOptions = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("MenuMaker") },
                actions = {
                    IconButton(onClick = { showExportOptions = true }) {
                        Icon(Icons.Default.Download, "Export")
                    }
                    IconButton(onClick = onNavigateToNotifications) {
                        Icon(Icons.Default.Notifications, "Notifications")
                    }
                    IconButton(onClick = { viewModel.refreshData() }) {
                        Icon(Icons.Default.Refresh, "Refresh")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            // Loading indicator
            if (isLoading) {
                LinearProgressIndicator(
                    modifier = Modifier.fillMaxWidth()
                )
            }

            // Business Header
            business?.let { bizData ->
                BusinessHeaderCard(
                    business = bizData,
                    onEdit = { showBusinessEdit = true }
                )
            }

            // Time Period Tabs
            TimePeriodTabs(
                selectedPeriod = selectedPeriod,
                onPeriodSelected = { viewModel.switchPeriod(it) }
            )

            // Stats Grid
            StatsGridView(
                analyticsData = analyticsData,
                todayOrdersCount = todayOrders.size,
                viewModel = viewModel
            )

            // Sales Chart
            analyticsData?.let { data ->
                if (data.salesData.isNotEmpty()) {
                    SalesChartSection(salesData = data.salesData)
                }
            }

            // Popular Items
            analyticsData?.let { data ->
                if (data.popularItems.isNotEmpty()) {
                    PopularItemsSection(items = data.popularItems)
                }
            }

            // Customer Insights
            customerInsights?.let { insights ->
                CustomerInsightsSection(insights = insights)
            }

            // Payouts
            payoutInfo?.let { payouts ->
                PayoutsSection(payouts = payouts)
            }

            // Today's Orders
            TodayOrdersSection(
                orders = todayOrders,
                onMarkReady = { orderId ->
                    viewModel.markOrderAsReady(orderId)
                }
            )

            // Recent Reviews
            RecentReviewsSection(reviews = recentReviews)
        }
    }
}

// MARK: - Business Header

@Composable
fun BusinessHeaderCard(
    business: BusinessDto,
    onEdit: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Business Logo
            business.logoUrl?.let { logoUrl ->
                AsyncImage(
                    model = logoUrl,
                    contentDescription = "${business.name} logo",
                    modifier = Modifier.size(80.dp),
                    contentScale = ContentScale.Crop
                )
            }

            Text(
                text = business.name,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )

            business.description?.let { desc ->
                Text(
                    text = desc,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            OutlinedButton(onClick = onEdit) {
                Text("Edit Business")
            }
        }
    }
}

// MARK: - Time Period Tabs

@Composable
fun TimePeriodTabs(
    selectedPeriod: TimePeriod,
    onPeriodSelected: (TimePeriod) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        TimePeriod.values().forEach { period ->
            FilterChip(
                selected = selectedPeriod == period,
                onClick = { onPeriodSelected(period) },
                label = { Text(period.displayName) }
            )
        }
    }
}

// MARK: - Stats Grid

@Composable
fun StatsGridView(
    analyticsData: AnalyticsData?,
    todayOrdersCount: Int,
    viewModel: SellerViewModel
) {
    LazyVerticalGrid(
        columns = GridCells.Fixed(2),
        modifier = Modifier.height(320.dp),
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        if (analyticsData != null) {
            items(
                listOf(
                    StatCardData("Total Sales", analyticsData.formattedTotalSales, Icons.Default.AttachMoney, Color(0xFF4CAF50)),
                    StatCardData("Total Orders", "${analyticsData.totalOrders}", Icons.Default.ShoppingBag, Color(0xFF2196F3)),
                    StatCardData("Revenue", analyticsData.formattedTotalRevenue, Icons.Default.TrendingUp, Color(0xFF9C27B0)),
                    StatCardData("Average Order", analyticsData.formattedAverageOrderValue, Icons.Default.ShoppingCart, Color(0xFFFF9800))
                )
            ) { stat ->
                StatCard(
                    title = stat.title,
                    value = stat.value,
                    icon = stat.icon,
                    color = stat.color
                )
            }
        } else {
            items(
                listOf(
                    StatCardData("Today's Revenue", viewModel.getFormattedRevenue(), Icons.Default.AttachMoney, Color(0xFF4CAF50)),
                    StatCardData("Today's Orders", "$todayOrdersCount", Icons.Default.ShoppingBag, Color(0xFF2196F3)),
                    StatCardData("Pending Orders", "${viewModel.getPendingOrders()}", Icons.Default.Schedule, Color(0xFFFF9800)),
                    StatCardData("Average Rating", viewModel.getFormattedAverageRating(), Icons.Default.Star, Color(0xFFFFB300))
                )
            ) { stat ->
                StatCard(
                    title = stat.title,
                    value = stat.value,
                    icon = stat.icon,
                    color = stat.color
                )
            }
        }
    }
}

data class StatCardData(
    val title: String,
    val value: String,
    val icon: ImageVector,
    val color: Color
)

@Composable
fun StatCard(
    title: String,
    value: String,
    icon: ImageVector,
    color: Color
) {
    Card(
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = color
                )
            }

            Text(
                text = value,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )

            Text(
                text = title,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

// MARK: - Sales Chart Section

@Composable
fun SalesChartSection(salesData: List<SalesDataPoint>) {
    Card(
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Sales Overview",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            // Simple bar chart
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(150.dp),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.Bottom
            ) {
                salesData.forEach { dataPoint ->
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text(
                            text = dataPoint.formattedSales,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )

                        Box(
                            modifier = Modifier
                                .width(40.dp)
                                .height((dataPoint.sales / 10).dp.coerceAtMost(100.dp))
                        ) {
                            Surface(
                                modifier = Modifier.fillMaxSize(),
                                color = MaterialTheme.colorScheme.primary
                            ) {}
                        }

                        Text(
                            text = "${dataPoint.orders}",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}

// MARK: - Popular Items Section

@Composable
fun PopularItemsSection(items: List<PopularItem>) {
    Column(
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            text = "Top Selling Items",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )

        items.forEach { item ->
            Card(
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    item.imageUrl?.let { imageUrl ->
                        AsyncImage(
                            model = imageUrl,
                            contentDescription = item.name,
                            modifier = Modifier.size(60.dp),
                            contentScale = ContentScale.Crop
                        )
                    }

                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text(
                            text = item.name,
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.SemiBold
                        )

                        Text(
                            text = "${item.salesCount} sold • ${item.formattedRevenue}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}

// MARK: - Customer Insights Section

@Composable
fun CustomerInsightsSection(insights: CustomerInsights) {
    Column(
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            text = "Customer Insights",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )

        LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            modifier = Modifier.height(200.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            items(
                listOf(
                    InsightCardData("New Customers", "${insights.newCustomers}", Icons.Default.PersonAdd, Color(0xFF4CAF50)),
                    InsightCardData("Repeat Customers", "${insights.repeatCustomers}", Icons.Default.Refresh, Color(0xFF2196F3)),
                    InsightCardData("Total Customers", "${insights.totalCustomers}", Icons.Default.People, Color(0xFF9C27B0)),
                    InsightCardData("Repeat Rate", insights.formattedRepeatRate, Icons.Default.Percent, Color(0xFFFF9800))
                )
            ) { insight ->
                InsightCard(
                    title = insight.title,
                    value = insight.value,
                    icon = insight.icon,
                    color = insight.color
                )
            }
        }
    }
}

data class InsightCardData(
    val title: String,
    val value: String,
    val icon: ImageVector,
    val color: Color
)

@Composable
fun InsightCard(
    title: String,
    value: String,
    icon: ImageVector,
    color: Color
) {
    Card(
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = color
            )

            Text(
                text = value,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            Text(
                text = title,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

// MARK: - Payouts Section

@Composable
fun PayoutsSection(payouts: PayoutInfo) {
    Card(
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Payouts",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        text = "Pending Payout",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = payouts.formattedPending,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                }

                Column(
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                    horizontalAlignment = Alignment.End
                ) {
                    Text(
                        text = "Completed",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = payouts.formattedCompleted,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF4CAF50)
                    )
                }
            }

            payouts.nextPayoutDate?.let { date ->
                HorizontalDivider()

                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.CalendarToday,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(16.dp)
                    )
                    Text(
                        text = "Next Payout: $date",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

// MARK: - Today's Orders Section

@Composable
fun TodayOrdersSection(
    orders: List<OrderDto>,
    onMarkReady: (String) -> Unit
) {
    Column(
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            text = "Today's Orders",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )

        if (orders.isEmpty()) {
            Text(
                text = "No orders today",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(16.dp)
            )
        } else {
            orders.take(5).forEach { order ->
                OrderRowView(
                    order = order,
                    onMarkReady = { onMarkReady(order.id) }
                )
            }
        }
    }
}

@Composable
fun OrderRowView(
    order: OrderDto,
    onMarkReady: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = order.customerName ?: "Customer",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold
                )

                Text(
                    text = "${order.items.size} items • ₹${order.totalCents / 100}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Surface(
                shape = MaterialTheme.shapes.small,
                color = getStatusColor(order.status).copy(alpha = 0.2f)
            ) {
                Text(
                    text = order.status.capitalize(),
                    style = MaterialTheme.typography.labelSmall,
                    color = getStatusColor(order.status),
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}

// MARK: - Recent Reviews Section

@Composable
fun RecentReviewsSection(reviews: List<ReviewDto>) {
    Column(
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            text = "Recent Reviews",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )

        if (reviews.isEmpty()) {
            Text(
                text = "No reviews yet",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(16.dp)
            )
        } else {
            reviews.forEach { review ->
                ReviewRowView(review = review)
            }
        }
    }
}

@Composable
fun ReviewRowView(review: ReviewDto) {
    Card(
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = review.customerName,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold
                )

                Text(
                    text = "⭐".repeat(review.rating),
                    style = MaterialTheme.typography.labelSmall
                )
            }

            review.comment?.let { comment ->
                Text(
                    text = comment,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2
                )
            }
        }
    }
}

// Helper functions

private fun getStatusColor(status: String): Color {
    return when (status.lowercase()) {
        "pending" -> Color(0xFFFF9800)
        "confirmed" -> Color(0xFF2196F3)
        "preparing" -> Color(0xFF9C27B0)
        "ready" -> Color(0xFF4CAF50)
        "delivered" -> Color(0xFF4CAF50)
        "cancelled" -> Color(0xFFF44336)
        else -> Color.Gray
    }
}

private fun String.capitalize(): String {
    return this.lowercase().replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
}
