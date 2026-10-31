//  The per-app configuration, read from the copied-in app.json.
//
//  Two apps differ only by data: a name, an identifier, a start URL, the origins
//  the web view may load, and which capability modules are on. Adding the next
//  Litro app is a new folder under Apps/, not a new project.

import Foundation
import LitroBridge

public struct AppConfiguration: Decodable, Equatable {
    public let name: String
    public let bundleIdentifier: String
    public let startURL: URL
    /// The origins the web view may load. Everything else is opened outside the
    /// app or refused, so a link in page content cannot turn the shell into a
    /// general-purpose browser.
    public let allowedOrigins: [String]
    /// The capability modules this app turns on.
    ///
    /// A module left out is not constructed, so it is absent from the handshake
    /// and the page degrades that one capability. One app may want notifications
    /// and no keychain, another the reverse.
    public let capabilities: [Capability]

    enum CodingKeys: String, CodingKey {
        case name, bundleIdentifier, startURL, allowedOrigins, capabilities
    }

    /// A public struct whose stored properties are `let` gets no public
    /// memberwise initializer, so one is written out for the tests that build a
    /// configuration without going through JSON.
    public init(
        name: String,
        bundleIdentifier: String,
        startURL: URL,
        allowedOrigins: [String],
        capabilities: [Capability]
    ) {
        self.name = name
        self.bundleIdentifier = bundleIdentifier
        self.startURL = startURL
        self.allowedOrigins = allowedOrigins
        self.capabilities = capabilities
    }
}

public enum AppConfigurationError: Error, CustomStringConvertible {
    case missing(String)
    case unreadable(String, underlying: Error)

    public var description: String {
        switch self {
        case let .missing(name):
            return """
            \(name) is not in the app bundle. The build copies one folder from \
            native/Apps/ into the project's resources; run native/scripts/select-app.sh \
            before building.
            """
        case let .unreadable(name, underlying):
            return "\(name) could not be read: \(underlying)"
        }
    }
}

extension AppConfiguration {
    /// Reads the configuration the build copied in.
    ///
    /// This throws rather than falling back to a default. A shell that quietly
    /// booted a built-in start URL when the copy step was skipped would look
    /// like it worked, and the mistake would surface as the wrong app shipping.
    public static func load(from bundle: Bundle = .main, named name: String = "app") throws -> AppConfiguration {
        guard let url = bundle.url(forResource: name, withExtension: "json") else {
            throw AppConfigurationError.missing("\(name).json")
        }
        do {
            return try JSONDecoder().decode(AppConfiguration.self, from: Data(contentsOf: url))
        } catch {
            throw AppConfigurationError.unreadable("\(name).json", underlying: error)
        }
    }

    /// Whether the web view may load `url`.
    ///
    /// Compared on scheme, host and port rather than a prefix match, because a
    /// prefix lets `https://example.com.attacker.test` through an allowlist that
    /// names `https://example.com`.
    public func allows(_ url: URL) -> Bool {
        guard let candidate = Origin(url) else { return false }
        return allowedOrigins.compactMap { Origin(string: $0) }.contains(candidate)
    }
}

/// A scheme, host and port, compared as a whole.
struct Origin: Equatable {
    let scheme: String
    let host: String
    let port: Int

    init?(_ url: URL) {
        guard let scheme = url.scheme?.lowercased(), let host = url.host?.lowercased() else { return nil }
        self.scheme = scheme
        self.host = host
        self.port = url.port ?? Origin.defaultPort(for: scheme)
    }

    init?(string: String) {
        guard let url = URL(string: string) else { return nil }
        self.init(url)
    }

    static func defaultPort(for scheme: String) -> Int {
        switch scheme {
        case "https": return 443
        case "http": return 80
        default: return -1
        }
    }
}
