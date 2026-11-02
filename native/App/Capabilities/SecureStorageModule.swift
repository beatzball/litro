//  Secure storage: the keychain calls, and nothing else.
//
//  Which attributes an item carries -- its class, its accessibility, that it is
//  never synchronized -- is decided in Sources/LitroShellKit/KeychainItem.swift,
//  where it has tests. Validation and error mapping are in the dispatcher.

import Foundation
import Security
import LitroBridge
import LitroShellKit

/// The native secure storage path: the platform keychain.
///
/// Synchronous, because `SecItem` is. The calls are small and local, and each
/// is one item, so they stay on the main actor with every other module.
@MainActor
final class SecureStorageModule: SecureStorageHost {
    private let bundleIdentifier: String

    init(bundleIdentifier: String) {
        self.bundleIdentifier = bundleIdentifier
    }

    private func item(_ key: String) -> KeychainItem {
        KeychainItem(bundleIdentifier: bundleIdentifier, key: key)
    }

    func get(_ key: String) throws -> String? {
        var out: CFTypeRef?
        let status = SecItemCopyMatching(item(key).read as CFDictionary, &out)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess else { throw SecureStorageFailure(status: status) }
        guard let data = out as? Data else { return nil }
        return KeychainItem.decode(data)
    }

    /// Updates the item when it exists and adds it when it does not.
    ///
    /// Update first rather than delete then add: a delete followed by a failed
    /// add would lose the previous value, and the page was promised that a
    /// rejected write leaves the old value in place.
    func set(_ key: String, value: String) throws {
        let item = item(key)
        let updated = SecItemUpdate(item.identity as CFDictionary, item.updating(value) as CFDictionary)
        if updated == errSecSuccess { return }
        guard updated == errSecItemNotFound else { throw SecureStorageFailure(status: updated) }
        let added = SecItemAdd(item.adding(value) as CFDictionary, nil)
        guard added == errSecSuccess else { throw SecureStorageFailure(status: added) }
    }

    func remove(_ key: String) throws {
        let status = SecItemDelete(item(key).identity as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw SecureStorageFailure(status: status)
        }
    }
}
