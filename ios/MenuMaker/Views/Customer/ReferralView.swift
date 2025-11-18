import SwiftUI

struct ReferralView: View {
    @StateObject private var viewModel = ReferralViewModel()
    @State private var showingShareSheet = false
    @State private var showHowItWorks = false
    @State private var showTermsAndConditions = false
    @State private var enteredReferralCode = ""

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    if viewModel.isLoading && viewModel.stats == nil {
                        ProgressView()
                            .padding()
                    } else {
                        // Referral Code Card
                        referralCodeCard

                        // Credits and Rewards Section
                        creditsRewardsSection

                        // Stats Cards
                        statsSection

                        // Apply Referral Code Section
                        applyReferralCodeSection

                        // Referral History Section
                        referralHistorySection

                        // Information Section
                        informationSection

                        // Leaderboard
                        leaderboardSection
                    }
                }
                .padding()
            }
            .background(Color.theme.background)
            .navigationTitle("Refer & Earn")
            .accessibilityIdentifier("referral-screen")
            .refreshable {
                await viewModel.refreshData()
            }
            .sheet(isPresented: $showingShareSheet) {
                if let code = viewModel.getReferralCode() {
                    ShareSheet(items: [generateShareMessage(code: code)])
                }
            }
            .sheet(isPresented: $showHowItWorks) {
                HowItWorksView()
            }
            .sheet(isPresented: $showTermsAndConditions) {
                TermsAndConditionsView()
            }
        }
    }

    private var referralCodeCard: some View {
        VStack(spacing: 16) {
            Image(systemName: "gift.fill")
                .font(.system(size: 48))
                .foregroundColor(.theme.primary)

            Text("Invite Friends, Get Rewards!")
                .font(.title3)
                .fontWeight(.bold)
                .accessibilityIdentifier("referral-title")

            Text("Share your referral code and earn rewards when your friends sign up")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .accessibilityIdentifier("referral-description")

            if let code = viewModel.getReferralCode() {
                VStack(spacing: 12) {
                    // Referral Code Display
                    HStack {
                        Text(code)
                            .font(.title)
                            .fontWeight(.bold)
                            .accessibilityIdentifier("referral-code")

                        Button(action: { copyToClipboard(code) }) {
                            Image(systemName: "doc.on.doc")
                                .foregroundColor(.theme.primary)
                        }
                        .accessibilityIdentifier("copy-code-button")
                    }
                    .padding()
                    .background(Color.theme.surface)
                    .cornerRadius(12)

                    // Share Button
                    Button(action: { showingShareSheet = true }) {
                        HStack {
                            Image(systemName: "square.and.arrow.up")
                            Text("Share Referral Code")
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.theme.primary)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                    }
                    .accessibilityIdentifier("share-referral-button")
                }
            }
        }
        .padding()
        .background(Color.white)
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 2)
    }

    private var creditsRewardsSection: some View {
        HStack(spacing: 12) {
            // Available Credits
            VStack(alignment: .leading, spacing: 8) {
                Text("Available Credits")
                    .font(.caption)
                    .foregroundColor(.secondary)

                if let stats = viewModel.stats {
                    Text(formatCurrency(stats.availableCreditsCents))
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundColor(.green)
                } else {
                    Text("₹0")
                        .font(.title2)
                        .fontWeight(.bold)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
            .background(Color.white)
            .cornerRadius(12)
            .shadow(color: Color.black.opacity(0.05), radius: 4, x: 0, y: 2)

            // Pending Rewards
            VStack(alignment: .leading, spacing: 8) {
                Text("Pending Rewards")
                    .font(.caption)
                    .foregroundColor(.secondary)

                if let stats = viewModel.stats {
                    Text(formatCurrency(stats.pendingRewardsCents))
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundColor(.orange)
                } else {
                    Text("₹0")
                        .font(.title2)
                        .fontWeight(.bold)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
            .background(Color.white)
            .cornerRadius(12)
            .shadow(color: Color.black.opacity(0.05), radius: 4, x: 0, y: 2)
        }
    }

    private var statsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Your Stats")
                .font(.headline)
                .accessibilityIdentifier("stats-section-title")

            if let stats = viewModel.stats {
                HStack(spacing: 12) {
                    ReferralStatCard(
                        title: "Total Referrals",
                        value: "\(stats.totalReferrals)",
                        icon: "person.2.fill",
                        color: .blue
                    )
                    .accessibilityIdentifier("total-referrals-stat")

                    ReferralStatCard(
                        title: "Rewards Earned",
                        value: formatCurrency(stats.totalEarningsCents),
                        icon: "indianrupeesign.circle.fill",
                        color: .green
                    )
                    .accessibilityIdentifier("total-rewards-stat")
                }

                HStack(spacing: 12) {
                    ReferralStatCard(
                        title: "Pending",
                        value: "\(stats.pendingReferrals)",
                        icon: "clock.fill",
                        color: .orange
                    )
                    .accessibilityIdentifier("pending-referrals-stat")

                    ReferralStatCard(
                        title: "This Month",
                        value: "\(stats.monthlyReferrals)",
                        icon: "calendar",
                        color: .purple
                    )
                    .accessibilityIdentifier("monthly-referrals-stat")
                }
            }
        }
    }

    private var applyReferralCodeSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Have a Referral Code?")
                .font(.headline)

            HStack(spacing: 12) {
                TextField("Enter Referral Code", text: $enteredReferralCode)
                    .textCase(.uppercase)
                    .autocapitalization(.allCharacters)
                    .disableAutocorrection(true)
                    .padding()
                    .background(Color.theme.surface)
                    .cornerRadius(8)
                    .accessibilityIdentifier("enter-referral-code-field")

                Button(action: {
                    Task {
                        await viewModel.applyReferralCode(enteredReferralCode)
                        enteredReferralCode = ""
                    }
                }) {
                    Text("Apply")
                        .fontWeight(.semibold)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 12)
                        .background(enteredReferralCode.isEmpty ? Color.gray : Color.theme.primary)
                        .foregroundColor(.white)
                        .cornerRadius(8)
                }
                .disabled(enteredReferralCode.isEmpty || viewModel.isLoading)
                .accessibilityLabel("Apply")
            }

            if let message = viewModel.referralCodeMessage {
                Text(message)
                    .font(.caption)
                    .foregroundColor(viewModel.referralCodeSuccess ? .green : .red)
                    .padding(.top, 4)
            }
        }
        .padding()
        .background(Color.white)
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 2)
    }

    private var referralHistorySection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Referral History")
                .font(.headline)

            if viewModel.referralHistory.isEmpty {
                Text("No referrals yet. Share your code to get started!")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding()
                    .accessibilityIdentifier("empty-referral-history")
            } else {
                VStack(spacing: 8) {
                    ForEach(viewModel.referralHistory) { referral in
                        ReferralHistoryRow(referral: referral)
                            .accessibilityIdentifier("ReferralHistoryCell")
                    }
                }
                .padding()
                .background(Color.white)
                .cornerRadius(16)
                .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 2)
            }
        }
    }

    private var informationSection: some View {
        VStack(spacing: 12) {
            Button(action: { showHowItWorks = true }) {
                HStack {
                    Image(systemName: "info.circle")
                    Text("How It Works")
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption)
                }
                .padding()
                .background(Color.white)
                .cornerRadius(12)
                .shadow(color: Color.black.opacity(0.05), radius: 4, x: 0, y: 2)
            }
            .foregroundColor(.primary)
            .accessibility(label: Text("How It Works"))

            Button(action: { showTermsAndConditions = true }) {
                HStack {
                    Image(systemName: "doc.text")
                    Text("Terms & Conditions")
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption)
                }
                .padding()
                .background(Color.white)
                .cornerRadius(12)
                .shadow(color: Color.black.opacity(0.05), radius: 4, x: 0, y: 2)
            }
            .foregroundColor(.primary)
            .accessibility(label: Text("Terms"))
        }
    }

    private var leaderboardSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Leaderboard")
                    .font(.headline)
                    .accessibilityIdentifier("leaderboard-title")

                Spacer()

                Image(systemName: "trophy.fill")
                    .foregroundColor(.yellow)
            }

            if viewModel.leaderboard.isEmpty {
                Text("No leaderboard data yet")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding()
                    .accessibilityIdentifier("empty-leaderboard")
            } else {
                VStack(spacing: 8) {
                    ForEach(Array(viewModel.leaderboard.enumerated()), id: \.element.id) { index, entry in
                        LeaderboardRow(rank: index + 1, entry: entry)
                            .accessibilityIdentifier("leaderboard-row-\(index)")
                    }
                }
                .padding()
                .background(Color.white)
                .cornerRadius(16)
                .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 2)
            }
        }
    }

    private func copyToClipboard(_ text: String) {
        UIPasteboard.general.string = text
        // Could show a toast notification here
    }

    private func generateShareMessage(code: String) -> String {
        """
        Join me on MenuMaker! Use my referral code \(code) and get special rewards.

        Download the app now!
        """
    }

    private func formatCurrency(_ cents: Int) -> String {
        let rupees = Double(cents) / 100.0
        return String(format: "₹%.0f", rupees)
    }
}

private struct ReferralStatCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(color)

            Text(value)
                .font(.title2)
                .fontWeight(.bold)

            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color.white)
        .cornerRadius(12)
        .shadow(color: Color.black.opacity(0.05), radius: 4, x: 0, y: 2)
    }
}

struct LeaderboardRow: View {
    let rank: Int
    let entry: ReferralLeaderboard

    var body: some View {
        HStack(spacing: 12) {
            // Rank
            Text("#\(rank)")
                .font(.headline)
                .foregroundColor(rankColor)
                .frame(width: 40)

            // User info
            VStack(alignment: .leading, spacing: 4) {
                Text(entry.userName)
                    .font(.subheadline)
                    .fontWeight(.semibold)

                Text("\(entry.referralCount) referrals")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            // Badge for top 3
            if rank <= 3 {
                Image(systemName: "medal.fill")
                    .foregroundColor(rankColor)
            }
        }
        .padding(.vertical, 8)
    }

    private var rankColor: Color {
        switch rank {
        case 1: return .yellow
        case 2: return .gray
        case 3: return .orange
        default: return .primary
        }
    }
}

struct ReferralHistoryRow: View {
    let referral: ReferralHistory

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(referral.referredUserName)
                    .font(.subheadline)
                    .fontWeight(.medium)

                Text(referral.formattedDate)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                Text(referral.status.displayName)
                    .font(.caption)
                    .fontWeight(.medium)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(referral.status.color.opacity(0.2))
                    .foregroundColor(referral.status.color)
                    .cornerRadius(8)

                if referral.rewardAmountCents > 0 {
                    Text(formatCurrency(referral.rewardAmountCents))
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(.green)
                }
            }
        }
        .padding(.vertical, 8)
    }

    private func formatCurrency(_ cents: Int) -> String {
        let rupees = Double(cents) / 100.0
        return String(format: "₹%.0f", rupees)
    }
}

struct HowItWorksView: View {
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    Text("How Referrals Work")
                        .font(.title2)
                        .fontWeight(.bold)

                    VStack(alignment: .leading, spacing: 16) {
                        HowItWorksStep(
                            number: 1,
                            title: "Share Your Code",
                            description: "Share your unique referral code with friends and family via WhatsApp, SMS, or social media."
                        )

                        HowItWorksStep(
                            number: 2,
                            title: "Friend Signs Up",
                            description: "Your friend creates an account using your referral code and completes their first order."
                        )

                        HowItWorksStep(
                            number: 3,
                            title: "You Both Earn Rewards",
                            description: "You receive ₹100 credit and your friend gets ₹50 off their first order!"
                        )

                        HowItWorksStep(
                            number: 4,
                            title: "Use Your Credits",
                            description: "Use your earned credits on any future orders. No minimum order value required!"
                        )
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        Text("Bonus Rewards")
                            .font(.headline)

                        Text("• Refer 5 friends: Get an extra ₹200 bonus")
                        Text("• Refer 10 friends: Get an extra ₹500 bonus")
                        Text("• Top monthly referrer: Win exciting prizes!")
                    }
                    .font(.subheadline)
                    .padding()
                    .background(Color.theme.primary.opacity(0.1))
                    .cornerRadius(12)
                }
                .padding()
            }
            .navigationTitle("How It Works")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}

struct HowItWorksStep: View {
    let number: Int
    let title: String
    let description: String

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            Text("\(number)")
                .font(.title)
                .fontWeight(.bold)
                .foregroundColor(.white)
                .frame(width: 50, height: 50)
                .background(Color.theme.primary)
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)

                Text(description)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
        }
    }
}

struct TermsAndConditionsView: View {
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Referral Program Terms & Conditions")
                        .font(.title2)
                        .fontWeight(.bold)

                    Group {
                        Text("1. Eligibility")
                            .font(.headline)
                            .padding(.top)

                        Text("The referral program is open to all registered MenuMaker users. You cannot refer yourself or use multiple accounts to claim rewards fraudulently.")

                        Text("2. Referral Rewards")
                            .font(.headline)
                            .padding(.top)

                        Text("Referrer receives ₹100 credit after the referred user completes their first order of minimum ₹200. The referred user receives ₹50 off on their first order.")

                        Text("3. Credit Validity")
                            .font(.headline)
                            .padding(.top)

                        Text("Referral credits are valid for 90 days from the date of credit. Unused credits will expire after this period and cannot be redeemed.")

                        Text("4. Credit Usage")
                            .font(.headline)
                            .padding(.top)

                        Text("Credits can be used on any order with no minimum order value required. Credits cannot be transferred or exchanged for cash.")

                        Text("5. Fraud Prevention")
                            .font(.headline)
                            .padding(.top)

                        Text("MenuMaker reserves the right to suspend or terminate accounts found to be abusing the referral program. This includes creating fake accounts or sharing codes publicly.")

                        Text("6. Program Changes")
                            .font(.headline)
                            .padding(.top)

                        Text("MenuMaker reserves the right to modify or terminate the referral program at any time without prior notice. Any changes will be reflected in these terms.")
                    }
                    .font(.subheadline)
                }
                .padding()
            }
            .navigationTitle("Terms & Conditions")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}

struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

#Preview {
    ReferralView()
}
