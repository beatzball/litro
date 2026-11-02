//  The per-app configuration, and the origin policy that keeps the shell from
//  becoming a general-purpose browser.

import XCTest
@testable import LitroShellKit
import LitroBridge

private func configuration(
    allowedOrigins: [String] = ["https://app.example.test"],
    capabilities: [Capability] = [.haptics, .badging]
) -> AppConfiguration {
    AppConfiguration(
        name: "Demo",
        bundleIdentifier: "test.demo",
        startURL: URL(string: "https://app.example.test/")!,
        allowedOrigins: allowedOrigins,
        capabilities: capabilities
    )
}

final class AppConfigurationDecodingTests: XCTestCase {
    func testDecodesAWholeConfiguration() throws {
        let json = Data("""
        {
          "name": "Demo",
          "bundleIdentifier": "test.demo",
          "startURL": "https://app.example.test/",
          "allowedOrigins": ["https://app.example.test"],
          "capabilities": ["haptics", "badging"]
        }
        """.utf8)
        let decoded = try JSONDecoder().decode(AppConfiguration.self, from: json)
        XCTAssertEqual(decoded, configuration())
    }

    func testAnEmptyCapabilityListIsLegal() throws {
        let json = Data("""
        {
          "name": "Demo",
          "bundleIdentifier": "test.demo",
          "startURL": "https://app.example.test/",
          "allowedOrigins": [],
          "capabilities": []
        }
        """.utf8)
        let decoded = try JSONDecoder().decode(AppConfiguration.self, from: json)
        XCTAssertEqual(decoded.capabilities, [])
    }

    /// A capability name the shell does not know is a typo in the app's config,
    /// and must stop the build rather than silently turn a module off.
    func testRefusesAnUnknownCapabilityName() {
        let json = Data("""
        {
          "name": "Demo",
          "bundleIdentifier": "test.demo",
          "startURL": "https://app.example.test/",
          "allowedOrigins": [],
          "capabilities": ["haptics", "camera"]
        }
        """.utf8)
        XCTAssertThrowsError(try JSONDecoder().decode(AppConfiguration.self, from: json))
    }

    func testRefusesAMissingField() {
        let json = Data("""
        { "name": "Demo", "bundleIdentifier": "test.demo", "capabilities": [] }
        """.utf8)
        XCTAssertThrowsError(try JSONDecoder().decode(AppConfiguration.self, from: json))
    }

    /// A missing config must throw, not fall back to a built-in start URL. A
    /// shell that quietly booted a default when the copy step was skipped would
    /// look like it worked, and the mistake would surface as the wrong app
    /// shipping.
    func testLoadingFromABundleWithNoConfigThrows() {
        XCTAssertThrowsError(try AppConfiguration.load(from: Bundle(for: Self.self), named: "no-such-config")) { error in
            guard case .missing = error as? AppConfigurationError else {
                return XCTFail("expected a missing-file error, got \(error)")
            }
        }
    }

    /// The error has to say what to do, because the person reading it is looking
    /// at a shell that launched and then stopped.
    func testTheMissingConfigErrorNamesTheSelectionScript() {
        let text = String(describing: AppConfigurationError.missing("app.json"))
        XCTAssertTrue(text.contains("select-app.sh"), text)
        XCTAssertTrue(text.contains("app.json"), text)
    }
}

final class OriginPolicyTests: XCTestCase {
    func testAllowsAnExactOrigin() {
        XCTAssertTrue(configuration().allows(URL(string: "https://app.example.test/")!))
        XCTAssertTrue(configuration().allows(URL(string: "https://app.example.test/deep/path?q=1")!))
    }

    /// Host comparison is case-insensitive, because DNS is.
    func testIgnoresCaseInTheSchemeAndHost() {
        XCTAssertTrue(configuration().allows(URL(string: "HTTPS://APP.EXAMPLE.TEST/")!))
    }

    /// The reason the policy compares whole origins rather than string prefixes.
    /// A prefix match lets this through an allowlist naming app.example.test.
    func testRefusesAHostThatMerelyStartsWithAnAllowedOne() {
        XCTAssertFalse(configuration().allows(URL(string: "https://app.example.test.attacker.invalid/")!))
    }

    func testRefusesADifferentSchemeHostOrPort() {
        let config = configuration()
        XCTAssertFalse(config.allows(URL(string: "http://app.example.test/")!))
        XCTAssertFalse(config.allows(URL(string: "https://other.example.test/")!))
        XCTAssertFalse(config.allows(URL(string: "https://app.example.test:8443/")!))
    }

    /// An explicit default port is the same origin as none at all, or a config
    /// written one way would refuse a redirect written the other.
    func testTreatsAnExplicitDefaultPortAsTheDefault() {
        XCTAssertTrue(configuration().allows(URL(string: "https://app.example.test:443/")!))
        XCTAssertTrue(configuration(allowedOrigins: ["https://app.example.test:443"])
            .allows(URL(string: "https://app.example.test/")!))
    }

    func testRefusesAUrlWithNoHost() {
        XCTAssertFalse(configuration().allows(URL(string: "about:blank")!))
        XCTAssertFalse(configuration().allows(URL(string: "file:///etc/passwd")!))
        XCTAssertFalse(configuration().allows(URL(string: "javascript:alert(1)")!))
    }

    /// An empty allowlist allows nothing. The failure of a misconfigured app
    /// must be "loads nothing", not "loads anything".
    func testAnEmptyAllowlistAllowsNothing() {
        XCTAssertFalse(configuration(allowedOrigins: []).allows(URL(string: "https://app.example.test/")!))
    }

    /// A malformed entry is ignored rather than crashing or matching everything.
    func testIgnoresAMalformedAllowlistEntry() {
        let config = configuration(allowedOrigins: ["not a url", "https://app.example.test"])
        XCTAssertTrue(config.allows(URL(string: "https://app.example.test/")!))
        XCTAssertFalse(config.allows(URL(string: "https://other.example.test/")!))
    }

    /// The app's own start URL must pass its own allowlist. A config that fails
    /// this boots to a blank screen.
    func testTheStartUrlIsItselfAllowed() {
        let config = configuration()
        XCTAssertTrue(config.allows(config.startURL))
    }
}

/// The bridge's own gate, which is not the navigation allowlist.
///
/// The navigation allowlist authorizes a frame's request URL. This authorizes
/// the origin the frame ended up running as, and the two differ exactly where
/// it matters: a sandboxed frame loads an allowed path and then has an opaque
/// origin.
final class BridgeOriginTests: XCTestCase {
    func testAllowsTheAppsOwnOrigin() {
        let config = configuration(allowedOrigins: ["https://app.example.test"])
        XCTAssertTrue(config.allowsBridgeOrigin(scheme: "https", host: "app.example.test", port: 0))
    }

    /// WebKit reports 0 for a default port, and the allowlist entry has no port
    /// written in it either. Both have to resolve to the same number.
    func testADefaultPortMatchesAnEntryWithNoPort() {
        let config = configuration(allowedOrigins: ["http://app.example.test"])
        XCTAssertTrue(config.allowsBridgeOrigin(scheme: "http", host: "app.example.test", port: 0))
        XCTAssertTrue(config.allowsBridgeOrigin(scheme: "http", host: "app.example.test", port: 80))
    }

    /// An opaque origin -- what a `sandbox` or `srcdoc` frame runs as -- has an
    /// empty scheme and host. It belongs to nothing and must match nothing.
    func testRefusesAnOpaqueOrigin() {
        let config = configuration(allowedOrigins: ["https://app.example.test"])
        XCTAssertFalse(config.allowsBridgeOrigin(scheme: "", host: "", port: 0))
        XCTAssertFalse(config.allowsBridgeOrigin(scheme: "", host: "app.example.test", port: 0))
        XCTAssertFalse(config.allowsBridgeOrigin(scheme: "https", host: "", port: 0))
    }

    /// An empty allowlist must not become an allow-all through some empty-set
    /// comparison going the wrong way.
    func testAnEmptyAllowlistAllowsNothing() {
        let config = configuration(allowedOrigins: [])
        XCTAssertFalse(config.allowsBridgeOrigin(scheme: "https", host: "app.example.test", port: 0))
        XCTAssertFalse(config.allowsBridgeOrigin(scheme: "", host: "", port: 0))
    }

    func testRefusesAnotherOrigin() {
        let config = configuration(allowedOrigins: ["https://app.example.test"])
        XCTAssertFalse(config.allowsBridgeOrigin(scheme: "https", host: "evil.example.test", port: 0),
                       "another host")
        XCTAssertFalse(config.allowsBridgeOrigin(scheme: "http", host: "app.example.test", port: 0),
                       "another scheme")
        XCTAssertFalse(config.allowsBridgeOrigin(scheme: "https", host: "app.example.test", port: 8443),
                       "another port")
        XCTAssertFalse(config.allowsBridgeOrigin(scheme: "https", host: "app.example.test.evil.test", port: 0),
                       "a suffix, which a prefix match would have let through")
    }

    /// WebKit reports the origin as the page set it; DNS does not care about
    /// case and neither may this.
    func testTheComparisonIgnoresCase() {
        let config = configuration(allowedOrigins: ["https://app.example.test"])
        XCTAssertTrue(config.allowsBridgeOrigin(scheme: "HTTPS", host: "App.Example.TEST", port: 0))
    }
}

/// A configuration whose own start URL its allowlist refuses boots to a blank
/// screen: the first navigation is canceled by the origin policy, and a cancel
/// is deliberately not a load failure (NATIVE-012). So `load` refuses it, and
/// the app shows the startup failure screen with the reason instead.
final class AppConfigurationValidationTests: XCTestCase {
    /// Writes `json` as app.json in a fresh directory and loads it as a bundle.
    private func load(_ json: String) throws -> AppConfiguration {
        let dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("litro-config-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: dir) }
        try Data(json.utf8).write(to: dir.appendingPathComponent("app.json"))
        let bundle = try XCTUnwrap(Bundle(url: dir))
        return try AppConfiguration.load(from: bundle)
    }

    private func json(start: String, origins: [String]) -> String {
        let list = origins.map { "\"\($0)\"" }.joined(separator: ", ")
        return """
        { "name": "Demo", "bundleIdentifier": "test.demo", "startURL": "\(start)",
          "allowedOrigins": [\(list)], "capabilities": [] }
        """
    }

    func testLoadsAConfigurationWhoseStartUrlIsAllowed() throws {
        let config = try load(json(start: "https://app.example.test/", origins: ["https://app.example.test"]))
        XCTAssertEqual(config.startURL, URL(string: "https://app.example.test/"))
    }

    func testRefusesAStartUrlOutsideTheAllowlist() {
        XCTAssertThrowsError(try load(json(start: "https://app.example.test/",
                                           origins: ["https://other.example.test"]))) { error in
            guard case let .startURLNotAllowed(url, allowedOrigins: _)? = error as? AppConfigurationError else {
                return XCTFail("expected startURLNotAllowed, got \(error)")
            }
            XCTAssertEqual(url.absoluteString, "https://app.example.test/")
            let text = String(describing: error)
            XCTAssertTrue(text.contains("https://app.example.test/"), text)
            XCTAssertTrue(text.contains("allowedOrigins"), text)
        }
    }

    func testRefusesAnEmptyAllowlist() {
        XCTAssertThrowsError(try load(json(start: "https://app.example.test/", origins: []))) { error in
            guard case .startURLNotAllowed? = error as? AppConfigurationError else {
                return XCTFail("expected startURLNotAllowed, got \(error)")
            }
        }
    }

    /// The plausible typo: an entry with no scheme. `URL.host` is nil for it,
    /// so it used to vanish from the list without a word. It gets its own
    /// message, because "your start URL is not allowed" would send the reader
    /// to the wrong line.
    func testRefusesAnEntryWithNoScheme() {
        XCTAssertThrowsError(try load(json(start: "https://app.example.test/",
                                           origins: ["https://app.example.test", "app.example.test"]))) { error in
            guard case let .unusableOrigin(entry)? = error as? AppConfigurationError else {
                return XCTFail("expected unusableOrigin, got \(error)")
            }
            XCTAssertEqual(entry, "app.example.test")
            let text = String(describing: error)
            XCTAssertTrue(text.contains("\"app.example.test\""), text)
            XCTAssertTrue(text.contains("https://"), text)
        }
    }

    func testRefusesAnEntryThatIsNotAUrl() {
        XCTAssertThrowsError(try load(json(start: "https://app.example.test/",
                                           origins: ["https://app.example.test", "not a url"]))) { error in
            guard case .unusableOrigin("not a url")? = error as? AppConfigurationError else {
                return XCTFail("expected unusableOrigin, got \(error)")
            }
        }
    }

    /// The demo app in native/Apps/ must pass its own check.
    func testTheDemoConfigurationIsValid() throws {
        let demo = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
            .appendingPathComponent("Apps/demo/app.json")
        let config = try load(String(contentsOf: demo, encoding: .utf8))
        XCTAssertTrue(config.allows(config.startURL))
    }
}
