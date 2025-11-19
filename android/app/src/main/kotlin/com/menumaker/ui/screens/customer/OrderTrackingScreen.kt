package com.menumaker.ui.screens.customer

import androidx.compose.foundation.layout.*
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

/**
 * Order Tracking Screen
 *
 * Displays real-time order status and tracking information.
 * Matches iOS OrderTrackingView functionality.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrderTrackingScreen(
    orderId: String,
    viewModel: OrderViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit
) {
    val orderDetailState by viewModel.orderDetailState.collectAsState()

    // Load order details when screen opens
    LaunchedEffect(orderId) {
        viewModel.loadOrderDetail(orderId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Track Order") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                }
            )
        }
    ) { padding ->
        when (val state = orderDetailState) {
            is Resource.Loading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }

            is Resource.Success -> {
                val order = state.data

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(24.dp)
                ) {
                    // Order ID Header
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.primaryContainer
                        )
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                text = "Order #${order.id.takeLast(8)}",
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold
                            )
                            Row(
                                horizontalArrangement = Arrangement.SpaceBetween,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(
                                    text = "${order.items.size} items",
                                    style = MaterialTheme.typography.bodyMedium
                                )
                                Text(
                                    text = "₹${order.totalCents / 100.0}",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }

                    // Order Status Timeline
                    OrderStatusTimeline(order = order)

                    // Order Items
                    Text(
                        text = "Order Items",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )

                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            order.items.forEach { item ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 8.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Column {
                                        Text(
                                            text = item.dishName,
                                            style = MaterialTheme.typography.bodyMedium,
                                            fontWeight = FontWeight.Medium
                                        )
                                        Text(
                                            text = "Qty: ${item.quantity}",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                    Text(
                                        text = "₹${item.totalCents / 100.0}",
                                        style = MaterialTheme.typography.bodyMedium,
                                        fontWeight = FontWeight.Medium
                                    )
                                }
                                if (item != order.items.last()) {
                                    Divider(modifier = Modifier.padding(vertical = 4.dp))
                                }
                            }
                        }
                    }

                    // Customer Details
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                text = "Delivery Details",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = order.customerName,
                                style = MaterialTheme.typography.bodyMedium
                            )
                            order.customerPhone?.let {
                                Text(
                                    text = it,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                }
            }

            is Resource.Error -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = "Error loading order",
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.error
                        )
                        Text(
                            text = state.message,
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }
            }

            null -> {}
        }
    }
}

@Composable
fun OrderStatusTimeline(order: OrderDto) {
    val statusSteps = listOf(
        OrderStep("Placed", "pending"),
        OrderStep("Confirmed", "confirmed"),
        OrderStep("Preparing", "preparing"),
        OrderStep("Ready", "ready"),
        OrderStep("Out for Delivery", "out_for_delivery"),
        OrderStep("Delivered", "delivered")
    )

    val currentStatusIndex = statusSteps.indexOfFirst { it.status == order.status }

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = "Order Status",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            statusSteps.forEachIndexed { index, step ->
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    // Status Icon
                    Surface(
                        color = if (index <= currentStatusIndex)
                            MaterialTheme.colorScheme.primary
                        else
                            MaterialTheme.colorScheme.surfaceVariant,
                        shape = MaterialTheme.shapes.extraLarge,
                        modifier = Modifier.size(40.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = when (index) {
                                    0 -> Icons.Default.CheckCircle
                                    1 -> Icons.Default.Verified
                                    2 -> Icons.Default.Restaurant
                                    3 -> Icons.Default.DoneAll
                                    4 -> Icons.Default.LocalShipping
                                    5 -> Icons.Default.Home
                                    else -> Icons.Default.Circle
                                },
                                contentDescription = null,
                                tint = if (index <= currentStatusIndex)
                                    MaterialTheme.colorScheme.onPrimary
                                else
                                    MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(24.dp)
                            )
                        }
                    }

                    // Status Text
                    Text(
                        text = step.label,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = if (index == currentStatusIndex) FontWeight.Bold else FontWeight.Normal,
                        color = if (index <= currentStatusIndex)
                            MaterialTheme.colorScheme.onSurface
                        else
                            MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                // Connecting line (except for last item)
                if (index < statusSteps.size - 1) {
                    Box(
                        modifier = Modifier
                            .width(2.dp)
                            .height(16.dp)
                            .offset(x = 19.dp)
                    ) {
                        Divider(
                            modifier = Modifier.fillMaxHeight(),
                            color = if (index < currentStatusIndex)
                                MaterialTheme.colorScheme.primary
                            else
                                MaterialTheme.colorScheme.surfaceVariant,
                            thickness = 2.dp
                        )
                    }
                }
            }
        }
    }
}

data class OrderStep(val label: String, val status: String)
