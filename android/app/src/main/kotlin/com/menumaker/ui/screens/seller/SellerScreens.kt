package com.menumaker.ui.screens.seller

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.horizontalScroll
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Money
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.IconButton
import androidx.compose.material.TopAppBar
import androidx.compose.material3.Button
import androidx.compose.material3.ElevatedButton
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.menumaker.data.remote.models.OrderDto
import com.menumaker.data.remote.models.ReviewDto
import com.menumaker.ui.navigation.Destination
import com.menumaker.viewmodel.SellerViewModel

@Composable
fun SellerDashboardScreen(
    navController: NavController,
    viewModel: SellerViewModel
) {
    val pendingOrders by viewModel.pendingOrders.collectAsState()
    val todayRevenue by viewModel.todayRevenue.collectAsState()
    SellerDashboardContent(
        navController = navController,
        pendingOrders = pendingOrders,
        todayRevenue = todayRevenue
    )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SellerDashboardContent(
    navController: NavController,
    pendingOrders: Int,
    todayRevenue: Double
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
                    Text("Pending orders: $pendingOrders", modifier = Modifier.testTag("pending-count"))
                    Text("Revenue: \$${todayRevenue}", modifier = Modifier.testTag("revenue-today"))
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
    val items = if (orders.isNotEmpty()) orders else sampleOrders()

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
            items(items) { order ->
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
            Text("Customer: Demo User")
            Text("Items: 3")
            Text("Status: Preparing")
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
    val list = if (dishes.isNotEmpty()) dishes else sampleDishes()

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
            items(list) { dish ->
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
                label = { Text("Dish ID (demo)") },
                enabled = false
            )
            OutlinedTextField(
                value = if (isNew) "" else "Dish name",
                onValueChange = {},
                label = { Text("Name") }
            )
            OutlinedTextField(
                value = "9.99",
                onValueChange = {},
                label = { Text("Price") }
            )
            Button(onClick = { navController.popBackStack() }) {
                Text(if (isNew) "Create Dish" else "Save Changes")
            }
        }
    }
}

@Composable
fun CouponsScreen(navController: NavController) {
    val coupons = remember {
        listOf(
            "NEW10" to "10% off for new users",
            "FREESHIP" to "Free delivery on orders over \$25"
        )
    }
    SimpleListScreen(
        title = "Coupons",
        items = coupons.map { "${it.first} - ${it.second}" },
        onBack = { navController.popBackStack() }
    )
}

@Composable
fun PaymentProcessorsScreen(navController: NavController) {
    SimpleListScreen(
        title = "Payment Processors",
        items = listOf("Stripe (connected)", "PayPal (connect)", "Square (beta)"),
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
            "Next payout: Jan 15 - \$4,000",
            "Pending: \$1,250",
            "Completed: \$38,500"
        ),
        onBack = { navController.popBackStack() }
    )
}

@Composable
fun IntegrationsScreen(navController: NavController) {
    SimpleListScreen(
        title = "Integrations",
        items = listOf(
            "POS: Toast (connected)",
            "Delivery: DoorDash (connected)",
            "Marketing: Mailchimp (connect)"
        ),
        onBack = { navController.popBackStack() }
    )
}

@Composable
fun SellerReviewsScreen(navController: NavController) {
    val reviews = remember { sampleReviews() }
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
            items(reviews) { review ->
                ElevatedCard(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("${review.customerName} • ${review.rating}★", fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(4.dp))
                        Text(review.comment ?: "Great service!")
                    }
                }
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

private fun sampleDishes() = listOf(
    com.menumaker.data.remote.models.DishDto(
        id = "dish-1",
        businessId = "business-1",
        name = "Margherita Pizza",
        description = "Classic with basil",
        priceCents = 1299,
        imageUrl = null,
        category = "Pizza",
        isVegetarian = true,
        isAvailable = true,
        createdAt = "2025-01-01",
        updatedAt = "2025-01-01"
    ),
    com.menumaker.data.remote.models.DishDto(
        id = "dish-2",
        businessId = "business-1",
        name = "Spicy Pasta",
        description = "Arrabbiata sauce",
        priceCents = 1199,
        imageUrl = null,
        category = "Pasta",
        isVegetarian = false,
        isAvailable = true,
        createdAt = "2025-01-01",
        updatedAt = "2025-01-01"
    )
)

private fun sampleOrders() = listOf(
    OrderDto(
        id = "order-1",
        businessId = "business-1",
        customerName = "Aisha Singh",
        customerPhone = "+1234567890",
        customerEmail = "aisha@example.com",
        totalCents = 2599,
        status = "pending",
        items = emptyList(),
        createdAt = "2025-01-01",
        updatedAt = "2025-01-01"
    ),
    OrderDto(
        id = "order-2",
        businessId = "business-1",
        customerName = "Carlos Diaz",
        customerPhone = "+1098765432",
        customerEmail = "carlos@example.com",
        totalCents = 1899,
        status = "preparing",
        items = emptyList(),
        createdAt = "2025-01-02",
        updatedAt = "2025-01-02"
    )
)

private fun sampleReviews(): List<ReviewDto> = listOf(
    ReviewDto(
        id = "rev-1",
        businessId = "business-1",
        customerName = "Jamie",
        rating = 5,
        comment = "Loved the pizzas and quick service.",
        imageUrls = emptyList(),
        createdAt = "2025-01-01T00:00:00Z"
    ),
    ReviewDto(
        id = "rev-2",
        businessId = "business-1",
        customerName = "Priya",
        rating = 4,
        comment = "Great vegetarian options.",
        imageUrls = emptyList(),
        createdAt = "2025-01-02T00:00:00Z"
    )
)
