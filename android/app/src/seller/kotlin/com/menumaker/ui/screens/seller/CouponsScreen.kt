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
import com.menumaker.data.remote.models.CouponDto
import com.menumaker.viewmodel.CouponViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CouponsScreen(
    businessId: String,
    viewModel: CouponViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit
) {
    val couponsState by viewModel.couponsState.collectAsState()
    var showCreateDialog by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        viewModel.loadCoupons(businessId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Coupons & Promotions") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { showCreateDialog = true }) {
                Icon(Icons.Default.Add, "Create Coupon")
            }
        }
    ) { padding ->
        when (val state = couponsState) {
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

            is Resource.Success -> {
                if (state.data.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(padding),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                Icons.Default.LocalOffer,
                                contentDescription = null,
                                modifier = Modifier.size(64.dp),
                                tint = MaterialTheme.colorScheme.outline
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Text("No coupons yet", style = MaterialTheme.typography.titleMedium)
                        }
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(padding),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(state.data) { coupon ->
                            CouponCard(
                                coupon = coupon,
                                onDelete = { viewModel.deleteCoupon(coupon.id, businessId) }
                            )
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
                    Text(text = state.message, color = MaterialTheme.colorScheme.error)
                }
            }

            null -> {}
        }
    }

    if (showCreateDialog) {
        CreateCouponDialog(
            onDismiss = { showCreateDialog = false },
            onCreate = { code, discountType, discountValue ->
                viewModel.createCoupon(mapOf(
                    "business_id" to businessId,
                    "code" to code,
                    "discount_type" to discountType,
                    "discount_value" to discountValue,
                    "is_active" to true
                ))
                showCreateDialog = false
            }
        )
    }
}

@Composable
fun CouponCard(coupon: CouponDto, onDelete: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = coupon.code,
                    style = MaterialTheme.typography.titleMedium
                )
                Text(
                    text = if (coupon.discountType == "percentage")
                        "${coupon.discountValue}% off"
                    else
                        "₹${coupon.discountValue / 100} off",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.primary
                )
                if (!coupon.isActive) {
                    Text(
                        text = "Inactive",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }

            IconButton(onClick = onDelete) {
                Icon(Icons.Default.Delete, "Delete")
            }
        }
    }
}

@Composable
fun CreateCouponDialog(
    onDismiss: () -> Unit,
    onCreate: (String, String, Int) -> Unit
) {
    var code by remember { mutableStateOf("") }
    var discountType by remember { mutableStateOf("percentage") }
    var discountValue by remember { mutableStateOf("10") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Create Coupon") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = code,
                    onValueChange = { code = it.uppercase() },
                    label = { Text("Coupon Code") },
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = discountValue,
                    onValueChange = { discountValue = it },
                    label = { Text(if (discountType == "percentage") "Discount %" else "Discount ₹") },
                    modifier = Modifier.fillMaxWidth()
                )

                Row(verticalAlignment = Alignment.CenterVertically) {
                    RadioButton(
                        selected = discountType == "percentage",
                        onClick = { discountType = "percentage" }
                    )
                    Text("Percentage")
                    Spacer(modifier = Modifier.width(16.dp))
                    RadioButton(
                        selected = discountType == "fixed",
                        onClick = { discountType = "fixed" }
                    )
                    Text("Fixed Amount")
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    val value = if (discountType == "fixed") {
                        (discountValue.toIntOrNull() ?: 0) * 100
                    } else {
                        discountValue.toIntOrNull() ?: 0
                    }
                    onCreate(code, discountType, value)
                },
                enabled = code.isNotBlank() && discountValue.isNotBlank()
            ) {
                Text("Create")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}
