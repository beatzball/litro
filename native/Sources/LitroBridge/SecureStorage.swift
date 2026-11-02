//  Secure storage: what a valid call looks like, and how a failure is reported.
//
//  The keychain calls themselves are in App/Capabilities/SecureStorageModule.swift,
//  and the item's attributes -- which keychain class, which accessibility, never
//  synchronized -- are decided in LitroShellKit's KeychainItem, where they have
//  tests. This file is the protocol side.

import Foundation

/// The keychain refused an operation. `status` is the system's `OSStatus`.
///
/// Reported as INTERNAL_ERROR, which says the caller may retry. The common
/// cause is a device that has not been unlocked since it restarted, which
/// clears up on its own.
public struct SecureStorageFailure: Error, Equatable, Sendable {
    public let status: Int32
    public init(status: Int32) { self.status = status }
}

/// What a build must provide to offer secure storage.
///
/// A missing key is `nil` from `get` and a success from `remove`. Neither is a
/// failure: the page asked whether a value is there, or for it to be gone.
@MainActor
public protocol SecureStorageHost: AnyObject {
    func get(_ key: String) throws -> String?
    func set(_ key: String, value: String) throws
    func remove(_ key: String) throws
}

enum SecureStorageParams {
    /// The key, which must be a non-empty string.
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
