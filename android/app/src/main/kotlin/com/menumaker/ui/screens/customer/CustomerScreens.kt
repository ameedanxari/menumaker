@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package com.menumaker.ui.screens.customer

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Divider
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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

    MarketplaceContent(navController = navController, sellersState = sellersState ?: Resource.Loading)
}

@Composable
fun MarketplaceContent(
    navController: NavController,
    sellersState: Resource<List<MarketplaceSellerDto>>
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Marketplace") }
            )
        }
    ) { padding ->
        when (sellersState) {
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
            is Resource.Error -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .padding(16.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(sellersState.message)
                }
            }
            is Resource.Success -> {
                val sellers = sellersState.data
                if (sellers.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(padding)
                            .padding(16.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("No sellers are available yet. Please check back later.")
                    }
                } else {
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
        dishes = dishes
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
        if (dishes.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(16.dp),
                contentAlignment = Alignment.Center
            ) {
                Text("This seller has no available menu items yet.")
            }
        } else {
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
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            contentAlignment = Alignment.Center
        ) {
            Text("No favorite sellers yet. Favorite a seller from the marketplace to see it here.")
        }
    }
}

@Composable
fun MyOrdersScreen(
    navController: NavController,
    viewModel: OrderViewModel
) {
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
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            contentAlignment = Alignment.Center
        ) {
            Text("You do not have any orders yet.")
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
