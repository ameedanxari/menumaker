import Foundation
import Testing
@testable import MenuMaker

@MainActor
struct APITransportTests {
    @Test("URLSession transport sends method, path, JSON body, headers, and request ID")
    func requestBuildsExpectedHTTPBoundary() async throws {
        URLProtocolStub.reset()
        var logLines: [String] = []

        URLProtocolStub.handler = { request in
            #expect(request.httpMethod == "POST")
            #expect(request.url?.absoluteString == "https://api.example.test/api/v1/dishes")
            #expect(request.value(forHTTPHeaderField: "Accept") == "application/json")
            #expect(request.value(forHTTPHeaderField: "Content-Type") == "application/json")
            #expect(request.value(forHTTPHeaderField: "X-Test-Scope") == "transport")
            #expect(request.value(forHTTPHeaderField: "X-Request-ID")?.isEmpty == false)
            #expect(request.value(forHTTPHeaderField: "Authorization") == nil)

            let body = try requestBodyData(from: request)
            let json = try #require(JSONSerialization.jsonObject(with: body) as? [String: Any])
            #expect(json["display_name"] as? String == "Masala Dosa")

            return (
                HTTPURLResponse(
                    url: try #require(request.url),
                    statusCode: 200,
                    httpVersion: nil,
                    headerFields: ["Content-Type": "application/json"]
                )!,
                Data(#"{"success":true,"data":{"id":"dish-1","display_name":"Masala Dosa"}}"#.utf8)
            )
        }

        let transport = makeTransport(logger: { logLines.append($0) })
        let payload: DishPayload = try await transport.request(
            endpoint: "/api/v1/dishes",
            method: .post,
            body: CreateDishPayload(displayName: "Masala Dosa"),
            headers: ["X-Test-Scope": "transport"],
            requiresAuth: false
        )

        #expect(payload == DishPayload(id: "dish-1", displayName: "Masala Dosa"))
        #expect(logLines.contains { $0.contains("ios_transport_request") && $0.contains("method=POST") && $0.contains("path=/api/v1/dishes") })
        #expect(!logLines.joined(separator: "\n").contains("Bearer "))
    }

    @Test("URLSession transport decodes server errors without fixture routing")
    func requestSurfacesTypedServerError() async throws {
        URLProtocolStub.reset()
        URLProtocolStub.handler = { request in
            (
                HTTPURLResponse(
                    url: try #require(request.url),
                    statusCode: 422,
                    httpVersion: nil,
                    headerFields: ["Content-Type": "application/json"]
                )!,
                Data(#"{"message":"dish name is required"}"#.utf8)
            )
        }

        let transport = makeTransport()

        do {
            let _: DishPayload = try await transport.request(
                endpoint: "/api/v1/dishes",
                method: .post,
                body: CreateDishPayload(displayName: ""),
                headers: nil,
                requiresAuth: false
            )
            Issue.record("Expected a typed server error")
        } catch let error as APIError {
            #expect(error == .serverError("dish name is required"))
        }
    }

    @Test("URLSession transport rejects disabled capability routes before network dispatch")
    func requestRejectsDisabledCapabilityRoutesBeforeNetworkDispatch() async throws {
        URLProtocolStub.reset()
        var didDispatch = false
        URLProtocolStub.handler = { request in
            didDispatch = true
            return (
                HTTPURLResponse(url: try #require(request.url), statusCode: 200, httpVersion: nil, headerFields: nil)!,
                Data(#"{"success":true,"data":{"id":"unexpected","display_name":"Unexpected"}}"#.utf8)
            )
        }

        let transport = makeTransport()

        for endpoint in [
            "/api/v1/pos/sync",
            "/api/v1/delivery/providers",
            "/api/v1/subscriptions/current",
            "/referrals/share/instagram",
            "/API/v1/OCR/extract-from-text",
            "https://api.example.test/Api/V1/Tax/invoices/order-1"
        ] {
            do {
                let _: DishPayload = try await transport.request(
                    endpoint: endpoint,
                    method: .get,
                    body: nil,
                    headers: nil,
                    requiresAuth: false
                )
                Issue.record("Expected disabled capability route to fail before network dispatch")
            } catch let error as APIError {
                #expect(error.localizedDescription.contains("FEATURE_UNAVAILABLE"))
            }
        }

        #expect(!didDispatch)
    }

    @Test("URLSession transport rejects decoded relative disabled-route path segments before network dispatch")
    func requestRejectsDecodedRelativeCapabilityPathSegmentsBeforeNetworkDispatch() async throws {
        URLProtocolStub.reset()
        var didDispatch = false
        URLProtocolStub.handler = { request in
            didDispatch = true
            return (
                HTTPURLResponse(url: try #require(request.url), statusCode: 200, httpVersion: nil, headerFields: nil)!,
                Data(#"{"success":true,"data":{"id":"unexpected","display_name":"Unexpected"}}"#.utf8)
            )
        }

        let transport = makeTransport()

        for endpoint in ["/api/v1/%2e%2e/subscriptions/current", "/ocr/%2e/extract-from-text"] {
            do {
                let _: DishPayload = try await transport.request(
                    endpoint: endpoint,
                    method: .get,
                    body: nil,
                    headers: nil,
                    requiresAuth: false
                )
                Issue.record("Expected decoded relative route segment to fail before network dispatch")
            } catch let error as APIError {
                #expect(error.localizedDescription.contains("API route path must not include relative path segments"))
            }
        }

        #expect(!didDispatch)
    }

    @Test("URLSession transport rejects encoded unsafe endpoint paths before network dispatch")
    func requestRejectsEncodedUnsafeEndpointPathsBeforeNetworkDispatch() async throws {
        URLProtocolStub.reset()
        var didDispatch = false
        URLProtocolStub.handler = { request in
            didDispatch = true
            return (
                HTTPURLResponse(url: try #require(request.url), statusCode: 200, httpVersion: nil, headerFields: nil)!,
                Data(#"{"success":true,"data":{"id":"unexpected","display_name":"Unexpected"}}"#.utf8)
            )
        }

        let transport = makeTransport()

        for endpoint in ["/subscriptions%E2%80%8D/current", "/api/v1/tax/invoices%EF%BB%BF/order-1"] {
            do {
                let _: DishPayload = try await transport.request(
                    endpoint: endpoint,
                    method: .get,
                    body: nil,
                    headers: nil,
                    requiresAuth: false
                )
                Issue.record("Expected encoded unsafe endpoint path to fail before network dispatch")
            } catch let error as APIError {
                #expect(error.localizedDescription.contains("API route path contains unsafe control characters"))
            }
        }

        do {
            let _: DishPayload = try await transport.request(
                endpoint: "/subscriptions%E2%80%ZZ/current",
                method: .get,
                body: nil,
                headers: nil,
                requiresAuth: false
            )
            Issue.record("Expected malformed percent-encoded endpoint path to fail before network dispatch")
        } catch let error as APIError {
            #expect(error.localizedDescription.contains("API route URL path must be valid percent-encoding"))
        }

        #expect(!didDispatch)
    }

    @Test("URLSession transport sends multipart image uploads through the same boundary")
    func uploadImageBuildsMultipartRequest() async throws {
        URLProtocolStub.reset()
        let imageData = Data([0xFF, 0xD8, 0xFF, 0xD9])

        URLProtocolStub.handler = { request in
            #expect(request.httpMethod == "POST")
            #expect(request.url?.path == "/api/v1/media")
            #expect(request.value(forHTTPHeaderField: "Content-Type")?.contains("multipart/form-data; boundary=") == true)
            #expect(request.value(forHTTPHeaderField: "X-Request-ID")?.isEmpty == false)
            #expect(request.value(forHTTPHeaderField: "Authorization") == nil)

            let body = try requestBodyData(from: request)
            #expect(body.contains(Data("name=\"image\"; filename=\"dish.jpg\"".utf8)))
            #expect(body.contains(Data("Content-Type: image/jpeg".utf8)))

            return (
                HTTPURLResponse(url: try #require(request.url), statusCode: 201, httpVersion: nil, headerFields: nil)!,
                Data(#"{"url":"https://cdn.example.test/dish.jpg"}"#.utf8)
            )
        }

        let response = try await makeTransport().uploadImage(
            endpoint: "/api/v1/media",
            image: imageData,
            fileName: " dish.jpg ",
            mimeType: " image/jpeg ",
            requiresAuth: false
        )

        #expect(String(data: response, encoding: .utf8)?.contains("dish.jpg") == true)
    }

    @Test("URLSession transport rejects unsafe multipart upload metadata before network dispatch")
    func uploadImageRejectsUnsafeMultipartMetadataBeforeNetworkDispatch() async throws {
        URLProtocolStub.reset()
        var didDispatch = false
        URLProtocolStub.handler = { request in
            didDispatch = true
            return (
                HTTPURLResponse(url: try #require(request.url), statusCode: 200, httpVersion: nil, headerFields: nil)!,
                Data(#"{"url":"https://cdn.example.test/unexpected.jpg"}"#.utf8)
            )
        }

        let transport = makeTransport()
        let imageData = Data([0xFF, 0xD8, 0xFF, 0xD9])

        do {
            _ = try await transport.uploadImage(
                endpoint: "/api/v1/media",
                image: imageData,
                fileName: "dish\u{202E}.jpg",
                mimeType: "image/jpeg",
                requiresAuth: false
            )
            Issue.record("Expected unsafe upload file name controls to fail before network dispatch")
        } catch let error as APIError {
            #expect(error.localizedDescription.contains("Upload file name contains unsafe control characters"))
        }

        do {
            _ = try await transport.uploadImage(
                endpoint: "/api/v1/media",
                image: imageData,
                fileName: #"dish"; name="other.jpg"#,
                mimeType: "image/jpeg",
                requiresAuth: false
            )
            Issue.record("Expected unsafe upload file name multipart characters to fail before network dispatch")
        } catch let error as APIError {
            #expect(error.localizedDescription.contains("Upload file name contains unsafe multipart characters"))
        }

        do {
            _ = try await transport.uploadImage(
                endpoint: "/api/v1/media",
                image: imageData,
                fileName: "dish.jpg",
                mimeType: "image/jpeg\r\nX-Injected: 1",
                requiresAuth: false
            )
            Issue.record("Expected unsafe MIME type controls to fail before network dispatch")
        } catch let error as APIError {
            #expect(error.localizedDescription.contains("Upload MIME type contains unsafe control characters"))
        }

        do {
            _ = try await transport.uploadImage(
                endpoint: "/api/v1/media",
                image: imageData,
                fileName: "dish.jpg",
                mimeType: "   ",
                requiresAuth: false
            )
            Issue.record("Expected blank MIME type to fail before network dispatch")
        } catch let error as APIError {
            #expect(error.localizedDescription.contains("Upload MIME type is required"))
        }

        #expect(!didDispatch)
    }

    @Test("URLSession transport rejects disabled multipart upload endpoints before network dispatch")
    func uploadImageRejectsDisabledCapabilityRoutesBeforeNetworkDispatch() async throws {
        URLProtocolStub.reset()
        var didDispatch = false
        URLProtocolStub.handler = { request in
            didDispatch = true
            return (
                HTTPURLResponse(url: try #require(request.url), statusCode: 200, httpVersion: nil, headerFields: nil)!,
                Data(#"{"url":"https://cdn.example.test/unexpected.jpg"}"#.utf8)
            )
        }

        do {
            _ = try await makeTransport().uploadImage(
                endpoint: "/ocr/upload",
                image: Data([0xFF, 0xD8, 0xFF, 0xD9]),
                fileName: "menu.jpg",
                mimeType: "image/jpeg",
                requiresAuth: false
            )
            Issue.record("Expected disabled multipart endpoint to fail before network dispatch")
        } catch let error as APIError {
            #expect(error.localizedDescription.contains("FEATURE_UNAVAILABLE"))
            #expect(error.localizedDescription.contains("ocr_import"))
        }

        #expect(!didDispatch)
    }

    private func makeTransport(logger: @escaping (String) -> Void = { _ in }) -> URLSessionMenuMakerTransport {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [URLProtocolStub.self]
        let session = URLSession(configuration: configuration)
        return URLSessionMenuMakerTransport(
            session: session,
            baseURLProvider: { "https://api.example.test" },
            logger: logger
        )
    }
}

private struct CreateDishPayload: Encodable {
    let displayName: String
}

private struct DishPayload: Decodable, Equatable {
    let id: String
    let displayName: String
}

private func requestBodyData(from request: URLRequest) throws -> Data {
    if let body = request.httpBody {
        return body
    }

    guard let stream = request.httpBodyStream else {
        Issue.record("Expected request body")
        return Data()
    }

    stream.open()
    defer { stream.close() }

    var data = Data()
    let bufferSize = 1024
    let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: bufferSize)
    defer { buffer.deallocate() }

    while stream.hasBytesAvailable {
        let count = stream.read(buffer, maxLength: bufferSize)
        if count < 0 {
            throw stream.streamError ?? APIError.invalidResponse
        }
        if count == 0 {
            break
        }
        data.append(buffer, count: count)
    }

    return data
}

private extension Data {
    func contains(_ needle: Data) -> Bool {
        guard !needle.isEmpty, count >= needle.count else {
            return false
        }

        return withUnsafeBytes { haystackBuffer in
            needle.withUnsafeBytes { needleBuffer in
                guard let haystackBase = haystackBuffer.bindMemory(to: UInt8.self).baseAddress,
                      let needleBase = needleBuffer.bindMemory(to: UInt8.self).baseAddress else {
                    return false
                }

                for offset in 0...(count - needle.count) {
                    if memcmp(haystackBase.advanced(by: offset), needleBase, needle.count) == 0 {
                        return true
                    }
                }

                return false
            }
        }
    }
}

private final class URLProtocolStub: URLProtocol {
    nonisolated(unsafe) static var handler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

    static func reset() {
        handler = nil
    }

    override class func canInit(with request: URLRequest) -> Bool {
        true
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override func startLoading() {
        guard let handler = Self.handler else {
            client?.urlProtocol(self, didFailWithError: APIError.invalidResponse)
            return
        }

        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}
