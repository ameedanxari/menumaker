package com.menumaker.ui.screens.customer

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.OrderDto
import com.menumaker.viewmodel.OrderViewModel
import java.text.SimpleDateFormat
import java.util.*

/**
 * My Orders Screen
 *
 * Displays customer's order history with tabs for Active, Completed, and Cancelled orders.
 * Matches iOS MyOrdersView functionality.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MyOrdersScreen(
    businessId: String, // TODO: In future, fetch user's orders across all businesses
    viewModel: OrderViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit,
    onNavigateToOrderDetail: (String) -> Unit = {}
) {
    val ordersState by viewModel.ordersState.collectAsState()
    var selectedTab by remember { mutableStateOf(0) }
    var searchQuery by remember { mutableStateOf("") }

    // Load orders when screen opens
    LaunchedEffect(businessId) {
        viewModel.loadOrders(businessId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("My Orders") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                },
                actions = {
                    IconButton(onClick = { /* TODO: Filter */ }) {
                        Icon(
                            imageVector = Icons.Default.FilterList,
                            contentDescription = "Filter"
                        )
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            when (val state = ordersState) {
                is Resource.Loading -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator()
                    }
                }

                is Resource.Success -> {
                    val allOrders = state.data

                    // Search bar (if there are orders)
                    if (allOrders.isNotEmpty()) {
                        OutlinedTextField(
                            value = searchQuery,
                            onValueChange = { searchQuery = it },
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 8.dp),
                            placeholder = { Text("Search orders...") },
                            leadingIcon = { Icon(Icons.Default.Search, null) },
                            singleLine = true
                        )
                    }

                    // Tab Selector
                    TabRow(
                        selectedTabIndex = selectedTab,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Tab(
                            selected = selectedTab == 0,
                            onClick = { selectedTab = 0 },
                            text = { Text("Active") }
                        )
                        Tab(
                            selected = selectedTab == 1,
                            onClick = { selectedTab = 1 },
                            text = { Text("Completed") }
                        )
                        Tab(
                            selected = selectedTab == 2,
                            onClick = { selectedTab = 2 },
                            text = { Text("Cancelled") }
                        )
                    }

                    // Filter orders based on tab and search
                    val filteredOrders = allOrders.filter { order ->
                        val matchesTab = when (selectedTab) {
                            0 -> order.status in listOf("pending", "confirmed", "preparing", "ready", "out_for_delivery")
                            1 -> order.status == "delivered" || order.status == "fulfilled"
                            2 -> order.status == "cancelled"
                            else -> true
                        }

                        val matchesSearch = searchQuery.isEmpty() ||
                                order.id.contains(searchQuery, ignoreCase = true) ||
                                order.customerName.contains(searchQuery, ignoreCase = true)

                        matchesTab && matchesSearch
                    }

                    // Orders List
                    if (filteredOrders.isEmpty()) {
                        // Empty state
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.ShoppingCart,
                                    contentDescription = null,
                                    modifier = Modifier.size(64.dp),
                                    tint = MaterialTheme.colorScheme.outline
                                )
                                Text(
                                    text = "No Orders",
                                    style = MaterialTheme.typography.titleMedium
                                )
                                Text(
                                    text = when (selectedTab) {
                                        0 -> "You don't have any active orders"
                                        1 -> "You haven't completed any orders yet"
                                        2 -> "You don't have any cancelled orders"
                                        else -> "No orders found"
                                    },
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    } else {
                        LazyColumn(
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            items(filteredOrders) { order ->
                                OrderCard(
                                    order = order,
                                    showTrackButton = selectedTab == 0,
                                    onOrderClick = { onNavigateToOrderDetail(order.id) },
                                    onTrackClick = { onNavigateToOrderDetail(order.id) }
                                )
                            }
                        }
                    }
                }

                is Resource.Error -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                text = "Error loading orders",
                                style = MaterialTheme.typography.titleMedium,
                                color = MaterialTheme.colorScheme.error
                            )
                            Text(
                                text = state.message,
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }

                null -> {
                    // Initial state
                }
            }
        }
    }
}

/**
 * Order Card Component
 * Displays an individual order with key details
 */
@Composable
fun OrderCard(
    order: OrderDto,
    showTrackButton: Boolean = false,
    onOrderClick: () -> Unit = {},
    onTrackClick: () -> Unit = {}
) {
    Card(
        onClick = onOrderClick,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Header: Order ID and Status
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Order #${order.id.takeLast(8)}",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )

                OrderStatusChip(status = order.status)
            }

            // Order Details
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                // Items count
                Text(
                    text = "${order.items.size} item${if (order.items.size != 1) "s" else ""}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                // Date
                Text(
                    text = formatOrderDate(order.createdAt),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                // Total
                Text(
                    text = "₹${order.totalCents / 100.0}",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
            }

            // Track Order Button (for active orders)
            if (showTrackButton) {
                Button(
                    onClick = onTrackClick,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(
                        imageVector = Icons.Default.LocalShipping,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Track Order")
                }
            }
        }
    }
}

/**
 * Order Status Chip Component
 * Displays order status with appropriate color
 */
@Composable
fun OrderStatusChip(status: String) {
    val (text, color) = when (status.lowercase()) {
        "pending" -> "Pending" to MaterialTheme.colorScheme.secondary
        "confirmed" -> "Confirmed" to MaterialTheme.colorScheme.primary
        "preparing" -> "Preparing" to MaterialTheme.colorScheme.tertiary
        "ready" -> "Ready" to MaterialTheme.colorScheme.primary
        "out_for_delivery" -> "On the way" to MaterialTheme.colorScheme.tertiary
        "delivered", "fulfilled" -> "Delivered" to MaterialTheme.colorScheme.primary
        "cancelled" -> "Cancelled" to MaterialTheme.colorScheme.error
        else -> status.capitalize() to MaterialTheme.colorScheme.outline
    }

    Surface(
        color = color.copy(alpha = 0.1f),
        shape = MaterialTheme.shapes.small
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelSmall,
            color = color,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            fontWeight = FontWeight.Medium
        )
    }
}

/**
 * Helper function to format order date
 */
private fun formatOrderDate(dateString: String): String {
    return try {
        val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
        val outputFormat = SimpleDateFormat("MMM dd, yyyy 'at' hh:mm a", Locale.getDefault())
        val date = inputFormat.parse(dateString)
        date?.let { outputFormat.format(it) } ?: dateString
    } catch (e: Exception) {
        dateString
    }
}

/**
 * Extension function to capitalize first letter
 */
private fun String.capitalize(): String {
    return this.replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
}
