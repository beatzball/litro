//  Share and review: what the page is told for each way a share sheet closes,
//  what a review request is answered with, and the payload rules.
//
//  The absent-module answers for all three methods are held by
//  AbsentCapabilityTests in DispatcherTests.swift.
//
//  Fixtures are built inside each test, never in `setUp` or a stored property
//  initializer: CI's Swift 6.1 runs both in a nonisolated context (NATIVE-009).

import XCTest
@testable import LitroBridge

/// A share sheet that closes the way the test says.
@MainActor
final class ScriptedShare: ShareHost {
    var outcome: ShareOutcome = .completed
    var shown: [ShareContent] = []
    /// When set, the sheet stays open until the test calls `close`.
    var holdsOpen = false
    private var pending: CheckedContinuation<ShareOutcome, Never>?

    func share(_ content: ShareContent) async -> ShareOutcome {
        shown.append(content)
        // A second sheet while one is open answers at once rather than wait, so
        // a dispatcher that lets it through fails the test instead of hanging it.
        guard holdsOpen, pending == nil else { return outcome }
        return await withCheckedContinuation { pending = $0 }
    }

    var isOpen: Bool { pending != nil }

    func close(_ outcome: ShareOutcome) {
        pending?.resume(returning: outcome)
        pending = nil
    }
}

@MainActor
final class RecordingReview: ReviewHost {
    var requests = 0
    func requestReview() { requests += 1 }
}

private func failure(_ reply: BridgeResponse, _ file: StaticString = #filePath,
                     _ line: UInt = #line) -> (String, ErrorCode, String)? {
    guard case let .failure(id, code, message) = reply else {
        XCTFail("expected a failure, got \(reply)", file: file, line: line)
        return nil
    }
    return (id, code, message)
}

private func success(_ reply: BridgeResponse, _ file: StaticString = #filePath,
                     _ line: UInt = #line) -> (String, JSONValue)? {
    guard case let .success(id, value) = reply else {
        XCTFail("expected a success, got \(reply)", file: file, line: line)
        return nil
    }
    return (id, value)
}

@MainActor
final class ShareDispatchTests: XCTestCase {
    private func fixture() -> (ScriptedShare, BridgeDispatcher) {
        let sheet = ScriptedShare()
        return (sheet, BridgeDispatcher(info: testInfo, share: sheet))
    }

    private func share(_ d: BridgeDispatcher, _ params: [String: JSONValue] = ["url": .string("https://app.example/p/1")],
                       id: String = "7") async -> BridgeResponse {
        await d.handle(BridgeRequest(id: id, method: .share, params: params))
    }

    func testIsAdvertisedInTheHandshake() {
        let (_, dispatcher) = fixture()
        XCTAssertEqual(dispatcher.capabilities, [.share])
    }

    /// A finished share answers `null`: the sheet is closed.
    func testACompletedShareAnswersNull() async {
        let (sheet, dispatcher) = fixture()
        sheet.outcome = .completed
        let reply = await share(dispatcher)
        XCTAssertEqual(success(reply)?.0, "7")
        XCTAssertEqual(success(reply)?.1, .null)
        XCTAssertEqual(sheet.shown.count, 1)
    }

    /// A cancel is not an error. It answers exactly what a completion does,
    /// because `share()` resolves when the sheet closes and claims nothing more.
    func testACanceledShareIsNotAnError() async {
        let (sheet, dispatcher) = fixture()
        sheet.outcome = .dismissed
        let reply = await share(dispatcher)
        XCTAssertEqual(success(reply)?.1, .null)
    }

    /// A target that reported an error is a failure the page can see, addressed
    /// to the call's id (NATIVE-003: a usable id is always answered).
    func testAFailedTargetIsAnInternalErrorOnTheCallsId() async {
        let (sheet, dispatcher) = fixture()
        sheet.outcome = .failed
        let reply = await share(dispatcher, id: "share-9")
        XCTAssertEqual(failure(reply)?.0, "share-9")
        XCTAssertEqual(failure(reply)?.1, .internalError)
    }

    /// A sheet that never appeared must not be answered as if the person closed it.
    func testASheetThatWasNeverShownIsAnError() async {
        let (sheet, dispatcher) = fixture()
        sheet.outcome = .notPresented
        let reply = await share(dispatcher)
        XCTAssertEqual(failure(reply)?.1, .internalError)
        XCTAssertTrue(failure(reply)?.2.contains("could not be shown") ?? false)
    }

    /// A second share while one is open is refused at once rather than handed to
    /// UIKit, which refuses it silently and never calls back.
    func testASecondShareWhileOneIsOpenIsRefusedAtOnce() async {
        let (sheet, dispatcher) = fixture()
        sheet.holdsOpen = true
        let first = Task { await share(dispatcher, id: "first") }
        while !sheet.isOpen { await Task.yield() }

        let second = await share(dispatcher, id: "second")
        XCTAssertEqual(failure(second)?.0, "second")
        XCTAssertEqual(failure(second)?.1, .internalError)
        XCTAssertEqual(sheet.shown.count, 1, "the second call reached the sheet")

        sheet.close(.dismissed)
        let firstReply = await first.value
        XCTAssertEqual(success(firstReply)?.0, "first")

        // Closed, so the next share is shown.
        sheet.holdsOpen = false
        let third = await share(dispatcher, id: "third")
        XCTAssertEqual(success(third)?.1, .null)
        XCTAssertEqual(sheet.shown.count, 2)
    }

    /// Bad params are refused before any sheet opens.
    func testABadPayloadIsRefusedBeforeTheSheetOpens() async {
        let (sheet, dispatcher) = fixture()
        for params: [String: JSONValue] in [
            [:],
            ["url": .string("javascript:alert(1)")],
            ["url": .string("/relative")],
            ["text": .number(1)],
        ] {
            let reply = await share(dispatcher, params)
            XCTAssertEqual(failure(reply)?.1, .invalidParams, "\(params)")
        }
        XCTAssertEqual(sheet.shown, [])
    }

    func testCanShareAnswersWhetherShareWouldAcceptThePayload() async {
        let (sheet, dispatcher) = fixture()
        func ask(_ params: [String: JSONValue]) async -> JSONValue? {
            success(await dispatcher.handle(BridgeRequest(id: "7", method: .canShare, params: params)))?.1
        }
        let yes = await ask(["url": .string("https://app.example/")])
        let empty = await ask([:])
        let badURL = await ask(["url": .string("file:///etc/passwd")])
        let badType = await ask(["title": .bool(true)])
        XCTAssertEqual(yes, .bool(true))
        XCTAssertEqual(empty, .bool(false))
        XCTAssertEqual(badURL, .bool(false))
        // A question is never answered with an error.
        XCTAssertEqual(badType, .bool(false))
        XCTAssertEqual(sheet.shown, [], "asking opened a sheet")
    }
}

@MainActor
final class ReviewDispatchTests: XCTestCase {
    func testIsAdvertisedInTheHandshake() {
        XCTAssertEqual(BridgeDispatcher(info: testInfo, review: RecordingReview()).capabilities, [.review])
    }

    /// Passed on once, answered `null`. Never anything that reads as "shown".
    func testPassesTheRequestOnAndAnswersNull() async {
        let review = RecordingReview()
        let dispatcher = BridgeDispatcher(info: testInfo, review: review)
        let reply = await dispatcher.handle(BridgeRequest(id: "r1", method: .requestReview))
        XCTAssertEqual(success(reply)?.0, "r1")
        XCTAssertEqual(success(reply)?.1, .null)
        XCTAssertEqual(review.requests, 1)
    }

    /// Params are not part of the method. Extra ones are ignored, not refused,
    /// so an answer never depends on what the page put beside the call.
    func testIgnoresParams() async {
        let review = RecordingReview()
        let dispatcher = BridgeDispatcher(info: testInfo, review: review)
        let reply = await dispatcher.handle(BridgeRequest(id: "r1", method: .requestReview,
                                                          params: ["shown": .bool(true)]))
        XCTAssertEqual(success(reply)?.1, .null)
        XCTAssertEqual(review.requests, 1)
    }
}

/// The share and review methods with a usable id, arriving as raw messages.
@MainActor
final class ShareMessageTests: XCTestCase {
    /// A raw message whose params fail inside the module is still answered on
    /// its id (NATIVE-003).
    func testABadShareMessageIsAnsweredOnItsId() async {
        let dispatcher = BridgeDispatcher(info: testInfo, share: ScriptedShare())
        let reply = await dispatcher.handle(message(id: .string("m-1"), method: .string("share"),
                                                    params: .object(["url": .number(3)])))
        guard case let .failure(id, code, _)? = reply else { return XCTFail("\(String(describing: reply))") }
        XCTAssertEqual(id, "m-1")
        XCTAssertEqual(code, .invalidParams)
    }
}

final class ShareContentTests: XCTestCase {
    private func parse(_ params: [String: JSONValue]) -> ShareContent? {
        try? ShareContent.parse(params).get()
    }

    func testCarriesTextUrlAndTitleAsSubject() {
        let c = parse(["title": .string("T"), "text": .string("Hi"), "url": .string("https://a.example/x")])
        XCTAssertEqual(c, ShareContent(text: "Hi", url: URL(string: "https://a.example/x"), subject: "T"))
    }

    /// A title alone is shared as the text, so the sheet is never empty.
    func testATitleAloneIsSharedAsText() {
        XCTAssertEqual(parse(["title": .string("T")]), ShareContent(text: "T", url: nil, subject: "T"))
    }

    /// With a link, the title stays the subject and is not added as text too.
    func testATitleWithALinkIsOnlyTheSubject() {
        XCTAssertEqual(parse(["title": .string("T"), "url": .string("https://a.example/")]),
                       ShareContent(text: nil, url: URL(string: "https://a.example/"), subject: "T"))
    }

    func testEmptyStringsAndNullsAreAbsent() {
        XCTAssertNil(parse(["title": .string(""), "text": .null, "url": .string("")]))
    }

    func testOnlyAbsoluteHttpAndHttpsLinks() {
        XCTAssertNotNil(parse(["url": .string("HTTPS://a.example/")]))
        XCTAssertNotNil(parse(["url": .string("http://a.example/")]))
        // The last two have a host, so only the scheme rule refuses them.
        for bad in ["javascript:alert(1)", "file:///etc/hosts", "data:text/plain,x", "/relative", "a.example",
                    "https://", "not a url", "ftp://a.example/f", "javascript://a.example/%0Aalert(1)"] {
            XCTAssertNil(parse(["url": .string(bad)]), bad)
        }
    }

    func testAWrongTypeNamesTheField() {
        XCTAssertEqual(ShareContent.parse(["text": .number(1)]).failure?.message, "text must be a string")
    }
}

final class ShareOutcomeTests: XCTestCase {
    /// The four combinations UIKit's completion handler can report.
    func testMapsTheSystemCallback() {
        XCTAssertEqual(ShareOutcome(completed: true, failed: false), .completed)
        XCTAssertEqual(ShareOutcome(completed: false, failed: false), .dismissed)
        XCTAssertEqual(ShareOutcome(completed: false, failed: true), .failed)
        // An error wins: a target that reports one did not finish.
        XCTAssertEqual(ShareOutcome(completed: true, failed: true), .failed)
    }

    /// A sheet UIKit refused to present is answered at once; one on screen waits.
    func testARefusedPresentationIsAnsweredAtOnce() {
        XCTAssertEqual(ShareOutcome.afterPresenting(isOnScreen: false), .notPresented)
        XCTAssertNil(ShareOutcome.afterPresenting(isOnScreen: true))
    }

    /// The iPad popover anchor is inside the view, so the sheet never lacks one.
    func testTheAnchorIsTheCenterOfTheView() {
        let a = ShareAnchor(width: 800, height: 1200)
        XCTAssertEqual(a.x, 400)
        XCTAssertEqual(a.y, 600)
        let zero = ShareAnchor(width: -5, height: 0)
        XCTAssertEqual(zero.x, 0)
        XCTAssertEqual(zero.y, 0)
    }
}

@MainActor
final class SingleAnswerTests: XCTestCase {
    /// A completion handler that fires twice answers once. A continuation
    /// resumed twice stops the app.
    func testOnlyTheFirstAnswerIsDelivered() {
        var got: [Int] = []
        let once = SingleAnswer<Int> { got.append($0) }
        XCTAssertFalse(once.isAnswered)
        once.answer(1)
        once.answer(2)
        XCTAssertEqual(got, [1])
        XCTAssertTrue(once.isAnswered)
    }
}
