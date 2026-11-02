//  The keychain item secure storage keeps one value in.
//
//  Every attribute here is a decision about who can read a secret and where it
//  goes, so they are built in one place with tests, and the app module only
//  passes the dictionaries to SecItem. Security is a system framework present
//  on every Mac, so `swift test` still needs no simulator.

import Foundation
import Security

/// The keychain attributes for one `secureStorage` key.
public struct KeychainItem: Sendable, Equatable {
    /// Groups this app's secure storage, so a key cannot collide with another
    /// keychain item the app might add later.
    public let service: String
    /// The page's key.
    public let account: String

    public init(bundleIdentifier: String, key: String) {
        service = "\(bundleIdentifier).secureStorage"
        account = key
    }

    /// The attributes that identify the item, for a read, an update or a delete.
    ///
    /// - A generic password, the class for a secret that is not tied to a server.
    /// - Never synchronized: a token minted for this device does not belong in
    ///   iCloud Keychain on every other device the person owns.
    /// - The data protection keychain, so a Mac build behaves as iOS does
    ///   rather than falling back to the older file keychain.
    public var identity: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrSynchronizable as String: kCFBooleanFalse as Any,
            kSecUseDataProtectionKeychain as String: true,
        ]
    }

    /// The query for reading the value.
    public var read: [String: Any] {
        var query = identity
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        return query
    }

    /// The attributes a new item is added with.
    ///
    /// After first unlock, this device only. Readable once the person has
    /// unlocked the phone after a restart, so a background task can still read
    /// a token; never restored onto a different device from a backup, so a
    /// token does not outlive the device it was issued to.
    public func adding(_ value: String) -> [String: Any] {
        var attributes = identity
        attributes[kSecValueData as String] = Data(value.utf8)
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        return attributes
    }

    /// The change applied to an item that already exists.
    ///
    /// Carries the accessibility too, so an item written by an older build with
    /// a weaker setting is moved to this one the next time it is written.
    public func updating(_ value: String) -> [String: Any] {
        [
            kSecValueData as String: Data(value.utf8),
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
    }

    /// The stored bytes as the page's string, or `nil` when they are not UTF-8.
    ///
    /// Only this shell writes these items, always as UTF-8, so bytes that do not
    /// decode are a damaged item. Reported as absent rather than as a failure,
    /// so the page can write a fresh value over it.
    public static func decode(_ data: Data) -> String? {
        String(data: data, encoding: .utf8)
    }
}
