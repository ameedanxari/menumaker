// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MenuMakerCore",
    platforms: [
        .iOS(.v17)
    ],
    products: [
        .library(name: "MenuMakerCore", targets: ["MenuMakerCore"])
    ],
    targets: [
        .target(
            name: "MenuMakerCore",
            path: "MenuMaker",
            exclude: [
                "App",
                "Assets.xcassets",
                "Generated/DesignTokens/asset-colors.json",
                "Info.plist",
                "Resources"
            ]
        ),
        .testTarget(
            name: "MenuMakerCoreTests",
            dependencies: ["MenuMakerCore"],
            path: "MenuMakerTests",
            exclude: [
                "TestFixtureLoader.swift"
            ]
        )
    ]
)
