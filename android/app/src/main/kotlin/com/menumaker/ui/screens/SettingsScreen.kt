package com.menumaker.ui.screens

import android.content.pm.PackageManager
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.menumaker.BuildConfig
import com.menumaker.data.remote.api.ApiConfig
import com.menumaker.viewmodel.AuthViewModel

/**
 * Settings Screen
 *
 * Comprehensive settings screen combining functionality from iOS MoreView and SettingsView.
 * Includes notifications, appearance, security, privacy, help, legal, and data management.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    authViewModel: AuthViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit,
    onNavigateToNotifications: () -> Unit = {},
    onNavigateToChangePassword: () -> Unit = {}
) {
    val context = LocalContext.current

    // Settings state - using simple remember for demonstration
    var darkModeEnabled by remember { mutableStateOf(false) }
    var soundEnabled by remember { mutableStateOf(true) }
    var biometricAuthEnabled by remember { mutableStateOf(false) }
    var locationSharingEnabled by remember { mutableStateOf(true) }
    var analyticsEnabled by remember { mutableStateOf(true) }

    var showLanguageSheet by remember { mutableStateOf(false) }
    var selectedLanguage by remember { mutableStateOf("en") }
    var showClearCacheDialog by remember { mutableStateOf(false) }
    var showClearCartDialog by remember { mutableStateOf(false) }
    var showDebugDialog by remember { mutableStateOf(false) }
    val baseUrl by ApiConfig.baseUrl.collectAsState()
    var debugBaseUrl by remember(baseUrl) { mutableStateOf(baseUrl) }

    // App version info
    val appVersion = try {
        context.packageManager.getPackageInfo(context.packageName, 0).versionName
    } catch (e: PackageManager.NameNotFoundException) {
        "1.0.0"
    }

    val buildNumber = try {
        context.packageManager.getPackageInfo(context.packageName, 0).longVersionCode.toString()
    } catch (e: PackageManager.NameNotFoundException) {
        "1"
    }

    // Language Selection Sheet
    if (showLanguageSheet) {
        LanguageSelectionSheet(
            selectedLanguage = selectedLanguage,
            onLanguageSelected = { selectedLanguage = it },
            onDismiss = { showLanguageSheet = false }
        )
    }

    // Clear Cache Dialog
    if (showClearCacheDialog) {
        AlertDialog(
            onDismissRequest = { showClearCacheDialog = false },
            title = { Text("Clear Cache") },
            text = { Text("Are you sure you want to clear the cache?") },
            confirmButton = {
                TextButton(
                    onClick = {
                        // TODO: Implement cache clearing
                        showClearCacheDialog = false
                    }
                ) {
                    Text("Clear", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showClearCacheDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    // Clear Cart Dialog
    if (showClearCartDialog) {
        AlertDialog(
            onDismissRequest = { showClearCartDialog = false },
            title = { Text("Clear Cart") },
            text = { Text("Are you sure you want to clear your cart?") },
            confirmButton = {
                TextButton(
                    onClick = {
                        // TODO: Implement cart clearing
                        showClearCartDialog = false
                    }
                ) {
                    Text("Clear", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showClearCartDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Settings") },
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
                .verticalScroll(rememberScrollState())
        ) {
            // Notifications Section
            SettingsSection(title = "Notifications") {
                SettingsNavigationItem(
                    title = "Notifications",
                    onClick = onNavigateToNotifications
                )
            }

            HorizontalDivider()

            // Language Section
            SettingsSection(title = "Language") {
                SettingsNavigationItem(
                    title = "Language",
                    trailing = {
                        Text(
                            text = when (selectedLanguage) {
                                "hi" -> "हिन्दी"
                                else -> "English"
                            },
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    },
                    onClick = { showLanguageSheet = true }
                )
            }

            HorizontalDivider()

            // Appearance Section
            SettingsSection(title = "Appearance") {
                SettingsToggleItem(
                    title = "Dark Mode",
                    checked = darkModeEnabled,
                    onCheckedChange = { darkModeEnabled = it }
                )
                HorizontalDivider(modifier = Modifier.padding(start = 16.dp))
                SettingsToggleItem(
                    title = "Sound",
                    checked = soundEnabled,
                    onCheckedChange = { soundEnabled = it }
                )
            }

            HorizontalDivider()

            // Security Section
            SettingsSection(title = "Security") {
                SettingsToggleItem(
                    title = "Biometric Authentication",
                    checked = biometricAuthEnabled,
                    onCheckedChange = { biometricAuthEnabled = it }
                )
                HorizontalDivider(modifier = Modifier.padding(start = 16.dp))
                SettingsNavigationItem(
                    title = "Change Password",
                    onClick = onNavigateToChangePassword
                )
            }

            HorizontalDivider()

            // Privacy Section
            SettingsSection(title = "Privacy") {
                SettingsToggleItem(
                    title = "Location Sharing",
                    checked = locationSharingEnabled,
                    onCheckedChange = { locationSharingEnabled = it }
                )
                HorizontalDivider(modifier = Modifier.padding(start = 16.dp))
                SettingsToggleItem(
                    title = "Analytics",
                    checked = analyticsEnabled,
                    onCheckedChange = { analyticsEnabled = it }
                )
            }

            HorizontalDivider()

            // Help & Support Section
            SettingsSection(title = "Help & Support") {
                SettingsNavigationItem(
                    title = "Help & Support",
                    onClick = { /* TODO: Navigate to help */ }
                )
                HorizontalDivider(modifier = Modifier.padding(start = 16.dp))
                SettingsNavigationItem(
                    title = "FAQ",
                    onClick = { /* TODO: Navigate to FAQ */ }
                )
            }

            HorizontalDivider()

            // Legal Section
            SettingsSection(title = "Legal") {
                SettingsNavigationItem(
                    title = "Terms and Conditions",
                    onClick = { /* TODO: Navigate to terms */ }
                )
                HorizontalDivider(modifier = Modifier.padding(start = 16.dp))
                SettingsNavigationItem(
                    title = "Privacy Policy",
                    onClick = { /* TODO: Navigate to privacy policy */ }
                )
            }

            HorizontalDivider()

            // Data Management Section
            SettingsSection(title = "Data") {
                SettingsActionItem(
                    title = "Clear Cache",
                    onClick = { showClearCacheDialog = true }
                )
                HorizontalDivider(modifier = Modifier.padding(start = 16.dp))
                SettingsActionItem(
                    title = "Clear Cart",
                    onClick = { showClearCartDialog = true }
                )
            }

            HorizontalDivider()

            // About Section
            SettingsSection(title = "About") {
                SettingsInfoItem(label = "Version", value = appVersion)
                HorizontalDivider(modifier = Modifier.padding(start = 16.dp))
                SettingsInfoItem(label = "Build", value = buildNumber)
                HorizontalDivider(modifier = Modifier.padding(start = 16.dp))
                SettingsInfoItem(label = "Developer", value = "MenuMaker Inc.")
            }

            if (BuildConfig.DEBUG) {
                HorizontalDivider()
                SettingsSection(title = "Developer") {
                    SettingsNavigationItem(
                        title = "API Base URL",
                        trailing = { Text(baseUrl, style = MaterialTheme.typography.bodySmall) },
                        onClick = { showDebugDialog = true }
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }

    if (showDebugDialog) {
        AlertDialog(
            onDismissRequest = { showDebugDialog = false },
            title = { Text("API Base URL") },
            text = {
                Column {
                    Text("Point the app to the fake backend or another environment.")
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = debugBaseUrl,
                        onValueChange = { debugBaseUrl = it },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    ApiConfig.overrideBaseUrl(debugBaseUrl.trim())
                    showDebugDialog = false
                }) {
                    Text("Apply")
                }
            },
            dismissButton = {
                TextButton(onClick = {
                    ApiConfig.overrideBaseUrl(BuildConfig.API_BASE_URL_DEFAULT)
                    debugBaseUrl = BuildConfig.API_BASE_URL_DEFAULT
                    showDebugDialog = false
                }) {
                    Text("Reset")
                }
            }
        )
    }
}

@Composable
fun SettingsSection(
    title: String? = null,
    content: @Composable ColumnScope.() -> Unit
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        title?.let {
            Text(
                text = it,
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                fontWeight = FontWeight.Bold
            )
        }
        content()
    }
}

@Composable
fun SettingsNavigationItem(
    title: String,
    trailing: @Composable (() -> Unit)? = null,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyLarge
            )
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                trailing?.invoke()
                Icon(
                    imageVector = Icons.Default.ChevronRight,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
fun SettingsToggleItem(
    title: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.bodyLarge
        )
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange
        )
    }
}

@Composable
fun SettingsActionItem(
    title: String,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth()
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.bodyLarge,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)
        )
    }
}

@Composable
fun SettingsInfoItem(
    label: String,
    value: String
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyLarge
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LanguageSelectionSheet(
    selectedLanguage: String,
    onLanguageSelected: (String) -> Unit,
    onDismiss: () -> Unit
) {
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
                text = "Select Language",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 8.dp)
            )

            Surface(
                onClick = {
                    onLanguageSelected("en")
                    onDismiss()
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("English", style = MaterialTheme.typography.bodyLarge)
                    if (selectedLanguage == "en") {
                        Icon(
                            imageVector = Icons.Default.Check,
                            contentDescription = "Selected",
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            }

            Surface(
                onClick = {
                    onLanguageSelected("hi")
                    onDismiss()
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("हिन्दी", style = MaterialTheme.typography.bodyLarge)
                    if (selectedLanguage == "hi") {
                        Icon(
                            imageVector = Icons.Default.Check,
                            contentDescription = "Selected",
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            }

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
