//  Secure storage: what a valid call looks like, whose store it reaches, and
//  how a failure is reported.
//
//  The keychain calls themselves are in App/Capabilities/SecureStorageModule.swift,
//  and the item's attributes -- which keychain class, which accessibility, never
//  synchronized, which origin -- are decided in LitroShellKit's KeychainItem,
//  where they have tests. This file is the protocol side.

import Foundation

/// The security origin of the frame a message arrived on.
///
/// Built only by the transport, from the frame WebKit says sent the message,
/// after the origin passed the allowlist. Never from the web view's current
/// URL, which can already be a different page, and never from anything in the
/// message, which the page controls.
///
/// Already normalized: lowercased scheme and host, and the real port where
/// WebKit reported 0 for a default one. Two spellings of one origin are one
/// value, so they reach one store. `AppConfiguration.bridgeOrigin` does that.
public struct MessageOrigin: Hashable, Sendable {
    public let scheme: String
    public let host: String
    public let port: Int

    public init(scheme: String, host: String, port: Int) {
        self.scheme = scheme
        self.host = host
        self.port = port
    }

    /// `scheme://host:port`, with the port always written, so no two origins
    /// share a spelling.
    public var serialized: String { "\(scheme)://\(host):\(port)" }
}

/// Why the keychain could not answer.
public enum SecureStorageFailure: Error, Equatable, Sendable {
    /// The keychain refused, with the system's `OSStatus`.
    case status(Int32)
    /// An item is there, but its bytes are not a string this shell wrote.
    /// Reported rather than read as "no value": an app treats `null` as signed
    /// out, and a damaged item is not the same thing.
    case unreadable

    /// Statuses that say this key or value is refused, so the same call fails
    /// the same way every time. Every other status may clear up -- the usual
    /// one is a device not unlocked since it restarted -- and is reported as
    /// retryable.
    ///
    /// Numbers rather than the Security constants, so this target stays pure
    /// Foundation. `KeychainItemTests` pins each to its named constant. The
    /// keychain's real size limits have not been measured on a device.
    public static let refusesTheInput: Set<Int32> = [
        -50,      // errSecParam
        -25302,   // errSecDataTooLarge
    ]
}

/// What a build must provide to offer secure storage.
///
/// Every call names the origin whose store it reaches. A missing key is `nil`
/// from `get` and a success from `remove`. Neither is a failure: the page
/// asked whether a value is there, or for it to be gone.
@MainActor
public protocol SecureStorageHost: AnyObject {
    func get(_ key: String, origin: MessageOrigin) throws -> String?
    func set(_ key: String, value: String, origin: MessageOrigin) throws
    func remove(_ key: String, origin: MessageOrigin) throws
}

enum SecureStorageParams {
    /// The key, which must be a non-empty string.
    ///
    /// The page adapter rejects an empty key on the web too, so the same call
    /// fails the same way in both places. It also rejects a key or value that
    /// is not well-formed text, which this side cannot see: the bridge turns a
    /// lone surrogate into U+FFFD before Swift gets the string, and two
    /// different keys would land on one item.
    static func key(_ params: [String: JSONValue]) -> Result<String, ParamsFailure> {
        guard let key = params["key"]?.stringValue, !key.isEmpty else {
            return .failure(ParamsFailure("key must be a non-empty string"))
        }
        return .success(key)
    }

    /// The value for `set`, which must be a string. An empty string is a value.
    static func value(_ params: [String: JSONValue]) -> Result<String, ParamsFailure> {
        guard let value = params["value"]?.stringValue else {
            return .failure(ParamsFailure("value must be a string"))
        }
        return .success(value)
    }
}
