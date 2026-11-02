//  The handshake, and the values it reports.

import Foundation

/// A haptic impact style, as the page may name it.
public enum HapticStyle: String, CaseIterable, Sendable {
    case light, medium, heavy, soft, rigid
}

/// A haptic notification type, as the page may name it.
public enum HapticNotify: String, CaseIterable, Sendable {
    case success, warning, error
}

/// What this build reports about itself.
///
/// The app fills this in. It is a plain value so `LitroBridge` needs no UIKit
/// and the dispatcher can be tested with made-up versions.
public struct ShellInfo: Equatable, Sendable {
    /// `"ios"`, and a value rather than a constant because the same bridge will
    /// answer for another host later.
    public let os: String
    public let appVersion: String?
    public let osVersion: String?

    public init(os: String = "ios", appVersion: String? = nil, osVersion: String? = nil) {
        self.os = os
        self.appVersion = appVersion
        self.osVersion = osVersion
    }
}

/// The shell's answer to `handshake`.
public struct HandshakeResult: Equatable, Sendable {
    public let version: Int
    public let info: ShellInfo
    /// What this build compiled in. A build that compiled in nothing reports `[]`,
    /// which is legal.
    public let capabilities: [Capability]

    public init(version: Int = bridgeProtocolVersion, info: ShellInfo, capabilities: [Capability]) {
        self.version = version
        self.info = info
        self.capabilities = capabilities
    }

    /// The result as a JSON value.
    ///
    /// `appVersion` and `osVersion` are omitted when absent rather than sent as
    /// `null`, because the page's validator accepts a missing key but reads a
    /// present one as a string.
    public var json: JSONValue {
        var out: [String: JSONValue] = [
            "version": .number(Double(version)),
            "os": .string(info.os),
            // Sorted so the capability list a test asserts on does not depend on
            // the order the modules happened to be constructed in.
            "capabilities": .array(capabilities.map(\.rawValue).sorted().map(JSONValue.string)),
        ]
        if let appVersion = info.appVersion { out["appVersion"] = .string(appVersion) }
        if let osVersion = info.osVersion { out["osVersion"] = .string(osVersion) }
        return .object(out)
    }
}
