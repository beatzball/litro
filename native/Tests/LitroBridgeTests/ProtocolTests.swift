//  Every rule the bridge protocol states, pinned here.
//
//  The companion suite is packages/litro-native/src/__tests__/protocol.test.ts.
//  Both sides assert the same rules against their own constants, and
//  scripts/check-bridge-parity.mjs asserts the constants themselves match. A
//  rule with no test here is a rule the shell does not have to honor.

import XCTest
@testable import LitroBridge

final class ConstantsTests: XCTestCase {
    func testProtocolVersionIsOne() {
        XCTAssertEqual(bridgeProtocolVersion, 1)
    }

    func testTransportNames() {
        XCTAssertEqual(handlerName, "litroNative")
        XCTAssertEqual(globalName, "__litroNative")
    }

    func testMethodListIsExactlyTheProtocolsMethods() {
        XCTAssertEqual(BridgeMethod.allCases.map(\.rawValue), [
            "handshake",
            "haptics.impact",
            "haptics.notify",
            "haptics.selection",
            "notifications.schedule",
            "notifications.cancel",
            "badging.set",
            "badging.clear",
            "secureStorage.get",
            "secureStorage.set",
            "secureStorage.remove",
            "canShare",
            "share",
            "requestReview",
        ])
    }

    func testCapabilityListIsExactlyTheProtocolsCapabilities() {
        XCTAssertEqual(Set(Capability.allCases.map(\.rawValue)),
                       ["haptics", "notifications", "badging", "secureStorage", "share", "review"])
    }

    func testErrorCodes() {
        XCTAssertEqual(ErrorCode.parseError.rawValue, -32700)
        XCTAssertEqual(ErrorCode.invalidRequest.rawValue, -32600)
        XCTAssertEqual(ErrorCode.methodNotFound.rawValue, -32601)
        XCTAssertEqual(ErrorCode.invalidParams.rawValue, -32602)
        XCTAssertEqual(ErrorCode.internalError.rawValue, -32603)
        XCTAssertEqual(ErrorCode.permissionDenied.rawValue, -32000)
        XCTAssertEqual(ErrorCode.timeout.rawValue, -32001)
        XCTAssertEqual(ErrorCode.versionUnsupported.rawValue, -32002)
    }

    /// Our own codes must sit in the range JSON-RPC sets aside for implementations.
    func testOurCodesSitInTheReservedImplementationRange() {
        for code in [ErrorCode.permissionDenied, .timeout, .versionUnsupported] {
            XCTAssertTrue((-32099...(-32000)).contains(code.rawValue), "\(code) is outside -32099...-32000")
        }
    }

    /// The absence this protocol depends on.
    ///
    /// There must be no code meaning "this capability is not available here". A
    /// protocol that can report one invites a shell that returns it, and a page
    /// that surfaces it as a rejection — which breaks the contract's promise
    /// that a capability call never throws for a missing platform feature.
    func testThereIsNoCapabilityUnavailableErrorCode() {
        let known: Set<Int> = [-32700, -32600, -32601, -32602, -32603, -32000, -32001, -32002]
        XCTAssertEqual(Set(ErrorCode.allCases.map(\.rawValue)), known)
    }

    func testCapabilityForEachMethod() {
        XCTAssertNil(BridgeMethod.handshake.capability)
        XCTAssertEqual(BridgeMethod.hapticsImpact.capability, .haptics)
        XCTAssertEqual(BridgeMethod.hapticsNotify.capability, .haptics)
        XCTAssertEqual(BridgeMethod.hapticsSelection.capability, .haptics)
        XCTAssertEqual(BridgeMethod.notificationsSchedule.capability, .notifications)
        XCTAssertEqual(BridgeMethod.notificationsCancel.capability, .notifications)
        XCTAssertEqual(BridgeMethod.badgingSet.capability, .badging)
        XCTAssertEqual(BridgeMethod.badgingClear.capability, .badging)
        XCTAssertEqual(BridgeMethod.secureStorageGet.capability, .secureStorage)
        XCTAssertEqual(BridgeMethod.secureStorageSet.capability, .secureStorage)
        XCTAssertEqual(BridgeMethod.secureStorageRemove.capability, .secureStorage)
        XCTAssertEqual(BridgeMethod.requestReview.capability, .review)
    }

    /// `share` and `canShare` are gated together, since one answers for the other.
    func testShareAndCanShareGateTogether() {
        XCTAssertEqual(BridgeMethod.share.capability, .share)
        XCTAssertEqual(BridgeMethod.canShare.capability, .share)
    }
}
