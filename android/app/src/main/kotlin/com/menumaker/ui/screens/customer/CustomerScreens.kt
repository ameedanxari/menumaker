package com.menumaker.ui.screens.customer

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.IconButton
import androidx.compose.material.TopAppBar
import androidx.compose.material3.Button
import androidx.compose.material3.Divider
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.DishDto
import com.menumaker.data.remote.models.MarketplaceSellerDto
import com.menumaker.ui.navigation.Destination
import com.menumaker.viewmodel.CartViewModel
import com.menumaker.viewmodel.CustomerPaymentViewModel
import com.menumaker.viewmodel.DishViewModel
import com.menumaker.viewmodel.MarketplaceViewModel
import com.menumaker.viewmodel.OrderViewModel

@Composable
fun MarketplaceScreen(
    navController: NavController,
    viewModel: MarketplaceViewModel
) {
    val sellersState by viewModel.sellersState.collectAsState()
    LaunchedEffect(Unit) {
        viewModel.searchSellers()
    }

    val sampleSellers = remember {
        listOf(
            MarketplaceSellerDto(
                id = "seller-1",
                name = "Pizzeria Roma",
                slug = "pizzeria-roma",
                description = "Wood-fired pizzas",
                logoUrl = null,
                cuisineType = "Italian",
                rating = 4.7,
                reviewCount = 120,
                latitude = null,
                longitude = null,
                distanceKm = 1.2
            ),
            MarketplaceSellerDto(
                id = "seller-2",
                name = "Green Bowl",
                slug = "green-bowl",
                description = "Healthy bowls and salads",
                logoUrl = null,
                cuisineType = "Healthy",
                rating = 4.5,
                reviewCount = 80,
                latitude = null,
                longitude = null,
                distanceKm = 2.5
            )
        )
    }

    val sellers = when (val state = sellersState) {
        is Resource.Success -> state.data ?: sampleSellers
        else -> sampleSellers
    }

    MarketplaceContent(navController = navController, sellers = sellers)
}

@Composable
fun MarketplaceContent(
    navController: NavController,
    sellers: List<MarketplaceSellerDto>
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Marketplace") }
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
            items(sellers) { seller ->
                ElevatedCard(
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("seller-${seller.id}"),
                    onClick = { navController.navigate(Destination.SellerMenu.createRoute(seller.id)) }
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(seller.name, fontWeight = FontWeight.Bold)
                        Text(seller.cuisineType ?: "Cuisine")
                        Text("Rating: ${seller.rating} (${seller.reviewCount})")
                        Text("Distance: ${seller.distanceKm ?: 0.0} km")
                    }
                }
            }
        }
    }
}

@Composable
fun SellerMenuScreen(
    navController: NavController,
    sellerId: String,
    viewModel: DishViewModel
) {
    LaunchedEffect(Unit) {
        viewModel.loadDishes(sellerId)
    }

    val dishesState by viewModel.dishesState.collectAsState()
    val dishes = when (val state = dishesState) {
        is Resource.Success -> state.data ?: emptyList()
        else -> emptyList()
    }

    SellerMenuContent(
        navController = navController,
        sellerId = sellerId,
        dishes = if (dishes.isNotEmpty()) dishes else sampleDishMenu()
    )
}

@Composable
fun SellerMenuContent(
    navController: NavController,
    sellerId: String,
    dishes: List<DishDto>
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Menu • $sellerId") },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { navController.navigate(Destination.Cart.route) }) {
                        Icon(Icons.Default.ShoppingCart, contentDescription = "Cart")
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
            items(dishes) { dish ->
                ElevatedCard(
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("menu-${dish.id}"),
                    onClick = { navController.navigate(Destination.Cart.route) }
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(dish.name, fontWeight = FontWeight.Bold)
                            Text(dish.description ?: "Tap to add to cart")
                        }
                        Text("\$${dish.priceCents / 100.0}")
                    }
                }
            }
        }
    }
}

@Composable
fun CartScreen(
    navController: NavController,
    viewModel: CartViewModel
) {
    val cartItems by viewModel.cartItems.collectAsState()
    val total by viewModel.cartTotal.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.loadCart("business-1")
    }

    CartContent(navController = navController, cartItems = cartItems, totalCents = total)
}

@Composable
fun CartContent(
    navController: NavController,
    cartItems: List<com.menumaker.data.local.entities.CartEntity>,
    totalCents: Int
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Cart") },
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
            if (cartItems.isEmpty()) {
                Text("Your cart is empty. Add items from the menu.")
            } else {
                cartItems.forEach { item ->
                    ElevatedCard(
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                Text(item.dishName, fontWeight = FontWeight.Bold)
                                Text("Qty: ${item.quantity}")
                            }
                            Text("\$${item.priceCents / 100.0}")
                        }
                    }
                }
            }

            Divider()

            Text("Total: \$${totalCents / 100.0}", fontWeight = FontWeight.Bold)
            Button(
                modifier = Modifier.fillMaxWidth(),
                onClick = { navController.navigate(Destination.Checkout.route) }
            ) {
                Text("Proceed to Checkout")
            }
        }
    }
}

@Composable
fun CheckoutScreen(navController: NavController) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Checkout") },
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
            Text("Review your order and select payment method.")
            Button(
                onClick = { navController.navigate(Destination.Payment.createRoute(0.0)) },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Continue to Payment")
            }
        }
    }
}

@Composable
fun PaymentScreen(
    navController: NavController,
    total: Double,
    viewModel: CustomerPaymentViewModel
) {
    val methods = remember { listOf("Card", "UPI", "Cash on Delivery") }
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Payment") },
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
            Text("Total due: \$${"%.2f".format(total)}", style = MaterialTheme.typography.titleMedium)
            methods.forEach { method ->
                ElevatedCard(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = { /* wire to viewModel in future */ }
                ) {
                    Text(method, modifier = Modifier.padding(16.dp))
                }
            }
            Button(
                onClick = { navController.popBackStack(Destination.Marketplace.route, false) },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Confirm Payment")
            }
        }
    }
}

@Composable
fun FavoritesScreen(navController: NavController) {
    val favorites = remember {
        listOf("Roma Pizza", "Green Bowl", "Sushi House")
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Favorites") },
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
            items(favorites) { name ->
                ElevatedCard(
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("favorite-$name"),
                    onClick = { navController.navigate(Destination.SellerMenu.createRoute(name)) }
                ) {
                    Text(name, modifier = Modifier.padding(16.dp))
                }
            }
        }
    }
}

@Composable
fun MyOrdersScreen(
    navController: NavController,
    viewModel: OrderViewModel
) {
    val orders = remember {
        listOf(
            "order-1" to "Preparing",
            "order-2" to "Out for delivery",
            "order-3" to "Delivered"
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("My Orders") },
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
            items(orders) { (id, status) ->
                ElevatedCard(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = { navController.navigate(Destination.OrderTracking.createRoute(id)) }
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Order #$id", fontWeight = FontWeight.Bold)
                        Text(status)
                    }
                }
            }
        }
    }
}

@Composable
fun OrderTrackingScreen(
    navController: NavController,
    orderId: String
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Order Tracking") },
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
            Text("Tracking order: $orderId", style = MaterialTheme.typography.titleMedium)
            Text("Status: Out for delivery")
            Text("ETA: 15 minutes")
            Button(onClick = { navController.navigate(Destination.CustomerReviews.createRoute("business-1")) }) {
                Text("Leave a review")
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CustomerReviewsScreen(
    navController: NavController,
    businessId: String,
    orderId: String?
) {
    var rating by remember { mutableStateOf("5") }
    var comment by remember { mutableStateOf("") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Write a Review") },
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
            Text("Business: $businessId")
            orderId?.let { Text("Order: $it") }
            OutlinedTextField(
                value = rating,
                onValueChange = { rating = it },
                label = { Text("Rating (1-5)") }
            )
            OutlinedTextField(
                value = comment,
                onValueChange = { comment = it },
                label = { Text("Comment") }
            )
            Button(
                onClick = { navController.popBackStack() },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Submit Review")
            }
            TextButton(onClick = { navController.navigate(Destination.MyOrders.route) }) {
                Text("View My Orders")
            }
        }
    }
}

private fun sampleDishMenu() = listOf(
    DishDto(
        id = "dish-1",
        businessId = "business-1",
        name = "Margherita",
        description = "Wood-fired classic",
        priceCents = 1299,
        imageUrl = null,
        category = "Pizza",
        isVegetarian = true,
        isAvailable = true,
        createdAt = "2025-01-01",
        updatedAt = "2025-01-01"
    ),
    DishDto(
        id = "dish-2",
        businessId = "business-1",
        name = "Spicy Arrabbiata",
        description = "Penne with heat",
        priceCents = 1149,
        imageUrl = null,
        category = "Pasta",
        isVegetarian = false,
        isAvailable = true,
        createdAt = "2025-01-01",
        updatedAt = "2025-01-01"
    )
)
