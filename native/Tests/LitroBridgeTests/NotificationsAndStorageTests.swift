//  Notifications and secure storage: the native path, through the dispatcher.
//
//  The fallback path for both -- a build with the module absent -- is covered
//  by AbsentCapabilityTests in DispatcherTests.swift, which every gated method
//  must pass.
//
//  Fixtures are built inside each test, never in `setUp` or a stored property
//  initializer: CI's Swift 6.1 runs both in a nonisolated context (NATIVE-009).

import XCTest
@testable import LitroBridge

private func result(_ reply: BridgeResponse?, _ file: StaticString = #filePath, _ line: UInt = #line) -> JSONValue? {
    guard case let .success(_, value) = reply else {
        XCTFail("expected a success, got \(String(describing: reply))", file: file, line: line)
        return nil
    }
    return value
}

private func failure(_ reply: BridgeResponse?, _ file: StaticString = #filePath,
                     _ line: UInt = #line) -> (ErrorCode, String)? {
    guard case let .failure(_, code, message) = reply else {
        XCTFail("expected a failure, got \(String(describing: reply))", file: file, line: line)
        return nil
    }
    return (code, message)
}

/// Epoch milliseconds, as the page sends `at`.
private func ms(_ date: Date) -> JSONValue { .number(date.timeIntervalSince1970 * 1000) }

@MainActor
final class NotificationsDispatchTests: XCTestCase {
    private func fixture() -> (RecordingNotifications, TestClock, BridgeDispatcher) {
        let center = RecordingNotifications()
        let clock = TestClock()
        var next = 0
        let dispatcher = BridgeDispatcher(info: testInfo, notifications: center,
                                          now: { clock.now }, monotonic: { clock.monotonic },
                                          calendar: { utcCalendar },
                                          makeID: { next += 1; return "made-\(next)" })
        return (center, clock, dispatcher)
    }

    private func schedule(_ d: BridgeDispatcher, _ params: [String: JSONValue]) async -> BridgeResponse {
        await d.handle(BridgeRequest(id: "7", method: .notificationsSchedule, params: params))
    }

    func testIsAdvertisedInTheHandshake() {
        let (_, _, dispatcher) = fixture()
        XCTAssertEqual(dispatcher.capabilities, [.notifications])
    }

    func testSchedulesAOneOffAsAnIntervalToItsInstantAndAnswersTheId() async {
        let (center, clock, dispatcher) = fixture()
        let at = clock.now.addingTimeInterval(3600)
        let reply = await schedule(dispatcher, ["id": .string("tea"), "title": .string("Tea"),
                                                "body": .string("Kettle"), "at": ms(at)])
        XCTAssertEqual(result(reply), .string("tea"))
        XCTAssertEqual(center.scheduled.count, 1)
        let (request, trigger) = center.scheduled[0]
        XCTAssertEqual(request.title, "Tea")
        XCTAssertEqual(request.body, "Kettle")
        XCTAssertEqual(trigger, .after(seconds: 3600))
    }

    func testMakesAnIdWhenThePageGaveNoneOrAnEmptyOne() async {
        let (_, clock, dispatcher) = fixture()
        let at = ms(clock.now.addingTimeInterval(60))
        let first = await schedule(dispatcher, ["title": .string("A"), "at": at])
        let second = await schedule(dispatcher, ["title": .string("B"), "at": at, "id": .string("")])
        XCTAssertEqual(result(first), .string("made-1"))
        XCTAssertEqual(result(second), .string("made-2"))
    }

    func testADailyReminderRepeatsAtItsTimeOfDayEvenFromAPastDate() async {
        let (center, clock, dispatcher) = fixture()
        let yesterdayAtNine = utcCalendar.date(bySettingHour: 9, minute: 30, second: 0,
                                               of: clock.now.addingTimeInterval(-86_400))!
        let reply = await schedule(dispatcher, ["title": .string("Stand up"), "at": ms(yesterdayAtNine),
                                                "repeat": .string("daily")])
        XCTAssertNotNil(result(reply))
        XCTAssertEqual(center.scheduled.first?.1,
                       .calendar(DateComponents(hour: 9, minute: 30, second: 0), repeats: true))
    }

    func testRejectsBadParamsBeforeAnyPromptIsShown() async {
        let (center, clock, dispatcher) = fixture()
        center.stored = .notDetermined
        let future = ms(clock.now.addingTimeInterval(60))
        let cases: [(String, [String: JSONValue])] = [
            ("no title", ["at": future]),
            ("empty title", ["title": .string(""), "at": future]),
            ("numeric title", ["title": .number(1), "at": future]),
            ("no at", ["title": .string("A")]),
            ("string at", ["title": .string("A"), "at": .string("soon")]),
            ("past one-off", ["title": .string("A"), "at": ms(clock.now.addingTimeInterval(-1))]),
            ("unknown repeat", ["title": .string("A"), "at": future, "repeat": .string("weekly")]),
            ("numeric body", ["title": .string("A"), "at": future, "body": .number(2)]),
            ("numeric id", ["title": .string("A"), "at": future, "id": .number(2)]),
        ]
        for (label, params) in cases {
            let reply = await schedule(dispatcher, params)
            XCTAssertEqual(failure(reply)?.0, .invalidParams, label)
        }
        XCTAssertEqual(center.prompts, 0, "a bad call must be rejected before anyone is asked")
        XCTAssertTrue(center.scheduled.isEmpty)
    }

    func testAsksOnceWhenNobodyHasBeenAskedThenSchedules() async {
        let (center, clock, dispatcher) = fixture()
        center.stored = .notDetermined
        let reply = await schedule(dispatcher, ["title": .string("A"), "at": ms(clock.now.addingTimeInterval(60))])
        XCTAssertEqual(result(reply), .string("made-1"))
        XCTAssertEqual(center.prompts, 1)
    }

    func testADeclinedPromptIsPermissionDenied() async {
        let (center, clock, dispatcher) = fixture()
        center.stored = .notDetermined
        center.afterAsking = .denied
        let reply = await schedule(dispatcher, ["title": .string("A"), "at": ms(clock.now.addingTimeInterval(60))])
        XCTAssertEqual(failure(reply)?.0, .permissionDenied)
        XCTAssertTrue(center.scheduled.isEmpty)
    }

    /// iOS never shows a second prompt, so asking after a denial would only
    /// look like a hang. A stored denial answers at once.
    func testAStoredDenialAnswersWithoutAsking() async {
        let (center, clock, dispatcher) = fixture()
        center.stored = .denied
        let reply = await schedule(dispatcher, ["title": .string("A"), "at": ms(clock.now.addingTimeInterval(60))])
        XCTAssertEqual(failure(reply)?.0, .permissionDenied)
        XCTAssertEqual(center.prompts, 0)
    }

    /// A grant that shows nothing -- a badge-only grant from an earlier build,
    /// say -- is asked about once more, and goes through if the answer widens.
    func testAGrantThatShowsNothingAsksOnceAndSchedulesIfItWidens() async {
        let (center, clock, dispatcher) = fixture()
        center.stored = .authorized(visible: false)
        center.afterAsking = .authorized(visible: true)
        let reply = await schedule(dispatcher, ["id": .string("w"), "title": .string("A"),
                                                "at": ms(clock.now.addingTimeInterval(60))])
        XCTAssertEqual(result(reply), .string("w"))
        XCTAssertEqual(center.prompts, 1)
    }

    /// And refuses, without claiming the person declined, when it does not.
    func testAGrantThatStillShowsNothingAfterAskingIsRefused() async {
        let (center, clock, dispatcher) = fixture()
        center.stored = .authorized(visible: false)
        center.afterAsking = .authorized(visible: false)
        let reply = await schedule(dispatcher, ["title": .string("A"), "at": ms(clock.now.addingTimeInterval(60))])
        XCTAssertEqual(failure(reply)?.0, .permissionDenied)
        XCTAssertFalse(failure(reply)?.1.contains("declined") ?? true)
        XCTAssertEqual(center.prompts, 1)
        XCTAssertTrue(center.scheduled.isEmpty)
    }

    /// The person read the prompt for thirty seconds. That is inside the
    /// page's interactive budget, so the page still waits and must get the id.
    func testASlowPromptInsideThePagesBudgetStillSchedulesAndAnswersTheId() async {
        let (center, clock, dispatcher) = fixture()
        center.stored = .notDetermined
        center.whilePrompting = { clock.advance(30) }
        let reply = await schedule(dispatcher, ["id": .string("r1"), "title": .string("A"),
                                                "at": ms(clock.now.addingTimeInterval(600))])
        XCTAssertEqual(result(reply), .string("r1"))
        XCTAssertEqual(center.scheduled.map(\.0.id), ["r1"])
    }

    /// Past the budget the page sent, the page has rejected the call with
    /// TIMEOUT. Nothing is scheduled.
    func testAPromptThatOutlastsTheBudgetThePageSentSchedulesNothing() async {
        let (center, clock, dispatcher) = fixture()
        center.stored = .notDetermined
        center.whilePrompting = { clock.advance(30) }
        let reply = await schedule(dispatcher, ["title": .string("A"), "budgetMs": .number(30_000),
                                                "at": ms(clock.now.addingTimeInterval(600))])
        XCTAssertEqual(failure(reply)?.0, .internalError)
        XCTAssertTrue(center.scheduled.isEmpty)
    }

    /// The page's budget, not a copy in the shell, decides. A page that waits
    /// longer than the old constant is honored.
    func testALongerBudgetThePageSentIsHonored() async {
        let (center, clock, dispatcher) = fixture()
        center.stored = .notDetermined
        center.whilePrompting = { clock.advance(150) }
        let reply = await schedule(dispatcher, ["id": .string("long"), "title": .string("A"),
                                                "budgetMs": .number(300_000),
                                                "at": ms(clock.now.addingTimeInterval(600))])
        XCTAssertEqual(result(reply), .string("long"))
    }

    /// A page built before `budgetMs` existed waited two minutes.
    func testAPageThatSendsNoBudgetGetsTheTwoMinutesItWaited() async {
        let (center, clock, dispatcher) = fixture()
        center.stored = .notDetermined
        center.whilePrompting = { clock.advance(120) }
        let reply = await schedule(dispatcher, ["title": .string("A"), "at": ms(clock.now.addingTimeInterval(600))])
        XCTAssertEqual(failure(reply)?.0, .internalError)
        XCTAssertTrue(center.scheduled.isEmpty)
    }

    /// The device time jumps back an hour while the prompt is open, and only
    /// a few seconds pass. The page is still waiting, so the id must arrive.
    /// A wall-clock measure would see minus an hour, and the reverse jump
    /// would refuse a call the page still waits for.
    func testADeviceTimeChangeDuringThePromptDoesNotMoveTheBudget() async {
        for jump in [-3600.0, 3600.0] {
            let (center, clock, dispatcher) = fixture()
            center.stored = .notDetermined
            center.whilePrompting = { clock.advance(5); clock.setWallClock(by: jump) }
            let reply = await schedule(dispatcher, ["id": .string("j"), "title": .string("A"),
                                                    "budgetMs": .number(120_000),
                                                    "at": ms(clock.now.addingTimeInterval(7200))])
            XCTAssertEqual(result(reply), .string("j"), "jump \(jump)")
        }
        let (center, clock, dispatcher) = fixture()
        center.stored = .notDetermined
        center.whilePrompting = { clock.advance(200); clock.setWallClock(by: -3600) }
        let late = await schedule(dispatcher, ["title": .string("A"), "budgetMs": .number(120_000),
                                               "at": ms(clock.now.addingTimeInterval(7200))])
        XCTAssertEqual(failure(late)?.0, .internalError, "a clock set back must not stretch the budget")
    }

    func testRejectsABudgetThatIsNotAPositiveNumber() async {
        let (center, clock, dispatcher) = fixture()
        for bad: JSONValue in [.number(0), .number(-5), .string("120000"), .bool(true)] {
            let reply = await schedule(dispatcher, ["title": .string("A"), "budgetMs": bad,
                                                    "at": ms(clock.now.addingTimeInterval(60))])
            XCTAssertEqual(failure(reply)?.0, .invalidParams, "\(bad)")
        }
        XCTAssertTrue(center.scheduled.isEmpty)
    }

    /// The reminder was for ten seconds from now; the person took twenty to
    /// allow it. They asked for it and allowed it, so it fires now, not never.
    func testAOneOffWhoseTimePassedDuringThePromptFiresAtOnce() async {
        let (center, clock, dispatcher) = fixture()
        center.stored = .notDetermined
        center.whilePrompting = { clock.advance(20) }
        let reply = await schedule(dispatcher, ["title": .string("A"), "at": ms(clock.now.addingTimeInterval(10))])
        XCTAssertNotNil(result(reply))
        XCTAssertEqual(center.scheduled.first?.1, .after(seconds: 1))
    }

    /// A daily reminder starts at its next time of day, today if that has
    /// not passed, even when `at` is next week. Documented, not a bug: iOS has
    /// no start date for a repeating trigger.
    func testADailyReminderWithAFutureDateStillUsesOnlyItsTimeOfDay() async {
        let (center, clock, dispatcher) = fixture()
        let nextWeekAtEight = utcCalendar.date(bySettingHour: 8, minute: 0, second: 0,
                                               of: clock.now.addingTimeInterval(7 * 86_400))!
        _ = await schedule(dispatcher, ["title": .string("A"), "at": ms(nextWeekAtEight), "repeat": .string("daily")])
        XCTAssertEqual(center.scheduled.first?.1,
                       .calendar(DateComponents(hour: 8, minute: 0, second: 0), repeats: true))
    }

    /// A reminder under a second away. A calendar trigger keeps whole seconds
    /// only, so it would name a moment already past and never fire, while the
    /// page was told it exists. Every one-off is an interval instead.
    func testAOneOffUnderASecondAwayIsAnIntervalNotACalendarMoment() async {
        let (center, clock, dispatcher) = fixture()
        clock.advance(0.2)
        let reply = await schedule(dispatcher, ["title": .string("A"), "at": ms(clock.now.addingTimeInterval(0.3))])
        XCTAssertNotNil(result(reply))
        guard case let .after(seconds)? = center.scheduled.first?.1 else {
            return XCTFail("expected an interval trigger, got \(String(describing: center.scheduled.first?.1))")
        }
        XCTAssertGreaterThan(seconds, 0)
    }

    func testASystemRefusalIsAnInternalError() async {
        let (center, clock, dispatcher) = fixture()
        center.refuses = true
        let reply = await schedule(dispatcher, ["title": .string("A"), "at": ms(clock.now.addingTimeInterval(60))])
        XCTAssertEqual(failure(reply)?.0, .internalError)
    }

    func testCancelReachesTheCenterAndAnEmptyIdIsANoOp() async {
        let (center, _, dispatcher) = fixture()
        let one = await dispatcher.handle(BridgeRequest(id: "7", method: .notificationsCancel,
                                                        params: ["id": .string("tea")]))
        let empty = await dispatcher.handle(BridgeRequest(id: "8", method: .notificationsCancel,
                                                          params: ["id": .string("")]))
        XCTAssertEqual(result(one), .null)
        XCTAssertEqual(result(empty), .null)
        XCTAssertEqual(center.canceled, ["tea"])
    }

    func testCancelRejectsAMissingOrNonStringId() async {
        let (_, _, dispatcher) = fixture()
        for params: [String: JSONValue] in [[:], ["id": .number(3)]] {
            let reply = await dispatcher.handle(BridgeRequest(id: "7", method: .notificationsCancel, params: params))
            XCTAssertEqual(failure(reply)?.0, .invalidParams)
        }
    }
}

final class PermissionScopeTests: XCTestCase {
    func testBadgingAloneAsksForTheBadgeOnly() {
        XCTAssertEqual(PermissionScope.forCapabilities([.badging, .haptics]), [.badge])
    }

    /// The prompt is shown once, so with notifications compiled in, the badge
    /// module must ask for everything notifications need too.
    func testNotificationsAskForAlertsSoundAndTheBadgeFromEitherModule() {
        XCTAssertEqual(PermissionScope.forCapabilities([.notifications]), [.badge, .alert, .sound])
        XCTAssertEqual(PermissionScope.forCapabilities([.badging, .notifications]), [.badge, .alert, .sound])
    }

    func testNoPromptingModuleAsksForNothing() {
        XCTAssertEqual(PermissionScope.forCapabilities([.haptics, .secureStorage]), [])
    }

    /// The shell gives up strictly before the page does, and a short budget
    /// is not all margin.
    func testTheBudgetKeepsAMarginForTheReply() {
        let twoMinutes = ScheduleBudget(duration: .seconds(120))
        XCTAssertTrue(twoMinutes.isStillAwaited(after: .seconds(117)))
        XCTAssertFalse(twoMinutes.isStillAwaited(after: .seconds(118)))
        let oneSecond = ScheduleBudget(duration: .seconds(1))
        XCTAssertTrue(oneSecond.isStillAwaited(after: .milliseconds(500)))
        XCTAssertFalse(oneSecond.isStillAwaited(after: .milliseconds(750)))
        XCTAssertEqual(ScheduleBudget.unstated.duration, .seconds(120))
    }
}

@MainActor
final class SecureStorageDispatchTests: XCTestCase {
    private func fixture() -> (MemorySecureStorage, BridgeDispatcher) {
        let store = MemorySecureStorage()
        return (store, BridgeDispatcher(info: testInfo, secureStorage: store))
    }

    private func call(_ d: BridgeDispatcher, _ method: BridgeMethod,
                      _ params: [String: JSONValue]) async -> BridgeResponse {
        await d.handle(BridgeRequest(id: "7", method: method, params: params))
    }

    func testIsAdvertisedInTheHandshake() {
        let (_, dispatcher) = fixture()
        XCTAssertEqual(dispatcher.capabilities, [.secureStorage])
    }

    /// Two allowed origins write the same key. Each reads back its own value,
    /// and removing one leaves the other: the store is per origin, as the web
    /// fallback is, not one store for the whole app.
    func testTwoOriginsWritingTheSameKeyNeverSeeEachOther() async {
        let (_, dispatcher) = fixture()
        let a = MessageOrigin(scheme: "https", host: "app.example", port: 443)
        let b = MessageOrigin(scheme: "https", host: "login.example", port: 443)
        func call(_ method: BridgeMethod, _ params: [String: JSONValue], from origin: MessageOrigin) async -> BridgeResponse {
            await dispatcher.handle(BridgeRequest(id: "7", method: method, params: params), from: origin)
        }
        _ = await call(.secureStorageSet, ["key": .string("token"), "value": .string("from-a")], from: a)
        let bBefore = await call(.secureStorageGet, ["key": .string("token")], from: b)
        XCTAssertEqual(result(bBefore), .null, "origin B must not read origin A's value")

        _ = await call(.secureStorageSet, ["key": .string("token"), "value": .string("from-b")], from: b)
        let aAfter = await call(.secureStorageGet, ["key": .string("token")], from: a)
        XCTAssertEqual(result(aAfter), .string("from-a"), "origin B must not overwrite origin A's value")

        _ = await call(.secureStorageRemove, ["key": .string("token")], from: b)
        let aLast = await call(.secureStorageGet, ["key": .string("token")], from: a)
        XCTAssertEqual(result(aLast), .string("from-a"), "origin B must not remove origin A's value")
    }

    /// A refusal the same input hits every time is not offered as retryable.
    func testAKeychainRefusalOfTheInputIsInvalidParams() async {
        for status: Int32 in [-50, -25302] {
            let (store, dispatcher) = fixture()
            store.failing = .status(status)
            let reply = await call(dispatcher, .secureStorageSet, ["key": .string("k"), "value": .string("v")])
            XCTAssertEqual(failure(reply)?.0, .invalidParams, "\(status)")
        }
    }

    /// A damaged item is a failure, never `null`: an app reads `null` as
    /// signed out.
    func testADamagedItemIsAnErrorNotNoValue() async {
        let (store, dispatcher) = fixture()
        store.failing = .unreadable
        let reply = await call(dispatcher, .secureStorageGet, ["key": .string("k")])
        XCTAssertEqual(failure(reply)?.0, .internalError)
    }

    func testSetsGetsAndRemoves() async {
        let (store, dispatcher) = fixture()
        let set = await call(dispatcher, .secureStorageSet, ["key": .string("token"), "value": .string("abc")])
        XCTAssertEqual(result(set), .null)
        XCTAssertEqual(store.values, ["token": "abc"])
        let get = await call(dispatcher, .secureStorageGet, ["key": .string("token")])
        XCTAssertEqual(result(get), .string("abc"))
        let remove = await call(dispatcher, .secureStorageRemove, ["key": .string("token")])
        XCTAssertEqual(result(remove), .null)
        XCTAssertEqual(store.values, [:])
    }

    func testAMissingKeyReadsNullAndRemovesCleanly() async {
        let (_, dispatcher) = fixture()
        let get = await call(dispatcher, .secureStorageGet, ["key": .string("nope")])
        XCTAssertEqual(result(get), .null)
        let remove = await call(dispatcher, .secureStorageRemove, ["key": .string("nope")])
        XCTAssertEqual(result(remove), .null)
    }

    func testAnEmptyStringIsAValue() async {
        let (store, dispatcher) = fixture()
        _ = await call(dispatcher, .secureStorageSet, ["key": .string("k"), "value": .string("")])
        XCTAssertEqual(store.values, ["k": ""])
    }

    func testRejectsAMissingEmptyOrNonStringKeyAndANonStringValue() async {
        let (store, dispatcher) = fixture()
        for method in [BridgeMethod.secureStorageGet, .secureStorageSet, .secureStorageRemove] {
            for params: [String: JSONValue] in [[:], ["key": .string("")], ["key": .number(1)]] {
                var withValue = params
                withValue["value"] = .string("v")
                let reply = await call(dispatcher, method, method == .secureStorageSet ? withValue : params)
                XCTAssertEqual(failure(reply)?.0, .invalidParams, "\(method.rawValue) \(params)")
            }
        }
        let noValue = await call(dispatcher, .secureStorageSet, ["key": .string("k"), "value": .number(1)])
        XCTAssertEqual(failure(noValue)?.0, .invalidParams)
        XCTAssertEqual(store.values, [:])
    }

    /// The reply is evaluated in the page, where script can log it, so a
    /// failure names the status and never the key or the value.
    func testAKeychainRefusalIsAnInternalErrorThatLeaksNothing() async {
        let (store, dispatcher) = fixture()
        store.failing = .status(-25308)
        for method in [BridgeMethod.secureStorageGet, .secureStorageSet, .secureStorageRemove] {
            let reply = await call(dispatcher, method, ["key": .string("refreshToken"), "value": .string("s3cret")])
            guard let (code, message) = failure(reply) else { continue }
            XCTAssertEqual(code, .internalError)
            XCTAssertTrue(message.contains("-25308"), message)
            XCTAssertFalse(message.contains("refreshToken"), message)
            XCTAssertFalse(message.contains("s3cret"), message)
        }
    }
}
