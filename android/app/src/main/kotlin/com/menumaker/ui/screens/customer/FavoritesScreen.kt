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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.FavoriteDto
import com.menumaker.viewmodel.FavoriteViewModel
import java.text.SimpleDateFormat
import java.util.*

/**
 * Favorites Screen
 *
 * Displays user's favorite sellers with search functionality.
 * Matches iOS FavoritesView functionality.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FavoritesScreen(
    viewModel: FavoriteViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit,
    onNavigateToSellerMenu: (String) -> Unit,
    onNavigateToMarketplace: () -> Unit = {}
) {
    val favoritesState by viewModel.favoritesState.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()

    var favoriteToDelete by remember { mutableStateOf<FavoriteDto?>(null) }
    var showDeleteDialog by remember { mutableStateOf(false) }

    // Load favorites when screen opens
    LaunchedEffect(Unit) {
        viewModel.loadFavorites()
    }

    // Delete confirmation dialog
    if (showDeleteDialog && favoriteToDelete != null) {
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            title = { Text("Remove Favorite") },
            text = {
                Text("Remove ${favoriteToDelete?.business?.name ?: "this seller"} from favorites?")
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        favoriteToDelete?.let {
                            viewModel.removeFavorite(it.id)
                        }
                        showDeleteDialog = false
                        favoriteToDelete = null
                    }
                ) {
                    Text("Remove", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    // Error alert
    errorMessage?.let { message ->
        AlertDialog(
            onDismissRequest = { viewModel.clearError() },
            title = { Text("Error") },
            text = { Text(message) },
            confirmButton = {
                TextButton(onClick = { viewModel.clearError() }) {
                    Text("OK")
                }
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Favorites") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
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
            when (val state = favoritesState) {
                is Resource.Loading -> {
                    if (viewModel.favorites.value.isEmpty()) {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            CircularProgressIndicator()
                        }
                    }
                }

                is Resource.Success -> {
                    val favorites = state.data.favorites

                    // Search Bar (only show if there are favorites)
                    if (favorites.isNotEmpty()) {
                        OutlinedTextField(
                            value = searchQuery,
                            onValueChange = { viewModel.updateSearchQuery(it) },
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            placeholder = { Text("Search favorites...") },
                            leadingIcon = { Icon(Icons.Default.Search, null) },
                            trailingIcon = {
                                if (searchQuery.isNotEmpty()) {
                                    IconButton(onClick = { viewModel.updateSearchQuery("") }) {
                                        Icon(Icons.Default.Clear, "Clear")
                                    }
                                }
                            },
                            singleLine = true
                        )
                    }

                    // Filtered favorites list
                    val filteredFavorites = viewModel.filteredFavorites.collectAsState().value

                    if (filteredFavorites.isEmpty()) {
                        // Empty state
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(16.dp),
                                modifier = Modifier.padding(32.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Favorite,
                                    contentDescription = null,
                                    modifier = Modifier.size(64.dp),
                                    tint = MaterialTheme.colorScheme.outline
                                )
                                Text(
                                    text = "No Favorites",
                                    style = MaterialTheme.typography.titleLarge,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = if (searchQuery.isEmpty())
                                        "Save your favorite sellers to quickly access them later"
                                    else
                                        "No favorites match your search",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )

                                if (searchQuery.isEmpty()) {
                                    Button(
                                        onClick = onNavigateToMarketplace,
                                        modifier = Modifier.padding(top = 16.dp)
                                    ) {
                                        Text("Explore Sellers")
                                    }
                                }
                            }
                        }
                    } else {
                        LazyColumn(
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            items(
                                items = filteredFavorites,
                                key = { it.id }
                            ) { favorite ->
                                FavoriteCard(
                                    favorite = favorite,
                                    onCardClick = {
                                        favorite.business?.let {
                                            onNavigateToSellerMenu(it.id)
                                        }
                                    },
                                    onRemove = {
                                        favoriteToDelete = favorite
                                        showDeleteDialog = true
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
                                text = "Error loading favorites",
                                style = MaterialTheme.typography.titleMedium,
                                color = MaterialTheme.colorScheme.error
                            )
                            Text(
                                text = state.message,
                                style = MaterialTheme.typography.bodyMedium
                            )
                            Button(onClick = { viewModel.loadFavorites() }) {
                                Text("Retry")
                            }
                        }
                    }
                }

                null -> {}
            }
        }
    }
}

/**
 * Favorite Card Component
 * Displays a favorite seller with swipe-to-delete functionality
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FavoriteCard(
    favorite: FavoriteDto,
    onCardClick: () -> Unit,
    onRemove: () -> Unit
) {
    val business = favorite.business

    Card(
        onClick = onCardClick,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Business Logo
            if (business?.logoUrl != null) {
                AsyncImage(
                    model = business.logoUrl,
                    contentDescription = "${business.name} logo",
                    modifier = Modifier
                        .size(60.dp),
                    contentScale = ContentScale.Crop
                )
            } else {
                Surface(
                    modifier = Modifier.size(60.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    shape = MaterialTheme.shapes.small
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = Icons.Default.Storefront,
                            contentDescription = null,
                            modifier = Modifier.size(32.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            // Business Info
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    text = business?.name ?: "Unknown",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )

                business?.description?.let { desc ->
                    Text(
                        text = desc,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2
                    )
                }

                Text(
                    text = "Added ${formatDate(favorite.createdAt)}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Delete button
            IconButton(onClick = onRemove) {
                Icon(
                    imageVector = Icons.Default.Delete,
                    contentDescription = "Remove favorite",
                    tint = MaterialTheme.colorScheme.error
                )
            }

            // Chevron
            Icon(
                imageVector = Icons.Default.ChevronRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

/**
 * Helper function to format date
 */
private fun formatDate(dateString: String): String {
    return try {
        val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
        val outputFormat = SimpleDateFormat("MMM dd, yyyy", Locale.getDefault())
        val date = inputFormat.parse(dateString)
        date?.let { outputFormat.format(it) } ?: dateString
    } catch (e: Exception) {
        dateString
    }
}
