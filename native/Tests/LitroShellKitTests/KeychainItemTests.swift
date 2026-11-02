//  The keychain attributes secure storage writes with.
//
//  These are the decisions about who can read a secret and where it goes. The
//  keychain calls themselves need a device; these attributes do not.

import XCTest
import Security
@testable import LitroShellKit
import LitroBridge

final class KeychainItemTests: XCTestCase {
    private let app = MessageOrigin(scheme: "https", host: "app.example", port: 443)

    private func item(_ origin: MessageOrigin? = nil, key: String = "token") -> KeychainItem {
        KeychainItem(bundleIdentifier: "dev.litro.shell.demo", origin: origin ?? app, key: key)
    }

    func testIsAGenericPasswordScopedToTheAppTheOriginAndTheKey() {
        let identity = item().identity
        XCTAssertEqual(identity[kSecClass as String] as? String, kSecClassGenericPassword as String)
        XCTAssertEqual(identity[kSecAttrService as String] as? String,
                       "dev.litro.shell.demo.secureStorage.https://app.example:443")
        XCTAssertEqual(identity[kSecAttrAccount as String] as? String, "token")
    }

    /// Two allowed origins writing one key are two items. Without the origin
    /// in the service, a page on any allowed origin reads every other one's
    /// secrets.
    func testTwoOriginsWithTheSameKeyAreTwoItems() {
        let login = item(MessageOrigin(scheme: "https", host: "login.example", port: 443))
        let otherPort = item(MessageOrigin(scheme: "https", host: "app.example", port: 8443))
        let otherScheme = item(MessageOrigin(scheme: "http", host: "app.example", port: 443))
        for other in [login, otherPort, otherScheme] {
            XCTAssertEqual(other.account, item().account)
            XCTAssertNotEqual(other.service, item().service, other.service)
        }
    }

    /// The statuses the dispatcher reports as "this input is refused" are
    /// written as numbers there, to keep that target free of Security. These
    /// pin each number to its name.
    func testTheInputRefusalStatusesAreTheNamedOnes() {
        XCTAssertEqual(SecureStorageFailure.refusesTheInput, [errSecParam, errSecDataTooLarge])
    }

    /// A token minted for this device must not land in iCloud Keychain on
    /// every other device the person owns.
    func testIsNeverSynchronized() {
        XCTAssertEqual(item().identity[kSecAttrSynchronizable as String] as? Bool, false)
        XCTAssertEqual(item().adding("v")[kSecAttrSynchronizable as String] as? Bool, false)
    }

    /// Readable after the first unlock since a restart, and never restored onto
    /// a different device from a backup. Both on add and on update, so an item
    /// written by an older build with a weaker setting is moved to this one.
    func testIsThisDeviceOnlyAfterFirstUnlockOnAddAndUpdate() {
        let expected = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly as String
        XCTAssertEqual(item().adding("v")[kSecAttrAccessible as String] as? String, expected)
        XCTAssertEqual(item().updating("v")[kSecAttrAccessible as String] as? String, expected)
    }

    func testStoresTheValueAsUTF8AndReadsItBack() {
        let data = item().adding("héllo")[kSecValueData as String] as? Data
        XCTAssertEqual(data, Data("héllo".utf8))
        XCTAssertEqual(KeychainItem.decode(Data("héllo".utf8)), "héllo")
        XCTAssertNil(KeychainItem.decode(Data([0xFF, 0xFE, 0xFD])))
    }

    func testTheReadAsksForOneItemsData() {
        let read = item().read
        XCTAssertEqual(read[kSecReturnData as String] as? Bool, true)
        XCTAssertEqual(read[kSecMatchLimit as String] as? String, kSecMatchLimitOne as String)
        // The read must not carry a value or an accessibility: those are add
        // attributes, and a query with them matches nothing.
        XCTAssertNil(read[kSecValueData as String])
        XCTAssertNil(read[kSecAttrAccessible as String])
    }

    func testTwoKeysAreTwoItems() {
        let other = item(key: "other")
        XCTAssertNotEqual(item().account, other.account)
        XCTAssertEqual(item().service, other.service)
    }
}
