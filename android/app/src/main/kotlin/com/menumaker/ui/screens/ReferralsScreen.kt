package com.menumaker.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.ReferralHistoryDto
import com.menumaker.data.remote.models.ReferralLeaderboardDto
import com.menumaker.data.remote.models.ReferralStatus
import com.menumaker.viewmodel.ReferralViewModel
import java.text.SimpleDateFormat
import java.util.*

/**
 * Referrals Screen
 *
 * Complete referral system with code sharing, stats, history, and leaderboard.
 * Matches iOS ReferralView functionality.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReferralsScreen(
    viewModel: ReferralViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit
) {
    val context = LocalContext.current
    val statsState by viewModel.statsState.collectAsState()
    val stats by viewModel.stats.collectAsState()
    val referralHistory by viewModel.referralHistory.collectAsState()
    val leaderboard by viewModel.leaderboard.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val referralCodeMessage by viewModel.referralCodeMessage.collectAsState()
    val referralCodeSuccess by viewModel.referralCodeSuccess.collectAsState()

    var showHowItWorks by remember { mutableStateOf(false) }
    var showTerms by remember { mutableStateOf(false) }
    var enteredReferralCode by remember { mutableStateOf("") }

    // Load data when screen opens
    LaunchedEffect(Unit) {
        viewModel.refreshData()
    }

    // How It Works Sheet
    if (showHowItWorks) {
        HowItWorksSheet(onDismiss = { showHowItWorks = false })
    }

    // Terms & Conditions Sheet
    if (showTerms) {
        TermsSheet(onDismiss = { showTerms = false })
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Refer & Earn") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                }
            )
        }
    ) { padding ->
        if (isLoading && stats == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(24.dp)
            ) {
                // Referral Code Card
                item {
                    ReferralCodeCard(
                        referralCode = viewModel.getReferralCode() ?: "",
                        onCopy = { code ->
                            copyToClipboard(context, code)
                        },
                        onShare = { code ->
                            shareReferralCode(context, code)
                        }
                    )
                }

                // Credits and Rewards
                item {
                    CreditsRewardsSection(stats = stats)
                }

                // Stats Cards
                item {
                    StatsSection(stats = stats)
                }

                // Apply Referral Code
                item {
                    ApplyReferralCodeSection(
                        enteredCode = enteredReferralCode,
                        onCodeChange = { enteredReferralCode = it },
                        onApply = {
                            viewModel.applyReferralCode(enteredReferralCode)
                            enteredReferralCode = ""
                        },
                        isLoading = isLoading,
                        message = referralCodeMessage,
                        isSuccess = referralCodeSuccess
                    )
                }

                // Referral History
                item {
                    ReferralHistorySection(referralHistory = referralHistory)
                }

                // Information Section
                item {
                    InformationSection(
                        onHowItWorks = { showHowItWorks = true },
                        onTerms = { showTerms = true }
                    )
                }

                // Leaderboard
                item {
                    LeaderboardSection(leaderboard = leaderboard)
                }

                // Bottom spacer
                item {
                    Spacer(modifier = Modifier.height(16.dp))
                }
            }
        }
    }
}

@Composable
fun ReferralCodeCard(
    referralCode: String,
    onCopy: (String) -> Unit,
    onShare: (String) -> Unit
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
            Icon(
                imageVector = Icons.Default.CardGiftcard,
                contentDescription = null,
                modifier = Modifier.size(48.dp),
                tint = MaterialTheme.colorScheme.primary
            )

            Text(
                text = "Invite Friends, Get Rewards!",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            Text(
                text = "Share your referral code and earn rewards when your friends sign up",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            if (referralCode.isNotEmpty()) {
                // Referral Code Display
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    shape = MaterialTheme.shapes.medium
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = referralCode,
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.Bold
                        )

                        IconButton(onClick = { onCopy(referralCode) }) {
                            Icon(
                                imageVector = Icons.Default.ContentCopy,
                                contentDescription = "Copy code",
                                tint = MaterialTheme.colorScheme.primary
                            )
                        }
                    }
                }

                // Share Button
                Button(
                    onClick = { onShare(referralCode) },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(
                        imageVector = Icons.Default.Share,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Share Referral Code")
                }
            }
        }
    }
}

@Composable
fun CreditsRewardsSection(stats: com.menumaker.data.remote.models.ReferralStatsDto?) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Available Credits
        Card(
            modifier = Modifier.weight(1f),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surface
            ),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = "Available Credits",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = formatCurrency(stats?.availableCreditsCents ?: 0),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF4CAF50)
                )
            }
        }

        // Pending Rewards
        Card(
            modifier = Modifier.weight(1f),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surface
            ),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = "Pending Rewards",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = formatCurrency(stats?.pendingRewardsCents ?: 0),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFFFF9800)
                )
            }
        }
    }
}

@Composable
fun StatsSection(stats: com.menumaker.data.remote.models.ReferralStatsDto?) {
    Column(
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "Your Stats",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            StatCard(
                title = "Total Referrals",
                value = "${stats?.totalReferrals ?: 0}",
                icon = Icons.Default.People,
                color = Color(0xFF2196F3),
                modifier = Modifier.weight(1f)
            )
            StatCard(
                title = "Rewards Earned",
                value = formatCurrency(stats?.totalEarningsCents ?: 0),
                icon = Icons.Default.AttachMoney,
                color = Color(0xFF4CAF50),
                modifier = Modifier.weight(1f)
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            StatCard(
                title = "Pending",
                value = "${stats?.pendingReferrals ?: 0}",
                icon = Icons.Default.Schedule,
                color = Color(0xFFFF9800),
                modifier = Modifier.weight(1f)
            )
            StatCard(
                title = "This Month",
                value = "${stats?.monthlyReferrals ?: 0}",
                icon = Icons.Default.CalendarToday,
                color = Color(0xFF9C27B0),
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
fun StatCard(
    title: String,
    value: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    color: Color,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = color,
                modifier = Modifier.size(24.dp)
            )
            Text(
                text = value,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = title,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
fun ApplyReferralCodeSection(
    enteredCode: String,
    onCodeChange: (String) -> Unit,
    onApply: () -> Unit,
    isLoading: Boolean,
    message: String?,
    isSuccess: Boolean
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
                text = "Have a Referral Code?",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold
            )

            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.Top
            ) {
                OutlinedTextField(
                    value = enteredCode,
                    onValueChange = onCodeChange,
                    modifier = Modifier.weight(1f),
                    label = { Text("Enter Referral Code") },
                    singleLine = true
                )

                Button(
                    onClick = onApply,
                    enabled = enteredCode.isNotEmpty() && !isLoading,
                    modifier = Modifier.padding(top = 8.dp)
                ) {
                    Text("Apply")
                }
            }

            message?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodySmall,
                    color = if (isSuccess) Color(0xFF4CAF50) else MaterialTheme.colorScheme.error
                )
            }
        }
    }
}

@Composable
fun ReferralHistorySection(referralHistory: List<ReferralHistoryDto>) {
    Column(
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "Referral History",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )

        if (referralHistory.isEmpty()) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            ) {
                Text(
                    text = "No referrals yet. Share your code to get started!",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(24.dp)
                )
            }
        } else {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surface
                ),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    referralHistory.forEach { referral ->
                        ReferralHistoryRow(referral = referral)
                        if (referral != referralHistory.last()) {
                            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ReferralHistoryRow(referral: ReferralHistoryDto) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                text = referral.referredUserName,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium
            )
            Text(
                text = formatDate(referral.createdAt),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        Column(
            horizontalAlignment = Alignment.End,
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Surface(
                shape = MaterialTheme.shapes.small,
                color = getStatusColor(referral.status).copy(alpha = 0.2f)
            ) {
                Text(
                    text = getStatusDisplayName(referral.status),
                    style = MaterialTheme.typography.labelSmall,
                    color = getStatusColor(referral.status),
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                    fontWeight = FontWeight.Medium
                )
            }

            if (referral.rewardAmountCents > 0) {
                Text(
                    text = formatCurrency(referral.rewardAmountCents),
                    style = MaterialTheme.typography.labelSmall,
                    color = Color(0xFF4CAF50),
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}

@Composable
fun InformationSection(
    onHowItWorks: () -> Unit,
    onTerms: () -> Unit
) {
    Column(
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Card(
            onClick = onHowItWorks,
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.Info, null)
                    Text("How It Works")
                }
                Icon(
                    imageVector = Icons.Default.ChevronRight,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp)
                )
            }
        }

        Card(
            onClick = onTerms,
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.Description, null)
                    Text("Terms & Conditions")
                }
                Icon(
                    imageVector = Icons.Default.ChevronRight,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp)
                )
            }
        }
    }
}

@Composable
fun LeaderboardSection(leaderboard: List<ReferralLeaderboardDto>) {
    Column(
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Leaderboard",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Icon(
                imageVector = Icons.Default.EmojiEvents,
                contentDescription = null,
                tint = Color(0xFFFFB300)
            )
        }

        if (leaderboard.isEmpty()) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            ) {
                Text(
                    text = "No leaderboard data yet",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(24.dp)
                )
            }
        } else {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surface
                ),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    leaderboard.forEachIndexed { index, entry ->
                        LeaderboardRow(rank = index + 1, entry = entry)
                        if (entry != leaderboard.last()) {
                            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun LeaderboardRow(rank: Int, entry: ReferralLeaderboardDto) {
    val rankColor = when (rank) {
        1 -> Color(0xFFFFB300) // Gold
        2 -> Color.Gray // Silver
        3 -> Color(0xFFFF9800) // Bronze
        else -> MaterialTheme.colorScheme.onSurface
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "#$rank",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = rankColor,
                modifier = Modifier.width(40.dp)
            )

            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = entry.userName,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = "${entry.referralCount} referrals",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        if (rank <= 3) {
            Icon(
                imageVector = Icons.Default.EmojiEvents,
                contentDescription = null,
                tint = rankColor
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HowItWorksSheet(onDismiss: () -> Unit) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            Text(
                text = "How Referrals Work",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )

            HowItWorksStep(
                number = 1,
                title = "Share Your Code",
                description = "Share your unique referral code with friends and family via WhatsApp, SMS, or social media."
            )

            HowItWorksStep(
                number = 2,
                title = "Friend Signs Up",
                description = "Your friend creates an account using your referral code and completes their first order."
            )

            HowItWorksStep(
                number = 3,
                title = "You Both Earn Rewards",
                description = "You receive ₹100 credit and your friend gets ₹50 off their first order!"
            )

            HowItWorksStep(
                number = 4,
                title = "Use Your Credits",
                description = "Use your earned credits on any future orders. No minimum order value required!"
            )

            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer
                )
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "Bonus Rewards",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold
                    )
                    Text("• Refer 5 friends: Get an extra ₹200 bonus")
                    Text("• Refer 10 friends: Get an extra ₹500 bonus")
                    Text("• Top monthly referrer: Win exciting prizes!")
                }
            }

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
fun HowItWorksStep(number: Int, title: String, description: String) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Surface(
            modifier = Modifier.size(50.dp),
            shape = CircleShape,
            color = MaterialTheme.colorScheme.primary
        ) {
            Box(contentAlignment = Alignment.Center) {
                Text(
                    text = "$number",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onPrimary
                )
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = description,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TermsSheet(onDismiss: () -> Unit) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = "Referral Program Terms & Conditions",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )

            TermsSection(
                title = "1. Eligibility",
                content = "The referral program is open to all registered MenuMaker users. You cannot refer yourself or use multiple accounts to claim rewards fraudulently."
            )

            TermsSection(
                title = "2. Referral Rewards",
                content = "Referrer receives ₹100 credit after the referred user completes their first order of minimum ₹200. The referred user receives ₹50 off on their first order."
            )

            TermsSection(
                title = "3. Credit Validity",
                content = "Referral credits are valid for 90 days from the date of credit. Unused credits will expire after this period and cannot be redeemed."
            )

            TermsSection(
                title = "4. Credit Usage",
                content = "Credits can be used on any order with no minimum order value required. Credits cannot be transferred or exchanged for cash."
            )

            TermsSection(
                title = "5. Fraud Prevention",
                content = "MenuMaker reserves the right to suspend or terminate accounts found to be abusing the referral program. This includes creating fake accounts or sharing codes publicly."
            )

            TermsSection(
                title = "6. Program Changes",
                content = "MenuMaker reserves the right to modify or terminate the referral program at any time without prior notice. Any changes will be reflected in these terms."
            )

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
fun TermsSection(title: String, content: String) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = content,
            style = MaterialTheme.typography.bodyMedium
        )
    }
}

// Helper Functions

private fun copyToClipboard(context: Context, text: String) {
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    val clip = ClipData.newPlainText("Referral Code", text)
    clipboard.setPrimaryClip(clip)
}

private fun shareReferralCode(context: Context, code: String) {
    val shareText = """
        Join me on MenuMaker! Use my referral code $code and get special rewards.

        Download the app now!
    """.trimIndent()

    val shareIntent = Intent().apply {
        action = Intent.ACTION_SEND
        putExtra(Intent.EXTRA_TEXT, shareText)
        type = "text/plain"
    }
    context.startActivity(Intent.createChooser(shareIntent, "Share via"))
}

private fun formatCurrency(cents: Int): String {
    return "₹${cents / 100}"
}

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

private fun getStatusDisplayName(status: ReferralStatus): String {
    return when (status) {
        ReferralStatus.PENDING -> "Pending"
        ReferralStatus.COMPLETED -> "Completed"
        ReferralStatus.CREDITED -> "Credited"
        ReferralStatus.EXPIRED -> "Expired"
    }
}

private fun getStatusColor(status: ReferralStatus): Color {
    return when (status) {
        ReferralStatus.PENDING -> Color(0xFFFF9800)
        ReferralStatus.COMPLETED -> Color(0xFF2196F3)
        ReferralStatus.CREDITED -> Color(0xFF4CAF50)
        ReferralStatus.EXPIRED -> Color.Gray
    }
}
