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
