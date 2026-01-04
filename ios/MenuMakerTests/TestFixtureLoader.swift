import Foundation

enum TestFixtureLoader {
    private static let basePath = URL(fileURLWithPath: #file)
        .deletingLastPathComponent() // MenuMakerTests
        .deletingLastPathComponent() // MenuMakerTests folder
        .deletingLastPathComponent() // ios
        .appendingPathComponent("shared/mocks")

    static func load<T: Decodable>(_ pathComponents: [String], as type: T.Type) throws -> T {
        let fileURL = pathComponents.reduce(basePath) { partial, component in
            partial.appendingPathComponent(component)
        }

        let data = try Data(contentsOf: fileURL)
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try decoder.decode(T.self, from: data)
    }
}
