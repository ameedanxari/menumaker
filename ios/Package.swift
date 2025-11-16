// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MenuMaker",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "MenuMaker", targets: ["MenuMaker"])
    ],
    dependencies: [],
    targets: [
        .target(name: "MenuMaker", dependencies: []),
        .testTarget(name: "MenuMakerTests", dependencies: ["MenuMaker"])
    ]
)
