package com.menumaker.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.NotificationDto
import com.menumaker.data.remote.models.NotificationType
import com.menumaker.viewmodel.NotificationViewModel
import java.text.SimpleDateFormat
import java.util.*
import kotlin.time.Duration.Companion.milliseconds

/**
 * Notifications Screen
 *
 * Displays user notifications with mark as read functionality and settings.
 * Matches iOS NotificationsView functionality.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationsScreen(
    viewModel: NotificationViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit
) {
    val notificationsState by viewModel.notificationsState.collectAsState()
    val notifications by viewModel.notifications.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()

    var showSettings by remember { mutableStateOf(false) }

    // Load notifications when screen opens
    LaunchedEffect(Unit) {
        viewModel.loadNotifications()
    }

    // Settings sheet
    if (showSettings) {
        NotificationSettingsSheet(
            viewModel = viewModel,
            onDismiss = { showSettings = false }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Notifications") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.markAllAsRead() }) {
                        Icon(Icons.Default.CheckCircle, "Mark all as read")
                    }
                    IconButton(onClick = { showSettings = true }) {
                        Icon(Icons.Default.Settings, "Settings")
                    }
                }
            )
        }
    ) { padding ->
        when (val state = notificationsState) {
            is Resource.Loading -> {
                if (notifications.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(padding),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator()
                    }
                }
            }

            is Resource.Success<*> -> {
                @Suppress("UNCHECKED_CAST")
                val data = (state as Resource.Success<com.menumaker.data.remote.models.NotificationListData>).data
                val notificationList = data.notifications

                if (notificationList.isEmpty()) {
                    // Empty state
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
                            Icon(
                                imageVector = Icons.Default.NotificationsOff,
                                contentDescription = null,
                                modifier = Modifier.size(64.dp),
                                tint = MaterialTheme.colorScheme.outline
                            )
                            Text(
                                text = "No Notifications",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "You're all caught up!",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(padding)
                    ) {
                        items<NotificationDto>(
                            items = notificationList,
                            key = { notification -> notification.id }
                        ) { notification ->
                            NotificationRow(
                                notification = notification,
                                onTap = { viewModel.markAsRead(notification.id) }
                            )
                            HorizontalDivider()
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
                            text = "Error loading notifications",
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
fun NotificationRow(
    notification: NotificationDto,
    onTap: () -> Unit
) {
    Surface(
        onClick = onTap,
        modifier = Modifier.fillMaxWidth(),
        color = if (notification.isRead) Color.Transparent else MaterialTheme.colorScheme.primary.copy(alpha = 0.05f)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Icon
            NotificationIcon(type = notification.type)

            // Content
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    text = notification.title,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = if (notification.isRead) FontWeight.Normal else FontWeight.SemiBold
                )

                Text(
                    text = notification.message,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2
                )

                Text(
                    text = formatRelativeTime(notification.createdAt),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Unread indicator
            if (!notification.isRead) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .background(
                            color = MaterialTheme.colorScheme.primary,
                            shape = CircleShape
                        )
                )
            }
        }
    }
}

@Composable
fun NotificationIcon(type: NotificationType) {
    val (icon, iconColor, backgroundColor) = when (type) {
        NotificationType.ORDER_PLACED,
        NotificationType.ORDER_CONFIRMED,
        NotificationType.ORDER_READY,
        NotificationType.ORDER_DELIVERED,
        NotificationType.ORDER_CANCELLED,
        NotificationType.ORDER_UPDATE -> Triple(
            Icons.Default.ShoppingBag,
            Color.White,
            Color(0xFF2196F3)
        )
        NotificationType.PROMOTION -> Triple(
            Icons.Default.LocalOffer,
            Color.White,
            Color(0xFF4CAF50)
        )
        NotificationType.REVIEW,
        NotificationType.REVIEW_RECEIVED -> Triple(
            Icons.Default.Star,
            Color.White,
            Color(0xFFFFB300)
        )
        NotificationType.PAYMENT_RECEIVED,
        NotificationType.PAYOUT_COMPLETED -> Triple(
            Icons.Default.Payment,
            Color.White,
            Color(0xFF9C27B0)
        )
        NotificationType.SYSTEM -> Triple(
            Icons.Default.Notifications,
            Color.White,
            Color.Gray
        )
    }

    Surface(
        modifier = Modifier.size(40.dp),
        shape = CircleShape,
        color = backgroundColor
    ) {
        Box(contentAlignment = Alignment.Center) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = iconColor,
                modifier = Modifier.size(20.dp)
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationSettingsSheet(
    viewModel: NotificationViewModel,
    onDismiss: () -> Unit
) {
    val orderNotificationsEnabled by viewModel.orderNotificationsEnabled.collectAsState()
    val promotionNotificationsEnabled by viewModel.promotionNotificationsEnabled.collectAsState()
    val reviewNotificationsEnabled by viewModel.reviewNotificationsEnabled.collectAsState()
    val pushNotificationsEnabled by viewModel.pushNotificationsEnabled.collectAsState()
    val emailNotificationsEnabled by viewModel.emailNotificationsEnabled.collectAsState()

    ModalBottomSheet(
        onDismissRequest = onDismiss
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = "Notification Settings",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 8.dp)
            )

            // Notification Types Section
            Text(
                text = "Notification Types",
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 8.dp)
            )

            SettingsToggle(
                label = "Order Updates",
                checked = orderNotificationsEnabled,
                onCheckedChange = { viewModel.setOrderNotificationsEnabled(it) }
            )

            SettingsToggle(
                label = "Promotions",
                checked = promotionNotificationsEnabled,
                onCheckedChange = { viewModel.setPromotionNotificationsEnabled(it) }
            )

            SettingsToggle(
                label = "Reviews",
                checked = reviewNotificationsEnabled,
                onCheckedChange = { viewModel.setReviewNotificationsEnabled(it) }
            )

            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

            // Delivery Section
            Text(
                text = "Delivery",
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            SettingsToggle(
                label = "Push Notifications",
                checked = pushNotificationsEnabled,
                onCheckedChange = { viewModel.setPushNotificationsEnabled(it) }
            )

            SettingsToggle(
                label = "Email Notifications",
                checked = emailNotificationsEnabled,
                onCheckedChange = { viewModel.setEmailNotificationsEnabled(it) }
            )

            Spacer(modifier = Modifier.height(16.dp))

            Button(
                onClick = onDismiss,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Done")
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

@Composable
fun SettingsToggle(
    label: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium
        )
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange
        )
    }
}

/**
 * Helper function to format relative time
 */
private fun formatRelativeTime(dateString: String): String {
    return try {
        val format = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
        val date = format.parse(dateString)
        date?.let {
            val now = System.currentTimeMillis()
            val diff = now - it.time

            when {
                diff < 60_000 -> "Just now"
                diff < 3600_000 -> "${diff / 60_000}m ago"
                diff < 86400_000 -> "${diff / 3600_000}h ago"
                diff < 604800_000 -> "${diff / 86400_000}d ago"
                else -> SimpleDateFormat("MMM dd", Locale.getDefault()).format(it)
            }
        } ?: dateString
    } catch (e: Exception) {
        dateString
    }
}
