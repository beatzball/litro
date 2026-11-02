//  The envelope's rules: what counts as a request, and what a reply looks like.

import XCTest
@testable import LitroBridge

final class RequestParsingTests: XCTestCase {
    func testAcceptsAWellFormedRequest() throws {
        let parsed = try BridgeRequest.parse(
            message(method: .string("haptics.impact"), params: .object(["style": .string("light")]))
        ).get()
        XCTAssertEqual(parsed, BridgeRequest(id: "7", method: .hapticsImpact,
                                             params: ["style": .string("light")]))
    }

    func testAcceptsAnAbsentParams() throws {
        let parsed = try BridgeRequest.parse(message(method: .string("haptics.selection"))).get()
        XCTAssertEqual(parsed.params, [:])
    }

    /// `params: null` is what a JavaScript caller produces by passing `undefined`
    /// through `JSON.stringify`, so it is read as absent rather than rejected.
    func testTreatsANullParamsAsAbsent() throws {
        let parsed = try BridgeRequest.parse(
            message(method: .string("haptics.selection"), params: .null)
        ).get()
        XCTAssertEqual(parsed.params, [:])
    }

    func testRejectsAMessageThatIsNotAnObject() {
        XCTAssertEqual(BridgeRequest.parse(.string("haptics.impact")).failure, .invalidRequest(id: nil))
        XCTAssertEqual(BridgeRequest.parse(.array([])).failure, .invalidRequest(id: nil))
        XCTAssertEqual(BridgeRequest.parse(.null).failure, .invalidRequest(id: nil))
    }

    func testRejectsAWrongOrMissingJsonrpc() {
        XCTAssertEqual(BridgeRequest.parse(message(jsonrpc: .string("1.0"), method: .string("handshake"))).failure,
                       .invalidRequest(id: "7"))
        XCTAssertEqual(BridgeRequest.parse(message(jsonrpc: nil, method: .string("handshake"))).failure,
                       .invalidRequest(id: "7"))
        XCTAssertEqual(BridgeRequest.parse(message(jsonrpc: .number(2), method: .string("handshake"))).failure,
                       .invalidRequest(id: "7"))
    }

    /// Every request carries an id. The page never sends a notification, because
    /// a call whose failure is invisible is hard to debug on a device.
    func testRejectsAMissingEmptyOrNonStringId() {
        XCTAssertEqual(BridgeRequest.parse(message(id: nil, method: .string("handshake"))).failure,
                       .invalidRequest(id: nil))
        XCTAssertEqual(BridgeRequest.parse(message(id: .string(""), method: .string("handshake"))).failure,
                       .invalidRequest(id: nil))
        XCTAssertEqual(BridgeRequest.parse(message(id: .number(7), method: .string("handshake"))).failure,
                       .invalidRequest(id: nil))
    }

    func testRejectsAMissingOrNonStringMethod() {
        XCTAssertEqual(BridgeRequest.parse(message(method: nil)).failure, .invalidRequest(id: "7"))
        XCTAssertEqual(BridgeRequest.parse(message(method: .number(1))).failure, .invalidRequest(id: "7"))
    }

    /// Positional params are a silent breakage when an argument is inserted, so
    /// `params` must be an object.
    func testRejectsPositionalParams() {
        XCTAssertEqual(
            BridgeRequest.parse(message(method: .string("haptics.impact"),
                                        params: .array([.string("light")]))).failure,
            .invalidRequest(id: "7")
        )
    }

    /// A malformed envelope is reported as such even when the method is unknown.
    /// Checking `params` first keeps the two reasons from masking each other.
    func testAMalformedParamsBeatsAnUnknownMethod() {
        XCTAssertEqual(
            BridgeRequest.parse(message(method: .string("nope"), params: .array([]))).failure,
            .invalidRequest(id: "7")
        )
    }

    func testReportsAnUnknownMethodWithItsId() {
        XCTAssertEqual(BridgeRequest.parse(message(method: .string("haptics.rumble"))).failure,
                       .methodNotFound(id: "7"))
    }

    func testTheParseFailureCarriesTheRightCode() {
        XCTAssertEqual(RequestParseFailure.invalidRequest(id: nil).code, .invalidRequest)
        XCTAssertEqual(RequestParseFailure.invalidRequest(id: "7").code, .invalidRequest)
        XCTAssertEqual(RequestParseFailure.methodNotFound(id: "7").code, .methodNotFound)
    }

    /// A rejection is addressable whenever the message had a usable id, whatever
    /// the reason. Only a message with no id at all goes unanswered, because a
    /// page call otherwise waits out its whole timeout for a reply that exists.
    func testARejectionIsAddressableWheneverTheMessageHadAnId() {
        XCTAssertEqual(RequestParseFailure.invalidRequest(id: "7").id, "7")
        XCTAssertEqual(RequestParseFailure.methodNotFound(id: "7").id, "7")
        XCTAssertNil(RequestParseFailure.invalidRequest(id: nil).id)
    }
}

final class ResponseTests: XCTestCase {
    func testASuccessCarriesResultAndNoError() {
        XCTAssertEqual(BridgeResponse.success(id: "7", result: .null).jsonText,
                       #"{"id":"7","jsonrpc":"2.0","result":null}"#)
    }

    func testAFailureCarriesErrorAndNoResult() {
        XCTAssertEqual(
            BridgeResponse.failure(id: "7", code: .permissionDenied, message: "denied").jsonText,
            #"{"error":{"code":-32000,"message":"denied"},"id":"7","jsonrpc":"2.0"}"#
        )
    }

    /// A reply carries exactly one of `result` and `error`. Both is ambiguous
    /// about whether the work happened; neither says nothing at all. The enum
    /// makes either impossible, and this asserts the emitted text agrees.
    func testAReplyNeverCarriesBothOrNeither() {
        for reply: BridgeResponse in [.success(id: "7", result: .bool(true)),
                                      .failure(id: "7", code: .internalError, message: "boom")] {
            let text = reply.jsonText
            XCTAssertNotEqual(text.contains(#""result":"#), text.contains(#""error":"#),
                              "exactly one of result and error must be present: \(text)")
        }
    }

    /// A page that navigated away between the call and the reply has no global
    /// left. The optional chain makes that a no-op rather than a thrown error
    /// inside the web view.
    func testTheDeliveryScriptToleratesAMissingGlobal() {
        XCTAssertEqual(BridgeResponse.success(id: "7", result: .null).deliveryScript,
                       #"window.__litroNative?.receive?.({"id":"7","jsonrpc":"2.0","result":null})"#)
    }
}

final class JSONValueTests: XCTestCase {
    /// JavaScriptCore boxes `true` and `1` as the same class. Read in the wrong
    /// order, `true` silently becomes the number 1.
    func testTellsABoolFromANumber() {
        XCTAssertEqual(JSONValue(any: true), .bool(true))
        XCTAssertEqual(JSONValue(any: false), .bool(false))
        XCTAssertEqual(JSONValue(any: 1), .number(1))
        XCTAssertEqual(JSONValue(any: 0), .number(0))
    }

    func testConvertsNestedStructures() {
        let converted = JSONValue(any: ["a": [1, "two", NSNull()], "b": ["c": true]] as [String: Any])
        XCTAssertEqual(converted, .object([
            "a": .array([.number(1), .string("two"), .null]),
            "b": .object(["c": .bool(true)]),
        ]))
    }

    /// A value that is not JSON is refused rather than coerced, so the caller can
    /// answer `INVALID_REQUEST` instead of guessing what was meant.
    func testRefusesAValueThatIsNotJson() {
        XCTAssertNil(JSONValue(any: Date()))
        XCTAssertNil(JSONValue(any: ["ok": Date()] as [String: Any]))
        XCTAssertNil(JSONValue(any: [Date()] as [Any]))
    }

    /// U+2028 and U+2029 are legal inside a JSON string and illegal inside a
    /// JavaScript line. Unescaped, a reply containing one is valid JSON that
    /// fails to evaluate in the web view.
    func testEscapesTheLineSeparatorsThatBreakJavaScript() {
        XCTAssertEqual(JSONValue.string("a\u{2028}b").jsonText, "\"a\\u2028b\"")
        XCTAssertEqual(JSONValue.string("a\u{2029}b").jsonText, "\"a\\u2029b\"")
    }

    func testEscapesQuotesBackslashesAndControlCharacters() {
        XCTAssertEqual(JSONValue.string("\"").jsonText, #""\"""#)
        XCTAssertEqual(JSONValue.string("\\").jsonText, #""\\""#)
        XCTAssertEqual(JSONValue.string("\n").jsonText, #""\n""#)
        XCTAssertEqual(JSONValue.string("\u{0001}").jsonText, #""\u0001""#)
    }

    /// Object keys come out sorted so a test can assert on an exact string.
    func testSortsObjectKeys() {
        XCTAssertEqual(JSONValue.object(["b": .number(2), "a": .number(1)]).jsonText,
                       #"{"a":1,"b":2}"#)
    }

    /// JavaScript has one number type, so an integer parameter arrives as a
    /// double. A fractional value is a caller mistake, not something to round.
    func testReadsAWholeNumberAndRefusesAFractionalOne() {
        XCTAssertEqual(JSONValue.number(3).intValue, 3)
        XCTAssertEqual(JSONValue.number(-3).intValue, -3)
        XCTAssertNil(JSONValue.number(3.5).intValue)
        XCTAssertNil(JSONValue.number(.nan).intValue)
        XCTAssertNil(JSONValue.number(.infinity).intValue)
    }

    func testWholeNumbersPrintWithoutADecimalPoint() {
        XCTAssertEqual(JSONValue.number(3).jsonText, "3")
        XCTAssertEqual(JSONValue.number(-32000).jsonText, "-32000")
    }
}
