package com.menumaker.ui.screens.customer

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.menumaker.viewmodel.CustomerPaymentViewModel
import com.menumaker.viewmodel.PaymentMethodType

/**
 * Payment Screen
 *
 * Handles checkout and payment processing for customer orders.
 * Matches iOS PaymentView functionality.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PaymentScreen(
    orderTotal: Double,
    viewModel: CustomerPaymentViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit,
    onPaymentSuccess: (String) -> Unit
) {
    val selectedMethod by viewModel.selectedPaymentMethod.collectAsState()
    val isProcessing by viewModel.isProcessing.collectAsState()
    val showSuccess by viewModel.showPaymentSuccess.collectAsState()
    val showFailed by viewModel.showPaymentFailed.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()
    val completedOrderId by viewModel.completedOrderId.collectAsState()

    // Handle payment success
    LaunchedEffect(showSuccess) {
        if (showSuccess && completedOrderId != null) {
            onPaymentSuccess(completedOrderId!!)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Payment") },
                navigationIcon = {
                    IconButton(
                        onClick = onNavigateBack,
                        enabled = !isProcessing
                    ) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                }
            )
        }
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize()) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(24.dp)
            ) {
                // Order Total
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.primaryContainer
                    )
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Order Total",
                            style = MaterialTheme.typography.titleMedium
                        )
                        Text(
                            text = "₹%.2f".format(orderTotal),
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }

                // Secure Payment Badge
                Row(
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(
                        imageVector = Icons.Default.Lock,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "Secure Payment",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.primary
                    )
                }

                // Payment Method Selection
                Text(
                    text = "Select Payment Method",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )

                // Payment method tabs
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    FilterChip(
                        selected = selectedMethod == PaymentMethodType.CARD,
                        onClick = { viewModel.setPaymentMethod(PaymentMethodType.CARD) },
                        label = { Text("Card") },
                        modifier = Modifier.weight(1f)
                    )
                    FilterChip(
                        selected = selectedMethod == PaymentMethodType.UPI,
                        onClick = { viewModel.setPaymentMethod(PaymentMethodType.UPI) },
                        label = { Text("UPI") },
                        modifier = Modifier.weight(1f)
                    )
                    FilterChip(
                        selected = selectedMethod == PaymentMethodType.CASH,
                        onClick = { viewModel.setPaymentMethod(PaymentMethodType.CASH) },
                        label = { Text("Cash") },
                        modifier = Modifier.weight(1f)
                    )
                }

                // Payment method forms
                when (selectedMethod) {
                    PaymentMethodType.CARD -> {
                        CardPaymentForm(viewModel = viewModel)
                    }
                    PaymentMethodType.UPI -> {
                        UPIPaymentForm(viewModel = viewModel)
                    }
                    PaymentMethodType.CASH -> {
                        CashPaymentInfo()
                    }
                }

                Spacer(modifier = Modifier.weight(1f))

                // Pay Button
                Button(
                    onClick = {
                        viewModel.processPayment(orderTotal) { orderId ->
                            onPaymentSuccess(orderId)
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp),
                    enabled = viewModel.isPayButtonEnabled() && !isProcessing
                ) {
                    if (isProcessing) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = MaterialTheme.colorScheme.onPrimary
                        )
                    } else {
                        Text(
                            text = "Pay ₹%.2f".format(orderTotal),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                TextButton(
                    onClick = onNavigateBack,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !isProcessing
                ) {
                    Text("Cancel")
                }
            }

            // Payment Failed Alert
            if (showFailed) {
                AlertDialog(
                    onDismissRequest = { /* Handled by button */ },
                    title = { Text("Payment Failed") },
                    text = { Text(errorMessage ?: "Payment could not be processed. Please try again.") },
                    confirmButton = {
                        TextButton(onClick = { /* Retry handled automatically */ }) {
                            Text("OK")
                        }
                    }
                )
            }
        }
    }
}

@Composable
fun CardPaymentForm(viewModel: CustomerPaymentViewModel) {
    val cardNumber by viewModel.cardNumber.collectAsState()
    val cardHolderName by viewModel.cardHolderName.collectAsState()
    val expiryDate by viewModel.expiryDate.collectAsState()
    val cvv by viewModel.cvv.collectAsState()
    val cardError by viewModel.cardValidationError.collectAsState()

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        OutlinedTextField(
            value = cardNumber,
            onValueChange = { viewModel.updateCardNumber(it) },
            label = { Text("Card Number") },
            modifier = Modifier.fillMaxWidth(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            isError = cardError != null,
            supportingText = cardError?.let { { Text(it) } },
            singleLine = true
        )

        OutlinedTextField(
            value = cardHolderName,
            onValueChange = { viewModel.updateCardHolderName(it) },
            label = { Text("Cardholder Name") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedTextField(
                value = expiryDate,
                onValueChange = { viewModel.updateExpiryDate(it) },
                label = { Text("MM/YY") },
                modifier = Modifier.weight(1f),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true
            )

            OutlinedTextField(
                value = cvv,
                onValueChange = { viewModel.updateCvv(it) },
                label = { Text("CVV") },
                modifier = Modifier.weight(1f),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true
            )
        }
    }
}

@Composable
fun UPIPaymentForm(viewModel: CustomerPaymentViewModel) {
    val upiId by viewModel.upiId.collectAsState()
    val upiError by viewModel.upiValidationError.collectAsState()

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        OutlinedTextField(
            value = upiId,
            onValueChange = { viewModel.updateUpiId(it) },
            label = { Text("UPI ID") },
            placeholder = { Text("yourname@upi") },
            modifier = Modifier.fillMaxWidth(),
            isError = upiError != null,
            supportingText = upiError?.let { { Text(it) } },
            singleLine = true
        )

        Text(
            text = "Enter your UPI ID to pay via UPI",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
fun CashPaymentInfo() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = "Cash on Delivery",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "Pay with cash when your order is delivered to your doorstep.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
