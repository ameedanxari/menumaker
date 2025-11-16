import Foundation
import Combine

/// Payment repository
@MainActor
class PaymentRepository: ObservableObject {
    static let shared = PaymentRepository()

    private let apiClient = APIClient.shared

    @Published var paymentProcessors: [PaymentProcessor] = []
    @Published var payouts: [Payout] = []
    @Published var payoutSchedule: PayoutSchedule?

    private init() {}

    // MARK: - Payment Processors

    func getPaymentProcessors(_ businessId: String) async throws -> [PaymentProcessor] {
        let response: PaymentProcessorListResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.paymentProcessors + "?business_id=\(businessId)",
            method: .get
        )

        paymentProcessors = response.data.processors
        return response.data.processors
    }

    func connectPaymentProcessor(provider: PaymentProvider, accountId: String?) async throws -> (processor: PaymentProcessor, authUrl: String?) {
        let request: [String: String] = [
            "provider": provider.rawValue,
            "account_id": accountId ?? ""
        ]

        let response: PaymentProcessorResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.paymentProcessors + "/connect",
            method: .post,
            body: request
        )

        // Update local cache
        paymentProcessors.append(response.data.processor)

        return (response.data.processor, response.data.authorizationUrl)
    }

    func disconnectPaymentProcessor(_ processorId: String) async throws {
        let _: EmptyResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.paymentProcessors + "/\(processorId)",
            method: .delete
        )

        // Update local cache
        paymentProcessors.removeAll { $0.id == processorId }
    }

    // MARK: - Payouts

    func getPayouts(_ businessId: String) async throws -> (payouts: [Payout], schedule: PayoutSchedule?) {
        let response: PayoutListResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.payments + "/payouts?business_id=\(businessId)",
            method: .get
        )

        payouts = response.data.payouts
        payoutSchedule = response.data.schedule

        return (response.data.payouts, response.data.schedule)
    }

    func updatePayoutSchedule(
        frequency: PayoutFrequency,
        minimumThresholdCents: Int,
        autoPayoutEnabled: Bool
    ) async throws -> PayoutSchedule {
        struct PayoutScheduleRequest: Encodable {
            let frequency: String
            let minimum_threshold_cents: Int
            let auto_payout_enabled: Bool
        }

        let request = PayoutScheduleRequest(
            frequency: frequency.rawValue,
            minimum_threshold_cents: minimumThresholdCents,
            auto_payout_enabled: autoPayoutEnabled
        )

        let response: PayoutListResponse = try await apiClient.request(
            endpoint: AppConstants.API.Endpoints.payments + "/payouts/schedule",
            method: .post,
            body: request
        )

        payoutSchedule = response.data.schedule

        return response.data.schedule!
    }

    // MARK: - Helpers

    func hasActiveProcessor(provider: PaymentProvider) -> Bool {
        paymentProcessors.contains { $0.provider == provider.rawValue && $0.isActive }
    }

    func getActiveProcessors() -> [PaymentProcessor] {
        paymentProcessors.filter { $0.isActive }
    }

    func getPendingPayouts() -> [Payout] {
        payouts.filter { $0.statusType == .pending }
    }

    func getTotalPendingAmount() -> Double {
        getPendingPayouts().reduce(0) { $0 + $1.amount }
    }
}
