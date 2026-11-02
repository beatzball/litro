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
    /// An `allowedOrigins` entry that does not parse to a scheme and a host.
    ///
    /// The plausible typo is an entry with no scheme, such as
    /// `"app.example.com"`: `URL.host` is nil for it, so the origin policy
    /// would drop it without a word and the list would be shorter than it reads.
    case unusableOrigin(String)
    /// The start URL is not covered by `allowedOrigins`.
    ///
    /// The first navigation would be refused by the app's own origin policy. A
    /// refusal is a cancel, and a cancel is deliberately not a load failure
    /// (NATIVE-012), so without this the app would open to a white view and
    /// say nothing.
    case startURLNotAllowed(URL, allowedOrigins: [String])

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
        case let .unusableOrigin(entry):
            return """
            allowedOrigins has an entry that is not an origin: "\(entry)". Write each \
            entry as a scheme and a host, such as https://app.example.com. This one \
            is missing the scheme, the host, or both, so it would be ignored, and the \
            app would refuse the pages it was meant to allow.
            """
        case let .startURLNotAllowed(url, allowedOrigins):
            let list = allowedOrigins.isEmpty ? "an empty list" : allowedOrigins.joined(separator: ", ")
            return """
            startURL \(url.absoluteString) is not in allowedOrigins (\(list)). The app \
            would refuse its own first page and show nothing. Add its origin to \
            allowedOrigins in the app's app.json under native/Apps/.
            """
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
        let configuration: AppConfiguration
        do {
            configuration = try JSONDecoder().decode(AppConfiguration.self, from: Data(contentsOf: url))
        } catch {
            throw AppConfigurationError.unreadable("\(name).json", underlying: error)
        }
        try configuration.validate()
        return configuration
    }

    /// Refuses a configuration that would boot to a blank screen.
    ///
    /// Two faults, with a message each, because they send the reader to
    /// different lines: an allowlist entry that is not an origin at all, and a
    /// start URL the list does not cover. The entries are checked first, since
    /// a dropped entry is the usual reason the start URL is not covered.
    ///
    /// In `load`, not in the decoder, so a test can still build a configuration
    /// with an empty list to exercise the origin policy itself.
    public func validate() throws {
        if let bad = allowedOrigins.first(where: { Origin(string: $0) == nil }) {
            throw AppConfigurationError.unusableOrigin(bad)
        }
        guard allows(startURL) else {
            throw AppConfigurationError.startURLNotAllowed(startURL, allowedOrigins: allowedOrigins)
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

    /// Whether a frame with this security origin may use the bridge.
    ///
    /// The navigation allowlist does not cover this. It authorizes a frame's
    /// *request URL*; this asks about the *security origin* the frame ended up
    /// with, and the two differ exactly where it matters. A `sandbox` or
    /// `srcdoc` frame loads from an allowed path and then runs with an opaque
    /// origin, and WebKit installs the message handler in every frame whatever
    /// its origin, so without this the frame reaches the bridge.
    ///
    /// An opaque origin has an empty scheme and host. It belongs to nothing, so
    /// it can never match an allowlist entry, and it is refused here rather than
    /// left to fall through the comparison by luck.
    ///
    /// Takes the three parts rather than a `WKSecurityOrigin` so this stays in
    /// a target with no WebKit in it, and therefore has tests.
    public func allowsBridgeOrigin(scheme: String, host: String, port: Int) -> Bool {
        bridgeOrigin(scheme: scheme, host: host, port: port) != nil
    }

    /// The frame's origin, normalized, when it may use the bridge; else `nil`.
    ///
    /// The transport carries this value to the dispatcher, so secure storage is
    /// kept per the origin that was actually checked here. Normalized once, in
    /// this one place: two spellings of one origin must reach one store.
    public func bridgeOrigin(scheme: String, host: String, port: Int) -> MessageOrigin? {
        guard !scheme.isEmpty, !host.isEmpty else { return nil }
        let scheme = scheme.lowercased()
        // WebKit reports 0 for a default port; `Origin` stores the real one.
        let port = port == 0 ? Origin.defaultPort(for: scheme) : port
        let candidate = Origin(scheme: scheme, host: host.lowercased(), port: port)
        guard allowedOrigins.compactMap({ Origin(string: $0) }).contains(candidate) else { return nil }
        return MessageOrigin(scheme: candidate.scheme, host: candidate.host, port: candidate.port)
    }
}

/// A scheme, host and port, compared as a whole.
struct Origin: Equatable {
    let scheme: String
    let host: String
    let port: Int

    /// Declaring the initializers below costs the struct its implicit
    /// memberwise one, so it is written out.
    init(scheme: String, host: String, port: Int) {
        self.scheme = scheme
        self.host = host
        self.port = port
    }

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
