import SwiftUI

struct PaymentProcessorsView: View {
    @StateObject private var viewModel = PaymentViewModel()
    @State private var showConnectProcessor = false

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Connected Processors
                Section {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Connected Processors")
                            .font(.headline)

                        if viewModel.paymentProcessors.isEmpty {
                            EmptyState(
                                icon: "creditcard",
                                title: "No Processors",
                                message: "Connect a payment processor to start accepting payments"
                            )
                        } else {
                            ForEach(viewModel.paymentProcessors) { processor in
                                ProcessorCard(processor: processor, viewModel: viewModel)
                            }
                        }
                    }
                }

                // Payouts Section
                Section {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Payouts")
                            .font(.headline)

                        if let schedule = viewModel.payoutSchedule {
                            PayoutScheduleCard(schedule: schedule)
                        }

                        // Recent Payouts
                        ForEach(viewModel.payouts.prefix(5)) { payout in
                            PayoutRow(payout: payout)
                        }
                    }
                }

                // Pending Amount
                if viewModel.getTotalPendingAmount() > 0 {
                    VStack(spacing: 8) {
                        Text("Pending Payout")
                            .font(.caption)
                            .foregroundColor(.theme.textSecondary)

                        Text(viewModel.getFormattedTotalPending())
                            .font(.title)
                            .fontWeight(.bold)
                            .foregroundColor(.theme.primary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.theme.surface)
                    .cornerRadius(AppConstants.UI.cornerRadius)
                }
            }
            .padding()
        }
        .background(Color.theme.background)
        .navigationTitle("Payment Processors")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: { showConnectProcessor = true }) {
                    Image(systemName: "plus.circle.fill")
                }
            }
        }
        .sheet(isPresented: $showConnectProcessor) {
            ConnectProcessorView(viewModel: viewModel)
        }
        .refreshable {
            await viewModel.refreshData()
        }
    }
}

struct ProcessorCard: View {
    let processor: PaymentProcessor
    @ObservedObject var viewModel: PaymentViewModel

    var body: some View {
        HStack {
            Image(systemName: processor.icon)
                .font(.title2)
                .foregroundColor(.theme.primary)

            VStack(alignment: .leading, spacing: 4) {
                Text(processor.displayName)
                    .font(.headline)

                if let accountId = processor.accountId {
                    Text("Account: \(accountId)")
                        .font(.caption)
                        .foregroundColor(.theme.textSecondary)
                }
            }

            Spacer()

            Badge(text: processor.isActive ? "Active" : "Inactive",
                  color: processor.isActive ? .green : .gray)
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(AppConstants.UI.cornerRadius)
    }
}

struct PayoutScheduleCard: View {
    let schedule: PayoutSchedule

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Payout Schedule")
                .font(.subheadline)
                .fontWeight(.semibold)

            DetailRow(label: "Frequency", value: schedule.frequencyType.displayName)
            DetailRow(label: "Minimum Threshold", value: schedule.formattedMinimumThreshold)
            DetailRow(label: "Auto Payout", value: schedule.autoPayoutEnabled ? "Enabled" : "Disabled")
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(AppConstants.UI.cornerRadius)
    }
}

struct PayoutRow: View {
    let payout: Payout

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(payout.formattedAmount)
                    .font(.subheadline)
                    .fontWeight(.semibold)

                if let date = payout.formattedScheduledDate {
                    Text("Scheduled: \(date)")
                        .font(.caption)
                        .foregroundColor(.theme.textSecondary)
                }
            }

            Spacer()

            Badge(text: payout.statusType.displayName,
                  color: payout.statusType == .completed ? .green : .orange)
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(AppConstants.UI.smallCornerRadius)
    }
}

struct ConnectProcessorView: View {
    @ObservedObject var viewModel: PaymentViewModel
    @Environment(\.dismiss) var dismiss
    @State private var selectedProvider: PaymentProvider = .razorpay
    @State private var accountId = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Select Provider") {
                    Picker("Provider", selection: $selectedProvider) {
                        ForEach(PaymentProvider.allCases, id: \.self) { provider in
                            Text(provider.displayName).tag(provider)
                        }
                    }
                }

                Section("Account Details") {
                    TextField("Account ID (Optional)", text: $accountId)
                }
            }
            .navigationTitle("Connect Processor")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") { dismiss() }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Connect") {
                        Task {
                            await connectProcessor()
                        }
                    }
                }
            }
        }
    }

    private func connectProcessor() async {
        await viewModel.connectPaymentProcessor(
            selectedProvider,
            accountId: accountId.isEmpty ? nil : accountId
        )
        dismiss()
    }
}

#Preview {
    NavigationStack {
        PaymentProcessorsView()
    }
}
