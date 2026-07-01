@file:OptIn(
    androidx.compose.foundation.layout.ExperimentalLayoutApi::class,
    androidx.compose.material3.ExperimentalMaterial3Api::class
)

package com.menumaker.ui.screens.seller

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Money
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ElevatedButton
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.menumaker.data.remote.models.OrderDto
import com.menumaker.ui.navigation.Destination
import com.menumaker.viewmodel.SellerDashboardStatus
import com.menumaker.viewmodel.SellerDashboardUiState
import com.menumaker.viewmodel.SellerViewModel

@Composable
fun SellerDashboardScreen(
    navController: NavController,
    viewModel: SellerViewModel
) {
    val pendingOrders by viewModel.pendingOrders.collectAsState()
    val todayRevenue by viewModel.todayRevenue.collectAsState()
    val dashboardState by viewModel.dashboardState.collectAsState()
    SellerDashboardContent(
        navController = navController,
        pendingOrders = pendingOrders,
        todayRevenue = todayRevenue,
        dashboardState = dashboardState,
        onRetry = { viewModel.retryDashboardSection() }
    )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SellerDashboardContent(
    navController: NavController,
    pendingOrders: Int,
    todayRevenue: Double,
    dashboardState: SellerDashboardUiState = SellerDashboardUiState(
        pendingOrders = pendingOrders,
        todayRevenue = todayRevenue
    ),
    onRetry: () -> Unit = {}
) {
    val quickActions = remember {
        listOf(
            "Orders" to Destination.SellerOrders.route,
            "Menu" to Destination.MenuEditor.route,
            "Coupons" to Destination.Coupons.route,
            "Payments" to Destination.PaymentProcessors.route,
            "Reviews" to Destination.Reviews.route
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Seller Dashboard") },
                actions = {
                    IconButton(onClick = { navController.navigate(Destination.Settings.route) }) {
                        Icon(Icons.Default.Settings, contentDescription = "Settings")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            DashboardStateBanner(
                state = dashboardState,
                onRetry = onRetry
            )

            Text(
                text = "Quick Actions",
                style = MaterialTheme.typography.titleMedium
            )

            Row(
                modifier = Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                quickActions.forEach { (label, route) ->
                    ElevatedButton(
                        onClick = { navController.navigate(route) },
                        modifier = Modifier.testTag("quick-$label")
                    ) {
                        Text(label)
                    }
                }
            }

            ElevatedCard(
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Today", style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(8.dp))
                    Text("Pending orders: ${dashboardState.pendingOrders}", modifier = Modifier.testTag("pending-count"))
                    Text("Revenue: \$${dashboardState.todayRevenue}", modifier = Modifier.testTag("revenue-today"))
                    Text("Available dishes: ${dashboardState.availableDishes}", modifier = Modifier.testTag("available-dishes"))
                    Text("Average rating: ${"%.1f".format(dashboardState.averageRating)}", modifier = Modifier.testTag("average-rating"))
                }
            }
        }
    }
}

@Composable
fun SellerOrdersScreen(
    navController: NavController,
    viewModel: SellerViewModel
) {
    val orders by viewModel.todayOrders.collectAsState()
    val dashboardState by viewModel.dashboardState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Orders") },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                DashboardStateBanner(
                    state = dashboardState,
                    emptyMessage = "No orders yet. New orders will appear here as soon as customers place them.",
                    onRetry = { viewModel.retryDashboardSection("orders") }
                )
            }
            items(orders) { order ->
                ElevatedCard(
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("order-${order.id}"),
                    onClick = { navController.navigate(Destination.OrderDetail.createRoute(order.id)) }
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Order #${order.id}", fontWeight = FontWeight.Bold)
                        Text(order.customerName)
                        Text("Status: ${order.status}")
                        Text("Total: \$${order.totalCents / 100.0}")
                    }
                }
            }
        }
    }
}

@Composable
fun OrderDetailScreen(
    orderId: String,
    navController: NavController
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Order Detail") },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("Order ID: $orderId", style = MaterialTheme.typography.titleMedium)
            Text("Customer details load from the orders API when available.")
            Text("Item counts and status are not fabricated in this launch build.")
            Button(
                onClick = { navController.navigate(Destination.OrderTracking.createRoute(orderId)) }
            ) {
                Text("Track Order")
            }
        }
    }
}

@Composable
fun MenuEditorScreen(
    navController: NavController,
    viewModel: SellerViewModel
) {
    val dishes by viewModel.dishes.collectAsState()
    val dashboardState by viewModel.dashboardState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Menu Editor") },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { navController.navigate(Destination.NewDish.route) }) {
                        Icon(Icons.Default.Add, contentDescription = "Add Dish")
                    }
                }
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                DashboardStateBanner(
                    state = dashboardState,
                    emptyMessage = "Your menu is empty. Add a dish to publish your first live menu item.",
                    onRetry = { viewModel.retryDashboardSection("dishes") }
                )
            }
            items(dishes) { dish ->
                ElevatedCard(
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("dish-${dish.id}"),
                    onClick = { navController.navigate(Destination.DishEditor.createRoute(dish.id)) }
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(dish.name, fontWeight = FontWeight.Bold)
                        Text("Price: \$${dish.priceCents / 100.0}")
                        Text(if (dish.isAvailable) "Available" else "Unavailable")
                    }
                }
            }
        }
    }
}

@Composable
fun DishEditorScreen(
    dishId: String?,
    navController: NavController
) {
    val isNew = dishId.isNullOrBlank()
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (isNew) "New Dish" else "Edit Dish") },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            OutlinedTextField(
                value = dishId ?: "",
                onValueChange = {},
                label = { Text("Dish ID") },
                enabled = false
            )
            OutlinedTextField(
                value = "",
                onValueChange = {},
                label = { Text("Name") },
                placeholder = { Text("Enter a dish name") }
            )
            OutlinedTextField(
                value = "",
                onValueChange = {},
                label = { Text("Price") },
                placeholder = { Text("Enter a price") }
            )
            Button(onClick = { navController.popBackStack() }) {
                Text(if (isNew) "Create Dish" else "Save Changes")
            }
        }
    }
}

@Composable
fun CouponsScreen(navController: NavController) {
    SimpleListScreen(
        title = "Coupons",
        items = listOf(
            "No live coupons loaded",
            "Create and validate coupons from the web/admin tools before advertising offers"
        ),
        onBack = { navController.popBackStack() }
    )
}

@Composable
fun PaymentProcessorsScreen(navController: NavController) {
    SimpleListScreen(
        title = "Payment Processors",
        items = listOf(
            "No payment processor is shown as connected in this launch build",
            "Provider status must come from verified backend configuration before payment methods are advertised"
        ),
        onBack = { navController.popBackStack() },
        trailingContent = {
            Icon(
                imageVector = Icons.Default.Money,
                contentDescription = "Payments"
            )
        }
    )
}

@Composable
fun PayoutsScreen(navController: NavController) {
    SimpleListScreen(
        title = "Payouts",
        items = listOf(
            "No live payout schedule loaded",
            "Pending and completed payout amounts are hidden until backed by settlement data"
        ),
        onBack = { navController.popBackStack() }
    )
}

@Composable
fun IntegrationsScreen(navController: NavController) {
    SimpleListScreen(
        title = "Integrations",
        items = listOf(
            "POS providers: launch gated",
            "Delivery providers: launch gated",
            "Provider connections are disabled until certification evidence is recorded"
        ),
        onBack = { navController.popBackStack() }
    )
}

@Composable
fun SellerReviewsScreen(
    navController: NavController,
    viewModel: SellerViewModel = hiltViewModel()
) {
    val reviews by viewModel.recentReviews.collectAsState()
    val dashboardState by viewModel.dashboardState.collectAsState()
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Seller Reviews") },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                DashboardStateBanner(
                    state = dashboardState,
                    emptyMessage = "No reviews yet. Customer feedback will appear here after completed orders.",
                    onRetry = { viewModel.retryDashboardSection("reviews") }
                )
            }
            items(reviews) { review ->
                ElevatedCard(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("${review.customerName} • ${review.rating}★", fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(4.dp))
                        Text(review.comment ?: "No written comment provided.")
                    }
                }
            }
        }
    }
}

@Composable
private fun DashboardStateBanner(
    state: SellerDashboardUiState,
    emptyMessage: String = "No live seller data yet. Add menu items or wait for customer activity to populate this screen.",
    onRetry: () -> Unit
) {
    when (state.status) {
        SellerDashboardStatus.Loading -> {
            ElevatedCard(
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("seller-loading")
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    CircularProgressIndicator()
                    Text("Loading live seller data…")
                }
            }
        }
        SellerDashboardStatus.Empty -> {
            StateMessageCard(
                tag = "seller-empty",
                title = "Nothing to show yet",
                message = emptyMessage,
                onRetry = onRetry
            )
        }
        SellerDashboardStatus.StaleOffline -> {
            StateMessageCard(
                tag = "seller-stale-offline",
                title = "Showing cached data",
                message = "Some live sources failed. Cached sections remain visible and are marked stale until retry succeeds.",
                onRetry = onRetry
            )
        }
        SellerDashboardStatus.PartialError -> {
            val failedSources = state.sectionErrors.joinToString { it.source }
            StateMessageCard(
                tag = "seller-partial-error",
                title = "Some sections need attention",
                message = "Failed sources: ${failedSources.ifBlank { "unknown" }}.",
                onRetry = onRetry
            )
        }
        SellerDashboardStatus.FatalError -> {
            StateMessageCard(
                tag = "seller-fatal-error",
                title = "Seller data could not load",
                message = state.sectionErrors.firstOrNull()?.message ?: "Please check your connection and retry.",
                onRetry = onRetry
            )
        }
        SellerDashboardStatus.Content,
        SellerDashboardStatus.Idle -> Unit
    }
}

@Composable
private fun StateMessageCard(
    tag: String,
    title: String,
    message: String,
    onRetry: () -> Unit
) {
    ElevatedCard(
        modifier = Modifier
            .fillMaxWidth()
            .testTag(tag)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(title, fontWeight = FontWeight.Bold)
            Text(message)
            Button(onClick = onRetry, modifier = Modifier.testTag("$tag-retry")) {
                Text("Retry")
            }
        }
    }
}

@Composable
private fun SimpleListScreen(
    title: String,
    items: List<String>,
    onBack: () -> Unit,
    trailingContent: @Composable (() -> Unit)? = null
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(title) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    trailingContent?.invoke()
                }
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(items) { item ->
                ElevatedCard(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = item,
                        modifier = Modifier.padding(16.dp)
                    )
                }
            }
        }
    }
}
