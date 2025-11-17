import SwiftUI

struct ReferralView: View {
    @StateObject private var viewModel = ReferralViewModel()
    @State private var showingShareSheet = false

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

                        // Stats Cards
                        statsSection

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
