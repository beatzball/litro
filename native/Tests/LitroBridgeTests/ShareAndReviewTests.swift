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
    /// What UIKit's completion handler can report, and what each means.
    func testMapsTheSystemCallback() {
        XCTAssertEqual(ShareOutcome(completed: true, errorDomain: nil, errorCode: nil), .completed)
        XCTAssertEqual(ShareOutcome(completed: false, errorDomain: nil, errorCode: nil), .dismissed)
        XCTAssertEqual(ShareOutcome(completed: false, errorDomain: "SomeDomain", errorCode: 7), .failed)
    }

    /// `completed` wins over an error. Apple documents it as "the service was
    /// performed": telling the page it failed would invite a second send.
    func testCompletedWinsOverAnError() {
        XCTAssertEqual(ShareOutcome(completed: true, errorDomain: "SomeDomain", errorCode: 7), .completed)
    }

    /// A target that reports the person canceled is a cancel, not a failure.
    func testAUserCanceledErrorIsADismissal() {
        XCTAssertEqual(ShareOutcome(completed: false, errorDomain: "NSCocoaErrorDomain", errorCode: 3072), .dismissed)
        // The same code in another domain is not a cancel.
        XCTAssertEqual(ShareOutcome(completed: false, errorDomain: "OtherDomain", errorCode: 3072), .failed)
        XCTAssertEqual(ShareOutcome(completed: false, errorDomain: "NSCocoaErrorDomain", errorCode: 3071), .failed)
    }

    func testThePresenterState() {
        XCTAssertEqual(ShareSheetPresenterState(inWindow: true, transitioning: false), .ready)
        XCTAssertEqual(ShareSheetPresenterState(inWindow: true, transitioning: true), .transitioning)
        XCTAssertEqual(ShareSheetPresenterState(inWindow: false, transitioning: false), .none)
        XCTAssertEqual(ShareSheetPresenterState(inWindow: false, transitioning: true), .none)
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

final class ShareItemTests: XCTestCase {
    private func items(_ params: [String: JSONValue]) -> [ShareItem]? {
        (try? ShareContent.parse(params).get())?.items
    }

    /// No title, no subject source. Its placeholder is what the sheet uses to
    /// choose which targets to offer.
    func testNoSubjectWithoutATitle() {
        XCTAssertEqual(items(["url": .string("https://a.example/")]), [.url(URL(string: "https://a.example/")!)])
        XCTAssertEqual(items(["text": .string("hi")]), [.text("hi")])
    }

    func testATitleIsTheSubjectAndTheTextAndLinkFollow() {
        XCTAssertEqual(items(["title": .string("T"), "text": .string("hi"), "url": .string("https://a.example/")]),
                       [.subject("T"), .text("hi"), .url(URL(string: "https://a.example/")!)])
    }

    func testATitleAloneIsTheSubjectAndTheText() {
        XCTAssertEqual(items(["title": .string("T")]), [.subject("T"), .text("T")])
    }
}

/// A share sheet whose UIKit behavior is a script on a virtual clock.
///
/// Like a real animated `present`, it is NOT on screen on the line after
/// `present` returns. It arrives `presentsAfter` later.
@MainActor
final class ScriptedSheet: ShareSheetUI {
    var inWindow = true
    var transitioning = false
    /// When the presentation completes. nil: UIKit refused, silently.
    var presentsAfter: Duration? = .milliseconds(300)
    /// When the completion handler fires, and with what.
    var closes: (after: Duration, completed: Bool, domain: String?, code: Int?)?
    /// When the sheet leaves the screen with no completion handler.
    var leavesAfter: Duration?
    /// Fire the completion handler twice.
    var handlerTwice = false

    private(set) var presentCalls = 0
    private(set) var now = Duration.zero
    private(set) var isOnScreen = false
    private var presentedAt: Duration?
    private var onPresented: (@MainActor () -> Void)?
    private var onClosed: (@MainActor (Bool, String?, Int?) -> Void)?
    private var closed = false

    func presenterFacts() -> (inWindow: Bool, transitioning: Bool) { (inWindow, transitioning) }

    func present(onPresented: @escaping @MainActor () -> Void,
                 onClosed: @escaping @MainActor (Bool, String?, Int?) -> Void) {
        presentCalls += 1
        presentedAt = now
        self.onPresented = onPresented
        self.onClosed = onClosed
        // Nothing synchronous: the sheet is not on screen yet.
    }

    /// Virtual time after which the script gives up on the run and answers
    /// for it, so a run that would never answer fails its test instead of
    /// hanging the suite. Shows up as `.failed`, which no test expects.
    static let giveUp = Duration.seconds(3600)

    /// The test's `sleep`: time passes, and whatever was due happens.
    func advance(_ d: Duration) {
        now += d
        if now >= Self.giveUp, !closed, let call = onClosed {
            closed = true
            call(false, "ScriptedSheet.neverAnswered", -1)
            return
        }
        guard let start = presentedAt else { return }
        if let p = presentsAfter, let call = onPresented, now - start >= p {
            onPresented = nil
            isOnScreen = true
            call()
        }
        if let l = leavesAfter, now - start >= l { isOnScreen = false }
        if let c = closes, !closed, now - start >= c.after {
            closed = true
            isOnScreen = false
            onClosed?(c.completed, c.domain, c.code)
            if handlerTwice { onClosed?(true, nil, nil) }
        }
    }
}

@MainActor
final class ShareSheetRunTests: XCTestCase {
    private func run(_ sheet: ScriptedSheet) async -> ShareOutcome {
        await ShareSheetRun.run(sheet, sleep: { d in
            sheet.advance(d)
            await Task.yield()
        })
    }

    /// The round 2 defect. A real animated `present` leaves the sheet off
    /// screen on the next line, and the first version answered "could not be
    /// shown" right there, for every share. A sheet that arrives a moment later
    /// and is then used must be answered by its completion handler.
    func testASheetThatArrivesAfterPresentReturnsIsAnsweredByItsHandler() async {
        let sheet = ScriptedSheet()
        sheet.closes = (.seconds(10), true, nil, nil)
        let outcome = await run(sheet)
        XCTAssertEqual(outcome, .completed)
        XCTAssertEqual(sheet.now, .seconds(10), "answered before the person closed the sheet")
    }

    func testAPersonClosingTheSheetIsADismissal() async {
        let sheet = ScriptedSheet()
        sheet.closes = (.seconds(4), false, nil, nil)
        let outcome = await run(sheet)
        XCTAssertEqual(outcome, .dismissed)
    }

    /// No page budget: a ten-minute compose in a target is still answered with
    /// what happened, when it happened.
    func testALongComposeIsAnsweredWhenItEnds() async {
        let sheet = ScriptedSheet()
        sheet.closes = (.seconds(600), true, nil, nil)
        let outcome = await run(sheet)
        XCTAssertEqual(outcome, .completed)
        XCTAssertEqual(sheet.now, .seconds(600))
    }

    /// UIKit refused, said nothing, and will never call back. Answered once
    /// the grace has passed, not left to wait forever.
    func testARefusedPresentationIsAnsweredAfterTheGrace() async {
        let sheet = ScriptedSheet()
        sheet.presentsAfter = nil
        let outcome = await run(sheet)
        XCTAssertEqual(outcome, .notPresented)
        XCTAssertEqual(sheet.now, ShareSheetTiming.standard.presentGrace)
    }

    func testNoWindowIsAnsweredAtOnceAndNothingIsPresented() async {
        let sheet = ScriptedSheet()
        sheet.inWindow = false
        let outcome = await run(sheet)
        XCTAssertEqual(outcome, .notPresented)
        XCTAssertEqual(sheet.presentCalls, 0)
    }

    func testAPresenterInATransitionIsAnsweredAtOnce() async {
        let sheet = ScriptedSheet()
        sheet.transitioning = true
        let outcome = await run(sheet)
        XCTAssertEqual(outcome, .notPresented)
        XCTAssertEqual(sheet.presentCalls, 0)
    }

    /// Presented, then gone without a completion handler -- a controller
    /// beneath it was dismissed. Answered `dismissed`, which is `null` on the
    /// wire and claims only that the sheet closed.
    func testASheetAbandonedWithoutACallbackIsADismissal() async {
        let sheet = ScriptedSheet()
        sheet.leavesAfter = .seconds(20)
        let outcome = await run(sheet)
        XCTAssertEqual(outcome, .dismissed)
        XCTAssertLessThanOrEqual(sheet.now, .seconds(22), "an abandoned sheet was not noticed promptly")
    }

    /// A handler that fires before the presentation completes still answers.
    func testAHandlerBeforeThePresentationCompletesAnswers() async {
        let sheet = ScriptedSheet()
        sheet.presentsAfter = .seconds(5)
        sheet.closes = (.milliseconds(500), false, nil, nil)
        let outcome = await run(sheet)
        XCTAssertEqual(outcome, .dismissed)
    }

    /// A handler that fires twice answers once. A continuation resumed twice
    /// stops the process, so this test would crash rather than fail.
    func testAHandlerFiringTwiceAnswersOnce() async {
        let sheet = ScriptedSheet()
        sheet.closes = (.seconds(2), false, nil, nil)
        sheet.handlerTwice = true
        let outcome = await run(sheet)
        XCTAssertEqual(outcome, .dismissed)
    }
}

/// The dispatcher over a real `ShareSheetRun`, as the app wires it.
@MainActor
final class ScriptedShareHost: ShareHost {
    var next: @MainActor () -> ScriptedSheet = { ScriptedSheet() }
    func share(_ content: ShareContent) async -> ShareOutcome {
        let sheet = next()
        return await ShareSheetRun.run(sheet, sleep: { d in
            sheet.advance(d)
            await Task.yield()
        })
    }
}

@MainActor
final class ShareSheetDispatchTests: XCTestCase {
    private func share(_ d: BridgeDispatcher, id: String) async -> BridgeResponse {
        await d.handle(BridgeRequest(id: id, method: .share, params: ["text": .string("hi")]))
    }

    /// An ordinary share is answered `null`, not "could not be shown".
    func testAnOrdinaryShareSucceeds() async {
        let host = ScriptedShareHost()
        host.next = {
            let s = ScriptedSheet()
            s.closes = (.seconds(3), true, nil, nil)
            return s
        }
        let reply = await share(BridgeDispatcher(info: testInfo, share: host), id: "a")
        guard case let .success(id, value) = reply else { return XCTFail("\(reply)") }
        XCTAssertEqual(id, "a")
        XCTAssertEqual(value, .null)
    }

    /// A sheet lost without a callback releases the one-sheet guard, so the
    /// next share is shown rather than refused as "already open" forever.
    func testAnAbandonedSheetDoesNotBlockTheNextShare() async {
        let host = ScriptedShareHost()
        host.next = {
            let s = ScriptedSheet()
            s.leavesAfter = .seconds(5)
            return s
        }
        let dispatcher = BridgeDispatcher(info: testInfo, share: host)
        let first = await share(dispatcher, id: "first")
        guard case .success = first else { return XCTFail("\(first)") }

        host.next = {
            let s = ScriptedSheet()
            s.closes = (.seconds(1), true, nil, nil)
            return s
        }
        let second = await share(dispatcher, id: "second")
        guard case let .success(id, _) = second else { return XCTFail("refused after an abandoned sheet: \(second)") }
        XCTAssertEqual(id, "second")
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
