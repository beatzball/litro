//  What the shell answers, for every method, with a module present and absent.
//
//  The spec requires one test per capability on the native path and one on the
//  fallback path. Here the fallback is a module this build did not compile in,
//  which must look to the page exactly like the web adapter's degradation.
//
//  Each reply is held in a local before it is asserted on: an `await` inside an
//  XCTAssert argument is an await inside an autoclosure, which does not compile.

import XCTest
@testable import LitroBridge

/// Unwraps a success and its result, failing the test with the real reply when
/// it is not one.
private func result(_ reply: BridgeResponse?, _ file: StaticString = #filePath, _ line: UInt = #line) -> JSONValue? {
    guard case let .success(_, value) = reply else {
        XCTFail("expected a success, got \(String(describing: reply))", file: file, line: line)
        return nil
    }
    return value
}

/// Unwraps a failure's code.
private func code(_ reply: BridgeResponse?, _ file: StaticString = #filePath, _ line: UInt = #line) -> ErrorCode? {
    guard case let .failure(_, code, _) = reply else {
        XCTFail("expected a failure, got \(String(describing: reply))", file: file, line: line)
        return nil
    }
    return code
}

@MainActor
final class HandshakeDispatchTests: XCTestCase {
    func testReportsTheVersionTheOsAndTheCompiledInCapabilities() async {
        let dispatcher = BridgeDispatcher(info: testInfo,
                                          haptics: RecordingHaptics(),
                                          badging: RecordingBadging())
        let reply = await dispatcher.handle(message(method: .string("handshake")))
        XCTAssertEqual(result(reply), .object([
            "version": .number(1),
            "os": .string("ios"),
            "appVersion": .string("1.2.0"),
            "osVersion": .string("27.2"),
            "capabilities": .array([.string("badging"), .string("haptics")]),
        ]))
    }

    /// A build that compiled in nothing is legal and reports an empty list.
    func testABuildWithNoModulesReportsAnEmptyCapabilityList() async {
        let dispatcher = BridgeDispatcher(info: ShellInfo())
        let reply = await dispatcher.handle(message(method: .string("handshake")))
        XCTAssertEqual(result(reply), .object([
            "version": .number(1),
            "os": .string("ios"),
            "capabilities": .array([]),
        ]))
    }

    /// Absent optional fields are omitted, not sent as null: the page's validator
    /// accepts a missing key but reads a present one as a string.
    func testOmitsTheOptionalVersionsRatherThanSendingNull() async {
        let dispatcher = BridgeDispatcher(info: ShellInfo(os: "ios"))
        let reply = await dispatcher.handle(message(method: .string("handshake")))
        let json = result(reply)
        XCTAssertNil(json?.objectValue?["appVersion"])
        XCTAssertNil(json?.objectValue?["osVersion"])
    }

    /// The handshake needs no capability, so a build with nothing compiled in
    /// must still answer it.
    func testTheHandshakeIsNotGatedByACapability() async {
        XCTAssertNil(BridgeMethod.handshake.capability)
        let dispatcher = BridgeDispatcher(info: ShellInfo())
        let reply = await dispatcher.handle(message(method: .string("handshake")))
        XCTAssertNotNil(result(reply))
    }

    /// The capability list is sorted, so it does not depend on the order the
    /// modules happened to be constructed in.
    func testTheCapabilityListIsSorted() async {
        let dispatcher = BridgeDispatcher(info: testInfo,
                                          haptics: RecordingHaptics(),
                                          badging: RecordingBadging())
        XCTAssertEqual(dispatcher.capabilities, [.haptics, .badging])
        let reply = await dispatcher.handle(message(method: .string("handshake")))
        XCTAssertEqual(result(reply)?.objectValue?["capabilities"],
                       .array([.string("badging"), .string("haptics")]))
    }
}

@MainActor
final class HapticsDispatchTests: XCTestCase {
    private var haptics: RecordingHaptics!
    private var dispatcher: BridgeDispatcher!

    override func setUp() {
        haptics = RecordingHaptics()
        dispatcher = BridgeDispatcher(info: testInfo, haptics: haptics)
    }

    func testImpactReachesTheModuleAndAnswersNull() async {
        for style in HapticStyle.allCases {
            let reply = await dispatcher.handle(message(method: .string("haptics.impact"),
                                                        params: .object(["style": .string(style.rawValue)])))
            XCTAssertEqual(result(reply), .null)
        }
        XCTAssertEqual(haptics.impacts, HapticStyle.allCases)
    }

    func testNotifyReachesTheModuleAndAnswersNull() async {
        for type in HapticNotify.allCases {
            let reply = await dispatcher.handle(message(method: .string("haptics.notify"),
                                                        params: .object(["type": .string(type.rawValue)])))
            XCTAssertEqual(result(reply), .null)
        }
        XCTAssertEqual(haptics.notifications, HapticNotify.allCases)
    }

    func testSelectionNeedsNoParams() async {
        let reply = await dispatcher.handle(message(method: .string("haptics.selection")))
        XCTAssertEqual(result(reply), .null)
        XCTAssertEqual(haptics.selections, 1)
    }

    /// A style the protocol does not define is a caller mistake, and must not
    /// silently become a different buzz.
    func testRejectsAnUnknownMissingOrNonStringStyle() async {
        for params: JSONValue? in [nil,
                                   .object([:]),
                                   .object(["style": .string("rumble")]),
                                   .object(["style": .number(1)])] {
            let reply = await dispatcher.handle(message(method: .string("haptics.impact"), params: params))
            XCTAssertEqual(code(reply), .invalidParams, "params \(String(describing: params))")
        }
        XCTAssertEqual(haptics.impacts, [], "a rejected call must not reach the module")
    }

    func testRejectsAnUnknownOrMissingNotifyType() async {
        for params: JSONValue? in [nil, .object([:]), .object(["type": .string("info")])] {
            let reply = await dispatcher.handle(message(method: .string("haptics.notify"), params: params))
            XCTAssertEqual(code(reply), .invalidParams)
        }
        XCTAssertEqual(haptics.notifications, [])
    }
}

@MainActor
final class BadgingDispatchTests: XCTestCase {
    private var badging: RecordingBadging!
    private var dispatcher: BridgeDispatcher!

    override func setUp() {
        badging = RecordingBadging()
        dispatcher = BridgeDispatcher(info: testInfo, badging: badging)
    }

    func testSetReachesTheModuleAndAnswersNull() async {
        let reply = await dispatcher.handle(message(method: .string("badging.set"),
                                                    params: .object(["count": .number(3)])))
        XCTAssertEqual(result(reply), .null)
        XCTAssertEqual(badging.counts, [3])
    }

    /// Clearing is setting zero. One code path means the two cannot disagree.
    func testClearSetsZero() async {
        let reply = await dispatcher.handle(message(method: .string("badging.clear")))
        XCTAssertEqual(result(reply), .null)
        XCTAssertEqual(badging.counts, [0])
    }

    func testAcceptsZero() async {
        let reply = await dispatcher.handle(message(method: .string("badging.set"),
                                                    params: .object(["count": .number(0)])))
        XCTAssertEqual(result(reply), .null)
        XCTAssertEqual(badging.counts, [0])
    }

    /// A negative or fractional count is a caller mistake. Rounding it would
    /// show a badge the app never asked for.
    func testRejectsANegativeFractionalMissingOrNonNumericCount() async {
        for params: JSONValue? in [nil,
                                   .object([:]),
                                   .object(["count": .number(-1)]),
                                   .object(["count": .number(1.5)]),
                                   .object(["count": .string("3")])] {
            let reply = await dispatcher.handle(message(method: .string("badging.set"), params: params))
            XCTAssertEqual(code(reply), .invalidParams, "params \(String(describing: params))")
        }
        XCTAssertEqual(badging.counts, [], "a rejected call must not reach the module")
    }

    /// A declined badge permission is the user's answer, not a bug, so it is
    /// PERMISSION_DENIED and not INTERNAL_ERROR. The page must not retry it.
    func testADeclinedPermissionIsReportedAsDeniedForBothSetAndClear() async {
        badging.allowed = false
        let set = await dispatcher.handle(message(method: .string("badging.set"),
                                                  params: .object(["count": .number(1)])))
        XCTAssertEqual(code(set), .permissionDenied)
        let clear = await dispatcher.handle(message(method: .string("badging.clear")))
        XCTAssertEqual(code(clear), .permissionDenied)
    }
}

@MainActor
final class AbsentCapabilityTests: XCTestCase {
    /// A build with nothing compiled in. Every capability call must still answer,
    /// and must answer the way the web adapter degrades.
    private let dispatcher = BridgeDispatcher(info: ShellInfo())

    /// The rule the whole protocol is shaped around.
    ///
    /// The page is supposed to gate these calls and never send them. But a page
    /// may be an old deploy we cannot fix, and the contract promises a capability
    /// call never fails for a missing platform feature. So the shell holds the
    /// promise too: it answers, and the answer is never an error.
    func testEveryCapabilityCallSucceedsWhenTheModuleIsAbsent() async {
        for method in BridgeMethod.allCases where method.capability != nil {
            let reply = await dispatcher.handle(BridgeRequest(id: "7", method: method))
            guard case .success = reply else {
                XCTFail("\(method.rawValue) answered \(reply) with its module absent")
                continue
            }
        }
    }

    /// The documented empty behavior, per method. These values are what make a
    /// disabled module indistinguishable from the web fallback.
    func testTheEmptyAnswersMatchTheWebAdaptersDegradation() async {
        let expected: [BridgeMethod: JSONValue] = [
            .hapticsImpact: .null,
            .hapticsNotify: .null,
            .hapticsSelection: .null,
            // An empty id means nothing was scheduled.
            .notificationsSchedule: .string(""),
            .notificationsCancel: .null,
            .badgingSet: .null,
            .badgingClear: .null,
            // Reading a store that does not exist finds nothing.
            .secureStorageGet: .null,
            .secureStorageSet: .null,
            .secureStorageRemove: .null,
            // Nothing can be shared when there is nothing to share it with.
            .canShare: .bool(false),
            .share: .null,
            .requestReview: .null,
        ]
        // Every gated method is covered, so adding one to the protocol fails here
        // rather than going untested.
        XCTAssertEqual(Set(expected.keys),
                       Set(BridgeMethod.allCases.filter { $0.capability != nil }))
        for (method, value) in expected {
            let reply = await dispatcher.handle(BridgeRequest(id: "7", method: method))
            XCTAssertEqual(result(reply), value, method.rawValue)
        }
    }

    /// An absent module must not be reported in the handshake, or the page would
    /// offer a feature that does nothing.
    func testAnAbsentModuleIsNotAdvertised() {
        XCTAssertEqual(dispatcher.capabilities, [])
    }

    /// A call for a module that is absent must not disturb one that is present.
    func testAPresentModuleIsUnaffectedByAnAbsentOne() async {
        let haptics = RecordingHaptics()
        let partial = BridgeDispatcher(info: testInfo, haptics: haptics)
        XCTAssertEqual(partial.capabilities, [.haptics])
        let badge = await partial.handle(BridgeRequest(id: "7", method: .badgingSet,
                                                       params: ["count": .number(2)]))
        XCTAssertEqual(result(badge), .null)
        let buzz = await partial.handle(BridgeRequest(id: "8", method: .hapticsSelection))
        XCTAssertEqual(result(buzz), .null)
        XCTAssertEqual(haptics.selections, 1)
    }

    /// Params are not validated for a capability that does nothing. Rejecting a
    /// bad style on a build without haptics would make the absence visible as a
    /// failure, which is exactly what the contract forbids.
    func testAnAbsentModuleDoesNotValidateParams() async {
        let reply = await dispatcher.handle(BridgeRequest(id: "7", method: .hapticsImpact,
                                                           params: ["style": .string("rumble")]))
        XCTAssertEqual(result(reply), .null)
    }
}

@MainActor
final class MalformedMessageTests: XCTestCase {
    private let dispatcher = BridgeDispatcher(info: testInfo, haptics: RecordingHaptics())

    func testAnUnknownMethodIsAnsweredWithMethodNotFound() async {
        let reply = await dispatcher.handle(message(method: .string("haptics.rumble")))
        XCTAssertEqual(code(reply), .methodNotFound)
    }

    /// A malformed envelope that still carries an id is answered, not dropped.
    /// A dropped reply costs the page its whole timeout for no reason.
    func testAMalformedEnvelopeWithAnIdIsAnsweredWithInvalidRequest() async {
        let reply = await dispatcher.handle(message(jsonrpc: .string("1.0"), method: .string("handshake")))
        XCTAssertEqual(code(reply), .invalidRequest)
    }

    /// No usable id means there is nowhere to send a reply. Inventing one would
    /// have the page resolve a call it never made.
    func testAMessageWithNoUsableIdIsNotAnswered() async {
        let noId = await dispatcher.handle(message(id: nil, method: .string("handshake")))
        XCTAssertNil(noId)
        let emptyId = await dispatcher.handle(message(id: .string(""), method: .string("handshake")))
        XCTAssertNil(emptyId)
        let notAnObject = await dispatcher.handle(.string("handshake"))
        XCTAssertNil(notAnObject)
    }

    /// The reply is addressed to the id that was sent, every time.
    func testAReplyCarriesTheRequestsId() async {
        let reply = await dispatcher.handle(message(id: .string("abc"), method: .string("haptics.selection")))
        guard case let .success(id, _) = reply else { return XCTFail("expected a success") }
        XCTAssertEqual(id, "abc")
    }
}
