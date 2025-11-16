import Foundation
import Combine

/// Payment management view model
@MainActor
class PaymentViewModel: ObservableObject {
    @Published var paymentProcessors: [PaymentProcessor] = []
    @Published var payouts: [Payout] = []
    @Published var payoutSchedule: PayoutSchedule?
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let repository = PaymentRepository.shared
    private let analyticsService = AnalyticsService.shared

    init() {
        Task {
            await loadPaymentData()
        }
    }

    // MARK: - Data Loading

    func loadPaymentData() async {
        guard let businessId = try? await KeychainManager.shared.getBusinessId() else {
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            async let processorsTask = repository.getPaymentProcessors(businessId)
            async let payoutsTask = repository.getPayouts(businessId)

            paymentProcessors = try await processorsTask
            let (payouts, schedule) = try await payoutsTask
            self.payouts = payouts
            self.payoutSchedule = schedule

            analyticsService.trackScreen("Payment Processors")

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func refreshData() async {
        await loadPaymentData()
    }

    // MARK: - Payment Processor Management

    func connectPaymentProcessor(_ provider: PaymentProvider, accountId: String?) async {
        isLoading = true
        errorMessage = nil

        do {
            let (processor, authUrl) = try await repository.connectPaymentProcessor(
                provider: provider,
                accountId: accountId
            )

            paymentProcessors.append(processor)

            // Handle authorization URL if present
            if let authUrl = authUrl {
                // Open authorization URL
                print("Authorization URL: \(authUrl)")
            }

            analyticsService.track(.paymentProcessorConnected, parameters: [
                "provider": provider.rawValue
            ])

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func disconnectPaymentProcessor(_ processorId: String) async {
        isLoading = true

        do {
            try await repository.disconnectPaymentProcessor(processorId)

            paymentProcessors.removeAll { $0.id == processorId }

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    // MARK: - Payout Management

    func updatePayoutSchedule(
        frequency: PayoutFrequency,
        minimumThreshold: Double,
        autoPayoutEnabled: Bool
    ) async {
        isLoading = true
        errorMessage = nil

        do {
            let schedule = try await repository.updatePayoutSchedule(
                frequency: frequency,
                minimumThresholdCents: Int(minimumThreshold * 100),
                autoPayoutEnabled: autoPayoutEnabled
            )

            payoutSchedule = schedule

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    // MARK: - Helper Methods

    func hasProcessor(_ provider: PaymentProvider) -> Bool {
        repository.hasActiveProcessor(provider: provider)
    }

    func getActiveProcessors() -> [PaymentProcessor] {
        repository.getActiveProcessors()
    }

    func getPendingPayouts() -> [Payout] {
        repository.getPendingPayouts()
    }

    func getTotalPendingAmount() -> Double {
        repository.getTotalPendingAmount()
    }

    func getFormattedTotalPending() -> String {
        String(format: "₹%.2f", getTotalPendingAmount())
    }

    // MARK: - Statistics

    func getTotalPayouts() -> Double {
        payouts.reduce(0) { $0 + $1.amount }
    }

    func getFormattedTotalPayouts() -> String {
        String(format: "₹%.2f", getTotalPayouts())
    }

    func getCompletedPayouts() -> [Payout] {
        payouts.filter { $0.statusType == .completed }
    }

    // MARK: - Error Handling

    func clearError() {
        errorMessage = nil
    }
}
