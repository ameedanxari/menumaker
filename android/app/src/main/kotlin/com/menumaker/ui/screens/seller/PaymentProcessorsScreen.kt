package com.menumaker.ui.screens.seller

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.PaymentProcessorDto
import com.menumaker.viewmodel.PaymentViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PaymentProcessorsScreen(
    businessId: String,
    viewModel: PaymentViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit
) {
    val processorsState by viewModel.processorsState.collectAsState()
    val connectState by viewModel.connectState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.loadProcessors(businessId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Payment Processors") },
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
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                "Available Processors",
                style = MaterialTheme.typography.titleLarge
            )

            val availableProcessors = listOf(
                "stripe" to "Stripe",
                "razorpay" to "Razorpay",
                "phonepe" to "PhonePe",
                "paytm" to "Paytm",
                "manual" to "Manual/Cash"
            )

            LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items(availableProcessors) { (id, name) ->
                    val isConnected = (processorsState as? Resource.Success)?.data
                        ?.any { it.provider == id && it.isActive } ?: false

                    ProcessorCard(
                        name = name,
                        isConnected = isConnected,
                        onConnect = { viewModel.connectProcessor(id) },
                        onDisconnect = {
                            val processor = (processorsState as? Resource.Success)?.data
                                ?.find { it.provider == id }
                            processor?.let { viewModel.disconnectProcessor(it.id, businessId) }
                        }
                    )
                }
            }
        }
    }
}

@Composable
fun ProcessorCard(
    name: String,
    isConnected: Boolean,
    onConnect: () -> Unit,
    onDisconnect: () -> Unit
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(name, style = MaterialTheme.typography.titleMedium)
                Text(
                    if (isConnected) "Connected" else "Not connected",
                    style = MaterialTheme.typography.bodySmall,
                    color = if (isConnected) MaterialTheme.colorScheme.primary
                    else MaterialTheme.colorScheme.outline
                )
            }

            if (isConnected) {
                Button(
                    onClick = onDisconnect,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error
                    )
                ) {
                    Text("Disconnect")
                }
            } else {
                Button(onClick = onConnect) {
                    Text("Connect")
                }
            }
        }
    }
}
