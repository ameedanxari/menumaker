package com.menumaker.ui.screens.customer

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.rememberAsyncImagePainter
import com.menumaker.viewmodel.ReviewViewModel

/**
 * Reviews Screen
 *
 * Allows customers to submit reviews with rating, comment, and photos.
 * Matches iOS ReviewsView functionality.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReviewsScreen(
    businessId: String,
    orderId: String? = null,
    viewModel: ReviewViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit
) {
    var rating by remember { mutableStateOf(5) }
    var comment by remember { mutableStateOf("") }
    var customerName by remember { mutableStateOf("") }
    var selectedImageUris by remember { mutableStateOf<List<Uri>>(emptyList()) }

    val isLoading by viewModel.isLoading.collectAsState()
    val showSuccessMessage by viewModel.showSuccessMessage.collectAsState()
    val successMessage by viewModel.successMessage.collectAsState()

    val imagePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetMultipleContents()
    ) { uris ->
        // Limit to 3 images
        selectedImageUris = (selectedImageUris + uris).take(3)
    }

    // Handle success
    LaunchedEffect(showSuccessMessage) {
        if (showSuccessMessage) {
            onNavigateBack()
        }
    }

    // Success dialog
    if (showSuccessMessage) {
        AlertDialog(
            onDismissRequest = { onNavigateBack() },
            title = { Text("Thank You!") },
            text = { Text(successMessage ?: "Your review has been submitted successfully!") },
            confirmButton = {
                TextButton(onClick = { onNavigateBack() }) {
                    Text("OK")
                }
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Write a Review") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.Close, "Cancel")
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
            verticalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            // Rating Section
            RatingSection(
                rating = rating,
                onRatingChange = { rating = it }
            )

            // Comment Section
            CommentSection(
                customerName = customerName,
                onCustomerNameChange = { customerName = it },
                comment = comment,
                onCommentChange = { comment = it }
            )

            // Photo Upload Section
            PhotoSection(
                selectedImageUris = selectedImageUris,
                onAddPhotos = {
                    imagePickerLauncher.launch("image/*")
                },
                onRemovePhoto = { index ->
                    selectedImageUris = selectedImageUris.filterIndexed { i, _ -> i != index }
                }
            )

            Spacer(modifier = Modifier.weight(1f))

            // Submit Button
            Button(
                onClick = {
                    viewModel.createReview(
                        businessId = businessId,
                        orderId = orderId,
                        customerName = customerName,
                        rating = rating,
                        comment = comment.ifEmpty { null },
                        imageUris = selectedImageUris.ifEmpty { null }
                    )
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
                enabled = customerName.isNotEmpty() && rating in 1..5 && !isLoading
            ) {
                if (isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                } else {
                    Text("Submit Review")
                }
            }
        }
    }
}

@Composable
fun RatingSection(
    rating: Int,
    onRatingChange: (Int) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = "How was your experience?",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )

            // Star Rating
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                (1..5).forEach { index ->
                    IconButton(
                        onClick = { onRatingChange(index) },
                        modifier = Modifier.size(40.dp)
                    ) {
                        Icon(
                            imageVector = if (index <= rating) Icons.Default.Star else Icons.Default.StarBorder,
                            contentDescription = "Star $index",
                            modifier = Modifier.size(32.dp),
                            tint = if (index <= rating) Color(0xFFFFB300) else Color.Gray.copy(alpha = 0.3f)
                        )
                    }
                }
            }

            // Rating Description
            Text(
                text = when (rating) {
                    5 -> "Excellent!"
                    4 -> "Great"
                    3 -> "Good"
                    2 -> "Fair"
                    1 -> "Poor"
                    else -> ""
                },
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
fun CommentSection(
    customerName: String,
    onCustomerNameChange: (String) -> Unit,
    comment: String,
    onCommentChange: (String) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Your Review",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold
            )

            OutlinedTextField(
                value = customerName,
                onValueChange = onCustomerNameChange,
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Your name") },
                singleLine = true
            )

            OutlinedTextField(
                value = comment,
                onValueChange = { if (it.length <= 500) onCommentChange(it) },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(140.dp),
                label = { Text("Share more about your experience...") },
                maxLines = 6,
                supportingText = {
                    Text(
                        text = "${comment.length}/500 characters",
                        modifier = Modifier.fillMaxWidth(),
                        style = MaterialTheme.typography.labelSmall
                    )
                }
            )
        }
    }
}

@Composable
fun PhotoSection(
    selectedImageUris: List<Uri>,
    onAddPhotos: () -> Unit,
    onRemovePhoto: (Int) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Add Photos",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )

                Text(
                    text = "${selectedImageUris.size}/3",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            if (selectedImageUris.isEmpty()) {
                Button(
                    onClick = onAddPhotos,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(
                        imageVector = Icons.Default.Photo,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Add Photos")
                }
            } else {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    selectedImageUris.forEachIndexed { index, uri ->
                        Box(
                            modifier = Modifier.size(100.dp)
                        ) {
                            Image(
                                painter = rememberAsyncImagePainter(uri),
                                contentDescription = "Photo $index",
                                modifier = Modifier
                                    .fillMaxSize()
                                    .clip(MaterialTheme.shapes.medium),
                                contentScale = ContentScale.Crop
                            )

                            IconButton(
                                onClick = { onRemovePhoto(index) },
                                modifier = Modifier
                                    .align(Alignment.TopEnd)
                                    .padding(4.dp)
                                    .size(24.dp)
                            ) {
                                Surface(
                                    shape = CircleShape,
                                    color = Color.Black.copy(alpha = 0.6f)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Close,
                                        contentDescription = "Remove photo",
                                        tint = Color.White,
                                        modifier = Modifier
                                            .padding(4.dp)
                                            .size(16.dp)
                                    )
                                }
                            }
                        }
                    }

                    // Add more photos button (if less than 3)
                    if (selectedImageUris.size < 3) {
                        OutlinedButton(
                            onClick = onAddPhotos,
                            modifier = Modifier.size(100.dp)
                        ) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Add,
                                    contentDescription = null
                                )
                                Text(
                                    text = "Add",
                                    style = MaterialTheme.typography.labelSmall
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
