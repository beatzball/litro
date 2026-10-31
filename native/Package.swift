// swift-tools-version:6.0

import PackageDescription

// The shell's testable halves.
//
//   LitroBridge    the wire protocol: envelope, dispatch, handshake.
//   LitroShellKit  the per-app configuration and the origin policy.
//
// Both are pure Foundation, so `swift test` runs them on any Mac with no
// simulator and no Xcode project. Everything that needs UIKit or WebKit lives
// in ../App, which only the Xcode project compiles — that split is what lets
// every rule here have a real test.
//
// There is no package dependency, and there must not be one. The bar in
// design/specs/2026-10-25-litro-native-ios-shell.md is that the shell carries no
// third-party dependency at build time or at run time.
let package = Package(
    name: "LitroShell",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "LitroBridge", targets: ["LitroBridge"]),
        .library(name: "LitroShellKit", targets: ["LitroShellKit"]),
    ],
    targets: [
        .target(name: "LitroBridge"),
        .target(name: "LitroShellKit", dependencies: ["LitroBridge"]),
        .testTarget(name: "LitroBridgeTests", dependencies: ["LitroBridge"]),
        .testTarget(name: "LitroShellKitTests", dependencies: ["LitroShellKit"]),
    ]
)
