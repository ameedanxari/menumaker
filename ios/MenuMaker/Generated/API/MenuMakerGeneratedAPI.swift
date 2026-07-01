// AUTO-GENERATED from openapi/menumaker.v1.yaml. DO NOT EDIT BY HAND.
import Foundation

public enum MenuMakerAPIContract {
    public static let specVersion = "1.0.0"
    public static let operationCount = 40
    public static let basePath = "/api/v1"
}

public struct GeneratedAPIErrorEnvelope: Codable, Equatable {
    public let error: GeneratedAPIError
}

public struct GeneratedAPIError: Codable, Equatable {
    public let code: String
    public let message: String
    public let requestId: String
    public let details: [String: String]?

    enum CodingKeys: String, CodingKey {
        case code
        case message
        case requestId = "request_id"
        case details
    }
}

public struct GeneratedPagination: Codable, Equatable {
    public let limit: Int
    public let cursor: String?
    public let nextCursor: String?
    public let hasMore: Bool

    enum CodingKeys: String, CodingKey {
        case limit
        case cursor
        case nextCursor = "next_cursor"
        case hasMore = "has_more"
    }
}

public enum GeneratedOrderStatus: String, Codable, CaseIterable {
    case draft
    case pending
    case accepted
    case preparing
    case ready
    case outForDelivery = "out_for_delivery"
    case completed
    case cancelled
    case refunded
}

public protocol MenuMakerAPITransport {
    func send<RequestBody: Encodable, ResponseBody: Decodable>(
        operationId: String,
        path: String,
        method: String,
        idempotencyKey: String?,
        body: RequestBody?
    ) async throws -> ResponseBody
}
