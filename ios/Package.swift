// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MenuMaker",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "MenuMaker", targets: ["MenuMaker"]),
        .library(name: "MenuMakerCustomer", targets: ["MenuMakerCustomer"])
    ],
    dependencies: [],
    targets: [
        .target(name: "MenuMaker", dependencies: []),
        .target(name: "MenuMakerCustomer", dependencies: ["MenuMaker"]),
        .testTarget(name: "MenuMakerTests", dependencies: ["MenuMaker"])
    ]
)
