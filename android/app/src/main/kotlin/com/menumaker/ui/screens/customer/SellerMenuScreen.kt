package com.menumaker.ui.screens.customer

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.menumaker.data.common.Resource
import com.menumaker.data.local.entities.CartEntity
import com.menumaker.data.remote.models.DishDto
import com.menumaker.viewmodel.CartViewModel
import com.menumaker.viewmodel.DishViewModel

/**
 * Seller Menu Screen
 *
 * Displays a seller's menu with dishes that can be added to cart.
 * Matches iOS SellerMenuView functionality.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SellerMenuScreen(
    businessId: String,
    businessName: String = "Menu",
    dishViewModel: DishViewModel = hiltViewModel(),
    cartViewModel: CartViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit
) {
    val dishesState by dishViewModel.dishesState.collectAsState()
    var selectedCategory by remember { mutableStateOf<String?>(null) }

    // Load dishes when screen opens
    LaunchedEffect(businessId) {
        dishViewModel.loadDishes(businessId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(businessName) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
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
            when (val state = dishesState) {
                is Resource.Loading -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator()
                    }
                }

                is Resource.Success -> {
                    val dishes = state.data
                    val categories = dishes.mapNotNull { it.category }.distinct()

                    // Category Filter Chips
                    if (categories.isNotEmpty()) {
                        LazyRow(
                            modifier = Modifier.fillMaxWidth(),
                            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            // "All" chip
                            item {
                                FilterChip(
                                    selected = selectedCategory == null,
                                    onClick = { selectedCategory = null },
                                    label = { Text("All") }
                                )
                            }

                            // Category chips
                            items(categories) { category ->
                                FilterChip(
                                    selected = selectedCategory == category,
                                    onClick = { selectedCategory = category },
                                    label = { Text(category) }
                                )
                            }
                        }
                        Divider()
                    }

                    // Filtered dishes
                    val filteredDishes = if (selectedCategory == null) {
                        dishes
                    } else {
                        dishes.filter { it.category == selectedCategory }
                    }

                    // Menu Items List
                    if (filteredDishes.isEmpty()) {
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
                                    imageVector = Icons.Default.Restaurant,
                                    contentDescription = null,
                                    modifier = Modifier.size(64.dp),
                                    tint = MaterialTheme.colorScheme.outline
                                )
                                Text(
                                    text = "No Menu Items",
                                    style = MaterialTheme.typography.titleMedium
                                )
                                Text(
                                    text = "This seller hasn't added any menu items yet",
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
                            items(filteredDishes) { dish ->
                                MenuItemCard(
                                    dish = dish,
                                    onAddToCart = {
                                        // Add to cart
                                        val cartItem = CartEntity(
                                            dishId = dish.id,
                                            businessId = businessId,
                                            dishName = dish.name,
                                            priceCents = dish.priceCents,
                                            quantity = 1,
                                            imageUrl = dish.imageUrl
                                        )
                                        cartViewModel.addToCart(cartItem)
                                    }
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
                                text = "Error loading menu",
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
                    // Initial state - show nothing or loading
                }
            }
        }
    }
}

/**
 * Menu Item Card Component
 * Displays a dish with image, details, and add to cart button
 */
@Composable
fun MenuItemCard(
    dish: DishDto,
    onAddToCart: () -> Void
) {
    var showAddedFeedback by remember { mutableStateOf(false) }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Dish Info
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                // Name and vegetarian indicator
                Row(
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = dish.name,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (dish.isVegetarian) {
                        Text(
                            text = "🌱",
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }

                // Description
                dish.description?.let { desc ->
                    Text(
                        text = desc,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                // Price
                Text(
                    text = "₹${dish.priceCents / 100.0}",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )

                // Availability status
                if (!dish.isAvailable) {
                    Text(
                        text = "Currently Unavailable",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }

            // Image and Add Button Column
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Dish Image
                dish.imageUrl?.let { url ->
                    AsyncImage(
                        model = url,
                        contentDescription = dish.name,
                        modifier = Modifier
                            .size(80.dp)
                            .clip(MaterialTheme.shapes.small),
                        contentScale = ContentScale.Crop
                    )
                } ?: run {
                    // Placeholder if no image
                    Box(
                        modifier = Modifier
                            .size(80.dp)
                            .clip(MaterialTheme.shapes.small),
                        contentAlignment = Alignment.Center
                    ) {
                        Surface(
                            color = MaterialTheme.colorScheme.surfaceVariant,
                            modifier = Modifier.fillMaxSize()
                        ) {
                            Icon(
                                imageVector = Icons.Default.Restaurant,
                                contentDescription = null,
                                modifier = Modifier
                                    .size(40.dp)
                                    .padding(20.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }

                // Add to Cart Button
                FilledIconButton(
                    onClick = {
                        if (dish.isAvailable) {
                            onAddToCart()
                            showAddedFeedback = true
                        }
                    },
                    modifier = Modifier.size(36.dp),
                    enabled = dish.isAvailable,
                    shape = CircleShape
                ) {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = "Add to cart",
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        }
    }

    // Show brief "Added" feedback
    LaunchedEffect(showAddedFeedback) {
        if (showAddedFeedback) {
            kotlinx.coroutines.delay(1000)
            showAddedFeedback = false
        }
    }
}
